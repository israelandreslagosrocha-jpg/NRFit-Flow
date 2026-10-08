'use client';

import { ANALYTICS_CONSENT_KEY, TRIAL_EVENT_KEY, analyticsPage, safeConversion } from './analytics-policy';

export function hasAnalyticsConsent() {
  try { return localStorage.getItem(ANALYTICS_CONSENT_KEY) === 'granted'; } catch { return false; }
}

export function emitConversion(detail: unknown) {
  if (!hasAnalyticsConsent() || !analyticsPage(window.location.pathname, window.location.hostname)) return;
  const safe = safeConversion(detail);
  if (safe) window.dispatchEvent(new CustomEvent('naty:conversion', { detail: { event: safe.event, ...safe.params } }));
}

// Only the action that CREATED a trial can leave this marker. No account ID is stored.
export function rememberTrialStarted() {
  if (!hasAnalyticsConsent() || !analyticsPage(window.location.pathname, window.location.hostname)) return;
  try { sessionStorage.setItem(TRIAL_EVENT_KEY, String(Date.now())); } catch { /* Analytics must never interrupt checkout. */ }
}

export function consumeTrialStarted(now = Date.now()) {
  try {
    const stored = sessionStorage.getItem(TRIAL_EVENT_KEY);
    sessionStorage.removeItem(TRIAL_EVENT_KEY);
    if (!hasAnalyticsConsent() || !stored) return false;
    const elapsed = now - Number(stored);
    return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 10 * 60 * 1000;
  } catch { return false; }
}
