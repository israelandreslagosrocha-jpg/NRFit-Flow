-- =============================================================================
-- CORTESÍAS: VISIBILIDAD DE CONTENIDO Y SESIONES PARA ALUMNAS VIGENTES
--
-- Las cortesías sin fecha de término son membresías legítimas. La policy
-- anterior sólo comprobaba current_period_end/end_date, por lo que ocultaba
-- contenido y agenda a esas alumnas aun cuando el gate de acceso las aceptaba.
-- =============================================================================

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
        OR (
          m.status IN ('ACTIVE', 'CANCELLED')
          AND (
            (
              m.is_complimentary = true
              AND m.complimentary_revoked_at IS NULL
              AND (m.complimentary_expires_at IS NULL OR m.complimentary_expires_at >= now())
            )
            OR (
              COALESCE(m.is_complimentary, false) = false
              AND COALESCE(m.current_period_end::timestamptz, m.end_date::timestamptz) >= now()
            )
          )
        )
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
        OR (
          m.status IN ('ACTIVE', 'CANCELLED')
          AND (
            (
              m.is_complimentary = true
              AND m.complimentary_revoked_at IS NULL
              AND (m.complimentary_expires_at IS NULL OR m.complimentary_expires_at >= now())
            )
            OR (
              COALESCE(m.is_complimentary, false) = false
              AND COALESCE(m.current_period_end::timestamptz, m.end_date::timestamptz) >= now()
            )
          )
        )
      )
  )
);
