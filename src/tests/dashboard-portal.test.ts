/**
 * Contratos del portal que afectan directamente la experiencia de Natalia y
 * de sus alumnas. Son estáticos a propósito: evitan que una maqueta vuelva a
 * introducir datos inventados o enlaces sensibles en un componente cliente.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { isTeamNatyLiveDay } from '../lib/team-naty-schedule.ts';

const projectRoot = path.resolve(import.meta.dirname, '../..');

function source(relativePath: string): string {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('Portal Team Naty — contratos de datos, seguridad y oferta', () => {
  it('limita las clases en vivo a lunes y miércoles', () => {
    assert.strictEqual(isTeamNatyLiveDay('2026-09-28'), true, 'lunes');
    assert.strictEqual(isTeamNatyLiveDay('2026-09-30'), true, 'miércoles');
    assert.strictEqual(isTeamNatyLiveDay('2026-09-29'), false, 'martes');
    assert.strictEqual(isTeamNatyLiveDay('fecha-inválida'), false);
    assert.strictEqual(isTeamNatyLiveDay('2026-02-30'), false);
  });

  it('protege las medidas por RLS y no las sustituye por valores inventados', () => {
    const migration = source('supabase/migrations/20260928000000_dashboard_data_integrity.sql');
    const portal = source('src/components/student/StudentPortal.tsx');

    assert.match(migration, /CREATE POLICY "Students can view own body measurements"/);
    assert.match(migration, /WHERE p\.user_id = auth\.uid\(\)/);
    assert.doesNotMatch(portal, /63\.5|70\.0|82\.0/);
    assert.match(portal, /Aún no has registrado medidas/);
  });

  it('mantiene el enlace Zoom fuera del componente cliente y lo entrega por una ruta protegida', () => {
    const portal = source('src/components/student/StudentPortal.tsx');
    const page = source('src/app/(student)/para-ti/page.tsx');
    const zoomRoute = source('src/app/(student)/para-ti/zoom/[sessionId]/route.ts');

    assert.doesNotMatch(portal, /zoom_join_url/);
    assert.match(portal, /\/para-ti\/zoom\/\$\{nextSession\.id\}/);
    assert.match(page, /has_zoom_link: Boolean\(zoom_join_url\)/);
    assert.match(zoomRoute, /elapsedMinutes < -15 \|\| elapsedMinutes > 180/);
    assert.match(zoomRoute, /checkStudentMembershipAccess/);
  });

  it('evita métricas comerciales inventadas y refleja la oferta oficial', () => {
    const admin = source('src/app/admin/AdminDashboardClient.tsx');
    const offer = source('src/lib/offers/membership-offer.ts');

    assert.doesNotMatch(admin, /\+14%|\+22%|78%|renovaci[oó]n autom[aá]tica/i);
    assert.match(admin, /precio mensual fijado al momento de cada inscripción/);
    assert.match(offer, /PRESALE_LAST_LOCAL_DATE = '2026-10-04'/);
    assert.match(offer, /monthlyPrice: 21000/);
    assert.match(offer, /monthlyPrice: 25000/);
    assert.match(admin, /Dos clases en vivo: lunes y miércoles/);
    assert.match(admin, /Sesiones de entre 10 y 40 minutos/);
  });

  it('usa un rol persistido, no el correo, para dar acceso administrativo', () => {
    const postLogin = source('src/app/auth/post-login/route.ts');
    const adminPage = source('src/app/admin/page.tsx');
    const helpers = source('src/lib/supabase/profile-helpers.ts');

    assert.doesNotMatch(postLogin, /isStaffEmail/);
    assert.doesNotMatch(adminPage, /isStaffEmail/);
    assert.doesNotMatch(helpers, /STAFF_EMAILS/);
    assert.match(adminPage, /STAFF_ROLES\.has\(profile\.role\)/);
  });

  it('no solicita columnas ausentes en el perfil y evita ciclos de login ante errores', () => {
    const profiles = source('src/lib/supabase/profile-helpers.ts');
    const proxy = source('src/proxy.ts');

    assert.doesNotMatch(profiles, /updated_at/);
    assert.match(proxy, /const isLoginError = pathname === '\/auth\/login' && request\.nextUrl\.searchParams\.has\('error'\)/);
    assert.match(proxy, /isAuthPath && user && !isLoginError/);
  });

  it('no indexa rutas de programas ajenos a Team Naty', () => {
    const sitemap = source('src/app/sitemap.ts');

    assert.doesNotMatch(sitemap, /\/presencial|\/post-parto/);
  });
});
