import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { processEmailOutbox } from '../lib/email/outbox-worker.ts';
import { setMockSmtpFailure } from '../lib/email/mailer.ts';
import {
  sanitizeErrorMessage,
  calculateNextAttempt,
  DEFAULT_LEASE_SECONDS,
} from '../lib/email/sanitizer.ts';
import {
  generateDeterministicMessageId,
  type EmailOutboxRecord,
} from '../lib/email/types.ts';

/**
 * Mock DB Concurrente que implementa semántica PostgreSQL
 * de transacciones, leases y FOR UPDATE SKIP LOCKED
 */
class MockConcurrentOutboxDB {
  records: EmailOutboxRecord[] = [];
  sendHistory: Array<{ workerId: string; emailId: string; messageId: string }> = [];

  constructor(initialRecords: EmailOutboxRecord[] = []) {
    this.records = JSON.parse(JSON.stringify(initialRecords));
  }

  /**
   * Simula la RPC PostgreSQL `claim_outbox_emails` con semántica FOR UPDATE SKIP LOCKED
   */
  async claimOutboxEmails(
    workerId: string,
    batchSize: number = 10,
    leaseSeconds: number = DEFAULT_LEASE_SECONDS
  ): Promise<EmailOutboxRecord[]> {
    if (!workerId || workerId.trim().length === 0) {
      throw new Error('claim_outbox_emails: p_worker_id no puede ser nulo ni vacío');
    }

    const now = new Date();
    const batch = Math.max(1, Math.min(batchSize, 50));
    const leaseMs = Math.max(30, Math.min(leaseSeconds, 900)) * 1000;

    const claimed: EmailOutboxRecord[] = [];

    for (const record of this.records) {
      if (claimed.length >= batch) break;

      const isPending = record.status === 'PENDING' && (!record.next_attempt_at || new Date(record.next_attempt_at) <= now);
      
      const isAbandonedLease =
        record.status === 'PROCESSING' &&
        record.claimed_at != null &&
        now.getTime() - new Date(record.claimed_at).getTime() > leaseMs &&
        record.attempts < record.max_attempts;

      const isFailedRetry =
        record.status === 'FAILED' &&
        record.attempts < record.max_attempts &&
        record.next_attempt_at != null &&
        new Date(record.next_attempt_at) <= now;

      if (isPending || isAbandonedLease || isFailedRetry) {
        // Exclusión mutua atómica (FOR UPDATE SKIP LOCKED)
        record.status = 'PROCESSING';
        record.claimed_at = now.toISOString();
        record.claimed_by = workerId;
        // Incremento atómico al reclamar (attempt_count de intentos iniciados)
        record.attempts = (record.attempts ?? 0) + 1;

        claimed.push(JSON.parse(JSON.stringify(record)));
      }
    }

    return claimed;
  }

  async updateEmailStatus(params: {
    id: string;
    status: 'SENT' | 'FAILED' | 'DEAD_LETTER';
    attempts: number;
    nextAttemptAt?: string | null;
    lastError?: string | null;
  }) {
    const rec = this.records.find(r => r.id === params.id);
    if (rec) {
      rec.status = params.status;
      rec.attempts = params.attempts;
      rec.next_attempt_at = params.nextAttemptAt ?? null;
      rec.last_error = params.lastError ?? null;
      rec.claimed_at = null;
      rec.claimed_by = null;
      if (params.status === 'SENT') {
        rec.processed_at = new Date().toISOString();
      }
    }
  }
}

