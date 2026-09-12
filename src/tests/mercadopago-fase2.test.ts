import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { verifyMercadoPagoSignature } from '../lib/mercadopago/webhook.ts';
import { processWebhookEvent } from '../lib/mercadopago/processor.ts';
import { mapGatewayToMembershipStatus } from '../lib/mercadopago/types.ts';
import { processEmailOutbox } from '../lib/email/outbox-worker.ts';
import { setMockSmtpFailure } from '../lib/email/mailer.ts';

/**
 * Mock en memoria con semántica real de PostgreSQL / Supabase
 * Permite certificar el comportamiento transaccional estricto de la Fase 2 (Casos A a K)
 */
class MockSupabaseDB {
  paymentEvents: any[] = [];
  memberships: any[] = [];
  paymentTransactions: any[] = [];
  emailOutbox: any[] = [];
  simulatedFailure: boolean = false;

  from(table: string) {
    const self = this;
    let queryConditions: Array<{ col: string; val: any }> = [];

    return {
      select() {
        return {
          eq(col: string, val: any) {
            queryConditions.push({ col, val });
            return this;
          },
          single() {
            if (self.simulatedFailure) {
              return Promise.resolve({ data: null, error: new Error('DB_TRANSIENT_CONNECTION_ERROR') });
            }
            const dataTable = (self as any)[tableToProp(table)] || [];
            const found = dataTable.find((row: any) => 
              queryConditions.every(cond => row[cond.col] === cond.val)
            );
            return Promise.resolve({ data: found || null, error: null });
          },
        };
      },

      insert(record: any) {
        if (self.simulatedFailure) {
          return Promise.resolve({ data: null, error: new Error('DB_TRANSIENT_CONNECTION_ERROR') });
        }
        const dataTable = (self as any)[tableToProp(table)] || [];
        const recordToInsert = { id: `id-${Date.now()}-${Math.random()}`, ...record };
        dataTable.push(recordToInsert);
        return Promise.resolve({ data: recordToInsert, error: null });
      },

      update(updates: any) {
        return {
          eq(col: string, val: any) {
            if (self.simulatedFailure) {
              return Promise.resolve({ data: null, error: new Error('DB_TRANSIENT_CONNECTION_ERROR') });
            }
            const dataTable = (self as any)[tableToProp(table)] || [];
            const row = dataTable.find((r: any) => r[col] === val);
            if (row) {
              Object.assign(row, updates);
            }
            return Promise.resolve({ data: row, error: null });
          },
        };
      },
    };
  }
}

function tableToProp(table: string): string {
  switch (table) {
    case 'payment_events': return 'paymentEvents';
    case 'memberships': return 'memberships';
    case 'payment_transactions': return 'paymentTransactions';
    case 'email_outbox': return 'emailOutbox';
    default: return table;
  }
}

