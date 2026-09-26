/**
 * FASE M-09.3F: RUNNER DINÁMICO DE INVENTARIO POSTGRESQL PRE-STAGING
 * Naty Entrenadora - Derivación Dinámica de Catálogo DDL vs Catálogo Runtime Real
 *
 * Propósito:
 * 1. Analizar dinámicamente las migraciones SQL en supabase/migrations/ para derivar
 *    el catálogo canónico esperado de funciones, triggers y políticas RLS sin hardcodear listas.
 * 2. Reconstruir cronológicamente el estado efectivo de seguridad DDL plegando CREATE,
 *    DROP, REVOKE y GRANT en el orden de aplicación de migraciones.
 * 3. Si existe variable de conexión runtime (DATABASE_URL o SUPABASE_DB_URL), consultar
 *    pg_proc / information_schema y comparar para detectar drift.
 * 4. Si NO existe conexión runtime, reportar explícitamente:
 *    ACTUAL = NOT_EXECUTED (DATABASE_URL no configurada; pendiente ejecución en staging)
 *    sin simular un PASS artificial.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface FunctionSecurityDetail {
  name: string;
  signature: string;
  isSecurityDefiner: boolean;
  hasEmptySearchPath: boolean;
  searchPath: string;
  expectedExecuteRoles: string[];
  sourceMigrationFinalDefinition: string;
  sourceMigration: string; // Alias para compatibilidad hacia atrás
}

export interface DynamicMigrationCatalog {
  expectedFunctions: string[];
  expectedPoliciesCount: number;
  expectedTriggers: string[];
  functionDetails: FunctionSecurityDetail[];
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

interface MutableFunctionState {
  name: string;
  signature: string;
  isSecurityDefiner: boolean;
  hasEmptySearchPath: boolean;
  searchPath: string;
  sourceMigrationFinalDefinition: string;
  permittedRoles: Set<string>;
}

/**
 * Deriva dinámicamente el conjunto canónico esperado de funciones y políticas
 * analizando el DDL/AST textual de las migraciones en orden cronológico y plegando
 * el estado acumulado de privilegios y hardening (CREATE, DROP, REVOKE, GRANT).
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

  const functionMap = new Map<string, MutableFunctionState>();
  const triggers = new Set<string>();
  let policiesCount = 0;

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    type MigrationEvent =
      | {
          type: 'CREATE';
          pos: number;
          name: string;
          rawArgs: string;
          isSecurityDefiner: boolean;
          searchPath: string;
          hasEmptySearchPath: boolean;
        }
      | {
          type: 'DROP';
          pos: number;
          name: string;
        }
      | {
          type: 'REVOKE';
          pos: number;
          name: string;
          roles: string[];
        }
      | {
          type: 'GRANT';
          pos: number;
          name: string;
          roles: string[];
        };

    const events: MigrationEvent[] = [];

    // 1. Detección de CREATE FUNCTION con manejo de paréntesis balanceados para parámetros
    const createStartRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi;
    let match: RegExpExecArray | null;
    while ((match = createStartRegex.exec(content)) !== null) {
      const fnName = match[1];
      const pos = match.index;
      const openParenIndex = pos + match[0].length - 1;

      // Paréntesis balanceados para soportar tipos con parámetros como VARCHAR(50) o INT(10)
      let depth = 1;
      let i = openParenIndex + 1;
      while (i < content.length && depth > 0) {
        if (content[i] === '(') depth++;
        else if (content[i] === ')') depth--;
        i++;
      }
      const rawArgs = content.slice(openParenIndex + 1, i - 1);
      const afterArgsIndex = i;

      // Localizar cuerpo de la función mediante delimitador dólar ($tag$ ... $tag$)
      const asRegex = /AS\s+\$([a-zA-Z0-9_]*)\$/gi;
      asRegex.lastIndex = afterArgsIndex;
      const asMatch = asRegex.exec(content);

      let fullStatement = '';
      if (asMatch) {
        const tag = asMatch[1];
        const closeTag = `$${tag}$`;
        const bodyStartIndex = asMatch.index + asMatch[0].length;
        const closeIndex = content.indexOf(closeTag, bodyStartIndex);
        if (closeIndex !== -1) {
          const afterCloseIndex = closeIndex + closeTag.length;
          const semiIndex = content.indexOf(';', afterCloseIndex);
          fullStatement = content.slice(pos, semiIndex !== -1 ? semiIndex + 1 : afterCloseIndex);
        }
      }

      if (!fullStatement) {
        const semiIndex = content.indexOf(';', afterArgsIndex);
        fullStatement = content.slice(pos, semiIndex !== -1 ? semiIndex + 1 : pos + 2500);
      }

      const isSecurityDefiner = /SECURITY\s+DEFINER/i.test(fullStatement);
      const spMatch = /SET\s+search_path\s*=\s*(?:'([^']*)'|"([^"]*)"|([a-zA-Z0-9_]+))/i.exec(fullStatement);
      let searchPath = 'unset';
      let hasEmptySearchPath = false;
      if (spMatch) {
        const rawVal = spMatch[1] ?? spMatch[2] ?? spMatch[3] ?? '';
        if (rawVal === '') {
          searchPath = "''";
          hasEmptySearchPath = true;
        } else {
          searchPath = rawVal;
          hasEmptySearchPath = false;
        }
      }

      events.push({
        type: 'CREATE',
        pos,
        name: fnName,
        rawArgs,
        isSecurityDefiner,
        searchPath,
        hasEmptySearchPath,
      });
    }

    // 2. Detección de DROP FUNCTION
    const dropRegex = /DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/gi;
    while ((match = dropRegex.exec(content)) !== null) {
      events.push({
        type: 'DROP',
        pos: match.index,
        name: match[1],
      });
    }

    // 3. Detección de REVOKE ON FUNCTION
    const revokeRegex = /REVOKE\s+(?:ALL|EXECUTE)\s+ON\s+FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\s*\([^)]*\))?\s+FROM\s+([^;]+);/gi;
    while ((match = revokeRegex.exec(content)) !== null) {
      const roles = match[2].split(',').map(r => r.trim()).filter(Boolean);
      events.push({
        type: 'REVOKE',
        pos: match.index,
        name: match[1],
        roles,
      });
    }

    // 4. Detección de GRANT ON FUNCTION
    const grantRegex = /GRANT\s+(?:ALL|EXECUTE)\s+ON\s+FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\s*\([^)]*\))?\s+TO\s+([^;]+);/gi;
    while ((match = grantRegex.exec(content)) !== null) {
      const roles = match[2].split(',').map(r => r.trim()).filter(Boolean);
      events.push({
        type: 'GRANT',
        pos: match.index,
        name: match[1],
        roles,
      });
    }

    // Ordenar eventos cronológicamente según posición en el archivo
    events.sort((a, b) => a.pos - b.pos);

    // Plegado acumulativo de estado
    for (const ev of events) {
      if (ev.type === 'CREATE') {
        const cleanArgs = ev.rawArgs.replace(/\s+/g, ' ').trim();
        const signature = `public.${ev.name}(${cleanArgs})`;
        let state = functionMap.get(ev.name);
        if (!state) {
          state = {
            name: ev.name,
            signature,
            isSecurityDefiner: ev.isSecurityDefiner,
            hasEmptySearchPath: ev.hasEmptySearchPath,
            searchPath: ev.searchPath,
            sourceMigrationFinalDefinition: file,
            permittedRoles: new Set(['PUBLIC']), // Comportamiento por defecto en Postgres al crear función
          };
          functionMap.set(ev.name, state);
        } else {
          // CREATE OR REPLACE actualiza firma, atributos de seguridad y archivo fuente
          state.signature = signature;
          state.isSecurityDefiner = ev.isSecurityDefiner;
          state.hasEmptySearchPath = ev.hasEmptySearchPath;
          state.searchPath = ev.searchPath;
          state.sourceMigrationFinalDefinition = file;
        }
      } else if (ev.type === 'DROP') {
        functionMap.delete(ev.name);
      } else if (ev.type === 'REVOKE') {
        const state = functionMap.get(ev.name);
        if (state) {
          for (const role of ev.roles) {
            if (role.toUpperCase() === 'PUBLIC') {
              state.permittedRoles.delete('PUBLIC');
              state.permittedRoles.delete('public');
            } else {
              state.permittedRoles.delete(role.toLowerCase());
            }
          }
        }
      } else if (ev.type === 'GRANT') {
        const state = functionMap.get(ev.name);
        if (state) {
          for (const role of ev.roles) {
            state.permittedRoles.add(role.toLowerCase());
          }
        }
      }
    }

    // Detección de TRIGGERS
    const triggerRegex = /CREATE\s+TRIGGER\s+([a-zA-Z0-9_]+)/gi;
    while ((match = triggerRegex.exec(content)) !== null) {
      triggers.add(match[1]);
    }

    // Conteo de RLS POLICIES
    const policyRegex = /CREATE\s+POLICY\s+"?([^"\n]+)"?\s+ON/gi;
    while ((match = policyRegex.exec(content)) !== null) {
      policiesCount++;
    }
  }

  const expectedFunctions = Array.from(functionMap.keys()).sort();
  const functionDetails: FunctionSecurityDetail[] = expectedFunctions.map(name => {
    const state = functionMap.get(name)!;
    return {
      name: state.name,
      signature: state.signature,
      isSecurityDefiner: state.isSecurityDefiner,
      hasEmptySearchPath: state.hasEmptySearchPath,
      searchPath: state.searchPath,
      expectedExecuteRoles: Array.from(state.permittedRoles).sort(),
      sourceMigrationFinalDefinition: state.sourceMigrationFinalDefinition,
      sourceMigration: state.sourceMigrationFinalDefinition,
    };
  });

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
        const secDef = detail?.isSecurityDefiner ? ' [SECURITY DEFINER]' : ' [SECURITY INVOKER]';
        const spEmpty = detail?.hasEmptySearchPath ? ' [search_path=""]' : ` [search_path=${detail?.searchPath || 'unset'}]`;
        const roles = detail && detail.expectedExecuteRoles.length > 0 ? ` [roles: ${detail.expectedExecuteRoles.join(', ')}]` : ' [roles: none]';
        console.log(`  - ${detail?.signature || fn}${secDef}${spEmpty}${roles}`);
        if (detail?.sourceMigrationFinalDefinition) {
          console.log(`    (Definición final: ${detail.sourceMigrationFinalDefinition})`);
        }
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
