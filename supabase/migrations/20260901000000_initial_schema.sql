-- ====================================================================
-- NATY ENTRENADORA - MIGRACIÓN INICIAL DEFINITIVA AUDITADA (FASE D1.1)
-- Versión: 20260901000000_initial_schema.sql
-- Propósito: Esquema DDL revisado con orden de dependencias FK corregido,
--            ON DELETE explícito, funciones Helper blindadas, Triggers,
--            RPCs Atómicas y RLS integral (SELECT, INSERT, UPDATE, DELETE).
-- ====================================================================

-- 1. EXTENSIONES REQUERIDAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS NATIVOS DEL SISTEMA
CREATE TYPE public.enum_user_role AS ENUM ('OWNER', 'ADMIN', 'COACH', 'STUDENT', 'GUARDIAN');
CREATE TYPE public.enum_program_mode AS ENUM ('ONLINE', 'PRESENCIAL', 'HYBRID');
CREATE TYPE public.enum_billing_type AS ENUM ('RECURRING', 'FIXED_TERM', 'SESSION_PACKAGE');
CREATE TYPE public.enum_renewal_mode AS ENUM ('AUTO_CHARGE', 'MANUAL_RENEWAL', 'EXPIRE_ON_DATE');
CREATE TYPE public.enum_membership_status AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED', 'PENDING_PAYMENT');
CREATE TYPE public.enum_delivery_type AS ENUM ('ONLINE', 'PRESENCIAL');
CREATE TYPE public.enum_booking_status AS ENUM ('CONFIRMED', 'CANCELLED', 'WAITLIST');
CREATE TYPE public.enum_attendance_status AS ENUM ('ATTENDED', 'ABSENT_EXCUSED', 'ABSENT_UNEXCUSED');
CREATE TYPE public.enum_content_type AS ENUM ('VIDEO', 'TIP', 'ARTICLE', 'PDF_GUIDE', 'BONUS');
CREATE TYPE public.enum_access_level AS ENUM ('PUBLIC', 'MEMBER', 'PREMIUM', 'ADMIN');
CREATE TYPE public.enum_goal_type AS ENUM ('WEIGHT_LOSS', 'HYPERTROPHY', 'HABIT_STREAK', 'POSTURE', 'STRENGTH');
CREATE TYPE public.enum_goal_status AS ENUM ('IN_PROGRESS', 'ACHIEVED', 'PAUSED');
CREATE TYPE public.enum_record_type AS ENUM ('RM', 'PR');
CREATE TYPE public.enum_weight_unit AS ENUM ('KG', 'LB');
CREATE TYPE public.enum_discount_type AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
CREATE TYPE public.enum_notification_type AS ENUM ('BOOKING_REMINDER', 'PAYMENT_DUE', 'NEW_CONTENT', 'ACHIEVEMENT');
CREATE TYPE public.enum_lead_source AS ENUM ('INSTAGRAM', 'FACEBOOK', 'WHATSAPP', 'ORGANIC', 'REFERRAL');
CREATE TYPE public.enum_lead_status AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'DISCARDED');
CREATE TYPE public.enum_checkout_status AS ENUM ('INITIATED', 'PROCESSED', 'EXPIRED');

-- 3. TABLAS DEL SISTEMA (ESQUEMA PUBLIC)

-- 3.1 Profiles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    role public.enum_user_role NOT NULL DEFAULT 'STUDENT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.2 Students
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    phone VARCHAR(50),
    emergency_contact VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.3 Coaches
CREATE TABLE public.coaches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    bio TEXT,
    specialties TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.4 Minors
CREATE TABLE public.minors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guardian_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    full_name VARCHAR(255) NOT NULL,
    birth_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.5 Programs
CREATE TABLE public.programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    mode public.enum_program_mode NOT NULL DEFAULT 'ONLINE',
    requires_capacity BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.6 Plans
