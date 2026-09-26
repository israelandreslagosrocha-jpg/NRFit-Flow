import type { EndpointRateLimitConfig } from './types.ts';

/**
 * FASE M-09.3E: CONFIGURACIÓN CENTRALIZADA DE LÍMITES POR SUPERFICIE
 * 
 * Regla: Los límites deben ser configurables mediante variables de entorno o valores
 * por defecto calibrados, evitando magic numbers irrevocables en el código.
 */

export const RATE_LIMIT_CONFIG: Record<string, EndpointRateLimitConfig> = {
  // 1. /api/callbacks/flow (Bulkhead global contra agotamiento de recursos S2S)
  // NO es cuota por IP. Es protección de capacidad de backend.
  flowCallbackBulkhead: {
    limit: parseInt(process.env.RATE_LIMIT_FLOW_CALLBACK_MAX || '120', 10),
    windowSeconds: parseInt(process.env.RATE_LIMIT_FLOW_CALLBACK_WINDOW || '60', 10),
    fallbackOnProviderFailure: 'ALLOW', // CRÍTICO: Si el provider cae, el callback financiero NO se descarta
  },

  // 2. /api/cron/* (Defensa adicional en profundidad contra spam de invocaciones)
  // La autorización primaria es CRON_SECRET.
  cronEndpoints: {
    limit: parseInt(process.env.RATE_LIMIT_CRON_MAX || '30', 10),
    windowSeconds: parseInt(process.env.RATE_LIMIT_CRON_WINDOW || '60', 10),
    fallbackOnProviderFailure: 'ALLOW',
  },

  // 3. /checkout/flow-return (Retorno suave de navegador, no-autoritativo)
  checkoutReturn: {
    limit: parseInt(process.env.RATE_LIMIT_CHECKOUT_RETURN_MAX || '20', 10),
    windowSeconds: parseInt(process.env.RATE_LIMIT_CHECKOUT_RETURN_WINDOW || '60', 10),
    fallbackOnProviderFailure: 'ALLOW',
  },

  // 4. Operaciones sensibles de Autenticación
  authLogin: {
    limit: parseInt(process.env.RATE_LIMIT_AUTH_LOGIN_MAX || '5', 10),
    windowSeconds: parseInt(process.env.RATE_LIMIT_AUTH_LOGIN_WINDOW || '60', 10),
    fallbackOnProviderFailure: 'ALLOW',
  },
  authRegister: {
    limit: parseInt(process.env.RATE_LIMIT_AUTH_REGISTER_MAX || '3', 10),
    windowSeconds: parseInt(process.env.RATE_LIMIT_AUTH_REGISTER_WINDOW || '60', 10),
    fallbackOnProviderFailure: 'ALLOW',
  },
  authPasswordRecovery: {
    limit: parseInt(process.env.RATE_LIMIT_AUTH_RECOVERY_MAX || '3', 10),
    windowSeconds: parseInt(process.env.RATE_LIMIT_AUTH_RECOVERY_WINDOW || '300', 10),
    fallbackOnProviderFailure: 'ALLOW',
  },
};