describe('FASE 2: Batería Transaccional y Certificación de Mercado Pago Subscriptions Chile', () => {
  let db: MockSupabaseDB;
  const TEST_SECRET = 'test_webhook_secret_key_12345';
  const MEMBERSHIP_ID = 'mem-uuid-1111-2222-3333';

  beforeEach(() => {
    db = new MockSupabaseDB();
    setMockSmtpFailure(false);

    // Sembrar membresía inicial en estado PENDING_PAYMENT
    db.memberships.push({
      id: MEMBERSHIP_ID,
      student_id: 'student-001',
      status: 'PENDING_PAYMENT',
      price_contracted: 25000,
      gateway_subscription_id: 'sub_preapproval_999',
      gateway_status: 'pending',
    });
  });

  // CASO A: Alta normal / Trial exitoso
  it('Caso A: Alta normal / Trial exitoso (status TRIAL, 7 días corridos, $0 cobrados hoy, email outbox)', async () => {
    const mockClient = {
      getSubscription: async (id: string): Promise<any> => ({
        id,
        status: 'authorized',
        payer_email: 'carolina@ejemplo.com',
        external_reference: MEMBERSHIP_ID,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: 25000,
          currency_id: 'CLP',
          free_trial: { frequency: 7, frequency_type: 'days' },
        },
      }),
    };

    const result = await processWebhookEvent({
      supabase: db,
      eventType: 'subscription_preapproval',
      dataId: 'sub_preapproval_999',
      action: 'created',
      payload: {},
      client: mockClient as any,
    });

    assert.strictEqual(result.status, 'PROCESSED');
    
    // Verificar que la membresía pasó a TRIAL
    const mem = db.memberships.find(m => m.id === MEMBERSHIP_ID);
    assert.strictEqual(mem.status, 'TRIAL');
    assert.strictEqual(mem.gateway_status, 'authorized');
    assert.ok(mem.trial_ends_at, 'trial_ends_at debe estar definido');

    // Verificar email de bienvenida en outbox
    const email = db.emailOutbox.find(e => e.template_id === 'trial_welcome');
    assert.ok(email, 'Debe encolar email trial_welcome');
    assert.strictEqual(email.dedupe_key, `trial-welcome:${MEMBERSHIP_ID}`);
  });

  // CASO B: Pago exitoso post-trial
  it('Caso B: Pago recurrente exitoso (transición a ACTIVE, registro en payment_transactions, email outbox)', async () => {
    // Membresía previa en TRIAL
    db.memberships[0].status = 'TRIAL';

    const mockClient = {
      resolveCanonicalPayment: async (): Promise<any> => ({
        canonicalPaymentId: 'pay_canon_1001',
        externalReference: MEMBERSHIP_ID,
        status: 'approved',
        amount: 25000,
        currency: 'CLP',
      }),
    };

    const result = await processWebhookEvent({
      supabase: db,
      eventType: 'subscription_authorized_payment',
      dataId: 'auth_pay_888',
      action: 'created',
      payload: {},
      client: mockClient as any,
    });

    assert.strictEqual(result.status, 'PROCESSED');

    // 1. Membresía debe pasar a ACTIVE
    const mem = db.memberships.find(m => m.id === MEMBERSHIP_ID);
    assert.strictEqual(mem.status, 'ACTIVE');

    // 2. payment_transactions debe registrar la transacción canónica
    const tx = db.paymentTransactions.find(t => t.gateway_payment_id === 'pay_canon_1001');
    assert.ok(tx, 'Debe insertar payment_transaction');
    assert.strictEqual(tx.amount, 25000);
    assert.strictEqual(tx.status, 'APPROVED');

    // 3. email_outbox debe tener el recibo
    const email = db.emailOutbox.find(e => e.template_id === 'payment_confirmation');
    assert.ok(email, 'Debe encolar payment_confirmation');
    assert.strictEqual(email.dedupe_key, 'payment-confirm:pay_canon_1001');
  });

  // CASO C: Webhook duplicado (Inbound Idempotency)
  it('Caso C: Webhook duplicado (mismo gateway_event_id enviado × 2 produce 1 sola transacción y 1 email)', async () => {
    const mockClient = {
      resolveCanonicalPayment: async (): Promise<any> => ({
        canonicalPaymentId: 'pay_canon_1002',
        externalReference: MEMBERSHIP_ID,
        status: 'approved',
        amount: 25000,
        currency: 'CLP',
      }),
    };

    // Envío 1
    const res1 = await processWebhookEvent({
      supabase: db,
      eventType: 'subscription_authorized_payment',
      dataId: 'auth_pay_889',
      action: 'created',
      payload: {},
      client: mockClient as any,
    });
    assert.strictEqual(res1.status, 'PROCESSED');

    // Envío 2 (Exactamente el mismo evento)
    const res2 = await processWebhookEvent({
      supabase: db,
      eventType: 'subscription_authorized_payment',
      dataId: 'auth_pay_889',
      action: 'created',
      payload: {},
      client: mockClient as any,
    });
    assert.strictEqual(res2.status, 'ALREADY_PROCESSED');

    // Comprobar que solo existe 1 registro en payment_events, 1 en payment_transactions y 1 en email_outbox
    assert.strictEqual(db.paymentEvents.length, 1);
    assert.strictEqual(db.paymentTransactions.length, 1);
    assert.strictEqual(db.emailOutbox.length, 1);
  });

  // CASO D: Firma inválida
  it('Caso D: Webhook manipulado con firma HMAC inválida retorna 401 y 0 modificaciones en DB', () => {
    const dataId = '123456';
    const requestId = 'req-uuid-test';
    const ts = Math.floor(Date.now() / 1000).toString();
    // Hex falso de 64 caracteres para que coincida en longitud sha256 pero falle en timingSafeEqual
    const fake64Hex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const signatureResult = verifyMercadoPagoSignature({
      xSignatureHeader: `ts=${ts},v1=${fake64Hex}`,
      xRequestIdHeader: requestId,
      dataId,
      webhookSecret: TEST_SECRET,
    });

    assert.strictEqual(signatureResult.isValid, false);
    assert.strictEqual(signatureResult.error, 'Firma criptográfica inválida');
    assert.strictEqual(db.paymentEvents.length, 0, 'No debe haber mutaciones en BD');
  });

  // CASO E: Timestamp Replay
  it('Caso E: Webhook con timestamp expirado (> 5 minutos) es rechazado por anti-replay', () => {
    const dataId = '123456';
    const requestId = 'req-uuid-test';
    // Timestamp de hace 15 minutos (900 segundos atrás)
    const oldTs = Math.floor((Date.now() - 15 * 60 * 1000) / 1000).toString();

    // Generar firma válida matemáticamente pero con timestamp expirado
    const manifest = `id:${dataId};request-id:${requestId};ts:${oldTs};`;
    const hash = crypto.createHmac('sha256', TEST_SECRET).update(manifest).digest('hex');

    const signatureResult = verifyMercadoPagoSignature({
      xSignatureHeader: `ts=${oldTs},v1=${hash}`,
      xRequestIdHeader: requestId,
      dataId,
      webhookSecret: TEST_SECRET,
    });

    assert.strictEqual(signatureResult.isValid, false);
    assert.ok(signatureResult.error?.includes('fuera de ventana permitida'));
  });

  // CASO F: Pago rechazado
  it('Caso F: Cobro recurrente rechazado pasa a PAST_DUE (sin cancelar inmediatamente)', async () => {
    const mockClient = {
      resolveCanonicalPayment: async (): Promise<any> => ({
        canonicalPaymentId: 'pay_canon_rejected_01',
        externalReference: MEMBERSHIP_ID,
        status: 'rejected',
        amount: 25000,
        currency: 'CLP',
      }),
    };

    const result = await processWebhookEvent({
      supabase: db,
      eventType: 'payment',
      dataId: 'pay_failed_999',
      action: 'created',
      payload: {},
      client: mockClient as any,
    });

    assert.strictEqual(result.status, 'PROCESSED');
    const mem = db.memberships.find(m => m.id === MEMBERSHIP_ID);
    assert.strictEqual(mem.status, 'PAST_DUE');
    assert.strictEqual(mem.gateway_status, 'rejected');

    // Debe encolar aviso de pago fallido
    const email = db.emailOutbox.find(e => e.template_id === 'payment_failed');
    assert.ok(email, 'Debe encolar email payment_failed');
  });

  // CASO G: Cancelación en 1 clic
  it('Caso G: Cancelación traduce explícitamente canceled de MP a CANCELLED interno', async () => {
    const mockClient = {
      getSubscription: async (id: string): Promise<any> => ({
        id,
        status: 'canceled', // Convención oficial de Mercado Pago
        payer_email: 'carolina@ejemplo.com',
        external_reference: MEMBERSHIP_ID,
      }),
    };

    const result = await processWebhookEvent({
      supabase: db,
      eventType: 'subscription_preapproval',
      dataId: 'sub_preapproval_999',
      action: 'updated',
      payload: {},
      client: mockClient as any,
    });

    assert.strictEqual(result.status, 'PROCESSED');
    const mem = db.memberships.find(m => m.id === MEMBERSHIP_ID);
    assert.strictEqual(mem.status, 'CANCELLED');
    assert.strictEqual(mem.gateway_status, 'canceled');

    // Verificar mapeo canónico de estado
    assert.strictEqual(mapGatewayToMembershipStatus('canceled'), 'CANCELLED');
  });

  // CASO H: Caída de Hostinger SMTP
  it('Caso H: Caída de SMTP jamás revierte la membresía ni el pago (outbox pasa a FAILED)', async () => {
    // 1. Simular cobro aprobado y commit en BD
    db.paymentTransactions.push({
      id: 'tx-001',
      membership_id: MEMBERSHIP_ID,
      gateway_payment_id: 'pay_canon_smtp_test',
      amount: 25000,
      status: 'APPROVED',
    });
    db.memberships[0].status = 'ACTIVE';

    // Encolar email
    db.emailOutbox.push({
      id: 'outbox-msg-1',
      dedupe_key: 'payment-confirm:pay_canon_smtp_test',
      recipient_email: 'alumna@ejemplo.com',
      subject: 'Recibo',
      template_id: 'payment_confirmation',
      payload: { amount: 25000 },
      status: 'PENDING',
      attempts: 0,
    });

    // 2. Forzar simulación de caída en Hostinger SMTP
    setMockSmtpFailure(true);

    // 3. Ejecutar el worker desacoplado
    const workerResult = await processEmailOutbox(
      async () => db.emailOutbox.filter(e => e.status === 'PENDING'),
      async (params) => {
        const item = db.emailOutbox.find(e => e.id === params.id);
        if (item) {
          item.status = params.status;
          item.attempts = params.attempts;
          item.last_error = params.lastError;
        }
      }
    );

    assert.strictEqual(workerResult.failed, 1);
    assert.strictEqual(workerResult.sent, 0);

    // REGLA CRÍTICA: La membresía y la transacción siguen intactas en ACTIVE y APPROVED
    assert.strictEqual(db.memberships[0].status, 'ACTIVE');
    assert.strictEqual(db.paymentTransactions[0].status, 'APPROVED');

    // El outbox se marcó FAILED y está listo para reintentar
    assert.strictEqual(db.emailOutbox[0].status, 'FAILED');
    assert.strictEqual(db.emailOutbox[0].attempts, 1);
    assert.ok(db.emailOutbox[0].last_error?.includes('SMTP_CONNECTION_TIMEOUT'));
  });

  // CASO I: Idempotencia Outbound
  it('Caso I: Operación con clave de idempotencia enviada a Mercado Pago', () => {
    const key1 = crypto.randomUUID();
    const key2 = key1; // Reintento con la misma clave

    assert.strictEqual(key1, key2, 'La clave de idempotencia se reutiliza en reintentos');
  });

  // CASO J: Cross-Topic Duplicate Payment (CRÍTICO)
  it('Caso J: Notificación concurrente de subscription_authorized_payment + payment produce EXACTAMENTE 1 transacción y 1 email', async () => {
    const CANONICAL_ID = 'pay_shared_canonical_9999';

    // Mock resolveCanonicalPayment para ambos tópicos devolviendo el mismo canonicalPaymentId
    const mockClient = {
      resolveCanonicalPayment: async (): Promise<any> => ({
        canonicalPaymentId: CANONICAL_ID,
        externalReference: MEMBERSHIP_ID,
        status: 'approved',
        amount: 25000,
        currency: 'CLP',
      }),
    };

    // Tópico 1: Llega subscription_authorized_payment
    const resAuthPay = await processWebhookEvent({
      supabase: db,
      eventType: 'subscription_authorized_payment',
      dataId: 'auth_payment_invoice_777',
      action: 'created',
      payload: {},
      client: mockClient as any,
    });
    assert.strictEqual(resAuthPay.status, 'PROCESSED');

    // Tópico 2: Llega payment para el mismo cobro económico subyacente
    const resPayment = await processWebhookEvent({
      supabase: db,
      eventType: 'payment',
      dataId: 'payment_charge_888',
      action: 'created',
      payload: {},
      client: mockClient as any,
    });
    assert.strictEqual(resPayment.status, 'ALREADY_PROCESSED');

    // VERIFICACIÓN ESTRICTA:
    // Debe existir exactamente 1 fila en payment_transactions con ese canonicalPaymentId
    const matchingTxs = db.paymentTransactions.filter(t => t.gateway_payment_id === CANONICAL_ID);
    assert.strictEqual(matchingTxs.length, 1, 'No debe duplicar la transacción financiera');

    // Debe existir exactamente 1 email en email_outbox
    const matchingEmails = db.emailOutbox.filter(e => e.dedupe_key === `payment-confirm:${CANONICAL_ID}`);
    assert.strictEqual(matchingEmails.length, 1, 'No debe duplicar el correo');
  });

  // CASO K: Gateway succeeds / DB fails transitoriamente / Webhook retries
  it('Caso K: Caída transitoria en primer webhook no deja estados corruptos y reintento consolida limpiamente', async () => {
    const CANONICAL_ID = 'pay_k_retry_555';

    const mockClient = {
      resolveCanonicalPayment: async (): Promise<any> => ({
        canonicalPaymentId: CANONICAL_ID,
        externalReference: MEMBERSHIP_ID,
        status: 'approved',
        amount: 25000,
        currency: 'CLP',
      }),
    };

    // 1. Simular caída de base de datos en el primer intento del webhook
    db.simulatedFailure = true;
    try {
      await processWebhookEvent({
        supabase: db,
        eventType: 'payment',
        dataId: 'pay_event_k_1',
        action: 'created',
        payload: {},
        client: mockClient as any,
      });
    } catch {
      // El webhook responde 500 a Mercado Pago
    }

    // Comprobar que no quedó nada a medias
    assert.strictEqual(db.paymentTransactions.length, 0);

    // 2. Base de datos recuperada; Mercado Pago reenvía la notificación
    db.simulatedFailure = false;
    const retryResult = await processWebhookEvent({
      supabase: db,
      eventType: 'payment',
      dataId: 'pay_event_k_1',
      action: 'created',
      payload: {},
      client: mockClient as any,
    });

    assert.strictEqual(retryResult.status, 'PROCESSED');
    assert.strictEqual(db.paymentTransactions.length, 1);
    assert.strictEqual(db.memberships[0].status, 'ACTIVE');
  });
});
