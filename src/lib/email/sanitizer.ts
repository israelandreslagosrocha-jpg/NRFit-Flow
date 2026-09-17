/**
 * M-09.2: Sanitizador de Errores y Estrategia de Backoff para Outbox
 * 
 * Garantiza que:
 * 1. Jamás se persistan credenciales SMTP, contraseñas, tokens ni PII sensible en `last_error`.
 * 2. Se aplique un backoff escalonado no infinito con estado terminal único `DEAD_LETTER`.
 */

export const MAX_OUTBOX_ATTEMPTS = 5;
export const DEFAULT_LEASE_SECONDS = 300; // 5 minutos de lease timeout

/**
 * Sanitiza cualquier mensaje o excepción antes de almacenarlo en la base de datos.
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';

  let raw = '';
  if (typeof error === 'string') {
    raw = error;
  } else if (error instanceof Error) {
    raw = `${error.name}: ${error.message}`;
  } else if (typeof error === 'object') {
    try {
      raw = JSON.stringify(error);
    } catch {
      raw = String(error);
    }
  } else {
    raw = String(error);
  }

  let sanitized = raw
    // 1. Eliminar credenciales SMTP / Passwords / Secrets
    .replace(/(?:password|pass|secret|key)\s*[:=]\s*['"]?([^\s'";,]+)['"]?/gi, 'password=[REDACTED_SECRET]')
    // 2. Eliminar tokens y portadores (token=..., Bearer ...)
    .replace(/(?:token|auth|bearer)\s*[:= ]\s*['"]?([^\s'";,]+)['"]?/gi, 'token=[REDACTED_TOKEN]')
    // 3. Eliminar cadenas Base64 largas independientes (típicamente tokens SASL o hashes)
    .replace(/\b[A-Za-z0-9+/]{24,}={0,2}\b/g, '[REDACTED_TOKEN]')
    // 4. Eliminar números de tarjeta de crédito (13-19 dígitos)
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[REDACTED_CARD]')
    // 5. Eliminar URLs con credenciales embebidas (https://user:pass@host)
    .replace(/https?:\/\/[^:]+:[^@]+@/gi, 'https://[REDACTED_AUTH]@')
    // 6. Sanitizar emails de terceros accidentales
    .replace(/[a-zA-Z0-9._%+-]+@(?!natyentrenadora\.com)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '[REDACTED_EMAIL]');

  // Truncar a un tamaño seguro para almacenamiento y observabilidad
  if (sanitized.length > 500) {
    sanitized = sanitized.slice(0, 497) + '...';
  }

  return sanitized.trim();
}

/**
 * Calcula la fecha del próximo reintento según el número de intentos completados.
 * Estrategia de backoff escalonado:
 * - Intento 1: +1 minuto
 * - Intento 2: +5 minutos
 * - Intento 3: +15 minutos
 * - Intento 4: +60 minutos
 * - Intento >= 5: null (Agotado -> estado terminal DEAD_LETTER)
 */
export function calculateNextAttempt(attempts: number, baseDate: Date = new Date()): Date | null {
  if (attempts >= MAX_OUTBOX_ATTEMPTS) {
    return null;
  }

  const delaysMinutes = [1, 5, 15, 60];
  const delayMinutes = delaysMinutes[attempts - 1] ?? 60;

  return new Date(baseDate.getTime() + delayMinutes * 60 * 1000);
}
