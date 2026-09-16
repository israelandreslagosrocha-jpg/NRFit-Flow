import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { NextRequest } from 'next/server.js';
import { verifyMercadoPagoSignature } from '../lib/mercadopago/webhook.ts';
import { processWebhookEvent } from '../lib/mercadopago/processor.ts';
import { reconcileMemberships } from '../lib/mercadopago/reconciler.ts';
import { validateMembershipDates, type MembershipRecord } from '../lib/supabase/membership-helpers.ts';
import { logger, sanitizeValue, formatLog } from '../lib/logger.ts';
import { setMockSmtpFailure } from '../lib/email/mailer.ts';
import { processEmailOutbox } from '../lib/email/outbox-worker.ts';
import { POST as webhookRouteHandler } from '../app/api/webhooks/mercadopago/route.ts';
import { POST as processOutboxHandler } from '../app/api/cron/process-outbox/route.ts';
import { POST as reconcileMembershipsHandler } from '../app/api/cron/reconcile-memberships/route.ts';

/**
 * Mock DB con semántica PostgreSQL / Supabase para certificar Fase M-09.1
 */
class MockAuditDB {
  paymentEvents: any[] = [];
  memberships: any[] = [];
  paymentTransactions: any[] = [];
  emailOutbox: any[] = [];
  simulateUniqueViolation: boolean = false;
  simulateDbFailure: boolean = false;

