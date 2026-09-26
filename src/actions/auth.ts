'use server';

import { headers } from 'next/headers.js';
import crypto from 'crypto';
import { checkRateLimit, resolveRateLimitKey } from '../lib/rate-limit/index.ts';
import { RATE_LIMIT_CONFIG } from '../lib/rate-limit/config.ts';
import { logger } from '../lib/logger.ts';

export type AuthSensitiveAction = 'login' | 'register' | 'forgot_password';

export interface AuthRateLimitCheckResult {
  allowed: boolean;
  status: 'ALLOWED' | 'LIMITED' | 'PROVIDER_UNAVAILABLE';
  error?: string;
  retryAfterSeconds?: number;
}

/**
 * FASE M-09.3E: PROTECCIÓN DE OPERACIONES SENSIBLES DE AUTENTICACIÓN
 * 
 * Evalúa cuotas de rate limiting sobre la operación sensible real (login, register, recovery),
 * no sobre la simple carga de la página en el navegador.
 * - Utiliza identidad anonimizada (fingerprint HMAC de IP o userId interno).
 * - No persiste IPs crudas ni contraseñas.
 */
export async function checkAuthRateLimitAction(
  action: AuthSensitiveAction,
  emailHint?: string,
  authenticatedUserId?: string | null
): Promise<AuthRateLimitCheckResult> {
  try {
    const headersList = await headers();
    const baseKey = resolveRateLimitKey(headersList, authenticatedUserId);

    // Saltear y hashear el email para evitar colisiones sin almacenar PII
    let key = baseKey;
    if (emailHint && emailHint.trim().length > 0) {
      const emailHash = crypto
        .createHash('sha256')
        .update(emailHint.trim().toLowerCase())
        .digest('hex')
        .slice(0, 16);
      key = `${baseKey}:${emailHash}`;
    }

    let config = RATE_LIMIT_CONFIG.authLogin;
    if (action === 'register') {
      config = RATE_LIMIT_CONFIG.authRegister;
    } else if (action === 'forgot_password') {
      config = RATE_LIMIT_CONFIG.authPasswordRecovery;
    }

    const result = await checkRateLimit({
      namespace: `auth-${action}`,
      key,
      limit: config.limit,
      windowSeconds: config.windowSeconds,
    });

    if (result.status === 'LIMITED') {
      logger.warn('Auth operation rate limit exceeded', {
        action,
        key_hash: baseKey,
        retryAfter: result.retryAfterSeconds,
      });

      return {
        allowed: false,
        status: 'LIMITED',
        error: `Has superado el límite de intentos para esta operación. Por favor reintenta en ${result.retryAfterSeconds ?? 60} segundos.`,
        retryAfterSeconds: result.retryAfterSeconds ?? 60,
      };
    }

    return {
      allowed: true,
      status: result.status,
    };
  } catch (err: any) {
    logger.error('Error checking auth rate limit, failing open safely', { error: err.message });
    return {
      allowed: true,
      status: 'PROVIDER_UNAVAILABLE',
    };
  }
}
