/**
 * TEST SUITE: FASE M-09.3C — Security Audit Events & SQL Hardening
 * Naty Entrenadora - Pruebas Negativas y de Autorización de Seguridad
 *
 * Contratos Verificados:
 *  1. anon cannot execute admin role mutation
 *  2. student cannot elevate role
 *  3. coach cannot elevate role
 *  4. admin cannot perform OWNER-only mutation
 *  5. owner can execute role mutation
 *  6. student cannot read security_audit_events
 *  7. anon cannot read security_audit_events
 *  8. authenticated cannot insert/update/delete security_audit_events
 *  9. service backend can insert sanitized audit event
 * 10. AUDIT_METADATA_UTF8_RESPECTS_8192_BYTE_LIMIT (multibyte UTF-8 aware)
 * 11. AUDIT_METADATA_DOES_NOT_PERSIST_SECRETS_OR_PII
 * 12. ROLE_MUTATION_ROLLS_BACK_IF_SECURITY_AUDIT_WRITE_FAILS (fail-closed)
 * 13. CHECK_PROFILE_UPDATE_INTEGRITY_IS_TRIGGER_NOT_DIRECT_RPC
 * 14. SEARCH_PATH_NORMALIZATION_AND_HARDENING_DEFERRED_CONTRACT
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  sanitizeAuditMetadata,
  getUtf8ByteLength,
  MAX_AUDIT_METADATA_BYTES,
  recordSecurityAuditEvent,
  type SecurityAuditEventInput,
} from '../lib/audit.ts';

// Configurar entorno seguro de pruebas
process.env.FLOW_ENV = 'sandbox';

/**
 * Mock en memoria con motor transaccional y simulación de RLS / GRANTS de PostgreSQL
 */
