/**
 * Oferta comercial vigente para Team Naty.
 *
 * El valor se resuelve en el servidor usando el calendario de Chile. La fecha
 * de inscripción se guarda posteriormente en `memberships.price_contracted`,
 * por lo que el precio prometido no depende de cuándo termine la prueba.
 */
export const CHILE_TIME_ZONE = 'America/Santiago';
export const PRESALE_LAST_LOCAL_DATE = '2026-10-04';

export type MembershipOfferId = 'PRESALE_2026' | 'REGULAR_2026';

export type MembershipOffer = {
  id: MembershipOfferId;
  monthlyPrice: number;
  isPresale: boolean;
  label: string;
  priceLabel: string;
  detail: string;
};

const PRESALE_OFFER: MembershipOffer = {
  id: 'PRESALE_2026',
  monthlyPrice: 21000,
  isPresale: true,
  label: 'PREVENTA HASTA EL DOMINGO 4 DE OCTUBRE',
  priceLabel: 'PREVENTA',
  detail: 'Inscríbete hasta el domingo 4 de octubre y tu valor mensual queda fijado en $21.000 CLP después de tus 7 días gratis.',
};

const REGULAR_OFFER: MembershipOffer = {
  id: 'REGULAR_2026',
  monthlyPrice: 25000,
  isPresale: false,
  label: 'MEMBRESÍA MENSUAL',
  priceLabel: 'VALOR MENSUAL',
  detail: 'Comienza con 7 días gratis. Después, el valor mensual de tu membresía es $25.000 CLP.',
};

function getChileCalendarDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHILE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  ) as Record<string, string>;

  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * Devuelve la oferta aplicable en el instante de inscripción, con el corte
 * inclusivo del domingo 4 de octubre en horario America/Santiago.
 */
export function getCurrentMembershipOffer(now: Date = new Date()): MembershipOffer {
  return getChileCalendarDate(now) <= PRESALE_LAST_LOCAL_DATE
    ? PRESALE_OFFER
    : REGULAR_OFFER;
}

/**
 * Resuelve la oferta ya contratada. Es esencial para un retorno desde Flow
 * ocurrido después del cambio de campaña: la alumna conserva su precio.
 */
export function getMembershipOfferForPrice(price: number | string | null | undefined): MembershipOffer | null {
  const normalizedPrice = Number(price);

  if (normalizedPrice === PRESALE_OFFER.monthlyPrice) return PRESALE_OFFER;
  if (normalizedPrice === REGULAR_OFFER.monthlyPrice) return REGULAR_OFFER;

  return null;
}

export function formatMembershipPrice(price: number): string {
  return `$${price.toLocaleString('es-CL')} CLP`;
}
