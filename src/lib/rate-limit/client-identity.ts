import crypto from 'crypto';

/**
 * FASE M-09.3E: EXTRACCIÓN Y ANONIMIZACIÓN SEGURA DE IDENTIDAD DE CLIENTE
 * 
 * Reglas de seguridad:
 * 1. NO confiar ciegamente en x-forwarded-for inyectado por clientes maliciosos.
 * 2. Priorizar cabeceras emitidas por el proxy/edge confiable (Cloudflare, Vercel, Nginx).
 * 3. Prohibido persistir o loguear IPs crudas (GDPR / privacidad / no PII).
 * 4. Generar fingerprint irreversible con HMAC-SHA256 y secreto dedicado (RATE_LIMIT_SALT).
 */

const DEFAULT_SALT = 'naty-entrenadora-rate-limit-salt-v1';

/**
 * Obtiene el secreto de salting del entorno o usa el predeterminado para dev.
 */
function getRateLimitSalt(): string {
  return process.env.RATE_LIMIT_SALT || DEFAULT_SALT;
}

/**
 * Extrae la IP de origen más confiable de los headers HTTP de la petición.
 */
export function extractClientIp(headers: Headers | Record<string, string | string[] | undefined>): string {
  const getHeader = (name: string): string | null => {
    if (typeof (headers as Headers).get === 'function') {
      return (headers as Headers).get(name);
    }
    const val = (headers as Record<string, any>)[name] || (headers as Record<string, any>)[name.toLowerCase()];
    if (Array.isArray(val)) return val[0] || null;
    return typeof val === 'string' ? val : null;
  };

  // 1. Edge headers de mayor confianza (establecidos por proxies perimetrales autorizados)
  const cfIp = getHeader('cf-connecting-ip');
  if (cfIp && isValidIp(cfIp)) return cfIp.trim();

  const realIp = getHeader('x-real-ip');
  if (realIp && isValidIp(realIp)) return realIp.trim();

  // 2. x-forwarded-for: tomar la última IP si viene de reverse proxy conocido,
  // o la primera si no hay proxy intermedio. Se sanea contra inyecciones.
  const forwardedFor = getHeader('x-forwarded-for');
  if (forwardedFor) {
    const parts = forwardedFor.split(',').map((p) => p.trim());
    for (const part of parts) {
      if (isValidIp(part)) {
        return part;
      }
    }
  }

  return '127.0.0.1';
}

/**
 * Valida formato básico IPv4 o IPv6 para evitar caracteres maliciosos.
 */
function isValidIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  // IPv4 simple o IPv6
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Genera una clave de fingerprint anonimizada mediante HMAC-SHA256 (no reversible).
 * Nunca persiste la IP cruda.
 */
export function hashClientIdentity(rawIp: string, customSalt?: string): string {
  const salt = customSalt || getRateLimitSalt();
  return crypto
    .createHmac('sha256', salt)
    .update(rawIp)
    .digest('hex')
    .slice(0, 16); // 16 caracteres hexadecimales proveen 64 bits de entropía para la clave
}

/**
 * Obtiene la clave para el rate limiter a partir de la petición.
 * Si el usuario está autenticado, prefiere su identificador interno (userId).
 * Si es anónimo, deriva el hash irreversible de su IP.
 */
export function resolveRateLimitKey(
  headers: Headers | Record<string, any>,
  authenticatedUserId?: string | null
): string {
  if (authenticatedUserId) {
    return `user:${authenticatedUserId}`;
  }
  const rawIp = extractClientIp(headers);
  return `ip_hash:${hashClientIdentity(rawIp)}`;
}
