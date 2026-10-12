/**
 * Prueba aislada en PostgreSQL embebido. Nunca acepta conexiones a Supabase.
 * Instala @electric-sql/pglite en una carpeta temporal y pasa su index.js:
 * PGLITE_MODULE=/ruta/temporal/node_modules/@electric-sql/pglite/dist/index.js node scripts/verify-student-follow-up.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
if (!process.env.PGLITE_MODULE) throw new Error('Se requiere PGLITE_MODULE (PostgreSQL temporal, no una conexión real).');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const actor = '11111111-1111-4111-8111-111111111111';
const profileA = '22222222-2222-4222-8222-222222222222';
const profileB = '33333333-3333-4333-8333-333333333333';
const studentA = '44444444-4444-4444-8444-444444444444';
const studentB = '55555555-5555-4555-8555-555555555555';
const membership = '66666666-6666-4666-8666-666666666666';
const content = '77777777-7777-4777-8777-777777777777';
let checks = 0;
const check = (condition) => { assert.ok(condition); checks++; };
async function rejected(sql, params, message) {
  await assert.rejects(() => db.query(sql, params), message ? new RegExp(message) : undefined); checks++;
}
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY, user_id uuid, role text);
    CREATE TABLE public.students(id uuid PRIMARY KEY, profile_id uuid REFERENCES public.profiles);
    CREATE TABLE public.content_items(id uuid PRIMARY KEY, title text, type text, is_active boolean, media_url text, publish_date date);
    CREATE TABLE public.memberships(id uuid PRIMARY KEY, student_id uuid REFERENCES public.students, price_contracted numeric, status text, gateway_subscription_id text, is_complimentary boolean DEFAULT false, created_at timestamptz DEFAULT now());
    CREATE TABLE public.notifications(id uuid DEFAULT gen_random_uuid(), profile_id uuid, title text, message text, type text);
    CREATE TABLE public.audit_logs(actor_id uuid, action text, entity_type text, entity_id uuid, old_data jsonb, new_data jsonb);
    CREATE TABLE public.payment_transactions(id uuid PRIMARY KEY, amount numeric, status text);
    GRANT SELECT ON profiles, students, content_items TO authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
  `);
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261012000000_student_personal_follow_up.sql', import.meta.url), 'utf8'));
  await db.query('INSERT INTO profiles VALUES ($1,$1,\'OWNER\'),($2,$2,\'STUDENT\'),($3,$3,\'STUDENT\')', [actor, profileA, profileB]);
  await db.query('INSERT INTO students VALUES ($1,$2),($3,$4)', [studentA, profileA, studentB, profileB]);
  await db.query('INSERT INTO memberships(id,student_id,price_contracted,status) VALUES ($1,$2,25000,\'TRIAL\')', [membership, studentA]);
  await db.query('INSERT INTO content_items VALUES ($1,\'Clase de prueba\',\'VIDEO\',true,\'https://youtu.be/abcdefghijk\',NULL)', [content]);
  await db.query('INSERT INTO payment_transactions VALUES ($1,25000,\'APPROVED\')', [membership]);

  const playback = 'SELECT public.record_student_playback($1,$2,$3,$4,$5,$6::jsonb)';
  const play = (start, end, url = 'https://youtu.be/abcdefghijk', duration = 100) => db.query(playback, [studentA, content, url, duration, end, JSON.stringify([[start, end]])]);
  await play(0, 30); await play(0, 30); await play(20, 50);
  let progress = (await db.query('SELECT * FROM student_video_progress')).rows[0];
  check(Number(progress.watched_seconds) === 50); check(progress.completed_at === null);
  await play(50, 90);
  progress = (await db.query('SELECT * FROM student_video_progress')).rows[0];
  check(Number(progress.watched_seconds) === 90); check(progress.completed_at !== null);
  await rejected(playback, [studentA, content, 'https://youtu.be/abcdefghijk', 100, 100, '[[0,100]]'], 'PLAYBACK_BATCH_TOO_LARGE');
  await rejected(playback, [studentA, content, 'https://youtu.be/abcdefghijk', 100, 10, '[[-5,10]]'], 'INVALID_SEGMENT');
  await rejected(playback, [studentA, content, 'https://youtu.be/abcdefghijk', 100, 10, 'null'], 'INVALID_PLAYBACK');
  check(Number((await db.query('SELECT watched_seconds FROM student_video_progress')).rows[0].watched_seconds) === 90);
  await db.query('UPDATE content_items SET media_url = $1 WHERE id = $2', ['https://youtu.be/01234567890', content]);
  await rejected(playback, [studentA, content, 'https://youtu.be/abcdefghijk', 100, 10, '[[0,10]]'], 'CONTENT_UNAVAILABLE');
  await play(0, 10, 'https://youtu.be/01234567890');
  progress = (await db.query('SELECT * FROM student_video_progress')).rows[0];
  check(Number(progress.watched_seconds) === 10); check(progress.completed_at === null);
  await db.query('UPDATE content_items SET is_active = false WHERE id = $1', [content]);
  await rejected(playback, [studentA, content, 'https://youtu.be/01234567890', 100, 10, '[[0,10]]'], 'CONTENT_UNAVAILABLE');

  const note = 'SELECT public.send_student_coach_note($1,$2,$3,$4,$5,$6)';
  await db.query(note, [actor, studentA, 'Para alumna A', 'Contenido personal A', null, true]);
  check((await db.query('SELECT * FROM notifications')).rows.length === 1);
  await db.query(note, [actor, studentB, 'Nota interna B', 'Privado para administración', null, false]);
  check((await db.query('SELECT * FROM notifications')).rows.length === 1);
  await rejected(note, [profileA, studentB, 'No autorizado', 'texto', null, true], 'STAFF_REQUIRED');
  await rejected(note, [actor, studentA, 'Duplicado', 'texto', null, true], 'NOTE_RATE_LIMIT');
  await db.exec("UPDATE student_coach_notes SET created_at = now() - interval '1 minute'");
  await rejected(note, [actor, studentA, 'Enlace inseguro', 'texto', 'javascript:alert(1)', true]);
  check((await db.query('SELECT * FROM notifications')).rows.length === 1);

  const price = 'SELECT public.set_student_monthly_price($1,$2,$3,$4,$5)';
  await db.query(price, [actor, studentA, membership, 25000, 21000]);
  check(Number((await db.query('SELECT price_contracted FROM memberships')).rows[0].price_contracted) === 21000);
  check(Number((await db.query('SELECT amount FROM payment_transactions')).rows[0].amount) === 25000);
  await rejected(price, [actor, studentA, membership, 25000, 25000], 'STALE_MEMBERSHIP');
  await rejected(price, [actor, studentA, membership, 21000, 22000], 'INVALID_PRICE');
  await rejected(price, [profileB, studentA, membership, 21000, 25000], 'STAFF_REQUIRED');
  await db.query("UPDATE memberships SET gateway_subscription_id = 'flow-id' WHERE id = $1", [membership]);
  await rejected(price, [actor, studentA, membership, 21000, 25000], 'FLOW_PRICE_SYNC_REQUIRED');
  await db.query("UPDATE memberships SET gateway_subscription_id = NULL, status = 'PENDING_PAYMENT' WHERE id = $1", [membership]);
  await rejected(price, [actor, studentA, membership, 21000, 25000], 'FLOW_PRICE_SYNC_REQUIRED');
  await db.query("UPDATE memberships SET status = 'ACTIVE', is_complimentary = true WHERE id = $1", [membership]);
  await rejected(price, [actor, studentA, membership, 21000, 25000], 'COMPLIMENTARY_PRICE_BLOCKED');

  await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${profileB}';`);
  check((await db.query('SELECT * FROM student_coach_notes')).rows.length === 0);
  check((await db.query('SELECT * FROM student_video_progress')).rows.length === 0);
  await rejected(note, [actor, studentA, 'Ataque', 'texto', null, true], 'permission denied');
  await rejected(price, [actor, studentA, membership, 21000, 25000], 'permission denied');
  await rejected('INSERT INTO student_coach_notes(student_id,author_profile_id,title,message) VALUES ($1,$2,\'Ataque\',\'texto\')', [studentA, actor], 'permission denied');
  await db.exec(`SET request.jwt.claim.sub = '${profileA}';`);
  check((await db.query('SELECT * FROM student_coach_notes')).rows.length === 1);
  check((await db.query('SELECT * FROM student_video_progress')).rows.length === 1);
  await rejected('UPDATE student_video_progress SET watched_seconds = 999', [], 'permission denied');
  await db.exec('RESET ROLE; SET ROLE anon');
  await rejected('SELECT * FROM student_coach_notes', [], 'permission denied');
  await rejected('SELECT * FROM student_video_progress', [], 'permission denied');
  await db.exec('RESET ROLE');
  console.log(`PostgreSQL aislado: ${checks} comprobaciones correctas. Ninguna conexión a datos reales.`);
} finally { await db.close(); }
