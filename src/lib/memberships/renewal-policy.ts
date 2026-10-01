/**
 * Reglas comerciales para el paso de prueba gratuita a membresía pagada.
 *
 * La prueba no registra tarjeta ni crea una suscripción en Flow. Al terminar,
 * la alumna decide de forma explícita cómo quiere continuar. Así el precio
 * queda fijado al inscribirse, pero la modalidad de cobro nunca se infiere.
 */

export const FREE_TRIAL_DAYS = 7;

export type RenewalChoice = 'AUTO_CHARGE' | 'MANUAL_RENEWAL';

export function createFreeTrialWindow(now: Date = new Date()) {
  const trialEndsAt = new Date(now.getTime() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000);

  return {
    startDate: now.toISOString().slice(0, 10),
    endDate: trialEndsAt.toISOString().slice(0, 10),
    trialEndsAt: trialEndsAt.toISOString(),
  };
}

export function isFreeTrialFinished(trialEndsAt: string | null | undefined, now: Date = new Date()) {
  if (!trialEndsAt) return true;

  const parsedTrialEnd = new Date(trialEndsAt);
  return Number.isNaN(parsedTrialEnd.getTime()) || parsedTrialEnd.getTime() <= now.getTime();
}

export function getRenewalSettings(choice: RenewalChoice) {
  return {
    autoRenew: true,
    renewalMode: choice,
    // La prueba ya se consumió. La suscripción que inicia después del trial
    // comienza su ciclo de cobro sin añadir otra semana gratuita.
    flowTrialPeriodDays: 0,
  };
}
