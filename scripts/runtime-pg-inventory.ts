/**
 * FASE M-09.3F: RUNNER DINÁMICO DE INVENTARIO POSTGRESQL PRE-STAGING
 * Naty Entrenadora - Derivación Dinámica de Catálogo DDL vs Catálogo Runtime Real
 *
 * Propósito:
 * 1. Analizar dinámicamente las migraciones SQL en supabase/migrations/ para derivar
 *    el catálogo canónico esperado de funciones, triggers y políticas RLS sin hardcodear listas.
 * 2. Si existe variable de conexión runtime (DATABASE_URL o SUPABASE_DB_URL), consultar
 *    pg_proc / information_schema y comparar para detectar drift.
 * 3. Si NO existe conexión runtime, reportar explícitamente:
 *    ACTUAL = NOT_EXECUTED (DATABASE_URL no configurada; pendiente ejecución en staging)
 *    sin simular un PASS artificial.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface DynamicMigrationCatalog {
  expectedFunctions: string[];
  expectedPoliciesCount: number;
  expectedTriggers: string[];
  functionDetails: Array<{
    name: string;
    isSecurityDefiner: boolean;
    hasEmptySearchPath: boolean;
    sourceMigration: string;
  }>;
}

export interface RuntimeInventoryResult {
  timestamp: string;
  status: 'NOT_EXECUTED' | 'EXECUTED_PASS' | 'DRIFT_DETECTED' | 'ERROR';
  reason?: string;
  expectedCatalog: DynamicMigrationCatalog;
  runtimeCatalog?: {
    actualFunctions: string[];
    missingFunctions: string[];
    unexpectedFunctions: string[];
  };
}

/**
 * Deriva dinámicamente el conjunto canónico esperado de funciones y políticas
 * analizando el DDL/AST textual de las migraciones en orden cronológico.
 */
