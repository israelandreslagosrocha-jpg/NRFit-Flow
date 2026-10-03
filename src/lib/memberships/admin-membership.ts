export const DISCOUNT_PERCENTAGES = [10, 15, 20] as const;
export type DiscountPercentage = (typeof DISCOUNT_PERCENTAGES)[number];

export function isDiscountPercentage(value: number): value is DiscountPercentage {
  return DISCOUNT_PERCENTAGES.includes(value as DiscountPercentage);
}

/**
 * Calcula un descuento en pesos de forma determinista. Los montos CLP no usan
 * decimales: se redondean al peso más cercano antes de llegar a Flow.
 */
export function getDiscountedMonthlyPrice(basePrice: number, discountPercent: DiscountPercentage): number {
  return Math.round(basePrice * (100 - discountPercent) / 100);
}

/**
 * Retorna la siguiente fecha de renovación mensual, conservando el día cuando
 * existe y ajustando al último día válido de meses más cortos (31 ene → 28 feb).
 */
export function nextCalendarMonthDate(isoDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [year, month, day] = isoDate.split('-').map(Number);
  const original = new Date(Date.UTC(year, month - 1, day));
  if (
    original.getUTCFullYear() !== year
    || original.getUTCMonth() !== month - 1
    || original.getUTCDate() !== day
  ) return null;

  const targetMonthStart = new Date(Date.UTC(year, month, 1));
  const lastDayOfTargetMonth = new Date(Date.UTC(
    targetMonthStart.getUTCFullYear(),
    targetMonthStart.getUTCMonth() + 1,
    0
  )).getUTCDate();
  const next = new Date(Date.UTC(
    targetMonthStart.getUTCFullYear(),
    targetMonthStart.getUTCMonth(),
    Math.min(day, lastDayOfTargetMonth)
  ));

  return next.toISOString().slice(0, 10);
}

export function startOfSantiagoDay(date: string): string {
  return `${date}T00:00:00-03:00`;
}
