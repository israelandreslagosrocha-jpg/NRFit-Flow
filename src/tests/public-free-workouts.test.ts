import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FREE_WORKOUTS, PUBLIC_SOCIAL, freeWorkoutEmbed } from '../lib/public-social.ts';
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