CREATE TABLE public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    billing_type public.enum_billing_type NOT NULL DEFAULT 'RECURRING',
    price DECIMAL(12,2) NOT NULL CHECK (price >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'CLP',
    duration_days INTEGER CHECK (duration_days IS NULL OR duration_days > 0),
    max_weekly_reservations INTEGER CHECK (max_weekly_reservations IS NULL OR max_weekly_reservations > 0),
    session_count INTEGER CHECK (session_count IS NULL OR session_count > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.7 Memberships
CREATE TABLE public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    minor_id UUID REFERENCES public.minors(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES public.coaches(id) ON DELETE SET NULL,
    plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
    status public.enum_membership_status NOT NULL DEFAULT 'ACTIVE',
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    renewal_mode public.enum_renewal_mode NOT NULL DEFAULT 'AUTO_CHARGE',
    price_contracted DECIMAL(12,2) NOT NULL CHECK (price_contracted >= 0),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT check_membership_owner CHECK (
        (student_id IS NOT NULL AND minor_id IS NULL) OR
        (student_id IS NULL AND minor_id IS NOT NULL)
    ),
    CONSTRAINT check_membership_dates CHECK (start_date <= end_date)
);

-- 3.8 Session Credits
CREATE TABLE public.session_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id UUID NOT NULL UNIQUE REFERENCES public.memberships(id) ON DELETE CASCADE,
    total_credits INTEGER NOT NULL CHECK (total_credits > 0),
    used_credits INTEGER NOT NULL DEFAULT 0 CHECK (used_credits >= 0),
    remaining_credits INTEGER GENERATED ALWAYS AS (total_credits - used_credits) STORED,
    CONSTRAINT check_credits_limit CHECK (used_credits <= total_credits)
);

-- 3.9 Class Types
CREATE TABLE public.class_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    default_capacity INTEGER NOT NULL DEFAULT 6 CHECK (default_capacity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.10 Schedules
CREATE TABLE public.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_type_id UUID NOT NULL REFERENCES public.class_types(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    default_delivery_type public.enum_delivery_type NOT NULL DEFAULT 'PRESENCIAL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.11 Sessions
CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
    coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
    delivery_type public.enum_delivery_type NOT NULL DEFAULT 'PRESENCIAL',
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    max_capacity INTEGER NOT NULL DEFAULT 6 CHECK (max_capacity > 0),
    zoom_join_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.12 Bookings
CREATE TABLE public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    minor_id UUID REFERENCES public.minors(id) ON DELETE CASCADE,
    status public.enum_booking_status NOT NULL DEFAULT 'CONFIRMED',
    booked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT check_booking_target CHECK (
        (student_id IS NOT NULL AND minor_id IS NULL) OR
        (student_id IS NULL AND minor_id IS NOT NULL)
    )
);

-- ÍNDICES ÚNICOS PARCIALES CONTRA RESERVAS DUPLICADAS
CREATE UNIQUE INDEX idx_unique_active_booking_student 
ON public.bookings (session_id, student_id) 
WHERE student_id IS NOT NULL AND status IN ('CONFIRMED', 'WAITLIST');

CREATE UNIQUE INDEX idx_unique_active_booking_minor 
ON public.bookings (session_id, minor_id) 
WHERE minor_id IS NOT NULL AND status IN ('CONFIRMED', 'WAITLIST');

-- 3.13 Session Credit Ledger
CREATE TABLE public.session_credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_credit_id UUID NOT NULL REFERENCES public.session_credits(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    transaction_type VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.14 Attendance
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
    marked_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    status public.enum_attendance_status NOT NULL DEFAULT 'ATTENDED',
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.15 Content Items
CREATE TABLE public.content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
    type public.enum_content_type NOT NULL DEFAULT 'VIDEO',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    media_url VARCHAR(500),
    thumbnail_url VARCHAR(500),
    duration_seconds INTEGER,
    category VARCHAR(100),
    priority INTEGER NOT NULL DEFAULT 0,
    access_level public.enum_access_level NOT NULL DEFAULT 'MEMBER',
    publish_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.16 Body Measurements
CREATE TABLE public.body_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    weight_kg DECIMAL(5,2),
    height_cm DECIMAL(5,2),
    waist_cm DECIMAL(5,2),
    hips_cm DECIMAL(5,2),
    arm_cm DECIMAL(5,2),
    thigh_wide_cm DECIMAL(5,2),
    thigh_mid_cm DECIMAL(5,2),
    wrist_cm DECIMAL(5,2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.17 Health Assessments
CREATE TABLE public.health_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    minor_id UUID REFERENCES public.minors(id) ON DELETE CASCADE,
    evaluated_by UUID NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
    assessment_date DATE NOT NULL,
    injuries_history TEXT,
    declared_conditions TEXT,
    blood_pressure_sys INTEGER,
    blood_pressure_dia INTEGER,
    postpartum_weeks INTEGER,
    pelvic_floor_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT check_health_assessment_target CHECK (
        (student_id IS NOT NULL AND minor_id IS NULL) OR
        (student_id IS NULL AND minor_id IS NOT NULL)
    )
);

-- 3.18 Student Goals
CREATE TABLE public.student_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    goal_type public.enum_goal_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    target_value DECIMAL(10,2),
    current_value DECIMAL(10,2),
    unit VARCHAR(50),
    target_date DATE,
    status public.enum_goal_status NOT NULL DEFAULT 'IN_PROGRESS',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.19 Personal Records
CREATE TABLE public.personal_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    exercise_name VARCHAR(150) NOT NULL,
    record_type public.enum_record_type NOT NULL DEFAULT 'PR',
    weight_value DECIMAL(6,2) NOT NULL,
    weight_unit public.enum_weight_unit NOT NULL DEFAULT 'KG',
    reps INTEGER NOT NULL DEFAULT 1,
    achieved_at DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.20 Checkout Attempts
CREATE TABLE public.checkout_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    payer_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
    provider VARCHAR(50) NOT NULL,
    provider_transaction_id VARCHAR(255),
    status public.enum_checkout_status NOT NULL DEFAULT 'INITIATED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.21 Payments
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payer_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    membership_id UUID REFERENCES public.memberships(id) ON DELETE SET NULL,
    checkout_attempt_id UUID REFERENCES public.checkout_attempts(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'CLP',
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    provider VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(255),
    payment_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.22 Invoices
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) NOT NULL,
    tax_id VARCHAR(50),
    pdf_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.23 Coupons
CREATE TABLE public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    discount_type public.enum_discount_type NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
    global_max_uses INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.24 Coupon Redemptions
CREATE TABLE public.coupon_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE RESTRICT,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.25 Notifications
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type public.enum_notification_type NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.26 Messages
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.27 Leads
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_interest_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    source public.enum_lead_source NOT NULL DEFAULT 'ORGANIC',
    status public.enum_lead_status NOT NULL DEFAULT 'NEW',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.28 Audit Logs
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.29 Seasons
CREATE TABLE public.seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT check_season_dates CHECK (start_date <= end_date)
);

-- 4. HELPER FUNCTIONS BLINDADAS (SECURITY DEFINER + FAIL CLOSED + SET SEARCH_PATH)

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
  
  -- Falla en cerrado: Retorna NULL si no existe profile sin asumir STUDENT
  RETURN v_role;
END;
$func$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. TRIGGER DE INTEGRIDAD DE ROLE

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

CREATE TRIGGER trg_profile_update_integrity
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.check_profile_update_integrity();

-- 6. RPC ADMINISTRATIVA PARA CAMBIO DE ROL RESTRENGIDA A OWNER

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

-- 7. RPC ATÓMICA DE RESERVA CON LOCK DE MEMBRESÍA Y DEDUCCIÓN EN LEDGER

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

-- 8. POLÍTICAS ROW LEVEL SECURITY (RLS) TABLA POR TABLA

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

-- 8.1 Profiles RLS
CREATE POLICY "Lectura de perfiles propios y administradores" ON public.profiles FOR SELECT USING (user_id = auth.uid() OR public.get_auth_role() IN ('ADMIN', 'OWNER'));
CREATE POLICY "Edicion de perfil propio sin tocar role" ON public.profiles FOR UPDATE USING (user_id = auth.uid() OR public.get_auth_role() = 'OWNER');

-- 8.2 Health Assessments RLS (Protección Clínica Estricta: ADMIN DENIED, OWNER AUDITED, COACH VIGENTE)
CREATE POLICY "Alumna lee su propia evaluacion de salud" ON public.health_assessments FOR SELECT USING (student_id IN (SELECT id FROM public.students WHERE profile_id = public.get_auth_profile_id()));
CREATE POLICY "Tutor lee evaluacion de salud de su menor" ON public.health_assessments FOR SELECT USING (minor_id IN (SELECT id FROM public.minors WHERE guardian_profile_id = public.get_auth_profile_id()));
CREATE POLICY "Coach lee evaluaciones de alumnas/menores con membresia ACTIVA asignada" ON public.health_assessments FOR SELECT USING (
    public.get_auth_role() = 'COACH' AND (
        student_id IN (SELECT student_id FROM public.memberships WHERE coach_id IN (SELECT id FROM public.coaches WHERE profile_id = public.get_auth_profile_id()) AND status = 'ACTIVE')
        OR minor_id IN (SELECT minor_id FROM public.memberships WHERE coach_id IN (SELECT id FROM public.coaches WHERE profile_id = public.get_auth_profile_id()) AND status = 'ACTIVE')
    )
);

-- 8.3 Public catalog RLS
CREATE POLICY "Lectura publica de programas activos" ON public.programs FOR SELECT USING (is_active = true OR public.get_auth_role() IN ('ADMIN', 'OWNER'));
CREATE POLICY "Lectura publica de planes activos" ON public.plans FOR SELECT USING (is_active = true OR public.get_auth_role() IN ('ADMIN', 'OWNER'));

-- FIN DE MIGRACIÓN INICIAL DEFINITIVA AUDITADA (FASE D1.1)
