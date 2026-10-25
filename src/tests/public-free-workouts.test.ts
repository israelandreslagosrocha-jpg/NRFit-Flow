import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FREE_WORKOUTS, PUBLIC_SOCIAL, freeWorkoutEmbed, freeWorkoutThumbnail } from '../lib/public-social.ts';
import { publicWorkoutThumbnail } from '../lib/public-workout-thumbnail.ts';
import { safeConversion, analyticsPage } from '../lib/analytics-policy.ts';
const source = (path: string) => fs.readFileSync(new URL('../../' + path, import.meta.url), 'utf8');

test('sólo muestra los dos videos públicos verificados y la cuenta correcta', () => {
  assert.deepEqual(FREE_WORKOUTS.map(video => video.id), ['BvZ08hjIF4o', 'jjcmvwv1hP8']);
  assert.equal(PUBLIC_SOCIAL.instagram, 'https://www.instagram.com/nr.fitandflow/');
  assert.match(PUBLIC_SOCIAL.subscribe, /@NRFitandFlow\?sub_confirmation=1$/);
  for (const video of FREE_WORKOUTS) {
    assert.match(video.thumbnail, /^\/images\/free-workouts\//);
    assert.ok(fs.statSync(new URL('../../public' + video.thumbnail, import.meta.url)).size > 1000);
    if (video.playback === 'embedded') assert.match(freeWorkoutEmbed(video.id)!, /^https:\/\/www.youtube-nocookie.com\/embed\//);
    else assert.equal(freeWorkoutEmbed(video.id), null);
  }
  assert.equal(freeWorkoutEmbed('unlisted-private-video'), null);
  assert.equal(freeWorkoutEmbed('jjcmvwv1hP8'), null, 'No mostrar el reproductor que YouTube bloquea para GAP');
  assert.equal(freeWorkoutThumbnail('BvZ08hjIF4o'), '/api/public-workout-thumbnail/BvZ08hjIF4o');
  assert.equal(freeWorkoutThumbnail('https://private.example/image'), null);
});
test('actualiza la portada desde un host fijo sin reenviar datos de la visitante', async () => {
  const response = await publicWorkoutThumbnail('BvZ08hjIF4o', 'https://natyentrenadora.com/api/public-workout-thumbnail/BvZ08hjIF4o', async (url, options) => {
    assert.equal(url, 'https://i.ytimg.com/vi/BvZ08hjIF4o/maxresdefault.jpg');
    assert.equal(options?.cache, 'no-store');
    assert.equal(options?.redirect, 'error');
    assert.equal(options?.headers, undefined);
    assert.ok(options?.signal);
    return new Response(new Uint8Array([255, 216, 255]), { headers: { 'Content-Type': 'image/jpeg' } });
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/jpeg');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=300, s-maxage=900');
  assert.equal((await response.arrayBuffer()).byteLength, 3);
  const section = source('src/components/landing/FreeWorkoutsSection.tsx');
  assert.equal(section.match(/src={freeWorkoutThumbnail\(video.id\)!}/g)?.length, 2);
});
test('rechaza IDs ajenos sin hacer consultas y recurre a calidad estándar si falla HD', async () => {
  let calls = 0;
  const unknown = await publicWorkoutThumbnail('private', 'https://natyentrenadora.com/', async () => { calls++; throw new Error('No debe consultar'); });
  assert.equal(unknown.status, 404);
  assert.equal(calls, 0);
  const urls: string[] = [];
  const result = await publicWorkoutThumbnail('jjcmvwv1hP8', 'https://natyentrenadora.com/', async (url) => {
    urls.push(String(url));
    return urls.length === 1 ? new Response(null, { status: 404 }) : new Response('image', { headers: { 'content-type': 'image/jpeg' } });
  });
  assert.equal(result.status, 200);
  assert.deepEqual(urls, ['https://i.ytimg.com/vi/jjcmvwv1hP8/maxresdefault.jpg', 'https://i.ytimg.com/vi/jjcmvwv1hP8/hqdefault.jpg']);
});
test('fallos, HTML y respuestas vacías usan el respaldo local y se reintentan pronto', async () => {
  for (const fetcher of [
    async () => { throw new Error('Timeout'); },
    async () => new Response('<html>blocked</html>', { headers: { 'content-type': 'text/html' } }),
    async () => new Response(null, { headers: { 'content-type': 'image/jpeg' } }),
    async () => new Response('huge', { headers: { 'content-type': 'image/jpeg', 'content-length': '3000000' } }),
  ]) {
    const result = await publicWorkoutThumbnail('BvZ08hjIF4o', 'https://natyentrenadora.com/', fetcher);
    assert.equal(result.status, 307);
    assert.equal(result.headers.get('location'), 'https://natyentrenadora.com/images/free-workouts/pilates-principiantes.avif');
    assert.equal(result.headers.get('cache-control'), 'public, max-age=60, s-maxage=60');
  }
});
test('los videos se cargan tras acción explícita, no al entrar a la página', () => {
  const section = source('src/components/landing/FreeWorkoutsSection.tsx');
  assert.match(section, /useState<string \| null>\(null\)/);
  assert.match(section, /activeVideo === video.id && video.playback === 'embedded' \? <iframe/);
  assert.match(section, /setActiveVideo\(video.id\)/);
  assert.match(section, /setActiveVideo\(null\)/);
  assert.doesNotMatch(section, /supabase|content_items|student|platform.js|instagram.com\/embed/);
  assert.match(section, /política de privacidad de Google/);
  assert.match(section, /target="_blank" rel="noopener noreferrer"/);
});
test('la muestra está entre Natalia y el funcionamiento, con accesos desde inicio y menú', () => {
  const home = source('src/views/Home.jsx');
  assert.ok(home.indexOf('<NataliaAuthoritySection />') < home.indexOf('<FreeWorkoutsSection />'));
  assert.ok(home.indexOf('<FreeWorkoutsSection />') < home.indexOf('<HowItWorksSection />'));
  assert.match(source('src/components/landing/HeroSection.jsx'), /href="#entrenamientos-gratis"/);
  assert.match(source('src/components/Navbar.jsx'), /\/#entrenamientos-gratis/);
  const footer = source('src/components/Footer.jsx');
  assert.match(footer, /PUBLIC_SOCIAL.instagram/);
  assert.match(footer, /PUBLIC_SOCIAL.subscribe/);
  assert.doesNotMatch(footer, /se agregarán aquí/);
});
test('mide sólo IDs públicos y redes permitidas, nunca confirmaciones de seguimiento ni datos personales', () => {
  assert.deepEqual(safeConversion({ event: 'enrollment_start', placement: 'free_workouts' }), { event: 'enrollment_start', params: { placement: 'free_workouts' } });
  assert.deepEqual(safeConversion({ event: 'social_click', network: 'instagram', email: 'private@example.com' }), { event: 'social_click', params: { network: 'instagram' } });
  assert.deepEqual(safeConversion({ event: 'free_workout_open', video: 'BvZ08hjIF4o', user_id: 'private' }), { event: 'free_workout_open', params: { video: 'BvZ08hjIF4o' } });
  assert.equal(safeConversion({ event: 'free_workout_open', video: 'private@example.com' }), null);
  assert.equal(safeConversion({ event: 'social_click', network: 'private@example.com' }), null);
  assert.equal(safeConversion({ event: 'subscribed', network: 'youtube' }), null);
  assert.equal(analyticsPage('/para-ti', 'natyentrenadora.com'), null);
});
