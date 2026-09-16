import crypto from 'crypto';

export interface WebhookVerificationResult {
  isValid: boolean;
  error?: string;
  dataId?: string;
  requestId?: string;
  ts?: string;
}

/**
 * Validador criptográfico de firmas de Webhooks de Mercado Pago (Chile)
 * Especificación oficial Subscriptions Chile:
 * 1. Extraer x-signature (ts y v1)
 * 2. Extraer x-request-id y data.id (proveniente de la fuente contractual oficial)
 * 3. Validar formato numérico de ts y aplicar ventana anti-replay (máx 5 minutos)
 * 4. Manifest canónico: "id:[data_id];request-id:[x-request-id];ts:[ts];"
 * 5. HMAC-SHA256 con MERCADOPAGO_WEBHOOK_SECRET
 * 6. Comparación en tiempo constante (timingSafeEqual)
 */
export function verifyMercadoPagoSignature(params: {
  xSignatureHeader: string | null;
  xRequestIdHeader: string | null;
  dataId: string | null;
  webhookSecret?: string;
  nowMs?: number; // Para inyección de dependencias en pruebas
}): WebhookVerificationResult {
  const secret = params.webhookSecret || process.env.MERCADOPAGO_WEBHOOK_SECRET;

  if (!secret) {
    return {
      isValid: false,
      error: 'MERCADOPAGO_WEBHOOK_SECRET no configurado',
    };
  }

  if (!params.xSignatureHeader) {
    return {
      isValid: false,
      error: 'Falta cabecera x-signature',
    };
  }

  if (!params.xRequestIdHeader) {
    return {
      isValid: false,
      error: 'Falta cabecera x-request-id',
    };
  }

  if (!params.dataId) {
    return {
      isValid: false,
      error: 'Falta identificador contractual data.id',
    };
  }

  // Parsear ts y v1 de la cabecera x-signature (ej: "ts=1704908010,v1=abcdef...")
  const parts = params.xSignatureHeader.split(',');
  let ts: string | undefined;
  let v1: string | undefined;

  for (const part of parts) {
    const [key, ...valParts] = part.trim().split('=');
    const val = valParts.join('=');
    if (key === 'ts') ts = val;
    if (key === 'v1') v1 = val;
  }

  if (!ts || !v1) {
    return {
      isValid: false,
      error: 'Formato inválido de x-signature (debe contener ts y v1)',
    };
  }

  // Validación estricta de formato del timestamp ts (Fail-closed)
  // Subscriptions Chile envía ts en segundos (10 dígitos) o milisegundos (13 dígitos)
  if (!/^\d{10}$|^\d{13}$/.test(ts)) {
    return {
      isValid: false,
      error: 'Formato numérico de ts inválido o no reconocido (fail-closed)',
      dataId: params.dataId,
      requestId: params.xRequestIdHeader,
      ts,
    };
  }

  const numTs = Number(ts);
  if (!Number.isFinite(numTs) || numTs <= 0) {
    return {
      isValid: false,
      error: 'Timestamp ts no finito o menor a cero (fail-closed)',
      dataId: params.dataId,
      requestId: params.xRequestIdHeader,
      ts,
    };
  }

  // Normalizar a milisegundos según longitud
  const eventTimeMs = ts.length === 10 ? numTs * 1000 : numTs;

  // Ventana anti-replay de la aplicación: tolerancia de 5 minutos (300 segundos)
  const currentTime = params.nowMs ?? Date.now();
  const timeDifference = Math.abs(currentTime - eventTimeMs);
  const maxAllowedToleranceMs = 5 * 60 * 1000; // 5 minutos

  if (timeDifference > maxAllowedToleranceMs) {
    return {
      isValid: false,
      error: `Timestamp de evento fuera de ventana permitida (diferencia: ${Math.round(timeDifference / 1000)}s)`,
      ts,
      dataId: params.dataId,
      requestId: params.xRequestIdHeader,
    };
  }

  // Construir manifest canónico de Mercado Pago
  // Formato oficial: id:[data.id];request-id:[x-request-id];ts:[ts];
  const manifest = `id:${params.dataId};request-id:${params.xRequestIdHeader};ts:${ts};`;

  // Calcular HMAC-SHA256
  const calculatedHash = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  // Comparación en tiempo constante para mitigar ataques de temporización
  const calculatedBuffer = Buffer.from(calculatedHash);
  const receivedBuffer = Buffer.from(v1);

  if (calculatedBuffer.length !== receivedBuffer.length) {
    return {
      isValid: false,
      error: 'Longitud de firma no coincide',
      dataId: params.dataId,
      requestId: params.xRequestIdHeader,
      ts,
    };
  }

  const isMatch = crypto.timingSafeEqual(calculatedBuffer, receivedBuffer);

  if (!isMatch) {
    return {
      isValid: false,
      error: 'Firma criptográfica inválida',
      dataId: params.dataId,
      requestId: params.xRequestIdHeader,
      ts,
    };
  }

  return {
    isValid: true,
    dataId: params.dataId,
    requestId: params.xRequestIdHeader,
    ts,
  };
}
