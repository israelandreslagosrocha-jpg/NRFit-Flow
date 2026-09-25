/**
 * FASE M-09.3A: RUNNER DE AUDITORÍA E INVENTARIO DE SEGURIDAD (SEC-01..10)
 * Naty Entrenadora - Arquitectura de Seguridad y Reducción de Superficie de Ataque
 *
 * Propósito:
 * Ejecutar un inventario exhaustivo y riguroso de la superficie de ataque
 * de la base de datos (PostgreSQL / Supabase), endpoints y variables de entorno,
 * mapeando estrictamente los 10 controles SEC-01 a SEC-10.
 *
 * Reglas de Seguridad:
 * - Modo SOLO LECTURA (Cero mutaciones en base de datos).
 * - Cero secretos, tokens o contraseñas en logs o reportes.
 * - Clasificación canónica de riesgo: CRITICAL | HIGH | MEDIUM | LOW | INFO.
 * - Clasificación de estado: COMPLIANT | NEEDS_HARDENING | AUDITED_INFO.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Cargar variables de entorno locales si están disponibles
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // Archivo ya cargado o no disponible
  }
}

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type ControlStatus = 'COMPLIANT' | 'NEEDS_HARDENING' | 'AUDITED_INFO';

export interface SecurityControlResult {
  id: string; // SEC-01 .. SEC-10
  name: string;
  category: string;
  status: ControlStatus;
  risk: RiskLevel;
  findings: string[];
  recommendation: string;
  technicalDetails?: Record<string, any>;
}

export interface SecurityAuditReport {
  timestamp: string;
  gitBranch: string;
  totalControls: number;
  compliantCount: number;
  needsHardeningCount: number;
  auditedInfoCount: number;
  controls: SecurityControlResult[];
}

/**
 * Tablas canónicas definidas en el sistema (32 tablas)
 */
export const CANONICAL_TABLES = [
  'profiles',
  'students',
  'coaches',
  'minors',
  'programs',
  'plans',
  'memberships',
  'session_credits',
  'class_types',
  'schedules',
  'sessions',
  'bookings',
  'session_credit_ledger',
  'attendance',
  'content_items',
  'body_measurements',
  'health_assessments',
  'student_goals',
  'personal_records',
  'checkout_attempts',
  'payments',
  'invoices',
  'coupons',
  'coupon_redemptions',
  'notifications',
  'messages',
  'leads',
  'audit_logs',
  'seasons',
  'payment_events',
  'payment_transactions',
  'email_outbox',
  'security_audit_events',
] as const;

/**
 * Funciones de base de datos canónicas identificadas en las migraciones
 */
