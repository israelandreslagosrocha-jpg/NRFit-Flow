import { NextRequest, NextResponse } from 'next/server.js';
import { createAdminClient } from '../../../../lib/supabase/admin.ts';
import { processFlowCallback } from '../../../../lib/payments/flow/processor.ts';

export async function POST(req: NextRequest) {
  try {
    let token: string | null = null;
    let resourceHint: string | undefined = undefined;
    let bodyData: any = {};

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      token = (formData.get('token') as string) || null;
      resourceHint = (formData.get('resource') as string) || (formData.get('type') as string) || undefined;
      bodyData = Object.fromEntries(formData.entries());
    } else if (contentType.includes('application/json')) {
      const json = await req.json();
      token = json.token || null;
      resourceHint = json.resource || json.type || undefined;
      bodyData = json;
    } else {
      // Fallback a query string
      const url = new URL(req.url);
      token = url.searchParams.get('token');
      resourceHint = url.searchParams.get('resource') || url.searchParams.get('type') || undefined;
    }

    if (!token) {
      return NextResponse.json({ error: 'Falta parámetro token en callback de Flow' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const result = await processFlowCallback({
      supabase,
      token,
      resourceHint,
      payload: bodyData,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error interno en callback Flow:', error);
    return NextResponse.json(
      { error: 'Error interno al procesar callback Flow', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ status: 'FLOW_CALLBACK_ENDPOINT_READY' }, { status: 200 });
  }

  const supabase = createAdminClient();
  const result = await processFlowCallback({
    supabase,
    token,
    payload: { query: Object.fromEntries(url.searchParams.entries()) },
  });

  return NextResponse.json(result, { status: 200 });
}
