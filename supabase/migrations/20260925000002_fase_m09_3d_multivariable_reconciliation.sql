-- ==============================================================================
-- MIGRACIÓN FASE M-09.3D: RECONCILIADOR MULTIVARIABLE FLOW Y CONCURRENCIA DETERMINISTA
-- Naty Entrenadora - Máquina de Estados, Versionado por Inicio de Request y Fail-Closed Persistente
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIÓN DE TABLA: public.memberships (SINCRONIZACIÓN, GATE DE ACCESO Y TIMESTAMPS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.memberships
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS last_gateway_snapshot_request_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS gateway_sync_state VARCHAR(20) NOT NULL DEFAULT 'HEALTHY',
    ADD COLUMN IF NOT EXISTS gateway_access_blocked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS gateway_access_block_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_memberships_request_started_at 
    ON public.memberships(last_gateway_snapshot_request_started_at);

CREATE INDEX IF NOT EXISTS idx_memberships_gateway_sync_state 
    ON public.memberships(gateway_sync_state);

CREATE INDEX IF NOT EXISTS idx_memberships_updated_at 
    ON public.memberships(updated_at DESC);

-- ------------------------------------------------------------------------------
-- 2. FUNCIÓN RPC ATÓMICA: public.apply_membership_transition_atomic
-- ------------------------------------------------------------------------------
-- Único embudo autorizado de aplicación de estado para callbacks asíncronos y cron.
-- Provee:
-- 1. Serialización atómica (FOR UPDATE)
-- 2. Ordenamiento por inicio de consulta S2S (last_gateway_snapshot_request_started_at)
-- 3. Gate persistente de anomalía (gateway_sync_state = 'ANOMALY') sin destrucción
--    de status comercial (ACTIVE, TRIAL, CANCELLED)
-- 4. Detección de no-op para idempotencia estricta
-- 5. Inserción atómica en public.security_audit_events
CREATE OR REPLACE FUNCTION public.apply_membership_transition_atomic(
    p_membership_id UUID,
    p_new_status public.enum_membership_status,
    p_gateway_status VARCHAR(50),
    p_current_period_start TIMESTAMPTZ DEFAULT NULL,
    p_current_period_end TIMESTAMPTZ DEFAULT NULL,
    p_trial_ends_at TIMESTAMPTZ DEFAULT NULL,
    p_gateway_snapshot_request_started_at TIMESTAMPTZ DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_actor_profile_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_sync_state VARCHAR(20) DEFAULT 'HEALTHY'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_mem RECORD;
    v_audit_meta JSONB;
BEGIN
    -- 1. Bloqueo exclusivo de fila para evitar condiciones de carrera (FOR UPDATE)
    SELECT id, status, gateway_status, current_period_start, current_period_end, trial_ends_at, cancelled_at, 
           last_gateway_snapshot_request_started_at, gateway_sync_state, trace_id
    INTO v_mem
    FROM public.memberships
    WHERE id = p_membership_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'NOT_FOUND',
            'error', 'Membership not found'
        );
    END IF;

    -- 2. Guarda contra peticiones obsoletas / fuera de orden (Race Condition Guard)
    -- Si la petición S2S comenzó antes o al mismo tiempo que el último request aplicado, descartar
    IF p_gateway_snapshot_request_started_at IS NOT NULL 
       AND v_mem.last_gateway_snapshot_request_started_at IS NOT NULL 
       AND p_gateway_snapshot_request_started_at <= v_mem.last_gateway_snapshot_request_started_at THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', 'STALE_SNAPSHOT_SKIPPED',
            'membership_id', p_membership_id,
            'previous_status', v_mem.status,
            'current_status', v_mem.status,
            'last_gateway_snapshot_request_started_at', v_mem.last_gateway_snapshot_request_started_at,
            'attempted_snapshot_request_started_at', p_gateway_snapshot_request_started_at
        );
    END IF;

    -- 3. Caso ANOMALY: Gate de falla cerrada persistente sin mutación destructiva del status comercial
    IF p_sync_state = 'ANOMALY' THEN
        UPDATE public.memberships
        SET gateway_sync_state = 'ANOMALY',
            gateway_access_blocked_at = now(),
            gateway_access_block_reason = p_reason,
            last_gateway_snapshot_request_started_at = GREATEST(
                COALESCE(p_gateway_snapshot_request_started_at, now()), 
                COALESCE(v_mem.last_gateway_snapshot_request_started_at, '-infinity'::timestamptz)
            ),
            updated_at = now()
        WHERE id = p_membership_id;

        v_audit_meta := jsonb_build_object(
            'previous_status', v_mem.status,
            'current_status', v_mem.status,
            'gateway_sync_state', 'ANOMALY',
            'gateway', 'FLOW',
            'reason', p_reason
        ) || COALESCE(p_metadata, '{}'::jsonb);

        INSERT INTO public.security_audit_events (
            event_type,
            actor_profile_id,
            target_type,
            target_id,
            trace_id,
            result,
            metadata
        ) VALUES (
            'MEMBERSHIP_GATEWAY_ANOMALY_BLOCKED',
            p_actor_profile_id,
            'memberships',
            p_membership_id::text,
            v_mem.trace_id,
            'SUCCESS',
            v_audit_meta
        );

        RETURN jsonb_build_object(
            'success', true,
            'status', 'ANOMALY_BLOCKED',
            'membership_id', p_membership_id,
            'current_status', v_mem.status,
            'gateway_sync_state', 'ANOMALY',
            'reason', p_reason
        );
    END IF;

    -- 4. Detección de No-Op (Idempotencia pura cuando ya es HEALTHY y estado coincide)
    IF v_mem.status = p_new_status
       AND v_mem.gateway_sync_state = 'HEALTHY'
       AND (p_current_period_end IS NULL OR v_mem.current_period_end IS NOT DISTINCT FROM p_current_period_end)
       AND (p_trial_ends_at IS NULL OR v_mem.trial_ends_at IS NOT DISTINCT FROM p_trial_ends_at)
       AND (p_gateway_status IS NULL OR v_mem.gateway_status IS NOT DISTINCT FROM p_gateway_status) THEN
        
        IF p_gateway_snapshot_request_started_at IS NOT NULL 
           AND (v_mem.last_gateway_snapshot_request_started_at IS NULL OR p_gateway_snapshot_request_started_at > v_mem.last_gateway_snapshot_request_started_at) THEN
            UPDATE public.memberships
            SET last_gateway_snapshot_request_started_at = p_gateway_snapshot_request_started_at,
                updated_at = now()
            WHERE id = p_membership_id;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'NO_CHANGE',
            'membership_id', p_membership_id,
            'current_status', v_mem.status
        );
    END IF;

    -- 5. Aplicar transición y restaurar sincronización HEALTHY
    UPDATE public.memberships
    SET status = p_new_status,
        gateway_status = COALESCE(p_gateway_status, gateway_status),
        gateway_sync_state = 'HEALTHY',
        gateway_access_blocked_at = NULL,
        gateway_access_block_reason = NULL,
        current_period_start = COALESCE(p_current_period_start, current_period_start),
        current_period_end = COALESCE(p_current_period_end, current_period_end),
        trial_ends_at = COALESCE(p_trial_ends_at, trial_ends_at),
        cancelled_at = CASE 
            WHEN p_new_status = 'CANCELLED' AND cancelled_at IS NULL THEN now() 
            ELSE cancelled_at 
        END,
        last_gateway_snapshot_request_started_at = GREATEST(
            COALESCE(p_gateway_snapshot_request_started_at, now()), 
            COALESCE(v_mem.last_gateway_snapshot_request_started_at, '-infinity'::timestamptz)
        ),
        updated_at = now()
    WHERE id = p_membership_id;

    -- 6. Registrar auditoría transaccional de cambio de estado
    v_audit_meta := jsonb_build_object(
        'previous_status', v_mem.status,
        'new_status', p_new_status,
        'gateway_sync_state', 'HEALTHY',
        'gateway', 'FLOW',
        'reason', p_reason
    ) || COALESCE(p_metadata, '{}'::jsonb);

    INSERT INTO public.security_audit_events (
        event_type,
        actor_profile_id,
        target_type,
        target_id,
        trace_id,
        result,
        metadata
    ) VALUES (
        'MEMBERSHIP_STATUS_TRANSITION',
        p_actor_profile_id,
        'memberships',
        p_membership_id::text,
        v_mem.trace_id,
        'SUCCESS',
        v_audit_meta
    );

    RETURN jsonb_build_object(
        'success', true,
        'status', 'TRANSITIONED',
        'membership_id', p_membership_id,
        'previous_status', v_mem.status,
        'new_status', p_new_status,
        'gateway_sync_state', 'HEALTHY',
        'reason', p_reason
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. PERMISOS Y PRIVILEGIOS MÍNIMOS (DEFENSE-IN-DEPTH)
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.apply_membership_transition_atomic(UUID, public.enum_membership_status, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, JSONB, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_membership_transition_atomic(UUID, public.enum_membership_status, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, JSONB, VARCHAR) FROM anon;
REVOKE ALL ON FUNCTION public.apply_membership_transition_atomic(UUID, public.enum_membership_status, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, JSONB, VARCHAR) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.apply_membership_transition_atomic(UUID, public.enum_membership_status, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, JSONB, VARCHAR) TO service_role;
