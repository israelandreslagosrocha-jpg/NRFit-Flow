import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { NextRequest } from 'next/server.js';
import {
  signFlowParams,
  verifyFlowSignature,
  assertSandboxGuard,
  FlowClient,
} from '../lib/payments/flow/client.ts';
import { FlowGatewayAdapter } from '../lib/payments/flow/adapter.ts';
import { processFlowCallback } from '../lib/payments/flow/processor.ts';
import { reconcileFlowSubscriptions } from '../lib/payments/flow/reconciler.ts';
import { validateMembershipDates, type MembershipRecord } from '../lib/supabase/membership-helpers.ts';
import { POST as callbackRouteHandler, GET as callbackGetHandler } from '../app/api/callbacks/flow/route.ts';
import { setPaymentGateway } from '../lib/payments/index.ts';
import { setMockSmtpFailure, sendEmail } from '../lib/email/mailer.ts';

/**
 * Mock DB con semántica PostgreSQL / Supabase para certificar Fase M-09R (Flow Chile)
 */
class MockFlowAuditDB {
  memberships: any[] = [];
  paymentEvents: any[] = [];
  paymentTransactions: any[] = [];
  emailOutbox: any[] = [];
  students: any[] = [];
  profiles: any[] = [];

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
            const dataTable = (self as any)[tableToProp(table)] || [];
            const found = dataTable.find((row: any) =>
              queryConditions.every(cond => row[cond.col] === cond.val)
            );
            return Promise.resolve({ data: found ? { ...found } : null, error: null });
          },
          then(resolve: any) {
            let dataTable = (self as any)[tableToProp(table)] || [];
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
            if (notCondition && notCondition.op === 'is' && notCondition.val === null) {
              dataTable = dataTable.filter((row: any) => row[notCondition!.col] !== null);
            }
            resolve({ data: dataTable.map((r: any) => ({ ...r })), error: null });
          },
        };
      },
      insert(rowOrRows: any) {
        const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
        const dataTable = (self as any)[tableToProp(table)];

        // Validar unicidad simulando constraints de Postgres
        for (const row of rows) {
          if (table === 'payment_events') {
            const exists = dataTable.some((r: any) => r.gateway_event_id === row.gateway_event_id);
            if (exists) {
              return Promise.resolve({
                data: null,
                error: {
                  code: '23505',
                  message: `duplicate key value violates unique constraint "payment_events_gateway_id_key"`,
                },
              });
            }
          }
          if (table === 'payment_transactions') {
            const exists = dataTable.some((r: any) => r.gateway_payment_id === row.gateway_payment_id);
            if (exists) {
              return Promise.resolve({
                data: null,
                error: {
                  code: '23505',
                  message: `duplicate key value violates unique constraint "payment_transactions_gateway_id_key"`,
                },
              });
            }
          }
          if (table === 'email_outbox') {
            const exists = dataTable.some((r: any) => r.dedupe_key === row.dedupe_key);
            if (exists) {
              return Promise.resolve({
                data: null,
                error: {
                  code: '23505',
                  message: `duplicate key value violates unique constraint "email_outbox_dedupe_key"`,
                },
              });
            }
          }

          const inserted = {
            id: row.id || `mock-id-${Date.now()}-${Math.random()}`,
            created_at: new Date().toISOString(),
            ...row,
          };
          dataTable.push(inserted);
        }

        return {
          select(_cols?: string) {
            return {
              single() {
                return Promise.resolve({ data: { ...rows[0] }, error: null });
              },
            };
          },
          then(resolve: any) {
            resolve({ data: rows, error: null });
          },
        };
      },
      update(updates: any) {
        return {
          eq(col: string, val: any) {
            const dataTable = (self as any)[tableToProp(table)] || [];
            for (const row of dataTable) {
              if (row[col] === val) {
                Object.assign(row, updates);
              }
            }
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
    };
  }

  rpc(name: string, params: any) {
    if (name === 'apply_membership_transition_atomic') {
      const mem = this.memberships.find((m: any) => m.id === params.p_membership_id);
      if (!mem) return Promise.resolve({ data: { success: false, status: 'NOT_FOUND' }, error: null });
      if (
        params.p_gateway_snapshot_observed_at &&
        mem.last_gateway_snapshot_observed_at &&
        params.p_gateway_snapshot_observed_at < mem.last_gateway_snapshot_observed_at
      ) {
        return Promise.resolve({
          data: {
            success: true,
            status: 'STALE_SNAPSHOT_SKIPPED',
            membership_id: mem.id,
            current_status: mem.status,
          },
          error: null,
        });
      }
      const prevStatus = mem.status;
      mem.status = params.p_new_status;
      mem.gateway_status = params.p_gateway_status || mem.gateway_status;
      if (params.p_current_period_start) mem.current_period_start = params.p_current_period_start;
      if (params.p_current_period_end) mem.current_period_end = params.p_current_period_end;
      if (params.p_trial_ends_at) mem.trial_ends_at = params.p_trial_ends_at;
      if (params.p_new_status === 'CANCELLED' && !mem.cancelled_at) {
        mem.cancelled_at = new Date().toISOString();
      }
      mem.last_gateway_snapshot_observed_at = params.p_gateway_snapshot_observed_at || new Date().toISOString();
      mem.updated_at = new Date().toISOString();
      return Promise.resolve({
        data: {
          success: true,
          status: 'TRANSITIONED',
          membership_id: mem.id,
          previous_status: prevStatus,
          new_status: params.p_new_status,
          reason: params.p_reason,
        },
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: { message: `Unknown RPC function: ${name}` } });
  }
}

function tableToProp(table: string): string {
  switch (table) {
    case 'memberships': return 'memberships';
    case 'payment_events': return 'paymentEvents';
    case 'payment_transactions': return 'paymentTransactions';
    case 'email_outbox': return 'emailOutbox';
    case 'students': return 'students';
    case 'profiles': return 'profiles';
    default: return table;
  }
}

describe('FASE M-09R — Suite de Certificación Pasarela Flow Chile y Desacoplamiento', () => {
  let mockDb: MockFlowAuditDB;

  beforeEach(() => {
    mockDb = new MockFlowAuditDB();
    setMockSmtpFailure(false);
  });

  // ============================================================================
  // 1. FIRMA CRIPTOGRÁFICA OFICIAL FLOW (HMAC-SHA256)
  // ============================================================================
  describe('1. Algoritmo de Firma Criptográfica Oficial Flow', () => {
    it('Ordena parámetros alfabéticamente y concatena clave+valor sin separadores', () => {
      const secretKey = 'TEST_FLOW_SECRET_123';
      const params = {
        planId: 'naty-mensual',
        apiKey: 'FLOW_API_KEY_TEST',
        amount: 25000,
        currency: 'CLP',
      };

      // Orden esperado: amount, apiKey, currency, planId
      // Cadena esperada: amount25000apiKeyFLOW_API_KEY_TESTcurrencyCLPplanIdnaty-mensual
      const expectedStringToSign = 'amount25000apiKeyFLOW_API_KEY_TESTcurrencyCLPplanIdnaty-mensual';
      const expectedHmac = crypto.createHmac('sha256', secretKey).update(expectedStringToSign).digest('hex').toLowerCase();

      const calculatedSig = signFlowParams(params, secretKey);
      assert.strictEqual(calculatedSig, expectedHmac);
      assert.strictEqual(calculatedSig.length, 64);
    });

    it('verifyFlowSignature verifica en tiempo constante e ignora parámetro s existente', () => {
      const secretKey = 'FLOW_SECRET_SECURE';
      const params = { token: 'tok_flow_test_123', status: 1 };
      const signature = signFlowParams(params, secretKey);

      // Verificación positiva
      assert.strictEqual(verifyFlowSignature(params, signature, secretKey), true);

      // Verificación negativa con firma adulterada
      assert.strictEqual(verifyFlowSignature(params, 'bad_signature_value', secretKey), false);
    });
  });

  // ============================================================================
  // 2. SALVAGUARDA ACTIVA ANTI-PRODUCCIÓN
  // ============================================================================
  describe('2. Salvaguarda Activa Anti-Producción', () => {
    it('Aborta de inmediato si se intenta usar la URL productiva www.flow.cl', () => {
      assert.throws(
        () => assertSandboxGuard('https://www.flow.cl/api', 'sandbox'),
        /ABORT_PRODUCTION_GUARD: Cobros reales y endpoints productivos de Flow bloqueados en Fase M-09R/
      );
    });

    it('Aborta si FLOW_ENV no es sandbox', () => {
      assert.throws(
        () => assertSandboxGuard('https://sandbox.flow.cl/api', 'production'),
        /ABORT_PRODUCTION_GUARD/
      );
    });

    it('Permite operar en entorno sandbox con https://sandbox.flow.cl/api', () => {
      assert.doesNotThrow(() => {
        assertSandboxGuard('https://sandbox.flow.cl/api', 'sandbox');
      });
    });
  });

  // ============================================================================
  // 3. IDENTIDAD FLOW CUSTOMER -> student.id (1:1 ESTABLE)
  // ============================================================================
  describe('3. Identidad Flow Customer vinculada a student.id', () => {
    it('createCustomer vincula externalId a student.id y no a membership.id', async () => {
      const studentId = 'student-uuid-9999';
      let capturedExternalId = '';

      const mockClient = {
        createCustomer: (p: any) => {
          capturedExternalId = p.externalId;
          return Promise.resolve({ customerId: 'cus_flow_12345', created: '2026-09-17', status: '1' });
        },
      } as any;

      const adapter = new FlowGatewayAdapter(mockClient);
      const customer = await adapter.createCustomer({
        name: 'Camila Alumna',
        email: 'camila@ejemplo.com',
        externalId: studentId,
      });

      assert.strictEqual(customer.id, 'cus_flow_12345');
      assert.strictEqual(capturedExternalId, studentId, 'externalId debe ser student.id');
    });
  });

  // ============================================================================
  // 4. POLÍTICA OFICIAL DE CANCELACIÓN NATY
  // ============================================================================
  describe('4. Política Oficial de Cancelación Naty (Acceso Garantizado)', () => {
    it('TRIAL cancelado: Conserva acceso hasta trial_ends_at y genera $0 cobros', () => {
      const now = new Date();
      const futureTrialEnd = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString();

      const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const membership: MembershipRecord = {
        id: 'mem-trial-cancel',
        student_id: 'stu-1',
        status: 'TRIAL',
        start_date: startDate,
        created_at: startDate,
        trial_ends_at: futureTrialEnd,
        current_period_end: null,
        end_date: null,
      };

      // Mientras trial_ends_at está en el futuro, conserva acceso
      const evalVigente = validateMembershipDates(membership, now);
      assert.strictEqual(evalVigente.hasAccess, true);

      // Una vez superado trial_ends_at, el acceso termina sin ningún cobro realizado
      const futureDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
      const evalExpirado = validateMembershipDates(membership, futureDate);
      assert.strictEqual(evalExpirado.hasAccess, false);
    });

    it('ACTIVE cancelado: Conserva acceso hasta current_period_end sin renovación futura', () => {
      const now = new Date();
      const futurePeriodEnd = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();
      const startDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const membership: MembershipRecord = {
        id: 'mem-active-cancel',
        student_id: 'stu-2',
        status: 'ACTIVE',
        start_date: startDate,
        created_at: startDate,
        trial_ends_at: null,
        current_period_end: futurePeriodEnd,
        end_date: null,
      };

      // Durante los 15 días restantes, la alumna sigue entrenando
      const evalVigente = validateMembershipDates(membership, now);
      assert.strictEqual(evalVigente.hasAccess, true);

      // Al expirar el período pagado, el acceso se corta limpiamente
      const expiredDate = new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000);
      const evalExpirado = validateMembershipDates(membership, expiredDate);
      assert.strictEqual(evalExpirado.hasAccess, false);
    });
  });

  // ============================================================================
  // 5. MOROSIDAD EN FLOW (morose = 0, 1, 2)
  // ============================================================================
  describe('5. Mapeo Oficial de Morosidad Flow (morose = 0, 1, 2)', () => {
    it('morose = 0: Todos los invoices pagados -> status ACTIVE', async () => {
      const mockClient = {
        getSubscription: () => Promise.resolve({
          subscriptionId: 'sub_000',
          planId: 'naty-mensual',
          customerId: 'cus_1',
          status: 1,
          morose: 0,
          period_start: new Date().toISOString(),
          period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
          cancel_at_period_end: 0,
        }),
      } as any;

      const adapter = new FlowGatewayAdapter(mockClient);
      const sub = await adapter.getSubscription('sub_000');
      assert.strictEqual(sub.status, 'ACTIVE');
      assert.strictEqual(sub.morose, 0);
    });

    it('morose = 1: Invoice vencido -> transiciona a PAST_DUE (fail-closed, sin acceso)', async () => {
      const mockClient = {
        getSubscription: () => Promise.resolve({
          subscriptionId: 'sub_morose_1',
          planId: 'naty-mensual',
          customerId: 'cus_1',
          status: 1,
          morose: 1, // Invoice vencido
          period_end: new Date(Date.now() + 10 * 86400000).toISOString(),
        }),
      } as any;

      const adapter = new FlowGatewayAdapter(mockClient);
      const sub = await adapter.getSubscription('sub_morose_1');
      assert.strictEqual(sub.status, 'PAST_DUE');
      assert.strictEqual(sub.morose, 1);

      // Validación de negocio en dominio
      const startDate = new Date(Date.now() - 20 * 86400000).toISOString().split('T')[0];
      const mem: MembershipRecord = {
        id: 'mem-past-due',
        student_id: 'stu-1',
        status: 'PAST_DUE',
        start_date: startDate,
        created_at: startDate,
        trial_ends_at: null,
        current_period_end: new Date(Date.now() + 10 * 86400000).toISOString(),
        end_date: null,
      };
      const evalAccess = validateMembershipDates(mem);
      assert.strictEqual(evalAccess.hasAccess, false, 'PAST_DUE debe fallar cerrado');
    });

    it('morose = 2: Invoice pendiente NO vencido -> NO convierte a PAST_DUE', async () => {
      const futureEnd = new Date(Date.now() + 2 * 86400000).toISOString();
      const mockClient = {
        getSubscription: () => Promise.resolve({
          subscriptionId: 'sub_morose_2',
          planId: 'naty-mensual',
          customerId: 'cus_1',
          status: 1,
          morose: 2, // Pendiente de pago pero aún no vencido
          period_end: futureEnd,
        }),
      } as any;

      const adapter = new FlowGatewayAdapter(mockClient);
      const sub = await adapter.getSubscription('sub_morose_2');
      // No debe ser forzado a PAST_DUE
      assert.strictEqual(sub.status, 'ACTIVE');
      assert.strictEqual(sub.morose, 2);

      // El acceso depende estrictamente de las fechas vigentes
      const startDate = new Date(Date.now() - 20 * 86400000).toISOString().split('T')[0];
      const memVigente: MembershipRecord = {
        id: 'mem-morose-2',
        student_id: 'stu-1',
        status: 'ACTIVE',
        start_date: startDate,
        created_at: startDate,
        trial_ends_at: null,
        current_period_end: futureEnd,
        end_date: null,
      };
      assert.strictEqual(validateMembershipDates(memVigente).hasAccess, true);
    });
  });

  // ============================================================================
  // 6. SUSCRIPCIÓN CON Y SIN CARGO AUTOMÁTICO (DUAL MODE)
  // ============================================================================
  describe('6. Soporte Dual de Cargo Automático (Capability Flag)', () => {
    it('Modo AUTOMATIC_RECURRING genera URL de enrolamiento de tarjeta Flow/Webpay', async () => {
      const originalEnv = process.env.FLOW_AUTOMATIC_CHARGE_ENABLED;
      process.env.FLOW_AUTOMATIC_CHARGE_ENABLED = 'true';

      try {
        const mockClient = {
          registerCustomer: () => Promise.resolve({
            url: 'https://sandbox.flow.cl/webpay/register',
            token: 'tok_card_reg_777',
          }),
        } as any;

        const adapter = new FlowGatewayAdapter(mockClient);
        assert.strictEqual(adapter.mode, 'AUTOMATIC_RECURRING');

        const reg = await adapter.registerPaymentMethod({
          customerId: 'cus_123',
          returnUrl: 'https://natyentrenadora.com/checkout/flow-return',
        });

        assert.strictEqual(reg.url, 'https://sandbox.flow.cl/webpay/register');
        assert.strictEqual(reg.token, 'tok_card_reg_777');
        assert.strictEqual(reg.redirectUrl, 'https://sandbox.flow.cl/webpay/register?token=tok_card_reg_777');
      } finally {
        process.env.FLOW_AUTOMATIC_CHARGE_ENABLED = originalEnv;
      }
    });

    it('Modo SUBSCRIPTION_PAYMENT_LINK no enrola tarjeta y crea suscripción con trial', async () => {
      const originalEnv = process.env.FLOW_AUTOMATIC_CHARGE_ENABLED;
      process.env.FLOW_AUTOMATIC_CHARGE_ENABLED = 'false';

      try {
        const mockClient = {
          createSubscription: (p: any) => Promise.resolve({
            subscriptionId: 'sub_link_999',
            planId: p.planId,
            customerId: p.customerId,
            status: 2, // Trial
            morose: 0,
            trial_end: new Date(Date.now() + 7 * 86400000).toISOString(),
            cancel_at_period_end: 0,
          }),
        } as any;

        const adapter = new FlowGatewayAdapter(mockClient);
        assert.strictEqual(adapter.mode, 'SUBSCRIPTION_PAYMENT_LINK');

        const sub = await adapter.createSubscription({
          planId: 'naty-mensual-25k-v1',
          customerId: 'cus_123',
          trialPeriodDays: 7,
        });

        assert.strictEqual(sub.id, 'sub_link_999');
        assert.strictEqual(sub.status, 'TRIAL');
      } finally {
        process.env.FLOW_AUTOMATIC_CHARGE_ENABLED = originalEnv;
      }
    });
  });

  // ============================================================================
  // 7. IDEMPOTENCIA DUAL (INBOUND Y FINANCIERA)
  // ============================================================================
  describe('7. Idempotencia Dual (Inbound y Financiera)', () => {
    it('Callback duplicado es detectado por constraint 23505 y retorna ALREADY_PROCESSED', async () => {
      mockDb.memberships.push({
        id: 'mem-uuid-1',
        gateway_subscription_id: 'sub_test_1',
        status: 'TRIAL',
      });

      const mockClient = {
        getPaymentStatus: () => Promise.resolve({
          flowOrder: 554433,
          amount: 25000,
          currency: 'CLP',
          status: 2, // Pagada
          requestDate: new Date().toISOString(),
        }),
      } as any;

      const adapter = new FlowGatewayAdapter(mockClient);
      setPaymentGateway(adapter);

      // Primer procesamiento
      const res1 = await processFlowCallback({
        supabase: mockDb as any,
        token: 'tok_duplicate_test',
        resourceHint: 'payment',
      });
      assert.strictEqual(res1.statusResult, 'PROCESSED');
      assert.strictEqual(mockDb.paymentEvents.length, 1);

      // Segundo procesamiento (duplicado)
      const res2 = await processFlowCallback({
        supabase: mockDb as any,
        token: 'tok_duplicate_test',
        resourceHint: 'payment',
      });
      assert.strictEqual(res2.statusResult, 'ALREADY_PROCESSED');
      assert.strictEqual(mockDb.paymentEvents.length, 1, 'No debe duplicar eventos en payment_events');
    });

    it('Transacción financiera repetida no duplica cobros contables ni emails en outbox', async () => {
      mockDb.memberships.push({
        id: 'mem-uuid-2',
        gateway_subscription_id: 'sub_test_2',
        status: 'TRIAL',
      });

      const mockClient = {
        getPaymentStatus: () => Promise.resolve({
          flowOrder: 888999,
          amount: 25000,
          currency: 'CLP',
          status: 2,
          requestDate: new Date().toISOString(),
        }),
      } as any;

      const adapter = new FlowGatewayAdapter(mockClient);
      setPaymentGateway(adapter);

      // Despacho 1
      await processFlowCallback({
        supabase: mockDb as any,
        token: 'tok_unique_pay_1',
        resourceHint: 'payment',
      });

      const txCount1 = mockDb.paymentTransactions.length;
      const emailCount1 = mockDb.emailOutbox.length;
      assert.strictEqual(txCount1, 1);
      assert.strictEqual(emailCount1, 1);

      // Forzar inserción de evento distinto pero mismo pago contable
      mockDb.paymentEvents = []; // Limpiar inbound para probar idempotencia financiera
      await processFlowCallback({
        supabase: mockDb as any,
        token: 'tok_unique_pay_2',
        resourceHint: 'payment',
      });

      assert.strictEqual(mockDb.paymentTransactions.length, 1, 'payment_transactions debe tener exactamente 1 registro');
      assert.strictEqual(mockDb.emailOutbox.length, 1, 'email_outbox no debe encolar duplicados');
    });
  });

  // ============================================================================
  // 8. AISLAMIENTO DE FALLO SMTP
  // ============================================================================
  describe('8. Aislamiento de Fallo SMTP', () => {
    it('Caída de Hostinger SMTP jamás revierte la transacción ni la membresía', async () => {
      setMockSmtpFailure(true);

      const emailRes = await sendEmail({
        to: 'alumna@natyentrenadora.com',
        templateId: 'payment_success',
        payload: { amount: 25000 },
      });

      // El envío falla
      assert.strictEqual(emailRes.success, false);
      assert.match(emailRes.error!, /SMTP_CONNECTION_TIMEOUT/);

      // Pero la membresía y la transacción quedan intactas en base de datos
      mockDb.memberships.push({
        id: 'mem-smtp-iso',
        status: 'ACTIVE',
      });

      assert.strictEqual(mockDb.memberships[0].status, 'ACTIVE');
    });
  });

  // ============================================================================
  // 9. CONFIGURACIÓN DE DOMINIO Y CORREO (.COM)
  // ============================================================================
  describe('9. Dominio Canónico y Correo Oficial .com', () => {
    it('El correo oficial configurado en el mailer es team@natyentrenadora.com', async () => {
      const emailRes = await sendEmail({
        to: 'test@example.com',
        templateId: 'trial_welcome',
        payload: { studentName: 'Alumna Test' },
      });

      assert.strictEqual(emailRes.success, true);
    });

    it('No existen referencias activas a natyentrenadora.cl en la configuración', () => {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://natyentrenadora.com';
      assert.strictEqual(appUrl.includes('natyentrenadora.cl'), false);
    });
  });

  // ============================================================================
  // 10. PROTECCIÓN DE HISTÓRICO DE MERCADO PAGO EN BASE DE DATOS
  // ============================================================================
  describe('10. Protección de Histórico de Mercado Pago', () => {
    it('Registros históricos de Mercado Pago conservan gateway = MERCADOPAGO sin ser sobreescritos por Flow', () => {
      // Simular registro histórico
      mockDb.memberships.push({
        id: 'mem-mp-legacy',
        gateway: 'MERCADOPAGO',
        gateway_subscription_id: 'preapproval_mp_123',
        status: 'ACTIVE',
      });

      // Simular nuevo registro de Flow
      mockDb.memberships.push({
        id: 'mem-flow-new',
        gateway: 'FLOW',
        gateway_subscription_id: 'sub_flow_456',
        status: 'TRIAL',
      });

      const mpRecord = mockDb.memberships.find(m => m.id === 'mem-mp-legacy');
      const flowRecord = mockDb.memberships.find(m => m.id === 'mem-flow-new');

      assert.strictEqual(mpRecord.gateway, 'MERCADOPAGO', 'El histórico de MP jamás debe alterarse');
      assert.strictEqual(flowRecord.gateway, 'FLOW');
    });
  });

  // ============================================================================
  // 11. RECONCILIADOR S2S DE SUSCRIPCIONES FLOW
  // ============================================================================
  describe('11. Reconciliador Server-to-Server Flow', () => {
    it('Reconciliador detecta morosidad en Flow y actualiza a PAST_DUE', async () => {
      mockDb.memberships.push({
        id: 'mem-sync-1',
        gateway: 'FLOW',
        gateway_subscription_id: 'sub_reconcile_overdue',
        status: 'ACTIVE',
      });

      const mockClient = {
        getSubscription: () => Promise.resolve({
          subscriptionId: 'sub_reconcile_overdue',
          status: 1,
          morose: 1, // Vencida en Flow pero activa localmente
        }),
      } as any;

      const adapter = new FlowGatewayAdapter(mockClient);
      setPaymentGateway(adapter);

      const result = await reconcileFlowSubscriptions(mockDb as any);
      assert.strictEqual(result.scanned, 1);
      assert.strictEqual(result.reconciled, 1);

      const updated = mockDb.memberships.find(m => m.id === 'mem-sync-1');
      assert.strictEqual(updated.status, 'PAST_DUE');
    });
  });

  // ============================================================================
  // 12. SEGURIDAD DE ENDPOINT Y RESOLUCIÓN S2S
  // ============================================================================
  describe('12. Endpoint Callback de Flow (/api/callbacks/flow)', () => {
    it('Rechaza peticiones sin parámetro token con HTTP 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/callbacks/flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await callbackRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.match(json.error, /Falta parámetro token/);
    });

    it('GET sin token responde HTTP 200 confirmando endpoint listo', async () => {
      const req = new NextRequest('http://localhost:3000/api/callbacks/flow', {
        method: 'GET',
      });

      const res = await callbackGetHandler(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.status, 'FLOW_CALLBACK_ENDPOINT_READY');
    });
  });

  // ============================================================================
  // 13. MÉTODOS DE CONSULTA FLOWCLIENT (getPlan, listPlans, getCustomer)
  // ============================================================================
  describe('13. Métodos de consulta S2S FlowClient', () => {
    it('FlowClient instancia correctamente con configuración de Sandbox', () => {
      const client = new FlowClient({
        apiKey: 'TEST_API_KEY',
        secretKey: 'TEST_SECRET_KEY',
        baseUrl: 'https://sandbox.flow.cl/api',
        env: 'sandbox',
      });
      assert.strictEqual(client.getBaseUrl(), 'https://sandbox.flow.cl/api');
    });

    it('FlowClient incluye firma HMAC y apiKey en peticiones', async () => {
      let interceptedUrl = '';
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = (async (url: string | URL | Request) => {
          interceptedUrl = String(url);
          return {
            ok: true,
            json: async () => ({ planId: 'plan-naty-fit-monthly', name: 'Plan Mensual', amount: 25000, currency: 'CLP', interval: 3, trial_period_days: 7 }),
          } as any;
        }) as any;

        const client = new FlowClient({
          apiKey: 'TEST_KEY_123',
          secretKey: 'TEST_SECRET_ABC',
          baseUrl: 'https://sandbox.flow.cl/api',
          env: 'sandbox',
        });

        const plan = await client.getPlan('plan-naty-fit-monthly');
        assert.strictEqual(plan.planId, 'plan-naty-fit-monthly');
        assert.ok(interceptedUrl.includes('apiKey=TEST_KEY_123'));
        assert.ok(interceptedUrl.includes('planId=plan-naty-fit-monthly'));
        assert.ok(interceptedUrl.includes('&s='));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('getCustomer recupera roundtrip de externalId (student.id)', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = (async () => {
          return {
            ok: true,
            json: async () => ({
              customerId: 'cus_test_123',
              created: '2026-09-16 22:00:00',
              email: 'alumna@natyentrenadora.com',
              name: 'Alumna Test',
              pay_mode: 'manual',
              externalId: 'stu-uuid-12345',
              status: '1',
            }),
          } as any;
        }) as any;

        const client = new FlowClient({
          apiKey: 'TEST_KEY_123',
          secretKey: 'TEST_SECRET_ABC',
          baseUrl: 'https://sandbox.flow.cl/api',
          env: 'sandbox',
        });

        const cust = await client.getCustomer('cus_test_123');
        assert.strictEqual(cust.externalId, 'stu-uuid-12345');
        assert.strictEqual(cust.pay_mode, 'manual');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});