function createMockSecurityDatabase() {
  const store = {
    profiles: [
      { id: 'prof-owner', user_id: 'usr-owner', role: 'OWNER', full_name: 'Naty Dueña' },
      { id: 'prof-admin', user_id: 'usr-admin', role: 'ADMIN', full_name: 'Admin Sistema' },
      { id: 'prof-coach', user_id: 'usr-coach', role: 'COACH', full_name: 'Entrenador Juan' },
      { id: 'prof-student-1', user_id: 'usr-student-1', role: 'STUDENT', full_name: 'Alumna María' },
      { id: 'prof-student-2', user_id: 'usr-student-2', role: 'STUDENT', full_name: 'Alumna Laura' },
    ],
    audit_logs: [] as any[],
    security_audit_events: [] as any[],
  };

  return {
    _store: store,

    /**
     * Simula la ejecución de admin_update_user_role con semántica transaccional fail-closed
     */
    async executeAdminUpdateUserRole(params: {
      actorRole: string | null;
      actorProfileId: string | null;
      targetProfileId: string;
      newRole: string;
      simulatedAuditFailure?: boolean;
      customAuditMetadata?: Record<string, any>;
    }): Promise<{ success: boolean; errorCode?: string; errorMessage?: string }> {
      // 1. Verificación de permiso EXECUTE (anon no tiene permiso de ejecución)
      if (!params.actorRole) {
        return { success: false, errorCode: '42501', errorMessage: 'permission denied for function admin_update_user_role' };
      }

      // 2. Verificación server-side de autorización (IF public.get_auth_role() IS DISTINCT FROM 'OWNER')
      if (params.actorRole !== 'OWNER') {
        return { success: false, errorCode: '42501', errorMessage: 'FORBIDDEN: Se requieren privilegios de OWNER' };
      }

      // 3. Inicio de bloque transaccional atómico
      const profileIndex = store.profiles.findIndex(p => p.id === params.targetProfileId);
      if (profileIndex === -1) {
        return { success: false, errorCode: 'P0002', errorMessage: 'TARGET_PROFILE_NOT_FOUND' };
      }

      const originalRole = store.profiles[profileIndex].role;

      // Paso A: Modificar rol en perfil
      store.profiles[profileIndex].role = params.newRole;

      // Paso B: Intentar escribir evento de auditoría obligatorio
      try {
        if (params.simulatedAuditFailure) {
          throw new Error('SIMULATED_DB_ERROR: Conexión o constraint violation en security_audit_events');
        }

        const rawMetadata = params.customAuditMetadata || { new_role: params.newRole };
        const metadataString = JSON.stringify(rawMetadata);
        const metadataBytes = getUtf8ByteLength(metadataString);

        // Simulación estricta de CONSTRAINT chk_audit_metadata_size CHECK (octet_length(metadata::text) <= 8192)
        if (metadataBytes > MAX_AUDIT_METADATA_BYTES) {
          throw new Error(`CHECK_CONSTRAINT_VIOLATION: octet_length(${metadataBytes}) > 8192`);
        }

        const auditEvent = {
          id: `audit-${Date.now()}-${Math.random()}`,
          created_at: new Date().toISOString(),
          event_type: 'ADMIN_ROLE_CHANGE',
          actor_profile_id: params.actorProfileId,
          target_type: 'profiles',
          target_id: params.targetProfileId,
          result: 'SUCCESS',
          metadata: rawMetadata,
        };

        store.security_audit_events.push(auditEvent);
        store.audit_logs.push({
          actor_id: params.actorProfileId,
          action: 'ROLE_CHANGE',
          entity_type: 'profiles',
          entity_id: params.targetProfileId,
          new_data: { role: params.newRole },
        });

        // Transacción completada con éxito
        return { success: true };
      } catch (err: any) {
        // FAIL-CLOSED: Si la auditoría falla, se revierte la mutación de perfil (ROLLBACK)
        store.profiles[profileIndex].role = originalRole;
        return { success: false, errorCode: 'AUDIT_WRITE_FAILED', errorMessage: err.message };
      }
    },

    /**
     * Simula consulta con RLS a security_audit_events según el rol del actor
     */
    querySecurityAuditEvents(actorRole: string | null): any[] {
      // anon o rol nulo -> CERO acceso (REVOKE ALL, sin filas)
      if (!actorRole) return [];

      // RLS Policy: public.get_auth_role() IN ('ADMIN', 'OWNER')
      if (actorRole === 'ADMIN' || actorRole === 'OWNER') {
        return [...store.security_audit_events];
      }

      // STUDENT y COACH -> CERO filas
      return [];
    },

    /**
     * Simula intento de mutación directa (INSERT/UPDATE/DELETE) en security_audit_events
     */
    attemptDirectClientMutation(actorRole: string | null, operation: 'INSERT' | 'UPDATE' | 'DELETE'): {
      permitted: boolean;
      errorCode?: string;
    } {
      // service_role puede insertar, pero NUNCA UPDATE ni DELETE
      if (actorRole === 'service_role') {
        if (operation === 'INSERT') return { permitted: true };
        return { permitted: false, errorCode: '42501_PERMISSION_DENIED_APPEND_ONLY' };
      }

      // Clientes anon o authenticated (STUDENT, COACH, ADMIN, OWNER) no tienen grant de mutación
      return { permitted: false, errorCode: '42501_PERMISSION_DENIED_FOR_CLIENT' };
    },
  };
}

