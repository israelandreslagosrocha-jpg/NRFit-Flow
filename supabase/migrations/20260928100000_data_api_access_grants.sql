-- Data API secure-by-default compatibility
--
-- Desde 2026 Supabase no concede acceso a la Data API para nuevas tablas de
-- public automáticamente. Los clientes de este proyecto usan supabase-js,
-- por lo que necesitan GRANT explícitos además de las políticas RLS.
--
-- Esta migración NO habilita acceso anónimo: la protección por RLS continúa
-- siendo la fuente de verdad para cada fila y service_role sólo se utiliza
-- desde rutas del servidor.

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

-- Superficie que necesita una alumna autenticada para iniciar sesión y usar
-- su portal. RLS limita cada lectura a su propio perfil, membresía y datos.
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.students TO authenticated;
GRANT SELECT ON TABLE public.memberships TO authenticated;
GRANT SELECT ON TABLE public.plans TO authenticated;
GRANT SELECT ON TABLE public.content_items TO authenticated;
GRANT SELECT ON TABLE public.sessions TO authenticated;
GRANT SELECT, UPDATE (is_read) ON TABLE public.notifications TO authenticated;
GRANT SELECT ON TABLE public.body_measurements TO authenticated;

-- Operaciones de confianza del backend: panel de Natalia, pagos, avisos y
-- trabajos programados. Nunca se entrega service_role al navegador.
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.students TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.memberships TO service_role;
GRANT SELECT ON TABLE public.plans TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.content_items TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.sessions TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.coaches TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.notifications TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.body_measurements TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.payment_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.payment_transactions TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.email_outbox TO service_role;
GRANT SELECT, INSERT ON TABLE public.security_audit_events TO service_role;

-- Las RPC financieras y de outbox permanecen exclusivas de rutas servidoras.
GRANT EXECUTE ON FUNCTION public.claim_outbox_emails(VARCHAR, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_gateway_snapshot_sequence(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_membership_transition_atomic(
  UUID,
  public.enum_membership_status,
  VARCHAR,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TEXT,
  UUID,
  JSONB,
  VARCHAR,
  BIGINT
) TO service_role;
