/**
 * FASE M-09.3E: INTERFACES Y CONTRATOS DE RATE LIMITING Y PROTECCIÓN CONTRA ABUSO
 * Naty Entrenadora - Arquitectura Desacoplada y Mínimo Privilegio
 */

export type RateLimitStatus = 'ALLOWED' | 'LIMITED' | 'PROVIDER_UNAVAILABLE';

export interface RateLimitResult {
  /** Indica si la petición puede proceder */
  allowed: boolean;
  /** Estado canónico del evaluador de límites */
  status: RateLimitStatus;
  /** Límite máximo configurado en la ventana */
  limit: number;
  /** Peticiones restantes en la ventana actual */
  remaining: number;
  /** Segundos restantes para el reinicio de la ventana */
  resetSeconds: number;
  /** Segundos que el cliente debe esperar antes de reintentar (para HTTP 429) */
  retryAfterSeconds?: number;
  /** Identificador de política para cabeceras Structured Fields según Internet-Draft IETF */
  policyId?: string;
  /** Definición de política según Internet-Draft IETF */
  policy?: string;
}

export interface RateLimitOptions {
  /** Espacio de nombres aislado por superficie (ej. 'flow-callback', 'cron', 'auth-login') */
  namespace: string;
  /** Identificador único anonimizado (hash de IP, user_id, o clave de bulkhead) */
  key: string;
  /** Cuota máxima permitida en la ventana */
  limit: number;
  /** Duración de la ventana en segundos */
  windowSeconds: number;
  /** Identificador de política opcional para cabeceras Structured Fields */
  policyId?: string;
}

export interface RateLimitProvider {
  /** Nombre descriptivo del provider ('memory', 'distributed', 'unconfigured') */
  readonly name: string;
  /** Evalúa y actualiza la cuota para una clave en una ventana deslizante */
  checkLimit(options: RateLimitOptions): Promise<RateLimitResult>;
}

export interface EndpointRateLimitConfig {
  limit: number;
  windowSeconds: number;
  policyId: string;
  /** Indica si el fallo del provider permite continuar (fail-open) o bloquea (fail-closed) */
  fallbackOnProviderFailure: 'ALLOW' | 'BLOCK';
}
