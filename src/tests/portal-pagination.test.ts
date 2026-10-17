import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readAllPortalRows, visiblePortalItems } from '../lib/portal-pagination.ts';
const source = (file: string) => fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8');

test('recupera 13 publicaciones, no 12, y recorre más de 1000', async () => {
  for (const size of [0, 13, 1251]) {
    const all = Array.from({ length: size }, (_, id) => ({ id: String(id) }));
    const rows = await readAllPortalRows(async (from, to) => ({ data: all.slice(from, to + 1), error: null }));
    assert.deepEqual(rows, all);
  }
});
test('continúa si la API devuelve menos filas que el rango solicitado', async () => {
  const all = Array.from({ length: 130 }, (_, id) => ({ id: String(id) }));
  const rows = await readAllPortalRows(async (from) => ({ data: all.slice(from, from + 20), error: null }));
  assert.deepEqual(rows, all);
});
test('un error no se convierte en una biblioteca vacía o parcial', async () => {
  await assert.rejects(readAllPortalRows(async () => ({ data: null, error: new Error('offline') })), /PORTAL_DATA_UNAVAILABLE/);
  let calls = 0;
  await assert.rejects(readAllPortalRows(async () => ({ data: [{ id: 'same' }], error: calls++ > 0 ? new Error('offline') : null })), /PORTAL_DATA_UNAVAILABLE/);
  await assert.rejects(readAllPortalRows(async () => ({ data: [{ id: 'same' }], error: null })), /DID_NOT_ADVANCE/);
});
test('cargar más permite recorrer cada sección y conservar el orden', () => {
  const all = Array.from({ length: 25 }, (_, id) => ({ id: String(id) }));
  assert.equal(visiblePortalItems(all, 6).length, 6);
  assert.equal(visiblePortalItems(all, 12).length, 12);
  assert.deepEqual(visiblePortalItems(all, 30), all);
  const component = source('src/components/student/StudentPortal.tsx');
  for (const section of ['asyncWorkouts', 'liveReplays', 'personalResources', 'notificationItems']) {
    assert.ok(component.includes('ProgressiveItems items={' + section + '}'));
  }
  assert.match(component, /setNotificationItems\(notifications\)/);
  assert.match(component, /visibilitychange/);
});
test('consultas conservan identidad, acceso, filtros y orden estable sin límite total', () => {
  const page = source('src/app/(student)/para-ti/page.tsx');
  assert.match(page, /checkStudentMembershipAccess\(supabase, authorizedStudent.id\)/);
  assert.match(page, /if \(!access.hasAccess\) redirect/);
  assert.match(page, /eq\('profile_id', profile.id\)/);
  assert.match(page, /eq\('is_active', true\)/);
  assert.match(page, /publish_date.lte/);
  assert.match(page, /const today = chileToday\(\)/);
  assert.match(page, /order\('id',/);
  assert.doesNotMatch(page, /\.limit\(12\)|\.limit\(8\)|\.limit\(4\)/);
});