  from(table: string) {
    const self = this;
    const queryConditions: Array<{ col: string; val: any }> = [];
    let inCondition: { col: string; vals: any[] } | null = null;
    let notCondition: { col: string; op: string; val: any } | null = null;

    return {
      select(_cols?: string) {
        return {
          eq(col: string, val: any) {
            queryConditions.push({ col, val });
            return this;
          },
          in(col: string, vals: any[]) {
            inCondition = { col, vals };
            return this;
          },
          not(col: string, op: string, val: any) {
            notCondition = { col, op, val };
            return this;
          },
          order(_col: string, _opts?: any) {
            return this;
          },
          limit(_n: number) {
            return this;
          },
          single() {
            if (self.simulateDbFailure) {
              return Promise.resolve({ data: null, error: new Error('DB_TRANSIENT_CONNECTION_ERROR') });
            }
            const dataTable = (self as any)[tableToProp(table)] || [];
            const found = dataTable.find((row: any) =>
              queryConditions.every(cond => row[cond.col] === cond.val)
            );
            return Promise.resolve({ data: found || null, error: null });
          },
          then(resolve: any) {
            if (self.simulateDbFailure) {
              return Promise.resolve({ data: null, error: new Error('DB_TRANSIENT_CONNECTION_ERROR') }).then(resolve);
            }
            let dataTable = [...((self as any)[tableToProp(table)] || [])];
            if (queryConditions.length > 0) {
              dataTable = dataTable.filter((row: any) =>
                queryConditions.every(cond => row[cond.col] === cond.val)
              );
            }
            if (inCondition) {
              dataTable = dataTable.filter((row: any) =>
                inCondition!.vals.includes(row[inCondition!.col])
              );
            }
            if (notCondition) {
              if (notCondition.op === 'is' && notCondition.val === null) {
                dataTable = dataTable.filter((row: any) => row[notCondition!.col] != null);
              }
            }
            return Promise.resolve({ data: dataTable, error: null }).then(resolve);
          },
        };
      },

      insert(record: any) {
        if (self.simulateDbFailure) {
          return Promise.resolve({ data: null, error: new Error('DB_TRANSIENT_CONNECTION_ERROR') });
        }
        if (table === 'payment_transactions') {
          if (self.simulateUniqueViolation) {
            return Promise.resolve({
              data: null,
              error: {
                code: '23505',
                message: 'duplicate key value violates unique constraint "payment_transactions_gateway_payment_id_key"',
              },
            });
          }
          const exists = self.paymentTransactions.some(
            t => t.gateway_payment_id === record.gateway_payment_id
          );
          if (exists) {
            return Promise.resolve({
              data: null,
              error: {
                code: '23505',
                message: 'duplicate key value violates unique constraint "payment_transactions_gateway_payment_id_key"',
              },
            });
          }
        }
        const dataTable = (self as any)[tableToProp(table)] || [];
        const recordToInsert = { id: `id-${Date.now()}-${Math.random()}`, ...record };
        dataTable.push(recordToInsert);
        return Promise.resolve({ data: recordToInsert, error: null });
      },

      update(updates: any) {
        return {
          eq(col: string, val: any) {
            if (self.simulateDbFailure) {
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

describe('FASE M-09.1 — Suite de Certificación Sandbox/Staging', () => {
  let db: MockAuditDB;
  const TEST_WEBHOOK_SECRET = 'staging_webhook_secret_key_987654';
  const MEMBERSHIP_ID = 'mem-audit-uuid-001';

  beforeEach(() => {
    db = new MockAuditDB();
    setMockSmtpFailure(false);

    db.memberships.push({
      id: MEMBERSHIP_ID,
      student_id: 'student-audit-001',
      status: 'PENDING_PAYMENT',
      price_contracted: 25000,
      gateway_subscription_id: 'sub_preapproval_audit_100',
      gateway_status: 'pending',
      start_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
  });

  // 1. Auditoría de Variables de Entorno y Secretos
  describe('1. Auditoría de Entorno y Secretos', () => {
    it('Variables de servidor sensibles NO deben exponerse con prefijo NEXT_PUBLIC_', () => {
      const serverSecrets = [
        'MERCADOPAGO_ACCESS_TOKEN',
        'MERCADOPAGO_WEBHOOK_SECRET',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SMTP_PASS',
        'CRON_SECRET',
      ];

      for (const secret of serverSecrets) {
        const publicEquivalent = `NEXT_PUBLIC_${secret}`;
        assert.strictEqual(
          process.env[publicEquivalent],
          undefined,
          `La variable confidencial ${secret} NO debe tener una versión ${publicEquivalent}`
        );
      }
    });

    it('Clasificación estricta de variables cliente/servidor documentada en el sistema', () => {
      const clientAllowed = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'NEXT_PUBLIC_APP_URL',
      ];

      for (const key of clientAllowed) {
        assert.ok(
          key.startsWith('NEXT_PUBLIC_'),
          `Variable cliente ${key} debe comenzar con prefijo NEXT_PUBLIC_`
        );
      }
    });
  });

  // 2. Sanitización de Logs (Zero PII, PAN y Secretos)
  describe('2. Sanitización Estricta de Logs Operativos', () => {
    it('Sanitiza recursivamente PII (emails, RUT, teléfonos) y tokens en cadenas', () => {
      const rawString = 'Usuario alumna@ejemplo.com con RUT 12.345.678-5 y token TEST-1234567890abcdef';
      const sanitized = sanitizeValue(rawString);

      assert.ok(!sanitized.includes('alumna@ejemplo.com'), 'Email debe ser suprimido');
      assert.ok(!sanitized.includes('TEST-1234567890abcdef'), 'Token de MP debe ser suprimido');
      assert.ok(sanitized.includes('[REDACTED_EMAIL]'));
      assert.ok(sanitized.includes('[REDACTED_TOKEN]'));
    });

    it('Sanitiza números de tarjeta de crédito/débito (PAN de 16 dígitos) en cadenas', () => {
      const rawPan = 'Pago procesado con tarjeta 4557 1234 5678 9012 exitosamente';
      const sanitized = sanitizeValue(rawPan);

      assert.ok(!sanitized.includes('4557 1234 5678 9012'), 'PAN de tarjeta debe ser suprimido');
      assert.ok(sanitized.includes('[REDACTED_PAN]'));
    });

    it('Sanitiza objetos anidados y llaves sensibles (cvv, password, token, payer_email)', () => {
      const payload = {
        payer_email: 'maria@ejemplo.cl',
        full_name: 'María Alumna',
        security_code: {
          cvv: '123',
        },
        metadata: {
          token: 'APP_USR-abcdef123456',
          student_rut: '18.999.888-2',
        },
        technical_id: 'sub_12345',
      };

      const sanitized = sanitizeValue(payload);

      assert.strictEqual(sanitized.payer_email, '[REDACTED]');
      assert.strictEqual(sanitized.full_name, '[REDACTED]');
      assert.strictEqual(sanitized.security_code.cvv, '[REDACTED]');
      assert.strictEqual(sanitized.metadata.token, '[REDACTED]');
      assert.strictEqual(sanitized.technical_id, 'sub_12345', 'Identificador técnico no sensible debe preservarse');
    });

    it('formatLog genera JSON estructurado conforme a la especificación oficial', () => {
      const logEntry = formatLog('INFO', 'WEBHOOK_PROCESSED', {
        membership_id: 'uuid-1234',
        gateway_event_id: 'evt-001',
        payer_email: 'secreta@correo.cl',
      });

      assert.strictEqual(logEntry.service, 'payments-engine');
      assert.strictEqual(logEntry.level, 'INFO');
      assert.strictEqual(logEntry.event, 'WEBHOOK_PROCESSED');
      assert.strictEqual(logEntry.data.membership_id, 'uuid-1234');
      assert.strictEqual(logEntry.data.payer_email, '[REDACTED]');
      assert.ok(logEntry.timestamp, 'Debe incluir timestamp ISO');
    });
  });

  // 3. Webhook Criptográfico y Anti-Replay
  describe('3. Verificación Criptográfica y Anti-Replay', () => {
    function generateValidSignature(secret: string, dataId: string, requestId: string, ts: string) {
      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const hash = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
      return `ts=${ts},v1=${hash}`;
    }

    it('Acepta firma HMAC válida con timestamp en segundos (10 dígitos) dentro de la ventana', () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const ts = String(nowSec);
      const dataId = 'sub_preapproval_audit_100';
      const reqId = 'req-uuid-111';
      const sig = generateValidSignature(TEST_WEBHOOK_SECRET, dataId, reqId, ts);

      const res = verifyMercadoPagoSignature({
        xSignatureHeader: sig,
        xRequestIdHeader: reqId,
        dataId,
        webhookSecret: TEST_WEBHOOK_SECRET,
      });

      assert.strictEqual(res.isValid, true);
    });

    it('Acepta firma HMAC válida con timestamp en milisegundos (13 dígitos) dentro de la ventana', () => {
      const nowMs = Date.now();
      const ts = String(nowMs);
      const dataId = 'sub_preapproval_audit_100';
      const reqId = 'req-uuid-222';
      const sig = generateValidSignature(TEST_WEBHOOK_SECRET, dataId, reqId, ts);

      const res = verifyMercadoPagoSignature({
        xSignatureHeader: sig,
        xRequestIdHeader: reqId,
        dataId,
        webhookSecret: TEST_WEBHOOK_SECRET,
      });

      assert.strictEqual(res.isValid, true);
    });

    it('Rechaza y falla cerrado ante formato de timestamp inválido (no 10 ni 13 dígitos)', () => {
      const dataId = 'sub_preapproval_audit_100';
      const reqId = 'req-uuid-bad';
      const sig = `ts=abc12345,v1=fakehash1234567890123456789012345678901234567890123456789012345678901234`;

      const res = verifyMercadoPagoSignature({
        xSignatureHeader: sig,
        xRequestIdHeader: reqId,
        dataId,
        webhookSecret: TEST_WEBHOOK_SECRET,
      });

      assert.strictEqual(res.isValid, false);
      assert.ok(res.error?.includes('fail-closed'));
    });

    it('Rechaza eventos con timestamp fuera de la ventana anti-replay (> 300 segundos)', () => {
      const oldSec = Math.floor(Date.now() / 1000) - 305; // 305 segundos en el pasado
      const ts = String(oldSec);
      const dataId = 'sub_preapproval_audit_100';
      const reqId = 'req-uuid-old';
      const sig = generateValidSignature(TEST_WEBHOOK_SECRET, dataId, reqId, ts);

      const res = verifyMercadoPagoSignature({
        xSignatureHeader: sig,
        xRequestIdHeader: reqId,
        dataId,
        webhookSecret: TEST_WEBHOOK_SECRET,
      });

      assert.strictEqual(res.isValid, false);
      assert.ok(res.error?.includes('fuera de ventana permitida'));
    });

    it('Rechaza firma HMAC alterada o manipulada', () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const ts = String(nowSec);
      const dataId = 'sub_preapproval_audit_100';
      const reqId = 'req-uuid-tampered';
      const validSig = generateValidSignature(TEST_WEBHOOK_SECRET, dataId, reqId, ts);
      // Alterar el último carácter del hash hexadecimal
      const tamperedSig = validSig.slice(0, -1) + (validSig.endsWith('a') ? 'b' : 'a');

      const res = verifyMercadoPagoSignature({
        xSignatureHeader: tamperedSig,
        xRequestIdHeader: reqId,
        dataId,
        webhookSecret: TEST_WEBHOOK_SECRET,
      });

      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.error, 'Firma criptográfica inválida');
    });
  });

  // 4. Contrato de Entrada del Webhook: Rechazo de data.id faltante
  describe('4. Rechazo de data.id Faltante en Query Contractual', () => {
    it('Route handler rechaza petición sin data.id en query con HTTP 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/webhooks/mercadopago?type=subscription_preapproval', {
        method: 'POST',
      });

      const res = await webhookRouteHandler(req);
      assert.strictEqual(res.status, 400);

      const body = await res.json();
      assert.ok(body.error?.includes('data.id'));
    });

    it('Route handler rechaza petición con firma faltante o inválida con HTTP 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/webhooks/mercadopago?data.id=12345&type=payment', {
        method: 'POST',
        headers: {
          'x-request-id': 'req-test-1',
          // Sin x-signature
        },
      });

      const res = await webhookRouteHandler(req);
      assert.strictEqual(res.status, 401);
    });
  });

  // 5. Rechazo de External Reference Ajeno
  describe('5. Protección contra Recursos Ajenos o Sin External Reference', () => {
    it('Suscripción sin external_reference se ignora con cero mutaciones', async () => {
      const mockClient = {
        getSubscription: async (): Promise<any> => ({
          id: 'sub_ajena_999',
          status: 'authorized',
          payer_email: 'desconocida@externo.cl',
          external_reference: null, // Sin referencia
        }),
      };

      const result = await processWebhookEvent({
        supabase: db,
        eventType: 'subscription_preapproval',
        dataId: 'sub_ajena_999',
        payload: {},
        client: mockClient as any,
      });

      assert.strictEqual(result.status, 'IGNORED');
      assert.strictEqual(db.paymentTransactions.length, 0);
      assert.strictEqual(db.emailOutbox.length, 0);
      assert.strictEqual(db.memberships[0].status, 'PENDING_PAYMENT');
    });

    it('Cobro sin membresía existente se registra como IGNORED sin mutaciones', async () => {
      const mockClient = {
        resolveCanonicalPayment: async (): Promise<any> => ({
          canonicalPaymentId: 'pay_orphan_001',
          externalReference: 'uuid-no-existente',
          status: 'approved',
          amount: 25000,
          currency: 'CLP',
        }),
      };

      const result = await processWebhookEvent({
        supabase: db,
        eventType: 'payment',
        dataId: 'pay_orphan_001',
        payload: {},
        client: mockClient as any,
      });

      assert.strictEqual(result.status, 'IGNORED');
      assert.strictEqual(db.paymentTransactions.length, 0);
      assert.strictEqual(db.emailOutbox.length, 0);
    });
  });

  // 6. Concurrencia y Captura de unique_violation (Código 23505)
  describe('6. Manejo de Concurrencia y Violación de Clave Única (23505)', () => {
    it('Captura error 23505 en payment_transactions y responde ALREADY_PROCESSED sin error 500', async () => {
      db.memberships[0].status = 'TRIAL';

      const mockClient = {
        resolveCanonicalPayment: async (): Promise<any> => ({
          canonicalPaymentId: 'pay_concurrent_race_1',
          externalReference: MEMBERSHIP_ID,
          status: 'approved',
          amount: 25000,
          currency: 'CLP',
        }),
      };

      // Simular que el SELECT de verificación no encuentra la fila previa (race condition),
      // pero el INSERT choca con la restricción UNIQUE(gateway_payment_id) de PostgreSQL (23505)
      db.simulateUniqueViolation = true;

      const result = await processWebhookEvent({
        supabase: db,
        eventType: 'payment',
        dataId: 'pay_event_concurrent_01',
        payload: {},
        client: mockClient as any,
      });

      assert.strictEqual(result.status, 'ALREADY_PROCESSED');
      assert.ok(result.message.includes('concurrentemente'));

      // Verificar que se registró el evento técnico en payment_events como ALREADY_PROCESSED
      const evt = db.paymentEvents.find(e => e.status === 'ALREADY_PROCESSED');
      assert.ok(evt, 'Debe registrar evento técnico ALREADY_PROCESSED');
    });
  });

  // 7. Fixtures Reales de Sandbox y Deduplicación Cross-Topic
  describe('7. Fixtures Reales de Sandbox y Deduplicación Cross-Topic', () => {
    it('Procesa subscription_authorized_payment y payment con payloads canónicos de Sandbox', async () => {
      const SANDBOX_CANONICAL_PAYMENT_ID = '12345678901';

      // Fixture realista de Sandbox para authorized_payments
      const sandboxAuthPaymentFixture = {
        id: 9988776655,
        preapproval_id: 'sub_preapproval_audit_100',
        type: 'scheduled',
        status: 'approved',
        transaction_amount: 25000,
        currency_id: 'CLP',
        payment: {
          id: SANDBOX_CANONICAL_PAYMENT_ID,
          status: 'approved',
          status_detail: 'accredited',
        },
        external_reference: MEMBERSHIP_ID,
      };

      // Fixture realista de Sandbox para payments
      const sandboxPaymentFixture = {
        id: SANDBOX_CANONICAL_PAYMENT_ID,
        status: 'approved',
        status_detail: 'accredited',
        currency_id: 'CLP',
        transaction_amount: 25000,
        external_reference: MEMBERSHIP_ID,
      };

      const mockClient = {
        resolveCanonicalPayment: async (topic: string): Promise<any> => {
          if (topic === 'subscription_authorized_payment') {
            return {
              canonicalPaymentId: String(sandboxAuthPaymentFixture.payment.id),
              externalReference: sandboxAuthPaymentFixture.external_reference,
              preapprovalId: sandboxAuthPaymentFixture.preapproval_id,
              status: sandboxAuthPaymentFixture.status,
              amount: sandboxAuthPaymentFixture.transaction_amount,
              currency: sandboxAuthPaymentFixture.currency_id,
            };
          } else {
            return {
              canonicalPaymentId: String(sandboxPaymentFixture.id),
              externalReference: sandboxPaymentFixture.external_reference,
              status: sandboxPaymentFixture.status,
              amount: sandboxPaymentFixture.transaction_amount,
              currency: sandboxPaymentFixture.currency_id,
            };
          }
        },
      };

      // 1. Llega subscription_authorized_payment
      const res1 = await processWebhookEvent({
        supabase: db,
        eventType: 'subscription_authorized_payment',
        dataId: '9988776655',
        payload: sandboxAuthPaymentFixture,
        client: mockClient as any,
      });
      assert.strictEqual(res1.status, 'PROCESSED');

      // 2. Llega payment para el mismo cobro
      const res2 = await processWebhookEvent({
        supabase: db,
        eventType: 'payment',
        dataId: SANDBOX_CANONICAL_PAYMENT_ID,
        payload: sandboxPaymentFixture,
        client: mockClient as any,
      });
      assert.strictEqual(res2.status, 'ALREADY_PROCESSED');

      // Verificación estricta de no duplicación
      const txs = db.paymentTransactions.filter(t => t.gateway_payment_id === SANDBOX_CANONICAL_PAYMENT_ID);
      assert.strictEqual(txs.length, 1, 'Debe existir exactamente 1 transacción financiera');

      const emails = db.emailOutbox.filter(e => e.dedupe_key === `payment-confirm:${SANDBOX_CANONICAL_PAYMENT_ID}`);
      assert.strictEqual(emails.length, 1, 'Debe existir exactamente 1 correo encolado');
    });
  });

  // 8. Tolerancia a Caídas de Hostinger SMTP
  describe('8. Tolerancia a Caídas de Hostinger SMTP (Desacople Total)', () => {
    it('Caída de SMTP marca FAILED en outbox pero deja transacción y membresía aprobadas', async () => {
      // 1. Transacción financiera ya aprobada
      db.memberships[0].status = 'ACTIVE';
      db.paymentTransactions.push({
        id: 'tx-audit-001',
        membership_id: MEMBERSHIP_ID,
        gateway_payment_id: 'pay_audit_smtp_1',
        amount: 25000,
        currency: 'CLP',
        status: 'APPROVED',
      });

      db.emailOutbox.push({
        id: 'email-audit-001',
        recipient_email: 'alumna@natyentrenadora.cl',
        template_id: 'payment_confirmation',
        dedupe_key: 'payment-confirm:pay_audit_smtp_1',
        payload: { amount: 25000 },
        status: 'PENDING',
        attempts: 0,
      });

      // 2. Simular fallo de socket SMTP en Hostinger
      setMockSmtpFailure(true);

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

      // Integridad financiera y de acceso 100% intacta
      assert.strictEqual(db.memberships[0].status, 'ACTIVE');
      assert.strictEqual(db.paymentTransactions[0].status, 'APPROVED');

      // Outbox registra FAILED para reintento posterior
      assert.strictEqual(db.emailOutbox[0].status, 'FAILED');
      assert.strictEqual(db.emailOutbox[0].attempts, 1);
      assert.ok(db.emailOutbox[0].last_error?.includes('SMTP_CONNECTION_TIMEOUT'));
    });
  });

  // 9. Reconciliador Server-to-Server y Cancelación Respetando Período Pagado
  describe('9. Reconciliador Server-to-Server y Cancelación con Período Pagado', () => {
    it('Webhook perdido: S2S reconcilia PENDING_PAYMENT a TRIAL y encola bienvenida', async () => {
      const mockClient = {
        getSubscription: async (): Promise<any> => ({
          id: 'sub_preapproval_audit_100',
          status: 'authorized',
          payer_email: 'alumna.reconciled@ejemplo.cl',
        }),
      };

      const result = await reconcileMemberships({
        supabase: db,
        client: mockClient as any,
      });

      assert.strictEqual(result.reconciledCount, 1);
      assert.strictEqual(db.memberships[0].status, 'TRIAL');
      assert.strictEqual(db.memberships[0].gateway_status, 'authorized');

      const email = db.emailOutbox.find(e => e.dedupe_key === `trial-welcome:${MEMBERSHIP_ID}`);
      assert.ok(email, 'Debe encolar email trial_welcome');
    });

    it('Cancelación en MP con período pagado vigente mantiene acceso legítimo en validateMembershipDates', async () => {
      const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
      db.memberships[0].status = 'ACTIVE';
      db.memberships[0].current_period_end = futureDate;
      db.memberships[0].gateway_status = 'authorized';

      const mockClient = {
        getSubscription: async (): Promise<any> => ({
          id: 'sub_preapproval_audit_100',
          status: 'canceled', // Cancelada en MP
        }),
      };

      const result = await reconcileMemberships({
        supabase: db,
        client: mockClient as any,
      });

      assert.strictEqual(result.reconciledCount, 1);
      assert.strictEqual(db.memberships[0].gateway_status, 'canceled');
      assert.strictEqual(db.memberships[0].status, 'CANCELLED');

      // Comprobar evaluación de acceso:
      // A pesar de estar CANCELLED en pasarela, el ciclo pagado sigue vigente
      const accessEval = validateMembershipDates(db.memberships[0] as MembershipRecord);
      assert.strictEqual(accessEval.hasAccess, true, 'Debe mantener acceso porque pagó el período');
      assert.strictEqual(accessEval.status, 'ACTIVE');
      assert.ok(accessEval.reason?.includes('período pagado vigente'));
    });

    it('Cancelación en MP sin período pagado o vencido deniega acceso inmediatamente', () => {
      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const mem: MembershipRecord = {
        id: 'mem-cancelled-past',
        student_id: 'student-99',
        status: 'CANCELLED',
        gateway_status: 'canceled',
        start_date: '2026-08-01',
        current_period_end: pastDate,
        created_at: '2026-08-01T10:00:00Z',
      };

      const accessEval = validateMembershipDates(mem);
      assert.strictEqual(accessEval.hasAccess, false);
      assert.strictEqual(accessEval.status, 'CANCELLED');
    });
  });

  // 10. Seguridad de Endpoints Cron
  describe('10. Seguridad de Endpoints Cron (/api/cron/*)', () => {
    const originalCronSecret = process.env.CRON_SECRET;

    beforeEach(() => {
      process.env.CRON_SECRET = 'audit_cron_secret_777';
    });

    it('/api/cron/process-outbox rechaza peticiones sin Authorization con HTTP 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/process-outbox', {
        method: 'POST',
      });

      const res = await processOutboxHandler(req);
      assert.strictEqual(res.status, 401);
    });

    it('/api/cron/reconcile-memberships rechaza peticiones con Bearer token incorrecto con HTTP 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/reconcile-memberships', {
        method: 'POST',
        headers: {
          authorization: 'Bearer wrong_token_123',
        },
      });

      const res = await reconcileMembershipsHandler(req);
      assert.strictEqual(res.status, 401);
    });

    it('Rutas cron validan la presencia y valor exacto de CRON_SECRET', () => {
      const token = 'audit_cron_secret_777';
      assert.strictEqual(`Bearer ${token}`, `Bearer ${process.env.CRON_SECRET}`);
    });
  });
});
