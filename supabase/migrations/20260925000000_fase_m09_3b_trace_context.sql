-- ==============================================================================
-- MIGRACIÓN FASE M-09.3B: TRACE CONTEXT Y CORRELACIÓN DE TRAZABILIDAD
-- Naty Entrenadora - Observabilidad y Auditoría de Extremo a Extremo (trace_id)
-- ==============================================================================

-- 1. Incorporación de trace_id en public.memberships
-- Justificación de persistencia (Requisito M-09.3B.3):
-- memberships es la entidad raíz del ciclo de vida de la suscripción de la alumna
-- que vincula la sesión de checkout inicial con las identidades remotas de la pasarela
-- (gateway_customer_id, gateway_subscription_id).
-- Almacenar trace_id en esta tabla permite reconstruir determinísticamente toda la cadena:
-- trace_id ↔ payment_events ↔ payment_transactions ↔ membership ↔ email_outbox
-- durante callbacks asíncronos sin requerir que Flow soporte ni devuelva metadata arbitraria.
ALTER TABLE public.memberships
    ADD COLUMN IF NOT EXISTS trace_id VARCHAR(100);

-- Índice optimizado para búsquedas por trace_id en auditoría y diagnóstico
CREATE INDEX IF NOT EXISTS idx_memberships_trace_id 
    ON public.memberships(trace_id);
