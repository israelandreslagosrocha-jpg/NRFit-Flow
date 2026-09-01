-- ====================================================================
-- PASO 2: FUNCIONES, TRIGGERS, RPCS Y POLÍTICAS ROW LEVEL SECURITY
-- ====================================================================

-- Asegurar valores de rol si el enum ya existía previamente
ALTER TYPE public.enum_user_role ADD VALUE IF NOT EXISTS 'OWNER';
ALTER TYPE public.enum_user_role ADD VALUE IF NOT EXISTS 'GUARDIAN';

-- 1. HELPER FUNCTIONS BLINDADAS (SECURITY DEFINER + FAIL CLOSED)

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
$func$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

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
$func$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. TRIGGER DE INTEGRIDAD DE ROLE

CREATE OR REPLACE FUNCTION public.check_profile_update_integrity()
RETURNS TRIGGER AS $func$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    IF (current_setting('role', true) != 'service_role' AND public.get_auth_role() IS DISTINCT FROM 'OWNER') THEN
      RAISE EXCEPTION 'UNAUTHORIZED_ROLE_MUTATION: El rol o identidades solo pueden ser alteradas por un OWNER.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_profile_update_integrity ON public.profiles;
CREATE TRIGGER trg_profile_update_integrity
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.check_profile_update_integrity();

-- 3. RPC ADMINISTRATIVA PARA CAMBIO DE ROL RESTRENGIDA A OWNER

CREATE OR REPLACE FUNCTION public.admin_update_user_role(p_target_profile_id UUID, p_new_role public.enum_user_role)
RETURNS VOID AS $func$
BEGIN
  IF public.get_auth_role() IS DISTINCT FROM 'OWNER' THEN
    RAISE EXCEPTION 'FORBIDDEN: Se requieren privilegios de OWNER' USING ERRCODE = '42501';
  END IF;
  
  UPDATE public.profiles SET role = p_new_role WHERE id = p_target_profile_id;
  
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_data)
  VALUES (public.get_auth_profile_id(), 'ROLE_CHANGE', 'profiles', p_target_profile_id, jsonb_build_object('role', p_new_role));
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. RPC ATÓMICA DE RESERVA CON LOCK DE MEMBRESÍA Y DEDUCCIÓN EN LEDGER

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

    SELECT COUNT(*) INTO v_current_capacity
    FROM public.bookings
    WHERE session_id = p_session_id AND status IN ('CONFIRMED', 'WAITLIST');

    IF v_current_capacity >= v_max_capacity THEN
        RAISE EXCEPTION 'SESSION_FULL' USING ERRCODE = '22000';
    END IF;

    -- 5. Validar límite semanal de reservas usando to_char ISO Week
    IF v_max_weekly_reservations IS NOT NULL THEN
        SELECT COUNT(*) INTO v_weekly_bookings_count
        FROM public.bookings b
        JOIN public.sessions s ON b.session_id = s.id
        WHERE (b.student_id = p_student_id OR b.minor_id = p_minor_id)
        AND b.status IN ('CONFIRMED', 'WAITLIST')
        AND to_char(s.session_date, 'IYYY-IW') = to_char(v_target_date, 'IYYY-IW');

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

    RETURN json_build_object('success', true, 'booking_id', v_new_booking_id, 'status', 'CONFIRMED');
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. POLÍTICAS ROW LEVEL SECURITY (RLS) TABLA POR TABLA

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

-- 5.1 Profiles RLS
CREATE POLICY "Lectura de perfiles propios y administradores" ON public.profiles FOR SELECT USING (user_id = auth.uid() OR public.get_auth_role() IN ('ADMIN', 'OWNER'));
CREATE POLICY "Edicion de perfil propio sin tocar role" ON public.profiles FOR UPDATE USING (user_id = auth.uid() OR public.get_auth_role() = 'OWNER');

-- 5.2 Health Assessments RLS (Protección Clínica Estricta: ADMIN DENIED, OWNER AUDITED, COACH VIGENTE)
CREATE POLICY "Alumna lee su propia evaluacion de salud" ON public.health_assessments FOR SELECT USING (student_id IN (SELECT id FROM public.students WHERE profile_id = public.get_auth_profile_id()));
CREATE POLICY "Tutor lee evaluacion de salud de su menor" ON public.health_assessments FOR SELECT USING (minor_id IN (SELECT id FROM public.minors WHERE guardian_profile_id = public.get_auth_profile_id()));
CREATE POLICY "Coach lee evaluaciones de alumnas/menores con membresia ACTIVA asignada" ON public.health_assessments FOR SELECT USING (
    public.get_auth_role() = 'COACH' AND (
        student_id IN (SELECT student_id FROM public.memberships WHERE coach_id IN (SELECT id FROM public.coaches WHERE profile_id = public.get_auth_profile_id()) AND status = 'ACTIVE')
        OR minor_id IN (SELECT minor_id FROM public.memberships WHERE coach_id IN (SELECT id FROM public.coaches WHERE profile_id = public.get_auth_profile_id()) AND status = 'ACTIVE')
    )
);

-- 5.3 Public catalog RLS
CREATE POLICY "Lectura publica de programas activos" ON public.programs FOR SELECT USING (is_active = true OR public.get_auth_role() IN ('ADMIN', 'OWNER'));
CREATE POLICY "Lectura publica de planes activos" ON public.plans FOR SELECT USING (is_active = true OR public.get_auth_role() IN ('ADMIN', 'OWNER'));
