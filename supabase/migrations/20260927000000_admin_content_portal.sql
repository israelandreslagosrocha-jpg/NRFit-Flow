-- ============================================================================
-- PORTAL OPERATIVO: administración de contenidos, sesiones Zoom y avisos
-- ============================================================================
-- Esta migración deja los datos consumibles de forma segura por el nuevo portal.
-- Las mutaciones administrativas se realizan en el servidor con service_role,
-- después de autenticar y autorizar al usuario staff en la aplicación.

ALTER TABLE public.sessions
    ADD COLUMN IF NOT EXISTS title VARCHAR(255);

-- El correo de facturación se captura desde la cuenta autenticada al iniciar
-- checkout. Permite que callbacks S2S notifiquen a la alumna correcta sin usar
-- direcciones ficticias ni consultar datos personales en logs.
ALTER TABLE public.memberships
    ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_content_items_member_published
    ON public.content_items (is_active, publish_date DESC, priority DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_online_upcoming
    ON public.sessions (delivery_type, session_date, start_time);

CREATE INDEX IF NOT EXISTS idx_notifications_profile_created
    ON public.notifications (profile_id, created_at DESC);

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- La alumna puede ver únicamente material activo/publicado mientras su propia
-- membresía se encuentre vigente. Las acciones de staff no usan esta policy.
DROP POLICY IF EXISTS "Members can view published content" ON public.content_items;
CREATE POLICY "Members can view published content"
ON public.content_items FOR SELECT TO authenticated
USING (
    is_active = true
    AND (publish_date IS NULL OR publish_date <= current_date)
    AND access_level IN ('PUBLIC', 'MEMBER', 'PREMIUM')
    AND EXISTS (
        SELECT 1
        FROM public.memberships m
        JOIN public.students s ON s.id = m.student_id
        WHERE s.profile_id = public.get_auth_profile_id()
          AND m.status IN ('TRIAL', 'ACTIVE', 'CANCELLED')
          AND m.start_date <= current_date
          AND (
              (m.status = 'TRIAL' AND m.trial_ends_at >= now())
              OR (m.status IN ('ACTIVE', 'CANCELLED') AND COALESCE(m.current_period_end::timestamptz, m.end_date::timestamptz) >= now())
          )
    )
);

DROP POLICY IF EXISTS "Members can view upcoming online sessions" ON public.sessions;
CREATE POLICY "Members can view upcoming online sessions"
ON public.sessions FOR SELECT TO authenticated
USING (
    delivery_type = 'ONLINE'
    AND session_date >= current_date
    AND EXISTS (
        SELECT 1
        FROM public.memberships m
        JOIN public.students s ON s.id = m.student_id
        WHERE s.profile_id = public.get_auth_profile_id()
          AND m.status IN ('TRIAL', 'ACTIVE', 'CANCELLED')
          AND m.start_date <= current_date
          AND (
              (m.status = 'TRIAL' AND m.trial_ends_at >= now())
              OR (m.status IN ('ACTIVE', 'CANCELLED') AND COALESCE(m.current_period_end::timestamptz, m.end_date::timestamptz) >= now())
          )
    )
);

DROP POLICY IF EXISTS "Members can view own notifications" ON public.notifications;
CREATE POLICY "Members can view own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (profile_id = public.get_auth_profile_id());

DROP POLICY IF EXISTS "Members can mark own notifications as read" ON public.notifications;
CREATE POLICY "Members can mark own notifications as read"
ON public.notifications FOR UPDATE TO authenticated
USING (profile_id = public.get_auth_profile_id())
WITH CHECK (profile_id = public.get_auth_profile_id());
