import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyticsPage, safeConversion, validMeasurementId } from '../lib/analytics-policy.ts';

describe('Analytics — privacidad por defecto', () => {
  it('permite sólo páginas públicas explícitas del dominio oficial', () => {
    assert.ok(analyticsPage('/', 'natyentrenadora.com'));
    assert.ok(analyticsPage('/checkout/success', 'www.natyentrenadora.com'));
    for (const route of ['/admin', '/admin/alumnas', '/para-ti', '/para-ti/zoom/123', '/auth/login', '/auth/callback', '/auth/reset-password', '/auth/onboarding', '/checkout/return', '/unknown']) {
      assert.equal(analyticsPage(route, 'natyentrenadora.com'), null, route);
    }
    for (const host of ['localhost', 'natyentrenadora.com.attacker.test', 'preview.vercel.app']) {
      assert.equal(analyticsPage('/', host), null);
    }
  });
  it('no acepta query strings, hashes ni rutas con datos de cuenta', () => {
    assert.equal(analyticsPage('/?email=someone@example.com', 'natyentrenadora.com'), null);
    assert.equal(analyticsPage('/auth/register#token=secret', 'natyentrenadora.com'), null);
    assert.deepEqual(analyticsPage('/auth/register', 'natyentrenadora.com'), {
      page_title: 'Naty Entrenadora · Registro', page_location: 'https://natyentrenadora.com/auth/register',
    });
  });
  it('acepta únicamente un ID de GA4, nunca HTML ni secretos', () => {
    assert.ok(validMeasurementId('G-SECMNKSV77'));
    for (const id of ['', undefined, 'G-<script>', 'GTM-ABC123', 'someone@example.com']) assert.equal(validMeasurementId(id), false);
  });
  it('elimina campos personales y restringe los valores enviados', () => {
    assert.deepEqual(safeConversion({ event: 'enrollment_start', placement: 'hero', email: 'private@example.com', user_id: 'abc', weight: 60 }), { event: 'enrollment_start', params: { placement: 'hero' } });
    assert.deepEqual(safeConversion({ event: 'enrollment_start', placement: 'private@example.com' }), { event: 'enrollment_start', params: { placement: 'unknown' } });
    assert.deepEqual(safeConversion({ event: 'sign_up', method: 'email', account: 'abc' }), { event: 'sign_up', params: { method: 'email' } });
    assert.deepEqual(safeConversion({ event: 'trial_started', price: 25000 }), { event: 'trial_started', params: {} });
    for (const value of [null, 'anything', { event: 'purchase' }, { event: 'sign_up', method: 'google' }, { event: 'measurements' }]) assert.equal(safeConversion(value), null);
  });
  it('sólo carga el proveedor tras consentimiento y permite detenerlo', () => {
    const source = fs.readFileSync(new URL('../components/analytics/Analytics.tsx', import.meta.url), 'utf8');
    assert.match(source, /choice === 'granted' && <Script/);
    assert.match(source, /ga-disable-/);
    assert.match(source, /send_page_view: false/);
    assert.match(source, /allow_google_signals: false/);
    assert.match(source, /page_referrer: ''/);
    assert.match(source, /ad_user_data: 'denied'/);
    assert.match(source, /hasAnalyticsConsent\(\) && page && safe/);
    assert.match(source, /\[measurementId\]\);/);
    assert.doesNotMatch(source, /if \(enabled && hasAnalyticsConsent/);
  });
  it('el trial se registra sólo tras creación real y confirmación server-side', () => {
    const checkout = fs.readFileSync(new URL('../app/checkout/CheckoutClient.tsx', import.meta.url), 'utf8');
    const confirmation = fs.readFileSync(new URL('../components/analytics/TrialConfirmation.tsx', import.meta.url), 'utf8');
    const client = fs.readFileSync(new URL('../lib/analytics-client.ts', import.meta.url), 'utf8');
    assert.match(checkout, /result.mode === 'FREE_TRIAL'\) rememberTrialStarted/);
    assert.match(confirmation, /isTrial && consumeTrialStarted\(\)/);
    assert.match(client, /sessionStorage.removeItem\(TRIAL_EVENT_KEY\)/);
    assert.match(client, /elapsed < 10 \* 60 \* 1000/);
  });
});
