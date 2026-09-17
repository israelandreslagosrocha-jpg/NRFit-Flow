-- ==============================================================================
-- MIGRACIÓN FASE M-09.2: CONCURRENCIA ATÓMICA DE OUTBOX Y LEASE RECOVERY
-- Naty Entrenadora - Hostinger SMTP + PostgreSQL At-Least-Once Delivery
-- ==============================================================================

-- 1. Evolución de la tabla public.email_outbox con soporte de lease y backoff
ALTER TABLE public.email_outbox
    ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS claimed_by VARCHAR(255),
    ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ DEFAULT now();

-- 2. Índices de alta concurrencia para claim y recuperación de lease
CREATE INDEX IF NOT EXISTS idx_email_outbox_claim 
    ON public.email_outbox(status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS idx_email_outbox_lease 
    ON public.email_outbox(status, claimed_at);

-- 3. Tipo de retorno acotado para la RPC de claim
-- (Devuelve únicamente las columnas requeridas para el despacho del correo)
CREATE OR REPLACE FUNCTION public.claim_outbox_emails(
    p_worker_id VARCHAR(255),
    p_batch_size INT DEFAULT 10,
    p_lease_seconds INT DEFAULT 300
)
RETURNS TABLE (
    id UUID,
    dedupe_key VARCHAR(255),
    recipient_email VARCHAR(255),
    subject VARCHAR(255),
    template_id VARCHAR(100),
    payload JSONB,
    attempts INT,
    max_attempts INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_batch INT;
    v_lease INT;
BEGIN
    -- Validación rigurosa de parámetros de entrada
    IF p_worker_id IS NULL OR length(trim(p_worker_id)) = 0 THEN
        RAISE EXCEPTION 'claim_outbox_emails: p_worker_id no puede ser nulo ni vacío';
    END IF;

    v_batch := GREATEST(1, LEAST(COALESCE(p_batch_size, 10), 50));
    v_lease := GREATEST(30, LEAST(COALESCE(p_lease_seconds, 300), 900));

    RETURN QUERY
    WITH candidate_rows AS (
        SELECT o.id
        FROM public.email_outbox o
        WHERE 
            -- Caso 1: Nuevo email pendiente
            (o.status = 'PENDING' AND (o.next_attempt_at IS NULL OR o.next_attempt_at <= now()))
            -- Caso 2: Job abandonado por worker caído (lease timeout)
            OR (o.status = 'PROCESSING' AND o.claimed_at < (now() - (v_lease || ' seconds')::INTERVAL) AND o.attempts < o.max_attempts)
            -- Caso 3: Reintento tras fallo transitorio con backoff cumplido
            OR (o.status = 'FAILED' AND o.attempts < o.max_attempts AND o.next_attempt_at <= now())
        ORDER BY o.created_at ASC
        LIMIT v_batch
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.email_outbox o
    SET 
        status = 'PROCESSING',
        claimed_at = now(),
        claimed_by = trim(p_worker_id),
        -- Incremento atómico al reclamar (attempt_count de intentos iniciados)
        attempts = o.attempts + 1
    FROM candidate_rows c
    WHERE o.id = c.id
    RETURNING 
        o.id,
        o.dedupe_key,
        o.recipient_email,
        o.subject,
        o.template_id,
        o.payload,
        o.attempts,
        o.max_attempts;
END;
$$;

-- 4. Endurecimiento estricto de permisos (Principio de menor privilegio)
-- Revocar ejecución a todo rol público o cliente anónimo/autenticado
REVOKE EXECUTE ON FUNCTION public.claim_outbox_emails(VARCHAR, INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_outbox_emails(VARCHAR, INT, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_outbox_emails(VARCHAR, INT, INT) FROM authenticated;

-- Otorgar ejecución exclusivamente al servicio backend autenticado (service_role)
GRANT EXECUTE ON FUNCTION public.claim_outbox_emails(VARCHAR, INT, INT) TO service_role;
