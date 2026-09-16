-- ==============================================================================
-- MIGRACIÓN FASE M-08: FUNDAMENTOS DE LANZAMIENTO
-- Aprovisionamiento seguro Auth -> profiles -> students, Backfill resiliente,
-- y Políticas RLS estrictas (SELECT exclusivo para alumnas en memberships).
-- ==============================================================================

-- 1. Trigger de aprovisionamiento seguro Auth -> profiles -> students
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_profile_id UUID;
    extracted_full_name TEXT;
BEGIN
    extracted_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1),
        'Alumna'
    );

    INSERT INTO public.profiles (user_id, full_name, role)
    VALUES (
        NEW.id,
        extracted_full_name,
        'STUDENT'
    )
    ON CONFLICT (user_id) DO UPDATE 
        SET updated_at = now()
    RETURNING id INTO new_profile_id;

    -- Solo crear student si el perfil es STUDENT
    INSERT INTO public.students (profile_id, phone)
    VALUES (
        new_profile_id,
        NEW.raw_user_meta_data->>'phone'
    )
    ON CONFLICT (profile_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Backfill seguro e idempotente contemplando nombres faltantes y roles
INSERT INTO public.profiles (user_id, full_name, role)
SELECT 
    u.id,
    COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        split_part(u.email, '@', 1),
        'Alumna'
    ),
    'STUDENT'::public.enum_user_role
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Crear students SOLAMENTE para perfiles con role STUDENT
INSERT INTO public.students (profile_id)
SELECT p.id
FROM public.profiles p
WHERE p.role = 'STUDENT'
AND NOT EXISTS (
    SELECT 1 FROM public.students s WHERE s.profile_id = p.id
)
ON CONFLICT (profile_id) DO NOTHING;

-- 3. Políticas RLS estrictas para students
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own student record" ON public.students;
CREATE POLICY "Students can view own student record"
ON public.students FOR SELECT TO authenticated
USING (
    profile_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Students can update own student record" ON public.students;
CREATE POLICY "Students can update own student record"
ON public.students FOR UPDATE TO authenticated
USING (
    profile_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    profile_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
);

-- 4. Políticas RLS estrictas para memberships
-- ALUMNAS SÓLO SELECT. PROHIBIDO UPDATE DE CLIENTE.
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own memberships" ON public.memberships;
CREATE POLICY "Students can view own memberships"
ON public.memberships FOR SELECT TO authenticated
USING (
    student_id IN (
        SELECT id FROM public.students 
        WHERE profile_id IN (
            SELECT id FROM public.profiles WHERE user_id = auth.uid()
        )
    )
);

-- 5. Actualización preventiva de RLS en payment_transactions
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own payment transactions" ON public.payment_transactions;
CREATE POLICY "Students can view own payment transactions"
ON public.payment_transactions FOR SELECT TO authenticated
USING (
    membership_id IN (
        SELECT id FROM public.memberships WHERE student_id IN (
            SELECT id FROM public.students WHERE profile_id IN (
                SELECT id FROM public.profiles WHERE user_id = auth.uid()
            )
        )
    )
);