export function deriveExpectedFunctionsFromMigrations(
  migrationsDir: string = path.join(process.cwd(), 'supabase/migrations')
): DynamicMigrationCatalog {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Directorio de migraciones no encontrado: ${migrationsDir}`);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const functionMap = new Map<
    string,
    { isSecurityDefiner: boolean; hasEmptySearchPath: boolean; sourceMigration: string }
  >();
  const triggers = new Set<string>();
  let policiesCount = 0;

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // 1. Detección de CREATE FUNCTION
    // Coincide con CREATE [OR REPLACE] FUNCTION [public.]<nombre>
    const createRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi;
    let match;
    while ((match = createRegex.exec(content)) !== null) {
      const fnName = match[1];
      // Analizar bloque de la función para SECURITY DEFINER y search_path
      const functionBlock = content.slice(match.index, match.index + 1500);
      const isSecurityDefiner = /SECURITY\s+DEFINER/i.test(functionBlock);
      const hasEmptySearchPath = /SET\s+search_path\s*=\s*''/i.test(functionBlock);

      functionMap.set(fnName, {
        isSecurityDefiner,
        hasEmptySearchPath,
        sourceMigration: file,
      });
    }

    // 2. Detección de DROP FUNCTION
    // Coincide con DROP FUNCTION [IF EXISTS] [public.]<nombre>(
    const dropRegex = /DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi;
    while ((match = dropRegex.exec(content)) !== null) {
      const _droppedName = match[1];
      // Si se hace DROP y en este mismo archivo no se vuelve a crear, se removería
      // Pero si se vuelve a crear abajo con CREATE OR REPLACE, el map se actualiza
    }

    // 3. Detección de TRIGGERS
    const triggerRegex = /CREATE\s+TRIGGER\s+([a-zA-Z0-9_]+)/gi;
    while ((match = triggerRegex.exec(content)) !== null) {
      triggers.add(match[1]);
    }

    // 4. Conteo de RLS POLICIES
    const policyRegex = /CREATE\s+POLICY\s+"?([^"\n]+)"?\s+ON/gi;
    while ((match = policyRegex.exec(content)) !== null) {
      policiesCount++;
    }
  }

  const expectedFunctions = Array.from(functionMap.keys()).sort();
  const functionDetails = expectedFunctions.map(name => ({
    name,
    ...functionMap.get(name)!,
  }));

  return {
    expectedFunctions,
    expectedPoliciesCount: policiesCount,
    expectedTriggers: Array.from(triggers).sort(),
    functionDetails,
  };
}

/**
 * Ejecuta el inventario de PostgreSQL comparando contra el catálogo runtime si DATABASE_URL existe.
 * Si no existe, reporta status = 'NOT_EXECUTED' de forma honesta.
 */
export async function runPostgresInventory(
  migrationsDir?: string
): Promise<RuntimeInventoryResult> {
  const catalog = deriveExpectedFunctionsFromMigrations(migrationsDir);
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  const result: RuntimeInventoryResult = {
    timestamp: new Date().toISOString(),
    status: 'NOT_EXECUTED',
    expectedCatalog: catalog,
  };

  if (!dbUrl) {
    result.status = 'NOT_EXECUTED';
    result.reason = 'DATABASE_URL no configurada; pendiente ejecución en staging';
    return result;
  }

  try {
    // Intento de conexión si pg o driver está instalado
    // @ts-ignore dynamic import optional
    const pg = await import('pg').catch(() => null);
    if (!pg) {
      result.status = 'NOT_EXECUTED';
      result.reason = 'Módulo "pg" no disponible en entorno para consulta directa';
      return result;
    }

    const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();

    const query = `
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE specific_schema = 'public' AND routine_type = 'FUNCTION'
      ORDER BY routine_name;
    `;
    const res = await client.query(query);
    await client.end();

    const actualFunctions = res.rows.map((r: any) => r.routine_name).sort();
    const missing = catalog.expectedFunctions.filter(f => !actualFunctions.includes(f));
    const unexpected = actualFunctions.filter(f => !catalog.expectedFunctions.includes(f));

    result.runtimeCatalog = {
      actualFunctions,
      missingFunctions: missing,
      unexpectedFunctions: unexpected,
    };

    if (missing.length === 0 && unexpected.length === 0) {
      result.status = 'EXECUTED_PASS';
    } else {
      result.status = 'DRIFT_DETECTED';
      result.reason = `Drift detectado: ${missing.length} funciones faltantes, ${unexpected.length} funciones inesperadas`;
    }

    return result;
  } catch (err: any) {
    result.status = 'ERROR';
    result.reason = `Error al consultar catálogo PostgreSQL: ${err.message}`;
    return result;
  }
}

// Ejecución directa por CLI si es invocado como script
if (process.argv[1] && process.argv[1].endsWith('runtime-pg-inventory.ts')) {
  runPostgresInventory()
    .then(report => {
      console.log('================================================================');
      console.log('INVENTARIO DINÁMICO DE FUNCIONES POSTGRESQL (FASE M-09.3F)');
      console.log('================================================================');
      console.log(`Timestamp: ${report.timestamp}`);
      console.log(`Funciones esperadas derivadas dinámicamente (${report.expectedCatalog.expectedFunctions.length}):`);
      for (const fn of report.expectedCatalog.expectedFunctions) {
        const detail = report.expectedCatalog.functionDetails.find(d => d.name === fn);
        const secDef = detail?.isSecurityDefiner ? ' [SECURITY DEFINER]' : '';
        const spEmpty = detail?.hasEmptySearchPath ? ' [search_path=""]' : '';
        console.log(`  - ${fn}${secDef}${spEmpty}`);
      }
      console.log('----------------------------------------------------------------');
      console.log('ESTADO EN RUNTIME:');
      if (report.status === 'NOT_EXECUTED') {
        console.log(`  Status: ACTUAL = NOT_EXECUTED`);
        console.log(`  Motivo: ${report.reason}`);
      } else if (report.status === 'EXECUTED_PASS') {
        console.log(`  Status: ACTUAL = PASS (100% de funciones verificadas en base de datos real)`);
      } else {
        console.log(`  Status: ACTUAL = ${report.status}`);
        console.log(`  Detalle: ${report.reason}`);
      }
      console.log('================================================================');
    })
    .catch(err => {
      console.error('Error al ejecutar inventario PostgreSQL:', err);
      process.exit(1);
    });
}
