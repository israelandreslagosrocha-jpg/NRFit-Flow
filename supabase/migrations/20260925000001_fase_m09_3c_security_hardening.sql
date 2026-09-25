-- ==============================================================================
-- MIGRACIÓN FASE M-09.3C: SECURITY AUDIT EVENTS & SQL HARDENING
-- Naty Entrenadora - Arquitectura de Seguridad, Menor Privilegio y Trazabilidad
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLA APPEND-ONLY: public.security_audit_events
-- ------------------------------------------------------------------------------
-- Registra eventos administrativos y de seguridad con garantía de menor privilegio.
-- Inmutable desde clientes: Cero permisos de UPDATE y DELETE a todos los roles.
CREATE TABLE IF NOT EXISTS public.security_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    event_type VARCHAR(100) NOT NULL,
    actor_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_type VARCHAR(100),
    target_id VARCHAR(100),
    trace_id VARCHAR(100),
    result VARCHAR(50) NOT NULL, -- e.g. 'SUCCESS', 'DENIED', 'ERROR'
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT chk_audit_metadata_size CHECK (octet_length(metadata::text) <= 8192)
);

-- Índices optimizados para consultas de auditoría
CREATE INDEX IF NOT EXISTS idx_security_audit_events_created_at 
    ON public.security_audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_events_event_type 
    ON public.security_audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_events_actor 
    ON public.security_audit_events(actor_profile_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_events_trace 
    ON public.security_audit_events(trace_id);

-- ------------------------------------------------------------------------------
-- 2. POLÍTICAS DE ACCESO Y PRIVILEGIOS: security_audit_events (DEFENSE-IN-DEPTH)
-- ------------------------------------------------------------------------------
-- Habilitar RLS obligatorio
ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;

-- Revocación exhaustiva de privilegios por defecto (Fail-closed)
REVOKE ALL ON public.security_audit_events FROM PUBLIC;
REVOKE ALL ON public.security_audit_events FROM anon;
REVOKE ALL ON public.security_audit_events FROM authenticated;

-- Conceder ÚNICAMENTE SELECT a authenticated (filtrado estricto por RLS)
GRANT SELECT ON public.security_audit_events TO authenticated;

-- Conceder ÚNICAMENTE SELECT e INSERT a service_role (append-only estricto en DB)
-- PROHIBIDO otorgar UPDATE o DELETE a service_role
GRANT SELECT, INSERT ON public.security_audit_events TO service_role;

-- Política RLS: Solo administradores (ADMIN) y dueños (OWNER) autenticados pueden leer
DROP POLICY IF EXISTS "Admins and owners can view security audit events" ON public.security_audit_events;
CREATE POLICY "Admins and owners can view security audit events"
    ON public.security_audit_events
    FOR SELECT
    TO authenticated
    USING (public.get_auth_role() IN ('ADMIN', 'OWNER'));


-- ------------------------------------------------------------------------------
-- 3. HARDENING FUNCIONAL: public.get_auth_profile_id()
-- ------------------------------------------------------------------------------
-- Helper STABLE SECURITY DEFINER necesario para evaluación RLS sin recursión.
-- Se revoca EXECUTE de PUBLIC y anon; se fija search_path = ''.
CREATE OR REPLACE FUNCTION public.get_auth_profile_id()
RETURNS UUID AS $func$
DECLARE
  v_profile_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT id INTO v_profile_id 
  FROM public.profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
  
  RETURN v_profile_id;
END;
$func$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.get_auth_profile_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_auth_profile_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_auth_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_profile_id() TO service_role;


-- ------------------------------------------------------------------------------
-- 4. HARDENING FUNCIONAL: public.get_auth_role()
-- ------------------------------------------------------------------------------
-- Helper STABLE SECURITY DEFINER para consultar rol en user_roles sin recursión.
-- Se revoca EXECUTE de PUBLIC y anon; se fija search_path = ''.
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS public.enum_user_role AS $func$
DECLARE
  v_role public.enum_user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT role INTO v_role 
  FROM public.profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
  
  RETURN v_role;
END;
$func$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.get_auth_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_auth_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO service_role;


-- ------------------------------------------------------------------------------
-- 5. HARDENING FUNCIONAL: public.check_profile_update_integrity()
-- ------------------------------------------------------------------------------
-- Función TRIGGER de integridad. No es un RPC.
-- Se revoca EXECUTE de PUBLIC, anon y authenticated para eliminar superficie directa.
-- Se fija search_path = ''.
CREATE OR REPLACE FUNCTION public.check_profile_update_integrity()
RETURNS TRIGGER AS $func$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    IF (pg_catalog.current_setting('role', true) != 'service_role' AND public.get_auth_role() IS DISTINCT FROM 'OWNER') THEN
      RAISE EXCEPTION 'UNAUTHORIZED_ROLE_MUTATION: El rol o identidades solo pueden ser alteradas por un OWNER.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Revocar superficie RPC innecesaria (la función se ejecuta exclusivamente vía trigger de tabla)
REVOKE EXECUTE ON FUNCTION public.check_profile_update_integrity() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_profile_update_integrity() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_profile_update_integrity() FROM authenticated;


-- ------------------------------------------------------------------------------
-- 6. HARDENING CRÍTICO: public.admin_update_user_role(UUID, public.enum_user_role)
-- ------------------------------------------------------------------------------
-- RPC Administrativa para elevación/mutación de roles.
-- 1. Exige strictly rol OWNER.
-- 2. Transaccional fail-closed: Si la inserción en security_audit_events falla,
--    la mutación de rol en profiles se revierte automáticamente (ROLLBACK).
-- 3. Se revoca EXECUTE de PUBLIC y anon.
-- 4. Se fija search_path = ''.
CREATE OR REPLACE FUNCTION public.admin_update_user_role(p_target_profile_id UUID, p_new_role public.enum_user_role)
RETURNS VOID AS $func$
DECLARE
  v_actor_profile_id UUID;
BEGIN
  -- Verificación de autorización de máxima seguridad
  IF public.get_auth_role() IS DISTINCT FROM 'OWNER' THEN
    RAISE EXCEPTION 'FORBIDDEN: Se requieren privilegios de OWNER' USING ERRCODE = '42501';
  END IF;

  v_actor_profile_id := public.get_auth_profile_id();
  
  -- Modificación de rol del usuario destino
  UPDATE public.profiles 
  SET role = p_new_role 
  WHERE id = p_target_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TARGET_PROFILE_NOT_FOUND: El perfil especificado no existe' USING ERRCODE = 'P0002';
  END IF;
  
  -- Inserción en registro de auditoría general (legacy)
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_data)
  VALUES (
    v_actor_profile_id,
    'ROLE_CHANGE',
    'profiles',
    p_target_profile_id,
    pg_catalog.jsonb_build_object('role', p_new_role)
  );

  -- Inserción transaccional obligatoria en security_audit_events
  -- (Cualquier fallo o violación de constraint aquí aborta la transacción y revierte el UPDATE de perfil)
  INSERT INTO public.security_audit_events (
    event_type,
    actor_profile_id,
    target_type,
    target_id,
    result,
    metadata
  )
  VALUES (
    'ADMIN_ROLE_CHANGE',
    v_actor_profile_id,
    'profiles',
    p_target_profile_id::TEXT,
    'SUCCESS',
    pg_catalog.jsonb_build_object('new_role', p_new_role)
  );
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Revocar explícitamente ejecución a PUBLIC y anon
REVOKE EXECUTE ON FUNCTION public.admin_update_user_role(UUID, public.enum_user_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_user_role(UUID, public.enum_user_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(UUID, public.enum_user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(UUID, public.enum_user_role) TO service_role;


-- ------------------------------------------------------------------------------
-- 7. HARDENING FUNCIONAL: public.create_booking_atomic(UUID, UUID, UUID)
-- ------------------------------------------------------------------------------
-- Preserva 100% de la lógica de negocio, validaciones de pertenencia, capacidad,
-- límites semanales, deducción atómica de créditos y registro en ledger.
-- Se revoca EXECUTE de PUBLIC y anon; se fija search_path = ''.
CREATE OR REPLACE FUNCTION public.create_booking_atomic(
    p_session_id UUID,
    p_student_id UUID DEFAULT NULL,
    p_minor_id UUID DEFAULT NULL
)
RETURNS JSON AS $func$
DECLARE
    v_membership_id UUID;
    v_plan_id UUID;
    v_billing_type public.enum_billing_type;
    v_max_weekly_reservations INT;
    v_max_capacity INT;
    v_current_capacity INT;
    v_weekly_bookings_count INT;
    v_session_credit_id UUID;
    v_remaining_credits INT;
    v_new_booking_id UUID;
    v_target_date DATE;
BEGIN
    -- 1. Validaciones iniciales
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
    END IF;

    IF (p_student_id IS NOT NULL AND p_minor_id IS NOT NULL) OR (p_student_id IS NULL AND p_minor_id IS NULL) THEN
        RAISE EXCEPTION 'INVALID_TARGET: Especificar student_id O minor_id' USING ERRCODE = '22000';
    END IF;

    -- 2. Validar pertenencia del target
    IF p_student_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND profile_id = public.get_auth_profile_id()) THEN
            RAISE EXCEPTION 'FORBIDDEN_STUDENT' USING ERRCODE = '42501';
        END IF;
    ELSE
        IF NOT EXISTS (SELECT 1 FROM public.minors WHERE id = p_minor_id AND guardian_profile_id = public.get_auth_profile_id()) THEN
            RAISE EXCEPTION 'FORBIDDEN_MINOR' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 3. LOCK en fila de Memberships para evitar race conditions semanales
    SELECT m.id, m.plan_id, p.billing_type, p.max_weekly_reservations 
    INTO v_membership_id, v_plan_id, v_billing_type, v_max_weekly_reservations
    FROM public.memberships m
    JOIN public.plans p ON m.plan_id = p.id
    WHERE (m.student_id = p_student_id OR m.minor_id = p_minor_id) AND m.status = 'ACTIVE'
    LIMIT 1 FOR UPDATE OF m;

    IF v_membership_id IS NULL THEN
        RAISE EXCEPTION 'NO_ACTIVE_MEMBERSHIP' USING ERRCODE = '22000';
    END IF;

    -- 4. LOCK en fila de Session para validar aforo
    SELECT max_capacity, session_date INTO v_max_capacity, v_target_date
    FROM public.sessions
    WHERE id = p_session_id FOR UPDATE;

    IF v_max_capacity IS NULL THEN
        RAISE EXCEPTION 'SESSION_NOT_FOUND' USING ERRCODE = '22000';
    END IF;

    SELECT pg_catalog.count(*) INTO v_current_capacity
    FROM public.bookings
    WHERE session_id = p_session_id AND status IN ('CONFIRMED', 'WAITLIST');

    IF v_current_capacity >= v_max_capacity THEN
        RAISE EXCEPTION 'SESSION_FULL' USING ERRCODE = '22000';
    END IF;

    -- 5. Validar límite semanal de reservas usando to_char ISO Week
    IF v_max_weekly_reservations IS NOT NULL THEN
        SELECT pg_catalog.count(*) INTO v_weekly_bookings_count
        FROM public.bookings b
        JOIN public.sessions s ON b.session_id = s.id
        WHERE (b.student_id = p_student_id OR b.minor_id = p_minor_id)
        AND b.status IN ('CONFIRMED', 'WAITLIST')
        AND pg_catalog.to_char(s.session_date, 'IYYY-IW') = pg_catalog.to_char(v_target_date, 'IYYY-IW');

        IF v_weekly_bookings_count >= v_max_weekly_reservations THEN
            RAISE EXCEPTION 'WEEKLY_LIMIT_EXCEEDED' USING ERRCODE = '22000';
        END IF;
    END IF;

    -- 6. Manejo de Paquetes de Sesiones y Créditos
    IF v_billing_type = 'SESSION_PACKAGE' THEN
        SELECT id, remaining_credits INTO v_session_credit_id, v_remaining_credits
        FROM public.session_credits
        WHERE membership_id = v_membership_id FOR UPDATE;

        IF v_remaining_credits < 1 THEN
            RAISE EXCEPTION 'NO_CREDITS_AVAILABLE' USING ERRCODE = '22000';
        END IF;

        UPDATE public.session_credits 
        SET used_credits = used_credits + 1 
        WHERE id = v_session_credit_id;
    END IF;

    -- 7. Insertar Reserva
    INSERT INTO public.bookings (session_id, student_id, minor_id, status)
    VALUES (p_session_id, p_student_id, p_minor_id, 'CONFIRMED')
    RETURNING id INTO v_new_booking_id;

    -- 8. Auditoría en Ledger si usó crédito
    IF v_billing_type = 'SESSION_PACKAGE' THEN
        INSERT INTO public.session_credit_ledger (session_credit_id, booking_id, transaction_type, amount)
        VALUES (v_session_credit_id, v_new_booking_id, 'BOOKING_DEDUCTION', -1);
    END IF;

    RETURN pg_catalog.json_build_object('success', true, 'booking_id', v_new_booking_id, 'status', 'CONFIRMED');
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.create_booking_atomic(UUID, UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_booking_atomic(UUID, UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_booking_atomic(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_atomic(UUID, UUID, UUID) TO service_role;


-- ------------------------------------------------------------------------------
-- 8. HARDENING FUNCIONAL: public.claim_outbox_emails(VARCHAR, INT, INT)
-- ------------------------------------------------------------------------------
-- Preserva 100% de la lógica de claim concurrente con FOR UPDATE SKIP LOCKED,
-- exclusividad de service_role, lease recovery, incremento atómico y DEAD_LETTER.
-- Se normaliza a search_path = '' con funciones pg_catalog calificadas.
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
SET search_path = ''
AS $$
DECLARE
    v_batch INT;
    v_lease INT;
BEGIN
    -- Validación rigurosa de parámetros de entrada
    IF p_worker_id IS NULL OR pg_catalog.length(pg_catalog.trim(p_worker_id)) = 0 THEN
        RAISE EXCEPTION 'claim_outbox_emails: p_worker_id no puede ser nulo ni vacío';
    END IF;

    v_batch := pg_catalog.greatest(1, pg_catalog.least(pg_catalog.coalesce(p_batch_size, 10), 50));
    v_lease := pg_catalog.greatest(30, pg_catalog.least(pg_catalog.coalesce(p_lease_seconds, 300), 900));

    RETURN QUERY
    WITH candidate_rows AS (
        SELECT o.id
        FROM public.email_outbox o
        WHERE 
            -- Caso 1: Nuevo email pendiente
            (o.status = 'PENDING' AND (o.next_attempt_at IS NULL OR o.next_attempt_at <= pg_catalog.now()))
            -- Caso 2: Job abandonado por worker caído (lease timeout)
            OR (o.status = 'PROCESSING' AND o.claimed_at < (pg_catalog.now() - (v_lease || ' seconds')::INTERVAL) AND o.attempts < o.max_attempts)
            -- Caso 3: Reintento tras fallo transitorio con backoff cumplido
            OR (o.status = 'FAILED' AND o.attempts < o.max_attempts AND o.next_attempt_at <= pg_catalog.now())
        ORDER BY o.created_at ASC
        LIMIT v_batch
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.email_outbox o
    SET 
        status = 'PROCESSING',
        claimed_at = pg_catalog.now(),
        claimed_by = pg_catalog.trim(p_worker_id),
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

-- Refuerzo de permisos: Exclusividad absoluta de service_role
REVOKE EXECUTE ON FUNCTION public.claim_outbox_emails(VARCHAR, INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_outbox_emails(VARCHAR, INT, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_outbox_emails(VARCHAR, INT, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_outbox_emails(VARCHAR, INT, INT) TO service_role;

-- ------------------------------------------------------------------------------
-- 9. NOTA METODOLÓGICA: public.handle_new_user() -> HARDENING_DEFERRED
-- ------------------------------------------------------------------------------
-- Siguiendo la directriz explícita del usuario, la función trigger public.handle_new_user()
-- NO se muta en esta migración para garantizar la continuidad del registro de alumnas
-- ante la ausencia de un entorno para ejecutar el PRE-TEST/POST-TEST real con Supabase Auth.
-- Estado asignado: HARDENING_DEFERRED (pendiente de verificación con Auth real).
