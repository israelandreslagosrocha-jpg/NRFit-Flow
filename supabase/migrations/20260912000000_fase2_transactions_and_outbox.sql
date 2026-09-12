-- ==============================================================================
-- MIGRACIÓN FASE 2: MOTOR TRANSACCIONAL, IDEMPOTENCIA Y OUTBOX (M-07)
-- Naty Entrenadora - Mercado Pago Subscriptions Chile
-- ==============================================================================

-- 1. Ampliación de enum_membership_status con TRIAL y PAST_DUE
ALTER TYPE public.enum_membership_status ADD VALUE IF NOT EXISTS 'TRIAL';
ALTER TYPE public.enum_membership_status ADD VALUE IF NOT EXISTS 'PAST_DUE';

-- 2. Evolución de public.memberships para gestión de suscripción y ciclo de vida
ALTER TABLE public.memberships
    ADD COLUMN IF NOT EXISTS gateway_subscription_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS gateway_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_memberships_gateway_sub_id ON public.memberships(gateway_subscription_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON public.memberships(status);

-- 3. Idempotencia Inbound de Webhooks (payment_events)
CREATE TABLE IF NOT EXISTS public.payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway_event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PROCESSED', -- 'PROCESSED', 'ALREADY_PROCESSED', 'FAILED'
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_events_gateway_id ON public.payment_events(gateway_event_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_resource_id ON public.payment_events(resource_id);

-- 4. Registro Financiero Canónico (Idempotencia Financiera Independiente)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id UUID NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
    gateway_payment_id VARCHAR(255) NOT NULL UNIQUE, -- ID Canónico de pago de Mercado Pago
    amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'CLP',
    status VARCHAR(50) NOT NULL, -- 'PENDING', 'APPROVED', 'REJECTED', 'REFUNDED'
    payment_method VARCHAR(50),
    payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway_id ON public.payment_transactions(gateway_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_membership_id ON public.payment_transactions(membership_id);

-- 5. Outbox Asíncrono de Emails Desacoplado
CREATE TABLE IF NOT EXISTS public.email_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dedupe_key VARCHAR(255) NOT NULL UNIQUE,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    template_id VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'SENT', 'FAILED'
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_email_outbox_status ON public.email_outbox(status);
CREATE INDEX IF NOT EXISTS idx_email_outbox_dedupe_key ON public.email_outbox(dedupe_key);

-- 6. Políticas RLS
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own payment transactions"
    ON public.payment_transactions FOR SELECT
    USING (membership_id IN (
        SELECT id FROM public.memberships WHERE student_id = (
            SELECT id FROM public.students WHERE profile_id = auth.uid()
        )
    ));

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
-- payment_events y email_outbox son de uso exclusivo backend (service_role)
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