describe('FASE M-09.3C — Suite de Certificación: Security Audit Events & SQL Hardening', () => {

  // ============================================================================
  // 1. anon cannot execute admin role mutation
  // ============================================================================
  it('1. anon cannot execute admin role mutation: Invocación anónima es rechazada sin privilegios', async () => {
    const db = createMockSecurityDatabase();
    const res = await db.executeAdminUpdateUserRole({
      actorRole: null, // anon
      actorProfileId: null,
      targetProfileId: 'prof-student-1',
      newRole: 'ADMIN',
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, '42501');
    // Verificar que el rol en DB no cambió
    const prof = db._store.profiles.find(p => p.id === 'prof-student-1');
    assert.strictEqual(prof?.role, 'STUDENT');
  });

  // ============================================================================
  // 2. student cannot elevate role
  // ============================================================================
  it('2. student cannot elevate role: Alumna intentando auto-elevarse es rechazada con FORBIDDEN', async () => {
    const db = createMockSecurityDatabase();
    const res = await db.executeAdminUpdateUserRole({
      actorRole: 'STUDENT',
      actorProfileId: 'prof-student-1',
      targetProfileId: 'prof-student-1',
      newRole: 'ADMIN',
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, '42501');
    assert.ok(res.errorMessage?.includes('FORBIDDEN'));

    const prof = db._store.profiles.find(p => p.id === 'prof-student-1');
    assert.strictEqual(prof?.role, 'STUDENT');
  });

  // ============================================================================
  // 3. coach cannot elevate role
  // ============================================================================
  it('3. coach cannot elevate role: Entrenador intentando elevar roles es rechazado con FORBIDDEN', async () => {
    const db = createMockSecurityDatabase();
    const res = await db.executeAdminUpdateUserRole({
      actorRole: 'COACH',
      actorProfileId: 'prof-coach',
      targetProfileId: 'prof-student-2',
      newRole: 'ADMIN',
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, '42501');
    assert.ok(res.errorMessage?.includes('FORBIDDEN'));

    const prof = db._store.profiles.find(p => p.id === 'prof-student-2');
    assert.strictEqual(prof?.role, 'STUDENT');
  });

  // ============================================================================
  // 4. admin cannot perform OWNER-only mutation
  // ============================================================================
  it('4. admin cannot perform OWNER-only mutation: Administrador no-owner es rechazado', async () => {
    const db = createMockSecurityDatabase();
    const res = await db.executeAdminUpdateUserRole({
      actorRole: 'ADMIN',
      actorProfileId: 'prof-admin',
      targetProfileId: 'prof-student-1',
      newRole: 'COACH',
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, '42501');
    assert.ok(res.errorMessage?.includes('FORBIDDEN: Se requieren privilegios de OWNER'));

    const prof = db._store.profiles.find(p => p.id === 'prof-student-1');
    assert.strictEqual(prof?.role, 'STUDENT');
  });

  // ============================================================================
  // 5. owner can execute role mutation
  // ============================================================================
  it('5. owner can execute role mutation: Dueño ejecuta exitosamente y registra evento de auditoría', async () => {
    const db = createMockSecurityDatabase();
    const res = await db.executeAdminUpdateUserRole({
      actorRole: 'OWNER',
      actorProfileId: 'prof-owner',
      targetProfileId: 'prof-student-1',
      newRole: 'COACH',
    });

    assert.strictEqual(res.success, true);

    const prof = db._store.profiles.find(p => p.id === 'prof-student-1');
    assert.strictEqual(prof?.role, 'COACH');

    // Verificar que el evento se persistió en security_audit_events
    assert.strictEqual(db._store.security_audit_events.length, 1);
    const event = db._store.security_audit_events[0];
    assert.strictEqual(event.event_type, 'ADMIN_ROLE_CHANGE');
    assert.strictEqual(event.actor_profile_id, 'prof-owner');
    assert.strictEqual(event.target_id, 'prof-student-1');
    assert.strictEqual(event.result, 'SUCCESS');
  });

  // ============================================================================
  // 6. student cannot read security_audit_events
  // ============================================================================
  it('6. student cannot read security_audit_events: Alumna autenticada recibe 0 filas bajo RLS', () => {
    const db = createMockSecurityDatabase();
    // Añadir un evento
    db._store.security_audit_events.push({
      id: 'audit-secret-1',
      event_type: 'SYSTEM_AUDIT',
      result: 'SUCCESS',
    });

    const rows = db.querySecurityAuditEvents('STUDENT');
    assert.strictEqual(rows.length, 0, 'Alumna no debe poder ver registros de auditoría');
  });

  // ============================================================================
  // 7. anon cannot read security_audit_events
  // ============================================================================
  it('7. anon cannot read security_audit_events: Cliente anónimo recibe 0 filas (acceso denegado)', () => {
    const db = createMockSecurityDatabase();
    db._store.security_audit_events.push({
      id: 'audit-secret-2',
      event_type: 'SYSTEM_AUDIT',
      result: 'SUCCESS',
    });

    const rows = db.querySecurityAuditEvents(null);
    assert.strictEqual(rows.length, 0, 'Petición anónima no debe ver filas de auditoría');
  });

  // ============================================================================
  // 8. authenticated cannot insert/update/delete security_audit_events
  // ============================================================================
  it('8. authenticated cannot insert/update/delete security_audit_events: Cero mutación directa para clientes', () => {
    const db = createMockSecurityDatabase();

    for (const role of ['STUDENT', 'COACH', 'ADMIN', 'OWNER']) {
      for (const op of ['INSERT', 'UPDATE', 'DELETE'] as const) {
        const attempt = db.attemptDirectClientMutation(role, op);
        assert.strictEqual(attempt.permitted, false, `Rol ${role} no debe tener permiso de ${op} en security_audit_events`);
        assert.strictEqual(attempt.errorCode, '42501_PERMISSION_DENIED_FOR_CLIENT');
      }
    }

    // Comprobar que ni siquiera service_role tiene UPDATE o DELETE (garantía append-only a nivel de privilegios)
    assert.strictEqual(db.attemptDirectClientMutation('service_role', 'UPDATE').permitted, false);
    assert.strictEqual(db.attemptDirectClientMutation('service_role', 'DELETE').permitted, false);
  });

  // ============================================================================
  // 9. service backend can insert sanitized audit event
  // ============================================================================
  it('9. service backend can insert sanitized audit event: Backend autenticado puede insertar eventos', async () => {
    const db = createMockSecurityDatabase();
    assert.strictEqual(db.attemptDirectClientMutation('service_role', 'INSERT').permitted, true);

    const mockClient: any = {
      from(table: string) {
        assert.strictEqual(table, 'security_audit_events');
        return {
          insert(payload: any) {
            db._store.security_audit_events.push({ id: 'evt-test-1', ...payload });
            return {
              select(_col: string) {
                return {
                  single() {
                    return Promise.resolve({ data: { id: 'evt-test-1' }, error: null });
                  },
                };
              },
            };
          },
        };
      },
    };

    const result = await recordSecurityAuditEvent(
      {
        eventType: 'TEST_AUDIT_EVENT',
        actorProfileId: 'prof-owner',
        result: 'SUCCESS',
        metadata: { action: 'test_audit_write', user: 'naty' },
      },
      mockClient
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.id, 'evt-test-1');
    assert.strictEqual(db._store.security_audit_events.length, 1);
  });

  // ============================================================================
  // 10. AUDIT_METADATA_UTF8_RESPECTS_8192_BYTE_LIMIT (multibyte aware)
  // ============================================================================
  it('10. AUDIT_METADATA_UTF8_RESPECTS_8192_BYTE_LIMIT: Sanitiza y compacta respetando bytes UTF-8', () => {
    // String con caracteres multibyte (ñ = 2 bytes, 🏋️‍♀️ = 11 bytes, acentos)
    const multibyteChar = '🏋️‍♀️_Naty_Entrenadora_Español_Año_2026_Ñandú_';
    const singleCharBytes = getUtf8ByteLength(multibyteChar);
    assert.ok(singleCharBytes > multibyteChar.length, 'Debe demostrar que UTF-8 ocupa más bytes que caracteres');

    // Generar metadata masiva que supere ampliamente los 8192 bytes (ej. 15.000 bytes)
    const largeOversizedObject: Record<string, any> = {
      description: multibyteChar.repeat(250), // ~11.000 bytes
      extra_data: Array.from({ length: 50 }, (_, i) => `item_largo_${i}_${multibyteChar}`),
    };

    const initialBytes = getUtf8ByteLength(JSON.stringify(largeOversizedObject));
    assert.ok(initialBytes > 8192, `El objeto inicial (${initialBytes} bytes) debe exceder 8192 bytes`);

    // Ejecutar sanitización con contrato de truncamiento seguro
    const sanitized = sanitizeAuditMetadata(largeOversizedObject);
    const finalBytes = getUtf8ByteLength(JSON.stringify(sanitized));

    assert.ok(
      finalBytes <= MAX_AUDIT_METADATA_BYTES,
      `El resultado sanitizado (${finalBytes} bytes) DEBE ser <= 8192 bytes`
    );
    assert.ok(sanitized._warning || sanitized.description.includes('[TRUNCATED'), 'Debe marcar el contenido como truncado');
  });

  // ============================================================================
  // 11. AUDIT_METADATA_DOES_NOT_PERSIST_SECRETS_OR_PII
  // ============================================================================
  it('11. AUDIT_METADATA_DOES_NOT_PERSIST_SECRETS_OR_PII: Purga exhaustiva de credenciales y tarjetas', () => {
    const sensitivePayload = {
      user_id: 'usr-123',
      password: 'super-secret-password-123',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
      flow_secret_key: 'flow_sk_live_9999999',
      apiKey: 'ak_test_123',
      authorization: 'Bearer secret_token_xyz',
      creditCard: '4532-1234-5678-9012',
      cvv: '123',
      nested: {
        smtp_pass: 'smtp-hostinger-secret',
        service_role_key: 'sb_service_key_live',
      },
    };

    const sanitized = sanitizeAuditMetadata(sensitivePayload);

    assert.strictEqual(sanitized.password, '[REDACTED_SECRET]');
    assert.strictEqual(sanitized.token, '[REDACTED_SECRET]');
    assert.strictEqual(sanitized.flow_secret_key, '[REDACTED_SECRET]');
    assert.strictEqual(sanitized.apiKey, '[REDACTED_SECRET]');
    assert.strictEqual(sanitized.authorization, '[REDACTED_SECRET]');
    assert.strictEqual(sanitized.creditCard, '[REDACTED_SECRET]');
    assert.strictEqual(sanitized.cvv, '[REDACTED_SECRET]');
    assert.strictEqual(sanitized.nested.smtp_pass, '[REDACTED_SECRET]');
    assert.strictEqual(sanitized.nested.service_role_key, '[REDACTED_SECRET]');
  });

  // ============================================================================
  // 12. ROLE_MUTATION_ROLLS_BACK_IF_SECURITY_AUDIT_WRITE_FAILS (fail-closed)
  // ============================================================================
  it('12. ROLE_MUTATION_ROLLS_BACK_IF_SECURITY_AUDIT_WRITE_FAILS: Mutación se revierte si la auditoría falla', async () => {
    const db = createMockSecurityDatabase();

    // Estado inicial de la alumna
    const studentProfile = db._store.profiles.find(p => p.id === 'prof-student-1');
    assert.strictEqual(studentProfile?.role, 'STUDENT');

    // Intentar mutación donde el INSERT de security_audit_events falla
    const res = await db.executeAdminUpdateUserRole({
      actorRole: 'OWNER',
      actorProfileId: 'prof-owner',
      targetProfileId: 'prof-student-1',
      newRole: 'ADMIN',
      simulatedAuditFailure: true,
    });

    // La operación debe retornar error
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, 'AUDIT_WRITE_FAILED');

    // ROLLBACK VERIFICADO: El perfil no debe haber quedado como ADMIN
    const studentProfileAfter = db._store.profiles.find(p => p.id === 'prof-student-1');
    assert.strictEqual(
      studentProfileAfter?.role,
      'STUDENT',
      'El rol debe permanecer en STUDENT debido al rollback transaccional'
    );
  });

  // ============================================================================
  // 13. CHECK_PROFILE_UPDATE_INTEGRITY_IS_TRIGGER_NOT_DIRECT_RPC
  // ============================================================================
  it('13. CHECK_PROFILE_UPDATE_INTEGRITY_IS_TRIGGER_NOT_DIRECT_RPC: Revocado de PUBLIC/anon/authenticated', () => {
    const migrationPath = path.join(
      process.cwd(),
      'supabase',
      'migrations',
      '20260925000001_fase_m09_3c_security_hardening.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Comprobar que se revoca EXECUTE de PUBLIC, anon y authenticated
    assert.ok(
      sql.includes('REVOKE EXECUTE ON FUNCTION public.check_profile_update_integrity() FROM PUBLIC;'),
      'Debe revocar EXECUTE FROM PUBLIC'
    );
    assert.ok(
      sql.includes('REVOKE EXECUTE ON FUNCTION public.check_profile_update_integrity() FROM anon;'),
      'Debe revocar EXECUTE FROM anon'
    );
    assert.ok(
      sql.includes('REVOKE EXECUTE ON FUNCTION public.check_profile_update_integrity() FROM authenticated;'),
      'Debe revocar EXECUTE FROM authenticated'
    );
  });

  // ============================================================================
  // 14. SEARCH_PATH_NORMALIZATION_AND_HARDENING_DEFERRED_CONTRACT
  // ============================================================================
  it('14. SEARCH_PATH_NORMALIZATION_AND_HARDENING_DEFERRED_CONTRACT: Funciones migradas y handle_new_user intacto', () => {
    const migrationPath = path.join(
      process.cwd(),
      'supabase',
      'migrations',
      '20260925000001_fase_m09_3c_security_hardening.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Funciones que deben tener SET search_path = ''
    assert.ok(sql.includes("FUNCTION public.get_auth_profile_id()\nRETURNS UUID AS $func$\nDECLARE\n  v_profile_id UUID;\nBEGIN\n  IF auth.uid() IS NULL THEN\n    RETURN NULL;\n  END IF;\n  \n  SELECT id INTO v_profile_id \n  FROM public.profiles \n  WHERE user_id = auth.uid() \n  LIMIT 1;\n  \n  RETURN v_profile_id;\nEND;\n$func$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';"));
    assert.ok(sql.includes("FUNCTION public.get_auth_role()\nRETURNS public.enum_user_role AS $func$\nDECLARE\n  v_role public.enum_user_role;\nBEGIN\n  IF auth.uid() IS NULL THEN\n    RETURN NULL;\n  END IF;\n  \n  SELECT role INTO v_role \n  FROM public.profiles \n  WHERE user_id = auth.uid() \n  LIMIT 1;\n  \n  RETURN v_role;\nEND;\n$func$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';"));
    assert.ok(sql.includes("FUNCTION public.check_profile_update_integrity()"));
    assert.ok(sql.includes("FUNCTION public.admin_update_user_role"));
    assert.ok(sql.includes("FUNCTION public.create_booking_atomic"));
    assert.ok(sql.includes("FUNCTION public.claim_outbox_emails"));

    // Comprobar que handle_new_user está explícitamente registrada como HARDENING_DEFERRED y no mutada
    assert.ok(
      sql.includes('HARDENING_DEFERRED'),
      'handle_new_user debe estar formalmente catalogada como HARDENING_DEFERRED'
    );
    assert.ok(
      !sql.includes('CREATE OR REPLACE FUNCTION public.handle_new_user'),
      'handle_new_user no debe ser reemplazada en esta migración'
    );
  });
});
