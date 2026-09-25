-- ==============================================================================
-- MIGRACIÓN FASE M-09.3D: RECONCILIADOR MULTIVARIABLE FLOW Y CONCURRENCIA DETERMINISTA
-- Naty Entrenadora - Máquina de Estados, Guarda Anti-Stale e Idempotencia Transaccional
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIÓN DE TABLA: public.memberships (SINCRONIZACIÓN Y TIMESTAMPS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.memberships
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS last_gateway_event_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_memberships_last_gateway_event_at 
    ON public.memberships(last_gateway_event_at);

CREATE INDEX IF NOT EXISTS idx_memberships_updated_at 
    ON public.memberships(updated_at DESC);

-- ------------------------------------------------------------------------------
-- 2. FUNCIÓN RPC ATÓMICA: public.apply_membership_transition_atomic
-- ------------------------------------------------------------------------------
-- Provee serialización atómica (FOR UPDATE), protección contra eventos obsoletos
-- (out-of-order race conditions entre webhooks y cron), detección de no-op
-- para idempotencia estricta y registro atómico en public.security_audit_events.
CREATE OR REPLACE FUNCTION public.apply_membership_transition_atomic(
    p_membership_id UUID,
    p_new_status public.enum_membership_status,
    p_gateway_status VARCHAR(50),
    p_current_period_start TIMESTAMPTZ DEFAULT NULL,
    p_current_period_end TIMESTAMPTZ DEFAULT NULL,
    p_trial_ends_at TIMESTAMPTZ DEFAULT NULL,
    p_gateway_event_at TIMESTAMPTZ DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_actor_profile_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
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
    -- 1. Bloqueo exclusivo de fila para evitar race conditions
    SELECT id, status, gateway_status, current_period_start, current_period_end, trial_ends_at, last_gateway_event_at, trace_id
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

    -- 2. Guarda contra eventos obsoletos (Stale Snapshot Protection)
    -- Si la pasarela ya procesó un evento con timestamp posterior, descartar de forma segura
    IF p_gateway_event_at IS NOT NULL 
       AND v_mem.last_gateway_event_at IS NOT NULL 
       AND p_gateway_event_at < v_mem.last_gateway_event_at THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', 'STALE_EVENT_SKIPPED',
            'membership_id', p_membership_id,
            'previous_status', v_mem.status,
            'current_status', v_mem.status,
            'last_gateway_event_at', v_mem.last_gateway_event_at,
            'attempted_event_at', p_gateway_event_at
        );
    END IF;

    -- 3. Detección de No-Op (Idempotencia pura sin duplicación de auditoría)
    IF v_mem.status = p_new_status
       AND (p_current_period_end IS NULL OR v_mem.current_period_end IS NOT DISTINCT FROM p_current_period_end)
       AND (p_trial_ends_at IS NULL OR v_mem.trial_ends_at IS NOT DISTINCT FROM p_trial_ends_at)
       AND (p_gateway_status IS NULL OR v_mem.gateway_status IS NOT DISTINCT FROM p_gateway_status) THEN
        
        -- Si hay una estampa más reciente del evento, refrescarla sin registrar auditoría de transición
        IF p_gateway_event_at IS NOT NULL AND (v_mem.last_gateway_event_at IS NULL OR p_gateway_event_at > v_mem.last_gateway_event_at) THEN
            UPDATE public.memberships
            SET last_gateway_event_at = p_gateway_event_at,
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

    -- 4. Aplicar transición de estado y fechas efectivas
    UPDATE public.memberships
    SET status = p_new_status,
        gateway_status = COALESCE(p_gateway_status, gateway_status),
        current_period_start = COALESCE(p_current_period_start, current_period_start),
        current_period_end = COALESCE(p_current_period_end, current_period_end),
        trial_ends_at = COALESCE(p_trial_ends_at, trial_ends_at),
        last_gateway_event_at = GREATEST(COALESCE(p_gateway_event_at, now()), COALESCE(v_mem.last_gateway_event_at, '-infinity'::timestamptz)),
        updated_at = now()
    WHERE id = p_membership_id;

    -- 5. Registrar evento de auditoría transaccional únicamente ante cambio real
    v_audit_meta := jsonb_build_object(
        'previous_status', v_mem.status,
        'new_status', p_new_status,
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
        'reason', p_reason
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. PERMISOS Y PRIVILEGIOS MÍNIMOS (DEFENSE-IN-DEPTH)
-- ------------------------------------------------------------------------------
-- Revocar ejecución a roles públicos y de cliente
REVOKE ALL ON FUNCTION public.apply_membership_transition_atomic(UUID, public.enum_membership_status, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_membership_transition_atomic(UUID, public.enum_membership_status, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.apply_membership_transition_atomic(UUID, public.enum_membership_status, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, JSONB) FROM authenticated;

-- Conceder ejecución exclusivamente a service_role
GRANT EXECUTE ON FUNCTION public.apply_membership_transition_atomic(UUID, public.enum_membership_status, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID, JSONB) TO service_role;
