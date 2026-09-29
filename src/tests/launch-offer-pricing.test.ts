import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCurrentMembershipOffer,
  getMembershipOfferForPrice,
} from '../lib/offers/membership-offer.ts';
import { getFlowPlanIdForOffer } from '../lib/payments/flow/plan.ts';

describe('Oferta de lanzamiento Team Naty', () => {
  it('mantiene $21.000 hasta el último minuto local del domingo 4 de octubre', () => {
    // 2026-10-05 02:59:59Z corresponde al 4 de octubre, 23:59:59 en Chile.
    const offer = getCurrentMembershipOffer(new Date('2026-10-05T02:59:59.000Z'));

    assert.equal(offer.id, 'PRESALE_2026');
    assert.equal(offer.monthlyPrice, 21000);
    assert.equal(offer.isPresale, true);
  });

  it('cambia a $25.000 al comenzar el lunes 5 de octubre en Chile', () => {
    // 2026-10-05 03:00:00Z corresponde a las 00:00:00 de Chile.
    const offer = getCurrentMembershipOffer(new Date('2026-10-05T03:00:00.000Z'));

    assert.equal(offer.id, 'REGULAR_2026');
    assert.equal(offer.monthlyPrice, 25000);
    assert.equal(offer.isPresale, false);
  });

  it('reconstruye la oferta contratada por su precio, sin depender de la fecha actual', () => {
    assert.equal(getMembershipOfferForPrice(21000)?.id, 'PRESALE_2026');
    assert.equal(getMembershipOfferForPrice(25000)?.id, 'REGULAR_2026');
    assert.equal(getMembershipOfferForPrice(99999), null);
  });

  it('exige planes Flow específicos en producción para no cobrar el monto equivocado', () => {
    const originalEnv = process.env.FLOW_ENV;
    const originalPresalePlan = process.env.FLOW_PRESALE_PLAN_ID;
    const originalRegularPlan = process.env.FLOW_REGULAR_PLAN_ID;

    try {
      process.env.FLOW_ENV = 'production';
      delete process.env.FLOW_PRESALE_PLAN_ID;
      delete process.env.FLOW_REGULAR_PLAN_ID;

      assert.throws(
        () => getFlowPlanIdForOffer(getMembershipOfferForPrice(21000)!),
        /FLOW_PRESALE_PLAN_ID/
      );

      process.env.FLOW_REGULAR_PLAN_ID = 'team-naty-regular-25k';
      assert.equal(
        getFlowPlanIdForOffer(getMembershipOfferForPrice(25000)!),
        'team-naty-regular-25k'
      );
    } finally {
      if (originalEnv === undefined) delete process.env.FLOW_ENV;
      else process.env.FLOW_ENV = originalEnv;

      if (originalPresalePlan === undefined) delete process.env.FLOW_PRESALE_PLAN_ID;
      else process.env.FLOW_PRESALE_PLAN_ID = originalPresalePlan;

      if (originalRegularPlan === undefined) delete process.env.FLOW_REGULAR_PLAN_ID;
      else process.env.FLOW_REGULAR_PLAN_ID = originalRegularPlan;
    }
  });
});
