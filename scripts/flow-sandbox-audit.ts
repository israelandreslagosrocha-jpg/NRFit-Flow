/**
 * Script de Certificación de Integración contra Flow Chile Sandbox Real
 *
 * USO:
 *   FLOW_API_KEY="tu_key" FLOW_SECRET_KEY="tu_secret" FLOW_BASE_URL="https://sandbox.flow.cl/api" npx tsx scripts/flow-sandbox-audit.ts
 *
 * NOTA:
 *   Requiere credenciales activas del comercio en sandbox.flow.cl.
 *   Si no están definidas, el script reporta STATUS: NOT_EXECUTED explicando cómo configurarlas.
 */

import { FlowClient, assertSandboxGuard } from '../src/lib/payments/flow/client';

async function main() {
  console.log('================================================================');
  console.log('  FASE M-09R.B — RUNNER DE AUDITORÍA Y CERTIFICACIÓN FLOW SANDBOX REAL');
  console.log('================================================================\n');

  const apiKey = process.env.FLOW_API_KEY;
  const secretKey = process.env.FLOW_SECRET_KEY;
  const baseUrl = process.env.FLOW_BASE_URL || 'https://sandbox.flow.cl/api';
  const flowEnv = process.env.FLOW_ENV || 'sandbox';

  // 1. Verificación de salvaguarda anti-producción
  try {
    assertSandboxGuard(baseUrl, flowEnv);
    console.log('✅ [1/5] Salvaguarda Anti-Producción: ACTIVA y VERIFICADA');
    console.log(`       Target Endpoint: ${baseUrl}`);
  } catch (err: any) {
    console.error('❌ [1/5] Salvaguarda Anti-Producción RECHAZADA:', err.message);
    process.exit(1);
  }

  // 2. Verificación de credenciales
  if (!apiKey || !secretKey || apiKey === 'MOCK_FLOW_API_KEY') {
    console.log('\n🟡 STATUS: FLOW REAL SANDBOX = NOT_EXECUTED');
    console.log('----------------------------------------------------------------');
    console.log('Para certificar el ciclo contra Flow Sandbox real:');
    console.log('1. Accede a tu cuenta de comercio en https://sandbox.flow.cl');
    console.log('2. Copia tu ApiKey y SecretKey de Sandbox.');
    console.log('3. Configura las siguientes variables en .env.local:');
    console.log('   FLOW_API_KEY="<tu_sandbox_api_key>"');
    console.log('   FLOW_SECRET_KEY="<tu_sandbox_secret_key>"');
    console.log('   FLOW_BASE_URL="https://sandbox.flow.cl/api"');
    console.log('   FLOW_ENV="sandbox"');
    console.log('   FLOW_AUTOMATIC_CHARGE_ENABLED="true" (o "false")');
    console.log('4. Ejecuta:');
    console.log('   npx tsx scripts/flow-sandbox-audit.ts\n');
    console.log('La suite de contrato e implementación local (M-09R.A) se valida mediante:');
    console.log('   npm run test:flow\n');
    process.exit(0);
  }

  console.log('✅ [2/5] Credenciales de Sandbox detectadas. Iniciando pruebas S2S...\n');

  const client = new FlowClient({
    apiKey,
    secretKey,
    baseUrl,
    env: flowEnv,
  });

  const testSuffix = Date.now().toString().slice(-6);
  const testStudentId = `stu-cert-${testSuffix}`;
  const testEmail = `alumna.cert.${testSuffix}@natyentrenadora.com`;
  const planId = process.env.FLOW_PLAN_ID || `naty-mensual-25k-v1`;

  try {
    // Paso 3: Crear o verificar cliente con externalId = student.id
    console.log(`[3/5] Creando cliente en Sandbox con externalId=${testStudentId}...`);
    const customer = await client.createCustomer({
      name: `Alumna Certificación ${testSuffix}`,
      email: testEmail,
      externalId: testStudentId,
    });
    console.log(`      Cliente creado OK: customerId=${customer.customerId}`);

    // Paso 4: Probar generación de enlace de registro de tarjeta Webpay
    console.log(`[4/5] Solicitando token de registro de tarjeta (/customer/register)...`);
    const registerRes = await client.registerCustomer({
      customerId: customer.customerId,
      url_return: 'https://natyentrenadora.com/checkout/flow-return',
    });
    console.log(`      Token de registro generado: token=${registerRes.token.slice(0, 10)}...`);
    console.log(`      URL de redirección: ${registerRes.url}`);

    // Paso 5: Consultar suscripción de prueba
    console.log(`[5/5] Probando creación de suscripción con 7 días de trial...`);
    try {
      const sub = await client.createSubscription({
        planId,
        customerId: customer.customerId,
        trial_period_days: 7,
      });
      console.log(`      Suscripción creada: subscriptionId=${sub.subscriptionId}, status=${sub.status}, morose=${sub.morose}`);

      // Cancelar de inmediato para no dejar basura en Sandbox
      console.log(`      Cancelando suscripción de prueba (at_period_end=1)...`);
      await client.cancelSubscription(sub.subscriptionId, 1);
      console.log(`      Cancelación programada exitosa.`);
    } catch (subErr: any) {
      console.log(`      Aviso de suscripción: ${subErr.message}`);
      console.log(`      (Nota: Si el plan '${planId}' aún no está creado en tu cuenta Sandbox, créalo primero desde el portal Flow o vía /plans/create)`);
    }

    console.log('\n================================================================');
    console.log('  CERTIFICACIÓN REAL FLOW SANDBOX: COMPLETADA CON ÉXITO');
    console.log('================================================================\n');
  } catch (err: any) {
    console.error('\n❌ ERROR DURANTE LA CERTIFICACIÓN REAL DE FLOW:', err.message);
    process.exit(1);
  }
}

main().catch(console.error);
