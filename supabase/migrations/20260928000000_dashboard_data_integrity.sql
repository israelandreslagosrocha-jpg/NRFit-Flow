-- ============================================================================
-- DASHBOARD DATA INTEGRITY
-- Las alumnas pueden leer únicamente sus propias medidas. No se conceden
-- permisos de inserción o modificación directa desde el navegador.
-- ============================================================================

ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own body measurements" ON public.body_measurements;
CREATE POLICY "Students can view own body measurements"
ON public.body_measurements FOR SELECT TO authenticated
USING (
    student_id IN (
        SELECT s.id
        FROM public.students s
        JOIN public.profiles p ON p.id = s.profile_id
        WHERE p.user_id = auth.uid()
    )
);
