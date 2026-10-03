-- =============================================================================
-- CONTROLES ADMINISTRATIVOS DE MEMBRESÍAS Y DESCUENTOS
--
-- Este esquema distingue explícitamente:
--   * pagos externos verificados por el equipo (nunca se hacen pasar por Flow),
--   * cortesías sin medio de pago, revocables o con término definido, y
--   * descuentos de primer ciclo, personales o por invitación.
--
-- Ninguna tabla nueva se expone a clientes. Las mutaciones se ejecutan desde
-- Server Actions autenticadas y con service_role exclusivamente en backend.
-- =============================================================================

-- Una cortesía indefinida no puede representarse de forma honesta con una fecha
-- futura ficticia. Se permite end_date NULL sólo para esos casos; los flujos
-- ordinarios siguen almacenando su fecha de término.
ALTER TABLE public.memberships
  ALTER COLUMN end_date DROP NOT NULL;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS membership_source VARCHAR(30) NOT NULL DEFAULT 'SELF_SERVICE',
  ADD COLUMN IF NOT EXISTS is_complimentary BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS complimentary_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS complimentary_revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discount_percent SMALLINT,
  ADD COLUMN IF NOT EXISTS discount_status VARCHAR(20) NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS discount_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS discount_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discount_applied_at TIMESTAMPTZ;

ALTER TABLE public.memberships
  DROP CONSTRAINT IF EXISTS chk_memberships_source;
ALTER TABLE public.memberships
  ADD CONSTRAINT chk_memberships_source
  CHECK (membership_source IN ('SELF_SERVICE', 'EXTERNAL_PAYMENT', 'COMPLIMENTARY'));

ALTER TABLE public.memberships
  DROP CONSTRAINT IF EXISTS chk_memberships_discount_percent;
ALTER TABLE public.memberships
  ADD CONSTRAINT chk_memberships_discount_percent
  CHECK (discount_percent IS NULL OR discount_percent IN (10, 15, 20));

ALTER TABLE public.memberships
  DROP CONSTRAINT IF EXISTS chk_memberships_discount_status;
ALTER TABLE public.memberships
  ADD CONSTRAINT chk_memberships_discount_status
  CHECK (discount_status IN ('NONE', 'RESERVED', 'APPLIED', 'REVOKED', 'EXPIRED'));

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS external_reference VARCHAR(120);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_payment_reference_once
  ON public.payment_transactions (external_reference)
  WHERE gateway = 'EXTERNAL' AND external_reference IS NOT NULL;

-- Se amplía el cupón legado con su dueño comercial y su vencimiento. La tabla
-- sigue siendo útil para códigos compartibles; el estado por alumna vive en la
-- tabla siguiente para no mezclarlo con transacciones del sistema antiguo.
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS issued_to_student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS issued_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'REFERRAL',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_paid_cycle_only BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.coupons
  DROP CONSTRAINT IF EXISTS chk_coupons_scope;
ALTER TABLE public.coupons
  ADD CONSTRAINT chk_coupons_scope CHECK (scope IN ('REFERRAL'));

CREATE TABLE IF NOT EXISTS public.membership_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES public.memberships(id) ON DELETE CASCADE,
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE RESTRICT,
  source VARCHAR(20) NOT NULL,
  discount_percent SMALLINT NOT NULL CHECK (discount_percent IN (10, 15, 20)),
  applies_to VARCHAR(30) NOT NULL DEFAULT 'FIRST_PAID_CYCLE',
  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
  expires_at TIMESTAMPTZ,
  assigned_by_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  applied_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_membership_discounts_source CHECK (source IN ('PERSONAL', 'REFERRAL')),
  CONSTRAINT chk_membership_discounts_scope CHECK (applies_to = 'FIRST_PAID_CYCLE'),
  CONSTRAINT chk_membership_discounts_status CHECK (status IN ('AVAILABLE', 'RESERVED', 'APPLIED', 'REVOKED', 'EXPIRED')),
  CONSTRAINT chk_referral_discount_has_coupon CHECK ((source = 'PERSONAL' AND coupon_id IS NULL) OR (source = 'REFERRAL' AND coupon_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_membership_discounts_student_status
  ON public.membership_discounts (student_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_membership_discounts_membership
  ON public.membership_discounts (membership_id);

-- Una alumna sólo puede tener un descuento personal pendiente. Las asignaciones
-- aplicadas o revocadas se preservan como historial.
CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_discount_one_open_personal
  ON public.membership_discounts (student_id)
  WHERE source = 'PERSONAL' AND status IN ('AVAILABLE', 'RESERVED');

-- Cada cupón de invitación es de un solo uso. Este índice también resuelve una
-- carrera si dos personas intentan canjear el mismo código al mismo tiempo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_discount_one_referral_claim
  ON public.membership_discounts (coupon_id)
  WHERE source = 'REFERRAL' AND status IN ('RESERVED', 'APPLIED');

ALTER TABLE public.membership_discounts ENABLE ROW LEVEL SECURITY;

-- No se crean policies para anon/authenticated: una alumna jamás puede crear,
-- cambiar o leer descuentos de terceros ni mutar el suyo desde el navegador.
GRANT SELECT, INSERT, UPDATE ON TABLE public.membership_discounts TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.coupons TO service_role;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO service_role;
