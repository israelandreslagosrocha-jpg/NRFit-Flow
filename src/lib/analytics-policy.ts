/** Strict allowlists: never send account data, URL parameters or private routes. */
export const ANALYTICS_CONSENT_KEY = 'naty.analytics-consent.v1';
export const TRIAL_EVENT_KEY = 'naty.trial-confirmation.v1';
const publicPages: Record<string, string> = {
  '/': 'Naty Entrenadora · Inicio',
  '/cookies': 'Naty Entrenadora · Cookies',
  '/privacidad': 'Naty Entrenadora · Privacidad',
  '/terminos': 'Naty Entrenadora · Términos',
  '/cancelacion': 'Naty Entrenadora · Cancelación',
  '/auth/register': 'Naty Entrenadora · Registro',
  '/checkout': 'Naty Entrenadora · Prueba gratuita',
  '/checkout/success': 'Naty Entrenadora · Confirmación de prueba',
};
export function analyticsPage(pathname: string, hostname: string) {
  if (!['natyentrenadora.com', 'www.natyentrenadora.com'].includes(hostname)) return null;
  const title = publicPages[pathname];
  return title ? { page_title: title, page_location: `https://natyentrenadora.com${pathname}` } : null;
}
export function validMeasurementId(value: string | undefined) {
  return /^G-[A-Z0-9]{6,}$/.test(value || '');
}
export function safeConversion(detail: unknown): { event: string; params: Record<string, string> } | null {
  if (!detail || typeof detail !== 'object') return null;
  const { event, placement, method } = detail as Record<string, unknown>;
  if (event === 'enrollment_start') {
    const allowed = ['navbar', 'mobile_navigation', 'hero', 'campaign', 'pricing', 'footer', 'final_cta', 'free_workouts'];
    return { event, params: { placement: typeof placement === 'string' && allowed.includes(placement) ? placement : 'unknown' } };
  }
  if (event === 'sign_up' && method === 'email') return { event, params: { method: 'email' } };
  if (event === 'trial_started') return { event, params: {} };
  if (event === 'social_click' && (detail as Record<string, unknown>).network === 'youtube') return { event, params: { network: 'youtube' } };
  if (event === 'social_click' && (detail as Record<string, unknown>).network === 'instagram') return { event, params: { network: 'instagram' } };
  const video = (detail as Record<string, unknown>).video;
  if (event === 'free_workout_open' && (video === 'BvZ08hjIF4o' || video === 'jjcmvwv1hP8')) return { event, params: { video } };
  return null;
}