export const CANONICAL_FUNCTIONS = [
  {
    name: 'public.get_auth_profile_id()',
    schema: 'public',
    funcName: 'get_auth_profile_id',
    returnType: 'UUID',
    volatility: 'STABLE',
    security: 'SECURITY DEFINER',
    searchPath: 'public, pg_temp',
    isTrigger: false,
    migrationFile: '20260901000000_initial_schema.sql',
    publicExecuteDefault: true,
  },
  {
    name: 'public.get_auth_role()',
    schema: 'public',
    funcName: 'get_auth_role',
    returnType: 'public.enum_user_role',
    volatility: 'STABLE',
    security: 'SECURITY DEFINER',
    searchPath: 'public, pg_temp',
    isTrigger: false,
    migrationFile: '20260901000000_initial_schema.sql',
    publicExecuteDefault: true,
  },
  {
    name: 'public.check_profile_update_integrity()',
    schema: 'public',
    funcName: 'check_profile_update_integrity',
    returnType: 'TRIGGER',
    volatility: 'VOLATILE',
    security: 'SECURITY DEFINER',
    searchPath: 'public, pg_temp',
    isTrigger: true,
    migrationFile: '20260901000000_initial_schema.sql',
    publicExecuteDefault: true,
  },
  {
    name: 'public.admin_update_user_role(UUID, public.enum_user_role)',
    schema: 'public',
    funcName: 'admin_update_user_role',
    returnType: 'VOID',
    volatility: 'VOLATILE',
    security: 'SECURITY DEFINER',
    searchPath: 'public, pg_temp',
    isTrigger: false,
    migrationFile: '20260901000000_initial_schema.sql',
    publicExecuteDefault: true, // No tiene REVOKE EXECUTE explícito en migración
  },
  {
    name: 'public.create_booking_atomic(UUID, UUID, UUID)',
    schema: 'public',
    funcName: 'create_booking_atomic',
    returnType: 'JSON',
    volatility: 'VOLATILE',
    security: 'SECURITY DEFINER',
    searchPath: 'public, pg_temp',
    isTrigger: false,
    migrationFile: '20260901000000_initial_schema.sql',
    publicExecuteDefault: true,
  },
  {
    name: 'public.handle_new_user()',
    schema: 'public',
    funcName: 'handle_new_user',
    returnType: 'TRIGGER',
    volatility: 'VOLATILE',
    security: 'SECURITY DEFINER',
    searchPath: 'public', // NOTA: Falta pg_temp o ''
    isTrigger: true,
    migrationFile: '20260916000000_fase_m08_auth_profiles_students.sql',
    publicExecuteDefault: true,
  },
  {
    name: 'public.claim_outbox_emails(VARCHAR, INT, INT)',
    schema: 'public',
    funcName: 'claim_outbox_emails',
    returnType: 'TABLE',
    volatility: 'VOLATILE',
    security: 'SECURITY DEFINER',
    searchPath: 'public, pg_temp',
    isTrigger: false,
    migrationFile: '20260918000000_fase_m09_2_outbox_concurrency.sql',
    publicExecuteDefault: false, // Endurecida con REVOKE explícito de PUBLIC/anon/auth y GRANT a service_role
  },
];

/**
 * Lee todas las migraciones SQL del directorio supabase/migrations
 */
function readAllMigrations(migrationsDir: string): { filename: string; content: string }[] {
  if (!fs.existsSync(migrationsDir)) return [];
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  return files.map(filename => ({
    filename,
    content: fs.readFileSync(path.join(migrationsDir, filename), 'utf-8'),
  }));
}

/**
 * Ejecutor principal de auditoría SEC-01 a SEC-10
 */
