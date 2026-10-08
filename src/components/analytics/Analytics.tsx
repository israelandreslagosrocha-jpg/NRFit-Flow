'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { ANALYTICS_CONSENT_KEY, TRIAL_EVENT_KEY, analyticsPage, safeConversion, validMeasurementId } from '../../lib/analytics-policy';
import { hasAnalyticsConsent } from '../../lib/analytics-client';
import './analytics.css';

declare global {
  interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; }
}

const consent = (granted: boolean) => ({
  analytics_storage: granted ? 'granted' : 'denied',
  ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
});

export default function Analytics({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const [choice, setChoice] = useState<'granted' | 'denied' | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [officialHost, setOfficialHost] = useState(false);
  const configured = useRef(false);
  const lastPage = useRef<string | null>(null);
  const currentPath = useRef(pathname);
  currentPath.current = pathname;
  const enabled = validMeasurementId(measurementId) && officialHost;
  const isPublicPage = officialHost && Boolean(analyticsPage(pathname, window.location.hostname));

  useEffect(() => {
    setOfficialHost(Boolean(analyticsPage('/', window.location.hostname)));
    const refresh = () => {
      try {
        const stored = localStorage.getItem(ANALYTICS_CONSENT_KEY);
        setChoice(stored === 'granted' || stored === 'denied' ? stored : null);
      } catch { setChoice('denied'); }
    };
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const allowed = choice === 'granted' && isPublicPage;
    (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = !allowed;
    if (!allowed) {
      window.gtag?.('consent', 'update', consent(false));
      lastPage.current = null;
      return;
    }
    // Basic consent mode: do not download Google scripts at all before opt-in.
    window.dataLayer ||= [];
    window.gtag ||= function (..._args: unknown[]) { window.dataLayer!.push(arguments); };
    if (!configured.current) {
      window.gtag('consent', 'default', consent(false));
      window.gtag('consent', 'update', consent(true));
      window.gtag('js', new Date());
      configured.current = true;
    } else window.gtag('consent', 'update', consent(true));
    const page = analyticsPage(pathname, window.location.hostname)!;
    window.gtag('config', measurementId, {
      send_page_view: false, allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_referrer: '', ...page,
    });
    if (lastPage.current !== pathname) {
      window.gtag('event', 'page_view', { ...page, page_referrer: '' });
      lastPage.current = pathname;
    }
    window.dispatchEvent(new Event('naty:analytics-ready'));
  }, [enabled, choice, pathname, measurementId, isPublicPage]);

  useEffect(() => {
    const conversion = (event: Event) => {
      const page = analyticsPage(currentPath.current, window.location.hostname);
      const safe = safeConversion((event as CustomEvent).detail);
      // Read runtime guards, not the initial render's enabled=false closure.
      // TrialConfirmation can fire while this component finishes hydration.
      const disabled = (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`];
      if (validMeasurementId(measurementId) && hasAnalyticsConsent() && page && safe && !disabled) {
        window.gtag?.('event', safe.event, { ...safe.params, ...page, page_referrer: '' });
      }
    };
    window.addEventListener('naty:conversion', conversion);
    return () => window.removeEventListener('naty:conversion', conversion);
  }, [measurementId]);

  const saveChoice = (granted: boolean) => {
    try { localStorage.setItem(ANALYTICS_CONSENT_KEY, granted ? 'granted' : 'denied'); } catch { granted = false; }
    // Disable immediately, not only after the React render.
    (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = !granted;
    window.gtag?.('consent', 'update', consent(granted));
    if (!granted) {
      try { sessionStorage.removeItem(TRIAL_EVENT_KEY); } catch { /* no storage */ }
      for (const cookie of document.cookie.split(';')) {
        const name = cookie.trim().split('=')[0];
        if (!/^_ga(?:_|$)/.test(name)) continue;
        for (const domain of ['', ';domain=natyentrenadora.com', ';domain=.natyentrenadora.com', `;domain=${window.location.hostname}`]) {
          document.cookie = `${name}=;max-age=0;path=/${domain};SameSite=Lax;Secure`;
        }
      }
    }
    setChoice(granted ? 'granted' : 'denied');
    setPreferencesOpen(false);
  };

  if (!enabled || !isPublicPage) return null;
  return <>
    {choice === 'granted' && <Script id="naty-ga4" src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />}
    {(choice === null || preferencesOpen) ? <section className="analytics-consent" aria-label="Preferencias de medición">
      <div><strong>Tú eliges qué compartes</strong><p>Podemos usar Google Analytics para conocer las visitas y mejorar la inscripción. Es opcional: rechazarlo no cambia tu acceso. No enviamos tu correo, medidas ni datos de tu dashboard. <a href="/cookies">Ver política de cookies</a>.</p></div>
      <div className="analytics-consent-actions"><button type="button" onClick={() => saveChoice(false)}>Solo necesarias</button><button type="button" onClick={() => saveChoice(true)}>Aceptar estadísticas</button></div>
    </section> : <button className="analytics-preferences" type="button" onClick={() => setPreferencesOpen(true)}>Preferencias de cookies</button>}
  </>;
}
