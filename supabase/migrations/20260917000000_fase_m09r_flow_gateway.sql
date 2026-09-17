-- ==============================================================================
-- MIGRACIÓN FASE M-09R: INTEGRACIÓN PASARELA FLOW CHILE Y DESACOPLAMIENTO MULTI-GATEWAY
-- Naty Entrenadora - Arquitectura Neutra de Pagos (Flow Sandbox / Staging)
-- ==============================================================================

-- 1. Evolución de public.memberships para soporte agnóstico de pasarela
-- NOTA CRÍTICA: NO se define DEFAULT 'FLOW' para evitar sobreescribir ni reetiquetar
-- accidentalmente registros preexistentes de Mercado Pago u otras pasarelas históricas.
ALTER TABLE public.memberships
    ADD COLUMN IF NOT EXISTS gateway VARCHAR(50),
    ADD COLUMN IF NOT EXISTS gateway_customer_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS gateway_plan_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_memberships_gateway ON public.memberships(gateway);
CREATE INDEX IF NOT EXISTS idx_memberships_gateway_customer ON public.memberships(gateway_customer_id);

-- 2. Evolución de public.payment_events para trazabilidad de eventos por pasarela
ALTER TABLE public.payment_events
    ADD COLUMN IF NOT EXISTS gateway VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_payment_events_gateway ON public.payment_events(gateway);

-- 3. Evolución de public.payment_transactions para registro financiero por pasarela
ALTER TABLE public.payment_transactions
    ADD COLUMN IF NOT EXISTS gateway VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway ON public.payment_transactions(gateway);

-- 4. Backfill explícito para proteger la identidad del histórico de Mercado Pago
-- Todos los registros creados durante Fase 2 / M-09.1 se preservan inequívocamente con gateway = 'MERCADOPAGO'.
UPDATE public.memberships
SET gateway = 'MERCADOPAGO'
WHERE gateway IS NULL
  AND (gateway_subscription_id IS NOT NULL OR gateway_status IS NOT NULL);

UPDATE public.payment_events
SET gateway = 'MERCADOPAGO'
WHERE gateway IS NULL;

UPDATE public.payment_transactions
SET gateway = 'MERCADOPAGO'
WHERE gateway IS NULL;