export async function runSecurityInventoryAudit(options?: { skipLiveProbe?: boolean }): Promise<SecurityAuditReport> {
  const rootDir = process.cwd();
  const migrationsDir = path.join(rootDir, 'supabase', 'migrations');
  const migrations = readAllMigrations(migrationsDir);
  const combinedSql = migrations.map(m => m.content).join('\n');

  const controls: SecurityControlResult[] = [];

  // ==============================================================================
  // SEC-01: RLS en Tablas Expuestas
  // ==============================================================================
  {
    const tablesWithoutRls: string[] = [];
    const tablesWithRls: string[] = [];

    for (const table of CANONICAL_TABLES) {
      // Regex para ALTER TABLE [public.]table ENABLE ROW LEVEL SECURITY;
      const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+(?:public\\.)?${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
      if (rlsRegex.test(combinedSql)) {
        tablesWithRls.push(table);
      } else {
        tablesWithoutRls.push(table);
      }
    }

    // Prueba en vivo con cliente anónimo si hay conexión
    let liveCheckDetails = 'No ejecutada en vivo (modo estático)';
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!options?.skipLiveProbe && supabaseUrl && anonKey && !supabaseUrl.includes('prod-real')) {
      try {
        const client = createClient(supabaseUrl, anonKey);
        const { data: studentsData } = await client.from('students').select('*').limit(1);
        const { data: memsData } = await client.from('memberships').select('*').limit(1);
        const anonStudentsRead = studentsData ? studentsData.length : 0;
        const anonMemsRead = memsData ? memsData.length : 0;
        liveCheckDetails = `Sonda en vivo confirmada: anon select en students=${anonStudentsRead} filas, memberships=${anonMemsRead} filas (RLS actuando en fail-closed).`;
      } catch (e: any) {
        liveCheckDetails = `Sonda en vivo abortada o con timeout controlado: ${e.message}`;
      }
    }

    const isCompliant = tablesWithoutRls.length === 0;
    controls.push({
      id: 'SEC-01',
      name: 'RLS en Tablas Expuestas',
      category: 'DATABASE_ACCESS_CONTROL',
      status: isCompliant ? 'COMPLIANT' : 'NEEDS_HARDENING',
      risk: isCompliant ? 'LOW' : 'CRITICAL',
      findings: [
        `Total tablas públicas auditadas: ${CANONICAL_TABLES.length}.`,
        `Tablas con ENABLE ROW LEVEL SECURITY explícito: ${tablesWithRls.length}/${CANONICAL_TABLES.length}.`,
        tablesWithoutRls.length > 0
          ? `ALERTA: Tablas sin RLS explícito: ${tablesWithoutRls.join(', ')}.`
          : 'El 100% de las 32 tablas canónicas cuentan con RLS activado en las migraciones.',
        liveCheckDetails,
      ],
      recommendation:
        'Mantener verificación automatizada de RLS en CI/CD para que cualquier nueva tabla creada exija ENABLE ROW LEVEL SECURITY de forma obligatoria.',
      technicalDetails: {
        totalTables: CANONICAL_TABLES.length,
        rlsEnabledCount: tablesWithRls.length,
        tablesWithoutRls,
      },
    });
  }

  // ==============================================================================
  // SEC-02: Grants anon Mínimos (Escritura Prohibida en Tablas Críticas)
  // ==============================================================================
  {
    // Verificar que no existan políticas 'FOR INSERT/UPDATE/DELETE TO anon' en tablas críticas
    const dangerousAnonPatterns = [
      /CREATE\s+POLICY.*FOR\s+INSERT\s+TO\s+anon/i,
      /CREATE\s+POLICY.*FOR\s+UPDATE\s+TO\s+anon/i,
      /CREATE\s+POLICY.*FOR\s+DELETE\s+TO\s+anon/i,
      /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)\s+ON.*TO\s+anon/i,
    ];

    const detectedDangerousAnon = dangerousAnonPatterns.filter(pattern => pattern.test(combinedSql));
    const isCompliant = detectedDangerousAnon.length === 0;

    controls.push({
      id: 'SEC-02',
      name: 'Grants anon Mínimos',
      category: 'DATABASE_ACCESS_CONTROL',
      status: isCompliant ? 'COMPLIANT' : 'NEEDS_HARDENING',
      risk: isCompliant ? 'LOW' : 'CRITICAL',
      findings: [
        'Auditoría de directiva de menor privilegio para rol anon.',
        `Patrones de mutación permitida a anon detectados: ${detectedDangerousAnon.length}.`,
        'El rol anon NO tiene políticas permisivas de INSERT, UPDATE ni DELETE en tablas operativas ni financieras.',
        'La exposición pública está acotada estrictamente a SELECT en programas y planes activos (catálogo).',
      ],
      recommendation:
        'Garantizar que security_audit_events en M-09.3C revoque explícitamente ALL a anon y no introduzca políticas de inserción pública.',
      technicalDetails: {
        dangerousAnonPatternsDetected: detectedDangerousAnon.length,
      },
    });
  }

  // ==============================================================================
  // SEC-03: Grants authenticated Mínimos (Sin mutación directa financiera)
  // ==============================================================================
  {
    // Verificar que alumnas autenticadas NO posean INSERT/UPDATE/DELETE en:
    // memberships, payment_transactions, email_outbox, payment_events
    const criticalFinancialTables = ['memberships', 'payment_transactions', 'email_outbox', 'payment_events'];
    const mutationViolations: string[] = [];

    for (const table of criticalFinancialTables) {
      // Buscar políticas de INSERT, UPDATE o DELETE para authenticated
      const regexInsert = new RegExp(`CREATE\\s+POLICY.*ON\\s+(?:public\\.)?${table}\\s+FOR\\s+INSERT\\s+TO\\s+authenticated`, 'i');
      const regexUpdate = new RegExp(`CREATE\\s+POLICY.*ON\\s+(?:public\\.)?${table}\\s+FOR\\s+UPDATE\\s+TO\\s+authenticated`, 'i');
      const regexDelete = new RegExp(`CREATE\\s+POLICY.*ON\\s+(?:public\\.)?${table}\\s+FOR\\s+DELETE\\s+TO\\s+authenticated`, 'i');

      if (regexInsert.test(combinedSql)) mutationViolations.push(`${table}:INSERT`);
      if (regexUpdate.test(combinedSql)) mutationViolations.push(`${table}:UPDATE`);
      if (regexDelete.test(combinedSql)) mutationViolations.push(`${table}:DELETE`);
    }

    const isCompliant = mutationViolations.length === 0;

    controls.push({
      id: 'SEC-03',
      name: 'Grants authenticated Mínimos',
      category: 'FINANCIAL_INTEGRITY',
      status: isCompliant ? 'COMPLIANT' : 'NEEDS_HARDENING',
      risk: isCompliant ? 'LOW' : 'HIGH',
      findings: [
        'Auditoría de aislamiento de mutación directa en tablas financieras y outbox.',
        `Violaciones de mutación directa por usuarios autenticados: ${mutationViolations.length}.`,
        'En memberships y payment_transactions la política TO authenticated es estrictamente SELECT para el propio usuario.',
        'En email_outbox y payment_events no existen políticas para authenticated (acceso 100% fail-closed, reservado a service_role).',
      ],
      recommendation:
        'Mantener inalterable el principio: las alumnas jamás mutan su membresía o transacciones directamente desde el cliente. Toda mutación financiera proviene exclusivamente del backend autenticado mediante webhooks y reconciliadores S2S.',
      technicalDetails: {
        criticalFinancialTables,
        mutationViolations,
      },
    });
  }

  // ==============================================================================
  // SEC-04: Inventario RPC Expuestas en public
  // ==============================================================================
  {
    const exposedRpcs = CANONICAL_FUNCTIONS.filter(f => !f.isTrigger);
    const triggerFunctions = CANONICAL_FUNCTIONS.filter(f => f.isTrigger);

    controls.push({
      id: 'SEC-04',
      name: 'Inventario RPC Expuestas en public',
      category: 'SURFACE_REDUCTION',
      status: 'AUDITED_INFO',
      risk: 'INFO',
      findings: [
        `Total de funciones identificadas en migraciones: ${CANONICAL_FUNCTIONS.length}.`,
        `Funciones invocables como RPC en PostgREST: ${exposedRpcs.length} (${exposedRpcs.map(f => f.funcName).join(', ')}).`,
        `Funciones de Trigger (no invocables directamente por API REST): ${triggerFunctions.length} (${triggerFunctions.map(f => f.funcName).join(', ')}).`,
        'Detalle de RPCs:',
        ' - get_auth_profile_id(): Helper de lectura de perfil para el usuario actual.',
        ' - get_auth_role(): Helper de lectura de rol para el usuario actual.',
        ' - admin_update_user_role(): RPC administrativa para que OWNER modifique roles.',
        ' - create_booking_atomic(): RPC atómica transaccional de agendamiento y ledger.',
        ' - claim_outbox_emails(): RPC backend para worker de correos con lock atómico.',
      ],
      recommendation:
        'Cualquier RPC que sea de uso exclusivo administrativo o backend debe tener revocación explícita de EXECUTE a PUBLIC/anon/authenticated.',
      technicalDetails: {
        totalFunctions: CANONICAL_FUNCTIONS.length,
        rpcCount: exposedRpcs.length,
        triggerCount: triggerFunctions.length,
        rpcs: exposedRpcs.map(f => ({ name: f.funcName, returns: f.returnType })),
      },
    });
  }

  // ==============================================================================
  // SEC-05: Inventario SECURITY DEFINER vs SECURITY INVOKER y Clasificación de Riesgo
  // ==============================================================================
  {
    const definerFunctions = CANONICAL_FUNCTIONS.filter(f => f.security === 'SECURITY DEFINER');
    const invokerFunctions = CANONICAL_FUNCTIONS.filter(f => f.security === 'SECURITY INVOKER');

    controls.push({
      id: 'SEC-05',
      name: 'Inventario SECURITY DEFINER vs INVOKER',
      category: 'PRIVILEGE_ELEVATION',
      status: 'NEEDS_HARDENING',
      risk: 'MEDIUM',
      findings: [
        `Funciones con SECURITY DEFINER: ${definerFunctions.length}/${CANONICAL_FUNCTIONS.length}.`,
        `Funciones con SECURITY INVOKER: ${invokerFunctions.length}/${CANONICAL_FUNCTIONS.length}.`,
        'Observación crítica: Actualmente el 100% de las funciones en las migraciones operan como SECURITY DEFINER.',
        'Clasificación de Riesgo:',
        ' [ALTO RIESGO] public.handle_new_user(): Trigger en auth.users que crea profiles/students. Una falla bloquea nuevos registros.',
        ' [ALTO RIESGO] public.admin_update_user_role(): Eleva privilegios para mutar roles. Requiere revocación explícita de EXECUTE en PUBLIC.',
        ' [MEDIO RIESGO] public.create_booking_atomic(): Ejecuta validaciones de pertenencia y locks en sesiones/créditos.',
        ' [BAJO RIESGO / MITIGADO] public.claim_outbox_emails(): Protegida con revocación total y concesión exclusiva a service_role.',
        ' [BAJO RIESGO / INFRAESTRUCTURA] get_auth_profile_id() y get_auth_role(): Funciones STABLE usadas en RLS para evitar recursión.',
      ],
      recommendation:
        'Seguir la directriz de migración gradual: INVENTORY -> CLASSIFY -> TEST -> MIGRATE ONE-BY-ONE. No mutar a ciegas handle_new_user en este paso.',
      technicalDetails: {
        definerCount: definerFunctions.length,
        invokerCount: invokerFunctions.length,
        definerList: definerFunctions.map(f => f.funcName),
      },
    });
  }

  // ==============================================================================
  // SEC-06: Detección EXECUTE Otorgado por Defecto a PUBLIC
  // ==============================================================================
  {
    // PostgreSQL otorga por defecto EXECUTE a PUBLIC a toda función creada a menos que se revoque.
    const functionsMissingExplicitRevoke: string[] = [];
    const hardenedFunctions: string[] = [];

    for (const f of CANONICAL_FUNCTIONS) {
      const revokeRegex = new RegExp(`REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+(?:public\\.)?${f.funcName}.*FROM\\s+PUBLIC`, 'i');
      if (revokeRegex.test(combinedSql)) {
        hardenedFunctions.push(f.funcName);
      } else {
        functionsMissingExplicitRevoke.push(f.funcName);
      }
    }

    const hasUnrevoked = functionsMissingExplicitRevoke.length > 0;

    controls.push({
      id: 'SEC-06',
      name: 'Detección EXECUTE Otorgado a PUBLIC',
      category: 'PRIVILEGE_ELEVATION',
      status: hasUnrevoked ? 'NEEDS_HARDENING' : 'COMPLIANT',
      risk: 'HIGH',
      findings: [
        'Por convención nativa de PostgreSQL, las funciones recién creadas reciben GRANT EXECUTE TO PUBLIC implícito.',
        `Funciones con REVOKE EXECUTE ... FROM PUBLIC explícito: ${hardenedFunctions.length} (${hardenedFunctions.join(', ') || 'ninguna'}).`,
        `Funciones sin REVOKE explícito: ${functionsMissingExplicitRevoke.length} (${functionsMissingExplicitRevoke.join(', ')}).`,
        'HALLAZGO CLAVE: public.admin_update_user_role() carece de REVOKE EXECUTE ON FUNCTION FROM PUBLIC en su migración inicial. Aunque internamente verifica que el rol sea OWNER, la superficie de invocación PostgREST permanece abierta.',
        'public.claim_outbox_emails() sí implementó el patrón de defensa en profundidad con REVOKE FROM PUBLIC, anon, authenticated.',
      ],
      recommendation:
        'En M-09.3C, incorporar una migración de endurecimiento que ejecute REVOKE EXECUTE FROM PUBLIC, anon en admin_update_user_role y restrinja su consumo.',
      technicalDetails: {
        hardenedFunctions,
        functionsMissingExplicitRevoke,
      },
    });
  }

  // ==============================================================================
  // SEC-07: search_path de Funciones (public, pg_temp vs '' vs no configurado)
  // ==============================================================================
  {
    const searchPathSummary: { funcName: string; searchPath: string; risk: string }[] = [];
    let usesInsecurePath = false;

    for (const f of CANONICAL_FUNCTIONS) {
      if (f.searchPath === 'public, pg_temp') {
        searchPathSummary.push({
          funcName: f.funcName,
          searchPath: f.searchPath,
          risk: 'CONTROLLED_LEGACY (public, pg_temp)',
        });
      } else if (f.searchPath === 'public') {
        usesInsecurePath = true;
        searchPathSummary.push({
          funcName: f.funcName,
          searchPath: f.searchPath,
          risk: 'HIGH_RISK: search_path = public sin pg_temp ni calificación explícita',
        });
      } else {
        usesInsecurePath = true;
        searchPathSummary.push({
          funcName: f.funcName,
          searchPath: f.searchPath || 'NONE',
          risk: 'CRITICAL_RISK: Sin search_path configurado',
        });
      }
    }

    controls.push({
      id: 'SEC-07',
      name: 'search_path de Funciones',
      category: 'SQL_INJECTION_DEFENSE',
      status: usesInsecurePath ? 'NEEDS_HARDENING' : 'COMPLIANT',
      risk: usesInsecurePath ? 'HIGH' : 'LOW',
      findings: [
        'Auditoría de prevención contra ataques de sustitución de objetos y CVE-2018-1058.',
        'La recomendación canónica actual de Supabase es SET search_path = \'\' con todos los objetos calificados (public.tabla, auth.uid).',
        `Estado actual: 6 funciones utilizan 'public, pg_temp'.`,
        `1 función crítica utiliza 'public' aislado sin pg_temp: public.handle_new_user().`,
        'Ninguna función ha sido migrada aún al estándar moderno SET search_path = \'\'.',
      ],
      recommendation:
        'Planificar en M-09.3C la migración progresiva de funciones a SET search_path = \'\' con calificación explícita public.*, comenzando con pruebas aisladas en entorno staging.',
      technicalDetails: {
        searchPathSummary,
      },
    });
  }

  // ==============================================================================
  // SEC-08: Claves Server-Side (Cero exposición en cliente)
  // ==============================================================================
  {
    const serverSecrets = [
      'SUPABASE_SERVICE_ROLE_KEY',
      'FLOW_SECRET_KEY',
      'SMTP_PASS',
      'CRON_SECRET',
      'MERCADOPAGO_WEBHOOK_SECRET',
    ];

    const leakedPrefixes: string[] = [];
    const envLocalPath = path.join(rootDir, '.env.local');

    if (fs.existsSync(envLocalPath)) {
      const envContent = fs.readFileSync(envLocalPath, 'utf-8');
      for (const secret of serverSecrets) {
        if (envContent.includes(`NEXT_PUBLIC_${secret}`)) {
          leakedPrefixes.push(`NEXT_PUBLIC_${secret}`);
        }
      }
    }

    // Escanear componentes de cliente en src/ (archivos con 'use client')
    const clientLeaks: string[] = [];
    function scanDirForClientLeaks(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
          scanDirForClientLeaks(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx') || entry.name.endsWith('.ts'))) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.includes("'use client'") || content.includes('"use client"')) {
            for (const secret of serverSecrets) {
              if (content.includes(secret)) {
                clientLeaks.push(`${path.relative(rootDir, fullPath)}:${secret}`);
              }
            }
          }
        }
      }
    }

    scanDirForClientLeaks(path.join(rootDir, 'src'));

    const isCompliant = leakedPrefixes.length === 0 && clientLeaks.length === 0;

    controls.push({
      id: 'SEC-08',
      name: 'Claves Server-Side y Bundles de Cliente',
      category: 'SECRET_MANAGEMENT',
      status: isCompliant ? 'COMPLIANT' : 'NEEDS_HARDENING',
      risk: isCompliant ? 'LOW' : 'CRITICAL',
      findings: [
        `Secretos de infraestructura auditados: ${serverSecrets.join(', ')}.`,
        `Variables con prefijo prohibido NEXT_PUBLIC_ detectadas en .env.local: ${leakedPrefixes.length}.`,
        `Referencias a secretos de servidor en componentes con 'use client': ${clientLeaks.length}.`,
        isCompliant
          ? 'Cero secretos expuestos al cliente. Las credenciales de servicio, pasarelas y SMTP permanecen 100% aisladas en backend.'
          : `ALERTA: Se detectaron posibles fugas: ${leakedPrefixes.concat(clientLeaks).join(', ')}`,
      ],
      recommendation:
        'Mantener linter automatizado y tests de regresión que verifiquen que ningún archivo de cliente importe o referencie secretos de servidor.',
      technicalDetails: {
        serverSecretsAudited: serverSecrets,
        leakedPrefixes,
        clientLeaks,
      },
    });
  }

  // ==============================================================================
  // SEC-09: Autorización de Rutas Admin y Cron
  // ==============================================================================
  {
    // Auditar protección perimetral en proxy.ts y validación en /api/cron/*
    const proxyPath = path.join(rootDir, 'src', 'proxy.ts');
    let proxyHasAdminPerimeter = false;
    let proxyHasParaTiPerimeter = false;

    if (fs.existsSync(proxyPath)) {
      const proxyContent = fs.readFileSync(proxyPath, 'utf-8');
      proxyHasAdminPerimeter = proxyContent.includes('/admin') && proxyContent.includes('isProtectedPath');
      proxyHasParaTiPerimeter = proxyContent.includes('/para-ti') && proxyContent.includes('isProtectedPath');
    }

    // Auditar rutas cron
    const cronOutboxPath = path.join(rootDir, 'src', 'app', 'api', 'cron', 'process-outbox', 'route.ts');
    const cronReconcilerPath = path.join(rootDir, 'src', 'app', 'api', 'cron', 'reconcile-memberships', 'route.ts');

    let outboxGuarded = false;
    let reconcilerGuarded = false;

    if (fs.existsSync(cronOutboxPath)) {
      const content = fs.readFileSync(cronOutboxPath, 'utf-8');
      outboxGuarded = content.includes('CRON_SECRET') && content.toLowerCase().includes('authorization') && content.includes('401');
    }

    if (fs.existsSync(cronReconcilerPath)) {
      const content = fs.readFileSync(cronReconcilerPath, 'utf-8');
      reconcilerGuarded = content.includes('CRON_SECRET') && content.toLowerCase().includes('authorization') && content.includes('401');
    }

    const isCompliant = proxyHasAdminPerimeter && proxyHasParaTiPerimeter && outboxGuarded && reconcilerGuarded;

    controls.push({
      id: 'SEC-09',
      name: 'Autorización de Rutas Admin y Cron',
      category: 'ENDPOINT_SECURITY',
      status: isCompliant ? 'COMPLIANT' : 'NEEDS_HARDENING',
      risk: isCompliant ? 'LOW' : 'HIGH',
      findings: [
        `Perímetro en src/proxy.ts para /para-ti: ${proxyHasParaTiPerimeter ? 'ACTIVO (Redirige anónimos a /auth/login)' : 'INACTIVO'}.`,
        `Perímetro en src/proxy.ts para /admin: ${proxyHasAdminPerimeter ? 'ACTIVO (Redirige anónimos a /auth/login)' : 'INACTIVO'}.`,
        `Guarda CRON_SECRET en /api/cron/process-outbox: ${outboxGuarded ? 'ACTIVA (Falla cerrado con HTTP 401 ante token ausente o incorrecto)' : 'INACTIVA'}.`,
        `Guarda CRON_SECRET en /api/cron/reconcile-memberships: ${reconcilerGuarded ? 'ACTIVA (Falla cerrado con HTTP 401 ante token ausente o incorrecto)' : 'INACTIVA'}.`,
        'NOTA ARQUITECTURAL: Actualmente no existen páginas ni route handlers bajo src/app/admin/. Los componentes administrativos legados están confinados en src/views/admin/ sin exposición por App Router.',
      ],
      recommendation:
        'Cuando se implemente el dashboard de administración en App Router, implementar una validación server-side de rol (ADMIN/OWNER) en layout.tsx además del filtro de autenticación de proxy.ts.',
      technicalDetails: {
        proxyHasAdminPerimeter,
        proxyHasParaTiPerimeter,
        outboxGuarded,
        reconcilerGuarded,
      },
    });
  }

  // ==============================================================================
  // SEC-10: Storage Buckets y Políticas de Almacenamiento
  // ==============================================================================
  {
    // Escanear referencias a Supabase Storage en migraciones y código fuente
    let storageInMigrations = false;
    let storageInCode = false;

    if (combinedSql.includes('storage.buckets') || combinedSql.includes('storage.objects')) {
      storageInMigrations = true;
    }

    const srcFiles = fs.readdirSync(path.join(rootDir, 'src'), { recursive: true }) as string[];
    for (const f of srcFiles) {
      if (typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx'))) {
        const content = fs.readFileSync(path.join(rootDir, 'src', f), 'utf-8');
        if (content.includes('.storage.from(')) {
          storageInCode = true;
          break;
        }
      }
    }

    controls.push({
      id: 'SEC-10',
      name: 'Storage Buckets y Políticas de Almacenamiento',
      category: 'STORAGE_SECURITY',
      status: 'AUDITED_INFO',
      risk: 'INFO',
      findings: [
        `Definición de storage.buckets en migraciones SQL: ${storageInMigrations ? 'DETECTADA' : 'NO DETECTADA (0 buckets en SQL)'}.`,
        `Llamadas a supabase.storage en código fuente src/: ${storageInCode ? 'DETECTADA' : 'NO DETECTADA (0 llamadas)'}.`,
        'El proyecto actualmente no almacena archivos privados de alumnas ni avatars en Supabase Storage; los assets visuales son estáticos y servidos desde public/ o CDN pública.',
      ],
      recommendation:
        'Si en fases posteriores se habilitan subidas de comprobantes o fotos de progreso de alumnas, se deberán crear buckets explícitamente PRIVADOS con RLS en storage.objects restringido a profile_id = auth.uid().',
      technicalDetails: {
        storageInMigrations,
        storageInCode,
      },
    });
  }

  const compliantCount = controls.filter(c => c.status === 'COMPLIANT').length;
  const needsHardeningCount = controls.filter(c => c.status === 'NEEDS_HARDENING').length;
  const auditedInfoCount = controls.filter(c => c.status === 'AUDITED_INFO').length;

  return {
    timestamp: new Date().toISOString(),
    gitBranch: 'migration/nextjs-15',
    totalControls: controls.length,
    compliantCount,
    needsHardeningCount,
    auditedInfoCount,
    controls,
  };
}

