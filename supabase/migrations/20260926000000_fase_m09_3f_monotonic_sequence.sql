-- ==============================================================================
-- MIGRACIÓN FASE M-09.3F: SECUENCIA MONOTÓNICA DETERMINISTA POR MEMBRESÍA
-- Naty Entrenadora - Anti Clock-Skew, Secuencia Estricta y Desacoplamiento de Relojes
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIÓN DE TABLA: public.memberships (CONTADOR Y SECUENCIA DE SNAPSHOT)
-- ------------------------------------------------------------------------------
-- Se implementa secuencia monotónica POR MEMBRESÍA para evitar contención global
-- y eliminar la dependencia de timestamps de aplicación ante clock-skew en multi-instancia.
ALTER TABLE public.memberships
    ADD COLUMN IF NOT EXISTS gateway_snapshot_sequence_counter BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_applied_snapshot_sequence BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_memberships_snapshot_sequence 
    ON public.memberships(last_applied_snapshot_sequence);

-- ------------------------------------------------------------------------------
-- 2. FUNCIÓN RPC: public.reserve_gateway_snapshot_sequence
-- ------------------------------------------------------------------------------
-- Emite atómicamente el siguiente número de secuencia para una membresía dada.
-- Cada consulta a Flow o reconciliación reserva su número antes de iniciar la operación.
CREATE OR REPLACE FUNCTION public.reserve_gateway_snapshot_sequence(
    p_membership_id UUID
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_seq BIGINT;
BEGIN
    UPDATE public.memberships
    SET gateway_snapshot_sequence_counter = COALESCE(gateway_snapshot_sequence_counter, 0) + 1,
        updated_at = now()
    WHERE id = p_membership_id
    RETURNING gateway_snapshot_sequence_counter INTO v_seq;

    IF v_seq IS NULL THEN
        RAISE EXCEPTION 'Membership not found for sequence reservation: %', p_membership_id;
    END IF;

    RETURN v_seq;
END;
$$;

-- Permisos mínimos defensivos para reserve_gateway_snapshot_sequence
REVOKE ALL ON FUNCTION public.reserve_gateway_snapshot_sequence(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_gateway_snapshot_sequence(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_gateway_snapshot_sequence(UUID) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_gateway_snapshot_sequence(UUID) TO service_role;

-- ------------------------------------------------------------------------------
-- 3. ACTUALIZACIÓN DE RPC ATÓMICA: public.apply_membership_transition_atomic
-- ------------------------------------------------------------------------------
-- Se elimina la firma anterior sin secuencia para evitar sobrecargas ambiguas.
DROP FUNCTION IF EXISTS public.apply_membership_transition_atomic(
    UUID, public.enum_membership_status, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, JSONB, VARCHAR
);

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
    p_sync_state VARCHAR(20) DEFAULT 'HEALTHY',
    p_snapshot_sequence BIGINT DEFAULT NULL
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
           last_gateway_snapshot_request_started_at, gateway_sync_state, trace_id,
           gateway_snapshot_sequence_counter, last_applied_snapshot_sequence
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

    -- 2. Validación obligatoria de secuencia monotónica en el camino financiero (Anti Clock-Skew)
    -- Prohibición estricta de fallback transparente a timestamp. Cero mutación si falta secuencia.
    IF p_snapshot_sequence IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'MISSING_SNAPSHOT_SEQUENCE',
            'error', 'Snapshot sequence is required for financial transitions'
        );
    END IF;

    -- 3. Guarda contra peticiones obsoletas / fuera de orden (Race Condition Guard)
    -- Si la secuencia asignada es menor o igual a la última secuencia aplicada, descartar
    IF p_snapshot_sequence <= COALESCE(v_mem.last_applied_snapshot_sequence, 0) THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', 'STALE_SNAPSHOT_SKIPPED',
            'membership_id', p_membership_id,
            'previous_status', v_mem.status,
            'current_status', v_mem.status,
            'last_applied_snapshot_sequence', v_mem.last_applied_snapshot_sequence,
            'attempted_snapshot_sequence', p_snapshot_sequence,
            'last_gateway_snapshot_request_started_at', v_mem.last_gateway_snapshot_request_started_at,
            'attempted_snapshot_request_started_at', p_gateway_snapshot_request_started_at
        );
    END IF;

    -- 4. Caso ANOMALY: Gate de falla cerrada persistente sin mutación destructiva del status comercial
    IF p_sync_state = 'ANOMALY' THEN
        UPDATE public.memberships
        SET gateway_sync_state = 'ANOMALY',
            gateway_access_blocked_at = now(),
            gateway_access_block_reason = p_reason,
            last_applied_snapshot_sequence = p_snapshot_sequence,
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
            'reason', p_reason,
            'snapshot_sequence', p_snapshot_sequence
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
            'snapshot_sequence', p_snapshot_sequence,
            'reason', p_reason
        );
    END IF;

    -- 5. Detección de No-Op (Idempotencia pura cuando ya es HEALTHY y estado coincide)
    IF v_mem.status = p_new_status
       AND v_mem.gateway_sync_state = 'HEALTHY'
       AND (p_current_period_end IS NULL OR v_mem.current_period_end IS NOT DISTINCT FROM p_current_period_end)
       AND (p_trial_ends_at IS NULL OR v_mem.trial_ends_at IS NOT DISTINCT FROM p_trial_ends_at)
       AND (p_gateway_status IS NULL OR v_mem.gateway_status IS NOT DISTINCT FROM p_gateway_status) THEN
        
        UPDATE public.memberships
        SET last_applied_snapshot_sequence = p_snapshot_sequence,
            last_gateway_snapshot_request_started_at = GREATEST(
                COALESCE(p_gateway_snapshot_request_started_at, now()), 
                COALESCE(v_mem.last_gateway_snapshot_request_started_at, '-infinity'::timestamptz)
            ),
            updated_at = now()
        WHERE id = p_membership_id;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'NO_CHANGE',
            'membership_id', p_membership_id,
            'current_status', v_mem.status,
            'snapshot_sequence', p_snapshot_sequence
        );
    END IF;

    -- 6. Aplicar transición y restaurar sincronización HEALTHY
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
        last_applied_snapshot_sequence = p_snapshot_sequence,
        last_gateway_snapshot_request_started_at = GREATEST(
            COALESCE(p_gateway_snapshot_request_started_at, now()), 
            COALESCE(v_mem.last_gateway_snapshot_request_started_at, '-infinity'::timestamptz)
        ),
        updated_at = now()
    WHERE id = p_membership_id;

    -- 7. Registrar auditoría transaccional de cambio de estado
    v_audit_meta := jsonb_build_object(
        'previous_status', v_mem.status,
        'new_status', p_new_status,
        'gateway_sync_state', 'HEALTHY',
        'gateway', 'FLOW',
        'reason', p_reason,
        'snapshot_sequence', p_snapshot_sequence
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
        'snapshot_sequence', p_snapshot_sequence,
        'reason', p_reason
    );
END;
$$;

-- Permisos mínimos defensivos para apply_membership_transition_atomic con secuencia
REVOKE ALL ON FUNCTION public.apply_membership_transition_atomic(UUID, public.enum_membership_status, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, JSONB, VARCHAR, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_membership_transition_atomic(UUID, public.enum_membership_status, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, JSONB, VARCHAR, BIGINT) FROM anon;
REVOKE ALL ON FUNCTION public.apply_membership_transition_atomic(UUID, public.enum_membership_status, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, JSONB, VARCHAR, BIGINT) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.apply_membership_transition_atomic(UUID, public.enum_membership_status, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, JSONB, VARCHAR, BIGINT) TO service_role;
