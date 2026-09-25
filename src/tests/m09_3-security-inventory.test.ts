/**
 * TEST SUITE: FASE M-09.3A — Auditoría e Inventario de Seguridad SEC-01..10
 * Naty Entrenadora - Validación Automatizada de Superficie de Ataque
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  runSecurityInventoryAudit,
  type SecurityAuditReport,
} from '../../scripts/security-inventory-audit.ts';
import { proxy } from '../proxy.ts';
import { NextRequest } from 'next/server.js';
import { POST as processOutboxPost } from '../app/api/cron/process-outbox/route.ts';
import { POST as reconcileMembershipsPost } from '../app/api/cron/reconcile-memberships/route.ts';

// Cargar variables de entorno para pruebas
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // Ya cargado
  }
}

/**
 * Salvaguarda Anti-Producción
 */
function assertNonProductionEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ABORT: Intento de ejecutar suite de pruebas con NODE_ENV=production');
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (supabaseUrl.includes('prod-real') || supabaseUrl.includes('natyentrenadora.com')) {
    throw new Error(`ABORT: Intento de ejecutar pruebas contra URL productiva: ${supabaseUrl}`);
  }
}

describe('FASE M-09.3A — Suite de Auditoría e Inventario de Seguridad (SEC-01..10)', () => {
  let report: SecurityAuditReport;

  before(async () => {
    assertNonProductionEnvironment();
    // Ejecutar análisis estático base una sola vez para toda la suite
    report = await runSecurityInventoryAudit({ skipLiveProbe: true });
  });

  // ============================================================================
  // SEC-01: RLS en Tablas Expuestas
  // ============================================================================
  describe('SEC-01: RLS en Tablas Expuestas', () => {
    it('Todas las 32 tablas canónicas deben tener ENABLE ROW LEVEL SECURITY en migraciones', () => {
      const sec01 = report.controls.find(c => c.id === 'SEC-01');
      assert.ok(sec01, 'Control SEC-01 debe existir en el reporte');
      assert.strictEqual(sec01.status, 'COMPLIANT');
      assert.strictEqual(sec01.technicalDetails?.totalTables, 32);
      assert.strictEqual(sec01.technicalDetails?.rlsEnabledCount, 32);
      assert.deepStrictEqual(sec01.technicalDetails?.tablesWithoutRls, []);
    });

    it('Sonda en vivo: Consulta anónima no debe retornar registros de estudiantes ni membresías ajenas', async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) return;

      const anonClient = createClient(supabaseUrl, anonKey);
      const { data: students, error: errStudents } = await anonClient.from('students').select('*').limit(5);
      if (students) {
        assert.strictEqual(students.length, 0, 'Cliente anónimo no debe leer filas en public.students');
      } else {
        assert.ok(errStudents, 'Si no retorna lista vacía, debe retornar error de permisos RLS');
      }

      const { data: mems, error: errMems } = await anonClient.from('memberships').select('*').limit(5);
      if (mems) {
        assert.strictEqual(mems.length, 0, 'Cliente anónimo no debe leer filas en public.memberships');
      } else {
        assert.ok(errMems, 'Si no retorna lista vacía, debe retornar error de permisos RLS');
      }
    });
  });

  // ============================================================================
  // SEC-02: Grants anon Mínimos (Escritura Prohibida en Tablas Críticas)
  // ============================================================================
  describe('SEC-02: Grants anon Mínimos', () => {
    it('No deben existir directivas de INSERT, UPDATE o DELETE concedidas a anon en migraciones', () => {
      const sec02 = report.controls.find(c => c.id === 'SEC-02');
      assert.ok(sec02, 'Control SEC-02 debe existir en el reporte');
      assert.strictEqual(sec02.status, 'COMPLIANT');
      assert.strictEqual(sec02.technicalDetails?.dangerousAnonPatternsDetected, 0);
    });

    it('Sonda en vivo: Inserción anónima en memberships debe ser rechazada de forma estricta', async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) return;

      const anonClient = createClient(supabaseUrl, anonKey);
      const { error } = await anonClient.from('memberships').insert({
        status: 'ACTIVE',
      });
      assert.ok(error, 'La inserción anónima en memberships DEBE fallar por RLS');
    });
  });

  // ============================================================================
  // SEC-03: Grants authenticated Mínimos (Sin mutación directa financiera)
  // ============================================================================
  describe('SEC-03: Grants authenticated Mínimos', () => {
    it('No deben existir políticas de mutación directa (INSERT/UPDATE/DELETE) para authenticated en tablas financieras ni outbox', () => {
      const sec03 = report.controls.find(c => c.id === 'SEC-03');
      assert.ok(sec03, 'Control SEC-03 debe existir en el reporte');
      assert.strictEqual(sec03.status, 'COMPLIANT');
      assert.deepStrictEqual(sec03.technicalDetails?.mutationViolations, []);
    });

    it('memberships y payment_transactions solo poseen política SELECT para el propio usuario en migración M-08', () => {
      const m08Path = path.join(process.cwd(), 'supabase', 'migrations', '20260916000000_fase_m08_auth_profiles_students.sql');
      const sql = fs.readFileSync(m08Path, 'utf-8');

      assert.ok(sql.includes('CREATE POLICY "Students can view own memberships"'), 'Debe existir policy SELECT');
      assert.ok(sql.includes('ON public.memberships FOR SELECT TO authenticated'), 'Solo FOR SELECT TO authenticated');
      assert.ok(!sql.includes('ON public.memberships FOR INSERT TO authenticated'), 'PROHIBIDO FOR INSERT TO authenticated');
      assert.ok(!sql.includes('ON public.memberships FOR UPDATE TO authenticated'), 'PROHIBIDO FOR UPDATE TO authenticated');
      assert.ok(!sql.includes('ON public.memberships FOR DELETE TO authenticated'), 'PROHIBIDO FOR DELETE TO authenticated');
    });
  });

  // ============================================================================
  // SEC-04: Inventario RPC Expuestas en public
  // ============================================================================
  describe('SEC-04: Inventario RPC Expuestas en public', () => {
    it('Debe inventariar exhaustivamente las 7 funciones del esquema (5 RPCs y 2 triggers)', () => {
      const sec04 = report.controls.find(c => c.id === 'SEC-04');
      assert.ok(sec04, 'Control SEC-04 debe existir');
      assert.strictEqual(sec04.status, 'AUDITED_INFO');
      assert.strictEqual(sec04.technicalDetails?.totalFunctions, 7);
      assert.strictEqual(sec04.technicalDetails?.rpcCount, 5);
      assert.strictEqual(sec04.technicalDetails?.triggerCount, 2);

      const rpcNames = (sec04.technicalDetails?.rpcs || []).map((r: any) => r.name);
      assert.ok(rpcNames.includes('get_auth_profile_id'));
      assert.ok(rpcNames.includes('get_auth_role'));
      assert.ok(rpcNames.includes('admin_update_user_role'));
      assert.ok(rpcNames.includes('create_booking_atomic'));
      assert.ok(rpcNames.includes('claim_outbox_emails'));
    });
  });

  // ============================================================================
  // SEC-05: Inventario SECURITY DEFINER vs SECURITY INVOKER
  // ============================================================================
  describe('SEC-05: Inventario SECURITY DEFINER vs INVOKER', () => {
    it('Registra el estado actual (7 DEFINER) y marca NEEDS_HARDENING para migración progresiva', () => {
      const sec05 = report.controls.find(c => c.id === 'SEC-05');
      assert.ok(sec05, 'Control SEC-05 debe existir');
      assert.strictEqual(sec05.status, 'NEEDS_HARDENING');
      assert.strictEqual(sec05.risk, 'MEDIUM');
      assert.strictEqual(sec05.technicalDetails?.definerCount, 7);
      assert.strictEqual(sec05.technicalDetails?.invokerCount, 0);

      // Clasificación canónica: handle_new_user debe figurar en los findings como Alto Riesgo
      const hasHighRiskMention = sec05.findings.some(f => f.includes('handle_new_user') && f.includes('ALTO RIESGO'));
      assert.ok(hasHighRiskMention, 'handle_new_user debe estar clasificada como ALTO RIESGO');
    });
  });

  // ============================================================================
  // SEC-06: Detección EXECUTE Otorgado a PUBLIC
  // ============================================================================
  describe('SEC-06: Detección EXECUTE Otorgado a PUBLIC', () => {
    it('Detecta que claim_outbox_emails fue endurecida con REVOKE y admin_update_user_role requiere endurecimiento', () => {
      const sec06 = report.controls.find(c => c.id === 'SEC-06');
      assert.ok(sec06, 'Control SEC-06 debe existir');
      assert.strictEqual(sec06.status, 'NEEDS_HARDENING');

      const hardened = sec06.technicalDetails?.hardenedFunctions || [];
      const unrevoked = sec06.technicalDetails?.functionsMissingExplicitRevoke || [];

      assert.ok(hardened.includes('claim_outbox_emails'), 'claim_outbox_emails debe tener REVOKE FROM PUBLIC');
      assert.ok(unrevoked.includes('admin_update_user_role'), 'admin_update_user_role debe detectarse como faltante de REVOKE');
    });
  });

  // ============================================================================
  // SEC-07: search_path de Funciones
  // ============================================================================
  describe('SEC-07: search_path de Funciones', () => {
    it('Audita search_path y detecta que handle_new_user tiene public sin pg_temp ni calificación absoluta', () => {
      const sec07 = report.controls.find(c => c.id === 'SEC-07');
      assert.ok(sec07, 'Control SEC-07 debe existir');
      assert.strictEqual(sec07.status, 'NEEDS_HARDENING');

      const summary = sec07.technicalDetails?.searchPathSummary || [];
      const handleUserItem = summary.find((s: any) => s.funcName === 'handle_new_user');
      assert.ok(handleUserItem, 'handle_new_user debe figurar en el análisis');
      assert.strictEqual(handleUserItem.searchPath, 'public');
      assert.ok(handleUserItem.risk.includes('HIGH_RISK'));
    });
  });

  // ============================================================================
  // SEC-08: Claves Server-Side (Cero exposición en cliente)
  // ============================================================================
  describe('SEC-08: Claves Server-Side y Bundles de Cliente', () => {
    it('Ningún secreto de backend debe tener prefijo NEXT_PUBLIC_ ni ser importado en componentes de cliente', () => {
      const sec08 = report.controls.find(c => c.id === 'SEC-08');
      assert.ok(sec08, 'Control SEC-08 debe existir');
      assert.strictEqual(sec08.status, 'COMPLIANT');
      assert.deepStrictEqual(sec08.technicalDetails?.leakedPrefixes, []);
      assert.deepStrictEqual(sec08.technicalDetails?.clientLeaks, []);
    });
  });

  // ============================================================================
  // SEC-09: Autorización de Rutas Admin y Cron
  // ============================================================================
  describe('SEC-09: Autorización de Rutas Admin y Cron', () => {
    it('proxy.ts debe redirigir peticiones no autenticadas a /para-ti y /admin hacia /auth/login', async () => {
      const reqParaTi = new NextRequest('http://localhost:3000/para-ti');
      const resParaTi = await proxy(reqParaTi);
      assert.strictEqual(resParaTi.status, 307);
      assert.ok(resParaTi.headers.get('location')?.includes('/auth/login'));

      const reqAdmin = new NextRequest('http://localhost:3000/admin');
      const resAdmin = await proxy(reqAdmin);
      assert.strictEqual(resAdmin.status, 307);
      assert.ok(resAdmin.headers.get('location')?.includes('/auth/login'));
    });

    it('/api/cron/process-outbox debe responder HTTP 401 sin Bearer CRON_SECRET', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/process-outbox', {
        method: 'POST',
      });
      const res = await processOutboxPost(req);
      assert.strictEqual(res.status, 401);
    });

    it('/api/cron/reconcile-memberships debe responder HTTP 401 con Bearer inválido', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/reconcile-memberships', {
        method: 'POST',
        headers: {
          authorization: 'Bearer token-falso-invalido',
        },
      });
      const res = await reconcileMembershipsPost(req);
      assert.strictEqual(res.status, 401);
    });
  });

  // ============================================================================
  // SEC-10: Storage Buckets y Políticas de Almacenamiento
  // ============================================================================
  describe('SEC-10: Storage Buckets y Políticas de Almacenamiento', () => {
    it('Verifica que no existan buckets de almacenamiento no auditados o llamadas inseguras a storage', () => {
      const sec10 = report.controls.find(c => c.id === 'SEC-10');
      assert.ok(sec10, 'Control SEC-10 debe existir');
      assert.strictEqual(sec10.status, 'AUDITED_INFO');
      assert.strictEqual(sec10.technicalDetails?.storageInMigrations, false);
      assert.strictEqual(sec10.technicalDetails?.storageInCode, false);
    });
  });
});