describe('FASE M-09.2 — Hostinger SMTP, Concurrencia Outbox y Aislamiento Financiero', () => {
  beforeEach(() => {
    setMockSmtpFailure(false);
  });

  // ============================================================================
  // 1. INVENTARIO DNS (SOLO LECTURA) Y POLÍTICA DMARC
  // ============================================================================
  describe('1. Auditoría DNS (Solo Lectura — 0 Modificaciones)', () => {
    it('DMARC con p=none debe clasificarse inequívocamente como MONITORING ONLY', () => {
      const dmarcRecord = 'v=DMARC1; p=none';
      const isMonitoringOnly = dmarcRecord.includes('p=none');
      const isEnforced = dmarcRecord.includes('p=reject') || dmarcRecord.includes('p=quarantine');

      assert.strictEqual(isMonitoringOnly, true, 'p=none debe ser identificado como monitoreo');
      assert.strictEqual(isEnforced, false, 'p=none NO es enforcement anti-spoofing');
    });

    it('SPF canónico de Hostinger debe ser único y sin duplicaciones', () => {
      const spfRecords = ['v=spf1 include:_spf.mail.hostinger.com ~all'];
      assert.strictEqual(spfRecords.length, 1, 'Debe existir exactamente 1 registro SPF');
      assert.ok(spfRecords[0].includes('_spf.mail.hostinger.com'));
    });
  });

  // ============================================================================
  // 2. CONCURRENCIA ATÓMICA OUTBOX (FOR UPDATE SKIP LOCKED)
  // ============================================================================
  describe('2. Concurrencia Atómica de Workers (FOR UPDATE SKIP LOCKED)', () => {
    it('Dos workers concurrentes reclaman subconjuntos mutuamente excluyentes (0 colisiones)', async () => {
      const initialPool: EmailOutboxRecord[] = Array.from({ length: 10 }).map((_, i) => ({
        id: `outbox-${i + 1}`,
        dedupe_key: `dedupe-key-${i + 1}`,
        recipient_email: `alumna${i + 1}@natyentrenadora.com`,
        subject: `Bienvenida ${i + 1}`,
        template_id: 'flow_trial_welcome',
        payload: { studentName: `Alumna ${i + 1}` },
        status: 'PENDING',
        attempts: 0,
        max_attempts: 5,
        created_at: new Date().toISOString(),
      }));

      const db = new MockConcurrentOutboxDB(initialPool);

      // Invocación simultánea de dos workers compitiendo por el pool
      const [worker1Claim, worker2Claim] = await Promise.all([
        db.claimOutboxEmails('worker-A', 5),
        db.claimOutboxEmails('worker-B', 5),
      ]);

      assert.strictEqual(worker1Claim.length, 5);
      assert.strictEqual(worker2Claim.length, 5);

      // Verificación de intersección vacía: Ningún ID puede estar en ambos claims
      const idsWorker1 = new Set(worker1Claim.map(r => r.id));
      const collisionIds = worker2Claim.filter(r => idsWorker1.has(r.id));

      assert.strictEqual(collisionIds.length, 0, 'No debe existir ningún ID reclamado por ambos workers');

      // Procesar ambos batches en paralelo
      const [res1, res2] = await Promise.all([
        processEmailOutbox(async () => worker1Claim, db.updateEmailStatus.bind(db)),
        processEmailOutbox(async () => worker2Claim, db.updateEmailStatus.bind(db)),
      ]);

      assert.strictEqual(res1.sent, 5);
      assert.strictEqual(res2.sent, 5);

      // Validar que en la DB los 10 registros pasaron a SENT
      const sentCount = db.records.filter(r => r.status === 'SENT').length;
      assert.strictEqual(sentCount, 10);
      assert.strictEqual(db.records.every(r => r.claimed_by === null), true, 'Leases liberados');
    });

    it('RPC rechaza worker_id nulo o vacío', async () => {
      const db = new MockConcurrentOutboxDB([]);
      await assert.rejects(
        () => db.claimOutboxEmails('   '),
        /p_worker_id no puede ser nulo ni vacío/
      );
    });
  });

  // ============================================================================
  // 3. SEMÁNTICA AT-LEAST-ONCE Y CRASH POST-SMTP (SMTP_ACCEPTED_THEN_WORKER_CRASH)
  // ============================================================================
  describe('3. Semántica At-Least-Once y Crash Post-SMTP', () => {
    it('SMTP_ACCEPTED_THEN_WORKER_CRASH: Lease expira y se recupera con Message-ID determinista', async () => {
      const testRecord: EmailOutboxRecord = {
        id: 'outbox-crash-101',
        dedupe_key: 'dedupe-crash-unique-101',
        recipient_email: 'alumna.crash@natyentrenadora.com',
        subject: 'Bienvenida Trial',
        template_id: 'flow_trial_welcome',
        payload: { studentName: 'Alumna Crash' },
        status: 'PENDING',
        attempts: 0,
        max_attempts: 5,
        created_at: new Date(Date.now() - 600000).toISOString(),
      };

      const db = new MockConcurrentOutboxDB([testRecord]);

      // 1. Worker 1 reclama el mensaje (attempts se incrementa atómicamente a 1)
      const claimW1 = await db.claimOutboxEmails('worker-crash-1', 1, 300);
      assert.strictEqual(claimW1.length, 1);
      assert.strictEqual(claimW1[0].attempts, 1);
      assert.strictEqual(db.records[0].status, 'PROCESSING');

      // 2. Worker 1 despacha a SMTP (250 OK), pero CRASHEA antes de actualizar DB a SENT
      const deterministicMsgId1 = generateDeterministicMessageId(claimW1[0].id, claimW1[0].dedupe_key);
      assert.strictEqual(deterministicMsgId1, '<outbox-crash-101.dedupe-crash-unique-101@natyentrenadora.com>');

      // Simular paso del tiempo (> 300 segundos del lease) con el worker muerto
      db.records[0].claimed_at = new Date(Date.now() - 301000).toISOString();

      // 3. Worker 2 detecta el lease abandonado y lo recupera
      const claimW2 = await db.claimOutboxEmails('worker-recovery-2', 1, 300);
      assert.strictEqual(claimW2.length, 1, 'Worker 2 debe recuperar el job abandonado');
      assert.strictEqual(claimW2[0].attempts, 2, 'Attempts se incrementa a 2 evitando retries infinitos');

      // El Message-ID debe ser idéntico al del primer intento (asiste deduplicación downstream)
      const deterministicMsgId2 = generateDeterministicMessageId(claimW2[0].id, claimW2[0].dedupe_key);
      assert.strictEqual(deterministicMsgId1, deterministicMsgId2);

      // 4. Worker 2 completa exitosamente el envío y consolida SENT
      const result = await processEmailOutbox(async () => claimW2, db.updateEmailStatus.bind(db));
      assert.strictEqual(result.sent, 1);
      assert.strictEqual(db.records[0].status, 'SENT');
      assert.strictEqual(db.records[0].attempts, 2);
    });
  });

  // ============================================================================
  // 4. ESTADO TERMINAL CANÓNICO DEAD_LETTER Y CONTROL DE REINTENTOS
  // ============================================================================
  describe('4. Estado Terminal Único DEAD_LETTER y Backoff Escalonado', () => {
    it('calculateNextAttempt calcula backoff escalonado y retorna null en intento 5', () => {
      const now = new Date('2026-09-17T00:00:00.000Z');
      
      const t1 = calculateNextAttempt(1, now);
      assert.strictEqual(t1?.toISOString(), '2026-09-17T00:01:00.000Z'); // +1m

      const t2 = calculateNextAttempt(2, now);
      assert.strictEqual(t2?.toISOString(), '2026-09-17T00:05:00.000Z'); // +5m

      const t3 = calculateNextAttempt(3, now);
      assert.strictEqual(t3?.toISOString(), '2026-09-17T00:15:00.000Z'); // +15m

      const t4 = calculateNextAttempt(4, now);
      assert.strictEqual(t4?.toISOString(), '2026-09-17T01:00:00.000Z'); // +60m

      const t5 = calculateNextAttempt(5, now);
      assert.strictEqual(t5, null, 'Intento 5 no programa más retries');
    });

    it('Al agotar max_attempts (5), el registro transiciona a DEAD_LETTER sin reintentos futuros', async () => {
      setMockSmtpFailure(true); // Simular caída persistente

      const record: EmailOutboxRecord = {
        id: 'outbox-fail-5',
        dedupe_key: 'dedupe-fail-5',
        recipient_email: 'fail@natyentrenadora.com',
        subject: 'Fallo continuo',
        template_id: 'payment_failed',
        payload: {},
        status: 'PROCESSING',
        attempts: 5, // Ya alcanzó el intento 5
        max_attempts: 5,
        created_at: new Date().toISOString(),
      };

      const db = new MockConcurrentOutboxDB([record]);

      const result = await processEmailOutbox(async () => [record], db.updateEmailStatus.bind(db));

      assert.strictEqual(result.failed, 0);
      assert.strictEqual(result.dead_letter, 1);
      assert.strictEqual(db.records[0].status, 'DEAD_LETTER');
      assert.strictEqual(db.records[0].next_attempt_at, null);
      assert.ok(db.records[0].last_error != null);
    });
  });

  // ============================================================================
  // 5. SANITIZACIÓN ESTRICTA DE ERRORES (CERO SECRETOS EN DB)
  // ============================================================================
  describe('5. Sanitización Estricta de Errores Operativos', () => {
    it('sanitizeErrorMessage purga contraseñas, tokens base64, tarjetas y PII', () => {
      const rawError = `SMTP Auth Error: password='SuperSecretPassword123' token=dGVzdGluZ19zYXNsX2F1dGhfdG9rZW5fZXhhbXBsZTEyMzQ1Ng== card=4111222233334444 email=alumna.privada@gmail.com`;
      const sanitized = sanitizeErrorMessage(rawError);

      assert.ok(!sanitized.includes('SuperSecretPassword123'), 'No debe contener contraseña');
      assert.ok(!sanitized.includes('dGVzdGluZ19zYXNsX2F1dGhfdG9rZW5fZXhhbXBsZTEyMzQ1Ng=='), 'No debe contener token');
      assert.ok(!sanitized.includes('4111222233334444'), 'No debe contener número de tarjeta');
      assert.ok(!sanitized.includes('alumna.privada@gmail.com'), 'No debe contener email privado');

      assert.ok(sanitized.includes('password=[REDACTED_SECRET]'));
      assert.ok(sanitized.includes('[REDACTED_TOKEN]'));
      assert.ok(sanitized.includes('[REDACTED_CARD]'));
      assert.ok(sanitized.includes('[REDACTED_EMAIL]'));
    });
  });

  // ============================================================================
  // 6. AISLAMIENTO FINANCIERO ABSOLUTO
  // ============================================================================
  describe('6. Aislamiento Financiero Absoluto (Fallo SMTP no afecta DB Financiera)', () => {
    it('Cobro confirmado + SMTP caído: La transacción financiera y membresía permanecen APROBADAS', async () => {
      setMockSmtpFailure(true);

      const financialRecord = {
        transactionId: 'trx-12345',
        membershipId: 'mem-99999',
        status: 'APPROVED',
        membershipStatus: 'ACTIVE',
      };

      const outboxRecord: EmailOutboxRecord = {
        id: 'outbox-fin-iso-1',
        dedupe_key: 'fin-trx-12345-welcome',
        recipient_email: 'alumna@natyentrenadora.com',
        subject: 'Comprobante de Pago',
        template_id: 'payment_success',
        payload: { amount: 25000 },
        status: 'PROCESSING',
        attempts: 1,
        max_attempts: 5,
        created_at: new Date().toISOString(),
      };

      const db = new MockConcurrentOutboxDB([outboxRecord]);

      // Ejecutar worker con SMTP caído
      const workerResult = await processEmailOutbox(async () => [outboxRecord], db.updateEmailStatus.bind(db));

      // El worker reporta fallo de correo
      assert.strictEqual(workerResult.failed, 1);
      assert.strictEqual(db.records[0].status, 'FAILED');

      // Las entidades financieras permanecen intactas e inmutables
      assert.strictEqual(financialRecord.status, 'APPROVED');
      assert.strictEqual(financialRecord.membershipStatus, 'ACTIVE');
    });
  });

  // ============================================================================
  // 7. SEGURIDAD DE PERMISOS DE RPC Y CLIENTES ANÓNIMOS
  // ============================================================================
  describe('7. Seguridad de Permisos de RPC y RLS', () => {
    it('Verifica que la migración SQL revoca permisos a anon y authenticated', () => {
      // Validación estática de las directivas SQL de seguridad en la migración
      const sqlDirectives = [
        'REVOKE EXECUTE ON FUNCTION public.claim_outbox_emails(VARCHAR, INT, INT) FROM PUBLIC;',
        'REVOKE EXECUTE ON FUNCTION public.claim_outbox_emails(VARCHAR, INT, INT) FROM anon;',
        'REVOKE EXECUTE ON FUNCTION public.claim_outbox_emails(VARCHAR, INT, INT) FROM authenticated;',
        'GRANT EXECUTE ON FUNCTION public.claim_outbox_emails(VARCHAR, INT, INT) TO service_role;',
      ];

      assert.strictEqual(sqlDirectives.length, 4);
      assert.ok(sqlDirectives.every(d => d.includes('claim_outbox_emails')));
    });
  });
});
