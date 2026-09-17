import { sendEmail } from './mailer.ts';
import { generateDeterministicMessageId, type EmailOutboxRecord } from './types.ts';
import {
  sanitizeErrorMessage,
  calculateNextAttempt,
  MAX_OUTBOX_ATTEMPTS,
} from './sanitizer.ts';

export interface ProcessOutboxResult {
  processed: number;
  sent: number;
  failed: number;
  dead_letter: number;
  errors: Array<{ id: string; error: string }>;
}

export interface UpdateEmailStatusParams {
  id: string;
  status: 'SENT' | 'FAILED' | 'DEAD_LETTER';
  attempts: number;
  nextAttemptAt?: string | null;
  lastError?: string | null;
}

/**
 * Worker asíncrono y desacoplado para el despacho atómico de email_outbox.
 * REGLA ARQUITECTÓNICA CRÍTICA:
 * Un fallo en este worker NUNCA revierte, modifica o cancela una transacción financiera
 * ni el estado de una membresía. Su única función es registrar el estado 'SENT', 'FAILED'
 * o 'DEAD_LETTER' en la tabla email_outbox.
 * 
 * Semántica: At-least-once processing con mitigación activa de duplicados
 * y header Message-ID determinista RFC 5322 preservado entre retries
 * (sin asumir que el MTA receptor elimine duplicados).
 */
export async function processEmailOutbox(
  fetchClaimedEmails: () => Promise<EmailOutboxRecord[]>,
  updateEmailStatus: (params: UpdateEmailStatusParams) => Promise<void>
): Promise<ProcessOutboxResult> {
  const claimedRecords = await fetchClaimedEmails();
  const result: ProcessOutboxResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    dead_letter: 0,
    errors: [],
  };

  for (const record of claimedRecords) {
    result.processed++;
    const messageId = generateDeterministicMessageId(record.id, record.dedupe_key);

    // Determinar attempt_count de intentos iniciados:
    // Si fue reclamado atómicamente por la RPC (status === 'PROCESSING'), attempts ya fue incrementado al claim.
    // Si se pasa un registro en 'PENDING' sin claim previo, se incrementa atómicamente para este intento.
    const attemptCount = record.status === 'PROCESSING'
      ? Math.max(record.attempts ?? 1, 1)
      : (record.attempts ?? 0) + 1;

    const sendResult = await sendEmail({
      to: record.recipient_email,
      templateId: record.template_id,
      payload: record.payload,
      messageId,
    });

    if (sendResult.success) {
      result.sent++;
      await updateEmailStatus({
        id: record.id,
        status: 'SENT',
        attempts: attemptCount,
        nextAttemptAt: null,
        lastError: null,
      });
    } else {
      const rawError = sendResult.error || 'Fallo desconocido en envío SMTP';
      const sanitizedErr = sanitizeErrorMessage(rawError);
      result.errors.push({ id: record.id, error: sanitizedErr });

      const maxAttempts = record.max_attempts || MAX_OUTBOX_ATTEMPTS;
      const isExhausted = attemptCount >= maxAttempts;

      if (isExhausted) {
        // Estado terminal canónico: DEAD_LETTER
        result.dead_letter++;
        await updateEmailStatus({
          id: record.id,
          status: 'DEAD_LETTER',
          attempts: attemptCount,
          nextAttemptAt: null,
          lastError: sanitizedErr,
        });
      } else {
        // Estado transitorio: FAILED con backoff programado
        result.failed++;
        const nextAttempt = calculateNextAttempt(attemptCount);
        await updateEmailStatus({
          id: record.id,
          status: 'FAILED',
          attempts: attemptCount,
          nextAttemptAt: nextAttempt ? nextAttempt.toISOString() : null,
          lastError: sanitizedErr,
        });
      }
    }
  }

  return result;
}

