import { NextRequest, NextResponse } from 'next/server.js';
import { verifyMercadoPagoSignature } from '../../../../lib/mercadopago/webhook.ts';
import { processWebhookEvent } from '../../../../lib/mercadopago/processor.ts';
import { createAdminClient } from '../../../../lib/supabase/admin.ts';

export async function POST(req: NextRequest) {
  try {
    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');
    const url = new URL(req.url);

    // Leer payload JSON si está presente
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Puede llegar sin body en algunos tipos de notificación
    }

    // En el contrato oficial de Webhooks de Subscriptions Chile,
    // data.id se envía en el query string de la petición HTTP (req.query['data.id'])
    const dataId = url.searchParams.get('data.id');
    const eventType = url.searchParams.get('type') || url.searchParams.get('topic') || body?.type || body?.topic || 'unknown';
    const action = url.searchParams.get('action') || body?.action || 'notify';

    if (!dataId) {
      return NextResponse.json(
        { error: 'Falta parámetro contractual data.id en query' },
        { status: 400 }
      );
    }

    // 1. Verificación criptográfica estricta (Firma + Timestamp Anti-Replay)
    const verification = verifyMercadoPagoSignature({
      xSignatureHeader: xSignature,
      xRequestIdHeader: xRequestId,
      dataId: String(dataId),
    });

    if (!verification.isValid) {
      return NextResponse.json(
        { error: verification.error || 'Firma inválida o no autorizada' },
        { status: 401 }
      );
    }

    // 2. Procesar el evento con la base de datos
    const supabase = createAdminClient();
    const result = await processWebhookEvent({
      supabase,
      eventType,
      dataId: String(dataId),
      action,
      payload: { ...body, queryParams: Object.fromEntries(url.searchParams.entries()) },
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error interno en webhook handler:', error);
    // En errores imprevistos respondemos 500 para permitir que Mercado Pago reintente
    return NextResponse.json(
      { error: 'Error interno al procesar webhook', details: error.message },
      { status: 500 }
    );
  }
}