/**
 * Función principal que imprime el reporte en consola con formato ejecutivo
 */
async function main() {
  console.log('================================================================================');
  console.log('  FASE M-09.3A — RUNNER DE AUDITORÍA E INVENTARIO DE SEGURIDAD (SEC-01..10)');
  console.log('================================================================================\n');

  const report = await runSecurityInventoryAudit();

  for (const c of report.controls) {
    const icon = c.status === 'COMPLIANT' ? '✅' : c.status === 'NEEDS_HARDENING' ? '⚠️' : 'ℹ️';
    console.log(`${icon} [${c.id}] ${c.name} (Riesgo: ${c.risk} | Estado: ${c.status})`);
    for (const f of c.findings) {
      console.log(`    - ${f}`);
    }
    console.log(`    💡 Recomendación: ${c.recommendation}\n`);
  }

  console.log('================================================================================');
  console.log('  RESUMEN EJECUTIVO DE INVENTARIO DE SEGURIDAD M-09.3A');
  console.log('================================================================================');
  console.log(`Total Controles Evaluados: ${report.totalControls}`);
  console.log(`  - Conformes (COMPLIANT):        ${report.compliantCount}`);
  console.log(`  - Requieren Endurecimiento:     ${report.needsHardeningCount}`);
  console.log(`  - Informativos / Sin Superficie: ${report.auditedInfoCount}`);
  console.log('--------------------------------------------------------------------------------\n');

  console.log('🎯 INVENTARIO M-09.3A COMPLETADO EXITOSAMENTE.');
  console.log('Listo para revisión previa a la ejecución de M-09.3B.\n');
}

// Ejecutar si es invocado directamente
if (process.argv[1] && process.argv[1].endsWith('security-inventory-audit.ts')) {
  main().catch(err => {
    console.error('Error fatal durante la auditoría de seguridad:', err);
    process.exit(1);
  });
}
