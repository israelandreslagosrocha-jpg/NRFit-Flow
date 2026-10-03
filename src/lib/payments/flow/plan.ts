import type { MembershipOffer } from '../../offers/membership-offer.ts';
import type { DiscountPercentage } from '../../memberships/admin-membership.ts';

const FALLBACK_SANDBOX_PLAN_IDS = {
  PRESALE_2026: 'naty-mensual-preventa-21k-v1',
  REGULAR_2026: 'naty-mensual-regular-25k-v1',
} as const;

/**
 * Los dos valores comerciales requieren planes distintos en Flow. En
 * producción no permitimos un fallback al plan legado: hacerlo podría cobrar
 * un importe diferente al que la alumna aceptó en el checkout.
 */
export function getFlowPlanIdForOffer(offer: MembershipOffer): string {
  const dedicatedPlanId = offer.isPresale
    ? process.env.FLOW_PRESALE_PLAN_ID
    : process.env.FLOW_REGULAR_PLAN_ID;

  if (dedicatedPlanId) return dedicatedPlanId;

  if (process.env.FLOW_ENV === 'production') {
    const missingVariable = offer.isPresale ? 'FLOW_PRESALE_PLAN_ID' : 'FLOW_REGULAR_PLAN_ID';
    throw new Error(
      `FLOW_CONFIGURATION_ERROR: ${missingVariable} es obligatorio para cobrar la oferta ${offer.monthlyPrice} CLP en producción.`
    );
  }

  return process.env.FLOW_PLAN_ID || FALLBACK_SANDBOX_PLAN_IDS[offer.id];
}

/**
 * Los descuentos sólo cubren el primer ciclo pagado. Por eso cada uno requiere
 * un plan Flow explícito cuyo importe corresponda exactamente al descuento; la
 * suscripción se crea con periods_number=1 para que nunca se convierta en una
 * rebaja permanente por accidente.
 */
export function getFlowPlanIdForFirstCycleDiscount(
  offer: MembershipOffer,
  discountPercent: DiscountPercentage
): string {
  const campaign = offer.isPresale ? 'PRESALE' : 'REGULAR';
  const variableName = `FLOW_${campaign}_${discountPercent}_FIRST_CYCLE_PLAN_ID`;
  const configuredPlanId = process.env[variableName];

  if (configuredPlanId) return configuredPlanId;

  if (process.env.FLOW_ENV === 'production') {
    throw new Error(
      `FLOW_CONFIGURATION_ERROR: ${variableName} es obligatorio para aplicar el ${discountPercent}% sólo al primer ciclo pagado.`
    );
  }

  return `naty-${offer.isPresale ? 'preventa-21k' : 'regular-25k'}-${discountPercent}pct-primer-ciclo-v1`;
}
