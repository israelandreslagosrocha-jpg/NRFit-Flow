import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import {
  validateMembershipDates,
  type MembershipRecord,
  checkStudentMembershipAccess,
} from '../lib/supabase/membership-helpers.ts';
import {
  getStudentProfileByUserId,
  ensureStudentProfile,
} from '../lib/supabase/profile-helpers.ts';
import { proxy } from '../proxy.ts';
import { NextRequest } from 'next/server.js';

// Cargar variables de entorno locales para pruebas
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // Archivo ya cargado o no disponible
  }
}

/**
 * GUARDA ANTI-PRODUCCIÓN:
 * Aborta inmediatamente la ejecución si se detecta un entorno o URL de producción real.
 */
function assertNonProductionEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ABORT: Intento de ejecutar suite de pruebas con NODE_ENV=production');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (supabaseUrl.includes('natyentrenadora.com') || supabaseUrl.includes('natyentrenadora.cl') || supabaseUrl.includes('prod-real')) {
    throw new Error(`ABORT: Intento de ejecutar pruebas contra URL de producción: ${supabaseUrl}`);
  }
}

describe('FASE M-08 — Fundamentos de Lanzamiento: Suite de Integración y Seguridad', () => {
  before(() => {
    assertNonProductionEnvironment();
  });

  // ============================================================================
  // 1. GUARDA ANTI-PRODUCCIÓN
  // ============================================================================
  describe('1. Salvaguarda Anti-Producción', () => {
    it('Debe abortar si NODE_ENV es production', () => {
      const envObj = process.env as Record<string, string | undefined>;
      const originalEnv = envObj.NODE_ENV;
      try {
        envObj.NODE_ENV = 'production';
        assert.throws(
          () => assertNonProductionEnvironment(),
          /ABORT: Intento de ejecutar suite de pruebas con NODE_ENV=production/
        );
      } finally {
        envObj.NODE_ENV = originalEnv;
      }
    });

    it('Debe abortar si NEXT_PUBLIC_SUPABASE_URL apunta a dominio productivo', () => {
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      try {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://db.natyentrenadora.com';
        assert.throws(
          () => assertNonProductionEnvironment(),
          /ABORT: Intento de ejecutar pruebas contra URL de producción/
        );
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      }
    });
  });

  // ============================================================================
  // 2. SEGURIDAD RLS EN SUPABASE REAL (Acceso anónimo denegado)
  // ============================================================================
  describe('2. Verificación de RLS en Supabase Real (Cliente Anónimo)', () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wqsmimxjnfanrenlhdgx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);

    it('RLS Negativo: Consulta anónima a "students" no debe retornar filas de alumnas', async () => {
      const { data, error } = await anonClient.from('students').select('*');
      // Con RLS activo, anon retorna lista vacía o error de permiso
      if (data) {
        assert.strictEqual(data.length, 0, 'Cliente anónimo no debe poder leer registros en public.students');
      } else {
        assert.ok(error, 'Si no retorna lista vacía, debe retornar error de RLS');
      }
    });

    it('RLS Negativo: Consulta anónima a "memberships" no debe retornar membresías', async () => {
      const { data, error } = await anonClient.from('memberships').select('*');
      if (data) {
        assert.strictEqual(data.length, 0, 'Cliente anónimo no debe poder leer membresías en public.memberships');
      } else {
        assert.ok(error, 'Si no retorna lista vacía, debe retornar error de RLS');
      }
    });

    it('RLS Negativo: Inserción anónima en "memberships" debe ser rechazada', async () => {
      const { error } = await anonClient.from('memberships').insert({
        plan_id: '00000000-0000-0000-0000-000000000001',
        status: 'ACTIVE',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        price_contracted: 25000,
      });
      assert.ok(error, 'RLS debe denegar inserción anónima en memberships');
    });

    it('RLS Negativo: Modificación anónima (UPDATE) en "memberships" debe ser rechazada', async () => {
      const { data, error } = await anonClient
        .from('memberships')
        .update({ status: 'ACTIVE' })
        .eq('status', 'PENDING_PAYMENT')
        .select();
      
      // Debe dar error o 0 filas afectadas
      if (data) {
        assert.strictEqual(data.length, 0, 'UPDATE anónimo no puede modificar filas en memberships');
      } else {
        assert.ok(error, 'UPDATE anónimo debe fallar');
      }
    });
  });

  // ============================================================================
  // 3. LÓGICA DE VALIDACIÓN DE MEMBRESÍAS (Separación de ramas y Fail-Closed)
  // ============================================================================
  describe('3. Validación por Ramas y Falla Cerrada (validateMembershipDates)', () => {
    const baseDate = new Date('2026-09-16T12:00:00Z');

    // Rama TRIAL
    it('TRIAL vigente (trial_ends_at futuro): Concede acceso sin requerir current_period_end', () => {
      const membership: MembershipRecord = {
        id: 'mem-trial-1',
        student_id: 'student-1',
        status: 'TRIAL',
        start_date: '2026-09-10',
        trial_ends_at: '2026-09-17T12:00:00Z', // Futuro (+1 día)
        current_period_end: null, // No exigido
        created_at: '2026-09-10T10:00:00Z',
      };

      const result = validateMembershipDates(membership, baseDate);
      assert.strictEqual(result.hasAccess, true);
      assert.strictEqual(result.status, 'TRIAL');
    });

    it('TRIAL expirado (trial_ends_at pasado): Deniega acceso', () => {
      const membership: MembershipRecord = {
        id: 'mem-trial-expired',
        student_id: 'student-1',
        status: 'TRIAL',
        start_date: '2026-09-01',
        trial_ends_at: '2026-09-16T11:59:59Z', // 1 segundo en el pasado
        created_at: '2026-09-01T10:00:00Z',
      };

      const result = validateMembershipDates(membership, baseDate);
      assert.strictEqual(result.hasAccess, false);
      assert.strictEqual(result.status, 'EXPIRED');
      assert.match(result.reason || '', /Período de prueba finalizado/);
    });

    it('TRIAL sin fecha trial_ends_at (nula): Falla cerrado y deniega acceso', () => {
      const membership: MembershipRecord = {
        id: 'mem-trial-null-date',
        student_id: 'student-1',
        status: 'TRIAL',
        start_date: '2026-09-10',
        trial_ends_at: null,
        created_at: '2026-09-10T10:00:00Z',
      };

      const result = validateMembershipDates(membership, baseDate);
      assert.strictEqual(result.hasAccess, false);
    });

    // Rama ACTIVE
    it('ACTIVE vigente (current_period_end futuro): Concede acceso sin requerir trial_ends_at', () => {
      const membership: MembershipRecord = {
        id: 'mem-active-1',
        student_id: 'student-2',
        status: 'ACTIVE',
        start_date: '2026-09-01',
        trial_ends_at: null, // No exigido
        current_period_end: '2026-10-01T12:00:00Z', // Futuro
        created_at: '2026-09-01T10:00:00Z',
      };

      const result = validateMembershipDates(membership, baseDate);
      assert.strictEqual(result.hasAccess, true);
      assert.strictEqual(result.status, 'ACTIVE');
    });

    it('ACTIVE vigente con fallback a end_date: Concede acceso si end_date es futuro', () => {
      const membership: MembershipRecord = {
        id: 'mem-active-fallback',
        student_id: 'student-2',
        status: 'ACTIVE',
        start_date: '2026-09-01',
        current_period_end: null,
        end_date: '2026-10-01',
        created_at: '2026-09-01T10:00:00Z',
      };

      const result = validateMembershipDates(membership, baseDate);
      assert.strictEqual(result.hasAccess, true);
      assert.strictEqual(result.status, 'ACTIVE');
    });

    it('ACTIVE expirado (current_period_end pasado): Deniega acceso', () => {
      const membership: MembershipRecord = {
        id: 'mem-active-exp',
        student_id: 'student-2',
        status: 'ACTIVE',
        start_date: '2026-08-01',
        current_period_end: '2026-09-01T12:00:00Z', // Pasado
        created_at: '2026-08-01T10:00:00Z',
      };

      const result = validateMembershipDates(membership, baseDate);
      assert.strictEqual(result.hasAccess, false);
      assert.strictEqual(result.status, 'EXPIRED');
    });

    it('ACTIVE FALLA CERRADO: Si current_period_end y end_date son ambos nulos, deniega acceso', () => {
      const membership: MembershipRecord = {
        id: 'mem-active-fail-closed',
        student_id: 'student-2',
        status: 'ACTIVE',
        start_date: '2026-09-01',
        current_period_end: null,
        end_date: null,
        created_at: '2026-09-01T10:00:00Z',
      };

      const result = validateMembershipDates(membership, baseDate);
      assert.strictEqual(result.hasAccess, false, 'ACTIVE sin fechas de fin debe fallar cerrado');
      assert.strictEqual(result.status, 'EXPIRED');
    });

    // Estados Bloqueados Explícitamente
    it('Estado PAUSED: Bloqueado terminantemente', () => {
      const membership: MembershipRecord = {
        id: 'mem-paused',
        student_id: 'student-3',
        status: 'PAUSED',
        start_date: '2026-09-01',
        current_period_end: '2026-10-01T12:00:00Z',
        created_at: '2026-09-01T10:00:00Z',
      };

      const result = validateMembershipDates(membership, baseDate);
      assert.strictEqual(result.hasAccess, false);
      assert.strictEqual(result.status, 'PAUSED');
      assert.match(result.reason || '', /pausada/);
    });

    it('Estado PAST_DUE: Bloqueado terminantemente (sin gracia comercial asumida)', () => {
      const membership: MembershipRecord = {
        id: 'mem-past-due',
        student_id: 'student-4',
        status: 'PAUSED',
        start_date: '2026-09-01',
        current_period_end: '2026-09-15T12:00:00Z',
        created_at: '2026-09-01T10:00:00Z',
      };

      const result = validateMembershipDates({ ...membership, status: 'PAST_DUE' }, baseDate);
      assert.strictEqual(result.hasAccess, false);
      assert.strictEqual(result.status, 'PAST_DUE');
    });

    it('Estado PENDING_PAYMENT: Bloqueado terminantemente (pending nunca otorga acceso)', () => {
      const membership: MembershipRecord = {
        id: 'mem-pending',
        student_id: 'student-5',
        status: 'PENDING_PAYMENT',
        start_date: '2026-09-16',
        created_at: '2026-09-16T10:00:00Z',
      };

      const result = validateMembershipDates(membership, baseDate);
      assert.strictEqual(result.hasAccess, false);
      assert.strictEqual(result.status, 'PENDING_PAYMENT');
    });

    it('Estado CANCELLED: Bloqueado terminantemente', () => {
      const membership: MembershipRecord = {
        id: 'mem-cancelled',
        student_id: 'student-6',
        status: 'CANCELLED',
        start_date: '2026-09-01',
        created_at: '2026-09-01T10:00:00Z',
      };

      const result = validateMembershipDates(membership, baseDate);
      assert.strictEqual(result.hasAccess, false);
      assert.strictEqual(result.status, 'CANCELLED');
    });

    it('Estado EXPIRED: Bloqueado terminantemente', () => {
      const membership: MembershipRecord = {
        id: 'mem-expired',
        student_id: 'student-7',
        status: 'EXPIRED',
        start_date: '2026-08-01',
        created_at: '2026-08-01T10:00:00Z',
      };

      const result = validateMembershipDates(membership, baseDate);
      assert.strictEqual(result.hasAccess, false);
      assert.strictEqual(result.status, 'EXPIRED');
    });

    it('checkStudentMembershipAccess retorna NO_MEMBERSHIP si studentId está vacío', async () => {
      const mockSupabase: any = {};
      const res = await checkStudentMembershipAccess(mockSupabase, '');
      assert.strictEqual(res.hasAccess, false);
      assert.strictEqual(res.status, 'NO_MEMBERSHIP');
    });

    it('checkStudentMembershipAccess retorna NO_MEMBERSHIP si la alumna no tiene membresías', async () => {
      const mockSupabase: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      };
      const res = await checkStudentMembershipAccess(mockSupabase, 'student-sin-membresia');
      assert.strictEqual(res.hasAccess, false);
      assert.strictEqual(res.status, 'NO_MEMBERSHIP');
    });

    it('checkStudentMembershipAccess prioriza y concede acceso si existe membresía activa', async () => {
      const mockSupabase: any = {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: 'mem-1',
                      student_id: 'student-vip',
                      status: 'ACTIVE',
                      start_date: '2026-09-01',
                      current_period_end: '2026-10-01T12:00:00Z',
                      created_at: '2026-09-01T10:00:00Z',
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        }),
      };
      const res = await checkStudentMembershipAccess(mockSupabase, 'student-vip', baseDate);
      assert.strictEqual(res.hasAccess, true);
      assert.strictEqual(res.status, 'ACTIVE');
    });
  });

  // ============================================================================
  // 4. JERARQUÍA DE IDENTIDADES (auth.users.id -> profiles.user_id -> students.profile_id)
  // ============================================================================
  describe('4. Jerarquía de Identidad y Consultas Seguras', () => {
    it('getStudentProfileByUserId debe retornar error si authUserId está vacío', async () => {
      const mockSupabase: any = {};
      const res = await getStudentProfileByUserId(mockSupabase, '');
      assert.strictEqual(res.profile, null);
      assert.strictEqual(res.student, null);
      assert.strictEqual(res.error, 'authUserId is required');
    });

    it('ensureStudentProfile extrae full_name de raw_user_meta_data con fallbacks sin consultar profile.email', async () => {
      let insertedProfile: any = null;
      let insertedStudent: any = null;

      const mockSupabase: any = {
        from(table: string) {
          if (table === 'profiles') {
            return {
              select() {
                return {
                  eq() {
                    return {
                      maybeSingle: () => Promise.resolve({ data: null, error: null }),
                    };
                  },
                };
              },
              upsert(data: any) {
                insertedProfile = { id: 'prof-uuid-99', ...data };
                return {
                  select() {
                    return {
                      single: () => Promise.resolve({ data: insertedProfile, error: null }),
                    };
                  },
                };
              },
            };
          }
          if (table === 'students') {
            return {
              select() {
                return {
                  eq() {
                    return {
                      maybeSingle: () => Promise.resolve({ data: null, error: null }),
                    };
                  },
                };
              },
              upsert(data: any) {
                insertedStudent = { id: 'stud-uuid-99', ...data };
                return {
                  select() {
                    return {
                      single: () => Promise.resolve({ data: insertedStudent, error: null }),
                    };
                  },
                };
              },
            };
          }
          return {};
        },
      };

      const authUser = {
        id: 'auth-user-123',
        email: 'carolina.test@ejemplo.com',
        user_metadata: { name: 'Carolina Test' },
      };

      const res = await ensureStudentProfile(mockSupabase, authUser);
      assert.ok(res.profile);
      assert.strictEqual(res.profile.full_name, 'Carolina Test');
      assert.strictEqual(res.profile.user_id, 'auth-user-123');
      assert.ok(res.student);
      assert.strictEqual(res.student.profile_id, 'prof-uuid-99');
      // Verificar que auth.users.id NO se asignó directamente como student.id ni profile.id
      assert.notStrictEqual(res.profile.id, authUser.id);
      assert.notStrictEqual(res.student.id, authUser.id);
    });
  });

  // ============================================================================
  // 5. REDIRECCIÓN TEMPORAL PERIMETRAL EN PROXY (/alumna/* -> /para-ti)
  // ============================================================================
  describe('5. Perímetro Proxy: Redirección Temporal (HTTP 307)', () => {
    it('Petición a /alumna/explorar debe responder con redirección temporal HTTP 307 a /para-ti', async () => {
      const req = new NextRequest('http://localhost:3000/alumna/explorar');
      const res = await proxy(req);

      assert.strictEqual(res.status, 307, 'Debe ser HTTP 307 Temporary Redirect');
      const location = res.headers.get('location');
      assert.ok(location?.endsWith('/para-ti'), `Ubicación esperada /para-ti, obtenida: ${location}`);
    });

    it('Petición a /alumna/para-ti debe responder con HTTP 307 a /para-ti', async () => {
      const req = new NextRequest('http://localhost:3000/alumna/para-ti');
      const res = await proxy(req);

      assert.strictEqual(res.status, 307);
      const location = res.headers.get('location');
      assert.ok(location?.endsWith('/para-ti'));
    });

    it('Petición a /alumna/mi-plan debe responder con HTTP 307 a /para-ti', async () => {
      const req = new NextRequest('http://localhost:3000/alumna/mi-plan');
      const res = await proxy(req);

      assert.strictEqual(res.status, 307);
      const location = res.headers.get('location');
      assert.ok(location?.endsWith('/para-ti'));
    });

    it('Petición no autenticada a /para-ti debe redirigir a /auth/login con parámetro redirectedFrom', async () => {
      const req = new NextRequest('http://localhost:3000/para-ti');
      const res = await proxy(req);

      // Si no hay cookies de sesión válidas en el request, redirige a login
      assert.strictEqual(res.status, 307);
      const location = res.headers.get('location') || '';
      assert.ok(location.includes('/auth/login'), `Debe redirigir a login, obtenida: ${location}`);
      assert.ok(location.includes('redirectedFrom=%2Fpara-ti'), 'Debe incluir parámetro redirectedFrom');
    });
  });
});
