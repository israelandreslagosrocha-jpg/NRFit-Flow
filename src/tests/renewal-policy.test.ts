import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_TRIAL_DAYS,
  createFreeTrialWindow,
  getRenewalSettings,
  isFreeTrialFinished,
} from '../lib/memberships/renewal-policy.ts';

describe('renewal policy', () => {
  it('crea una prueba exacta de siete días sin cobro ni renovación automática', () => {
    const start = new Date('2026-10-01T12:00:00.000Z');
    const window = createFreeTrialWindow(start);

    assert.equal(FREE_TRIAL_DAYS, 7);
    assert.equal(window.startDate, '2026-10-01');
    assert.equal(window.endDate, '2026-10-08');
    assert.equal(window.trialEndsAt, '2026-10-08T12:00:00.000Z');
  });

  it('solo permite elegir renovación una vez concluida la prueba', () => {
    const trialEnd = '2026-10-08T12:00:00.000Z';

    assert.equal(isFreeTrialFinished(trialEnd, new Date('2026-10-08T11:59:59.999Z')), false);
    assert.equal(isFreeTrialFinished(trialEnd, new Date('2026-10-08T12:00:00.000Z')), true);
  });

  it('mantiene explícita la elección mensual y nunca otorga un segundo trial', () => {
    assert.deepEqual(getRenewalSettings('MANUAL_RENEWAL'), {
      autoRenew: true,
      renewalMode: 'MANUAL_RENEWAL',
      flowTrialPeriodDays: 0,
    });
    assert.deepEqual(getRenewalSettings('AUTO_CHARGE'), {
      autoRenew: true,
      renewalMode: 'AUTO_CHARGE',
      flowTrialPeriodDays: 0,
    });
  });
});
