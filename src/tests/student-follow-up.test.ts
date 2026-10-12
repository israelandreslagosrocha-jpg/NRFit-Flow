import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chileToday, isNegotiatedPrice, observedSegment, validObservation, playbackPercent, youtubeId } from '../lib/student-follow-up.ts';

const root = path.resolve(import.meta.dirname, '../..');
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const observation = { contentId: '11111111-1111-4111-8111-111111111111', mediaUrl: 'https://youtu.be/abcdefghijk', duration: 600, position: 15, segments: [[0, 15]] as Array<[number, number]> };

describe('Acompañamiento personal', () => {
  it('limita los valores acordados a planes ya existentes', () => {
    for (const price of [21000, 25000]) assert.equal(isNegotiatedPrice(price), true);
    for (const price of [0, 22500, 30000, '21000', null, NaN, Infinity]) assert.equal(isNegotiatedPrice(price), false);
  });
  it('sólo observa reproducción continua, no saltos, retrocesos ni pausas largas', () => {
    assert.deepEqual(observedSegment(0.2, 1.2, 1, 1), [0, 1]);
    assert.deepEqual(observedSegment(10, 12, 1, 2), [10, 12]);
    assert.equal(observedSegment(0, 590, 1, 1), null);
    assert.equal(observedSegment(100, 50, 1, 1), null);
    assert.equal(observedSegment(20, 20, 1, 1), null);
    assert.equal(observedSegment(0, 60, 60, 1), null);
    assert.equal(observedSegment(NaN, 60, 1, 1), null);
    assert.equal(observedSegment(10, 12, 1, 8), null);
  });
  it('valida rangos finitos, posición y límites de cada lote de observación', () => {
    assert.equal(validObservation(observation), true);
    for (const override of [
      { contentId: 'otra-alumna' }, { duration: NaN }, { duration: 21601 }, { position: Infinity },
      { position: 601 }, { segments: [[0, 61]] }, { segments: [[0, 601]] },
      { segments: [[5, 3]] }, { segments: [[-1, 10]] }, { segments: [['0', 10]] }, { segments: null },
    ]) assert.equal(validObservation({ ...observation, ...override } as any), false);
    assert.equal(playbackPercent({ duration_seconds: 100, watched_seconds: 50 }), 50);
    assert.equal(playbackPercent({ duration_seconds: 100, watched_seconds: 200 }), 100);
  });
  it('mantiene el calendario chileno alrededor de medianoche UTC', () => {
    assert.equal(chileToday(new Date('2026-10-13T01:00:00Z')), '2026-10-12');
  });
  it('acepta sólo IDs y dominios YouTube válidos', () => {
    for (const url of ['https://youtu.be/abcdefghijk', 'https://www.youtube.com/watch?v=abcdefghijk', 'https://youtube.com/shorts/abcdefghijk', 'https://youtube.com/live/abcdefghijk', 'https://www.youtube-nocookie.com/embed/abcdefghijk']) assert.equal(youtubeId(url), 'abcdefghijk');
    for (const url of ['javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=abcdefghijk', 'http://youtu.be/abcdefghijk', 'https://youtube.com/watch?v=x']) assert.equal(youtubeId(url), null);
  });
  it('autentica staff y deriva la alumna desde sesión, no desde IDs del navegador', () => {
    const actions = source('src/actions/student-follow-up.ts');
    assert.match(actions, /auth\.auth\.getUser\(\)/);
    assert.match(actions, /\['ADMIN', 'OWNER'\]\.includes\(profile\.role\)/);
    assert.match(actions, /getStudentProfileByUserId\(auth, user\.id\)/);
    assert.match(actions, /checkStudentMembershipAccess\(admin, student\.id\)/);
    assert.match(actions, /p_student: student\.id, p_content: input\.contentId/);
    assert.match(actions, /eq\('visible_to_student', true\)/);
    assert.doesNotMatch(actions, /trackAnalytics|trackEvent|gtag|console\.log/);
  });
  it('protege SQL por RLS, une segundos repetidos y preserva pagos anteriores', () => {
    const sql = source('supabase/migrations/20261012000000_student_personal_follow_up.sql');
    assert.match(sql, /visible_to_student AND EXISTS/);
    assert.match(sql, /p\.user_id = auth\.uid\(\)/);
    assert.match(sql, /v_ranges := v_ranges \+ int8multirange/);
    assert.match(sql, /ceil\(p_duration \* 0\.9\)/);
    assert.match(sql, /v_membership\.gateway_subscription_id IS NOT NULL/);
    assert.match(sql, /price_contracted IS DISTINCT FROM p_expected_price/);
    assert.doesNotMatch(sql, /UPDATE public\.payment_transactions|DELETE FROM|SECURITY DEFINER/);
    assert.match(sql, /FROM PUBLIC, anon, authenticated/);
    assert.match(source('src/actions/subscription.ts'), /eq\('price_contracted', membership\.price_contracted\)/);
  });
});
