import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  getDiscountedMonthlyPrice,
  nextCalendarMonthDate,
} from '../lib/memberships/admin-membership.ts';

const root = path.resolve(import.meta.dirname, '../..');
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('Controles administrativos de membresía', () => {
  it('calcula renovación por mes calendario y descuentos CLP enteros', () => {
    assert.equal(nextCalendarMonthDate('2026-10-05'), '2026-11-05');
    assert.equal(nextCalendarMonthDate('2027-01-31'), '2027-02-28');
    assert.equal(nextCalendarMonthDate('2028-01-31'), '2028-02-29');
    assert.equal(nextCalendarMonthDate('2026-02-30'), null);
    assert.equal(getDiscountedMonthlyPrice(25000, 10), 22500);
    assert.equal(getDiscountedMonthlyPrice(25000, 15), 21250);
    assert.equal(getDiscountedMonthlyPrice(21000, 20), 16800);
  });

  it('mantiene descuentos y cortesías fuera de la superficie de cliente', () => {
    const migration = source('supabase/migrations/20261003000000_admin_membership_controls.sql');

    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.membership_discounts/);
    assert.match(migration, /ALTER TABLE public\.membership_discounts ENABLE ROW LEVEL SECURITY/);
    assert.match(migration, /idx_membership_discount_one_referral_claim/);
    assert.match(migration, /is_complimentary BOOLEAN NOT NULL DEFAULT false/);
    assert.match(migration, /membership_source IN \('SELF_SERVICE', 'EXTERNAL_PAYMENT', 'COMPLIMENTARY'\)/);
    assert.doesNotMatch(migration, /GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE).*membership_discounts\s+TO\s+authenticated/i);
  });

  it('protege toda mutación del dashboard con requireStaff y conserva Flow separado', () => {
    const actions = source('src/actions/admin-portal.ts');

    for (const action of [
      'recordExternalMembershipPaymentAction',
      'assignComplimentaryMembershipAction',
      'revokeComplimentaryMembershipAction',
      'assignPersonalDiscountAction',
      'createReferralCouponAction',
    ]) {
      assert.match(actions, new RegExp(`export async function ${action}\\(formData: FormData\\) \\{\\s+const staff = await requireStaff\\(\\)`));
    }
    assert.match(actions, /gateway: 'EXTERNAL'/);
    assert.match(actions, /gateway: 'COMPLIMENTARY'/);
    assert.match(actions, /Esta alumna tiene una suscripción Flow vigente o pendiente/);
    assert.match(actions, /EXTERNAL_MEMBERSHIP_PAYMENT_RECORDED/);
  });

  it('reserva códigos para el primer ciclo y evita que Flow aplique la rebaja indefinidamente', () => {
    const checkout = source('src/app/checkout/CheckoutClient.tsx');
    const subscriptions = source('src/actions/subscription.ts');
    const planResolver = source('src/lib/payments/flow/plan.ts');
    const adapter = source('src/lib/payments/flow/adapter.ts');

    assert.match(checkout, /referral_coupon/);
    assert.match(subscriptions, /source: 'REFERRAL'/);
    assert.match(subscriptions, /status: 'RESERVED'/);
    assert.match(subscriptions, /\.eq\('is_active', true\)/);
    assert.match(subscriptions, /Este cupón acaba de ser utilizado/);
    assert.match(subscriptions, /periodsNumber: discountPercent \? 1 : undefined/);
    assert.match(planResolver, /FIRST_CYCLE_PLAN_ID/);
    assert.match(adapter, /periods_number: params\.periodsNumber \?\? 0/);
  });

  it('permite renovar un ciclo pagado terminado sin abrir una segunda prueba', () => {
    const subscriptions = source('src/actions/subscription.ts');
    const gate = source('src/components/ui/MembershipGate.tsx');

    assert.match(subscriptions, /const canRenewExpiredPaidCycle = timing === 'AFTER_TRIAL'/);
    assert.match(subscriptions, /membership\.status === 'EXPIRED'/);
    assert.match(subscriptions, /membership\.status === 'CANCELLED' && periodHasFinished/);
    assert.match(subscriptions, /membership\.status === 'ACTIVE' && periodHasFinished/);
    assert.match(subscriptions, /\.eq\('status', membership\.status\)/);
    assert.match(gate, /const canChooseRenewal = isFinishedFreeTrial \|\| isExpiredPaidMembership/);
    assert.match(gate, /\{canChooseRenewal && \(/);
  });

  it('permite preparar un descuento en una prueba vencida sin aplicarlo a un ciclo ya pagado', () => {
    const actions = source('src/actions/admin-portal.ts');

    assert.match(actions, /\['TRIAL', 'EXPIRED'\]\.includes\(membership\.status\)/);
    assert.match(actions, /let hasApprovedPayment = false/);
    assert.match(actions, /payment_transactions/);
    assert.match(actions, /membership\.discount_status !== 'APPLIED'/);
  });
});
