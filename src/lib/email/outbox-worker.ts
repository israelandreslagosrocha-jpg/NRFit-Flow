import { sendEmail } from './mailer.ts';
import type { EmailOutboxRecord } from './types.ts';

export interface ProcessOutboxResult {
  processed: number;
  sent: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * Worker asíncrono y desacoplado para el despacho de email_outbox.
 * REGLA ARQUITECTÓNICA CRÍTICA:
 * Un fallo en este worker NUNCA revierte, modifica o cancela una transacción financiera
 * ni el estado de una membresía. Su única función es registrar el estado 'SENT' o 'FAILED'
 * en la tabla email_outbox para permitir reintentos.
 */
export async function processEmailOutbox(
  fetchPendingEmails: () => Promise<EmailOutboxRecord[]>,
  updateEmailStatus: (params: {
    id: string;
    status: 'SENT' | 'FAILED';
    attempts: number;
    lastError?: string | null;
  }) => Promise<void>
): Promise<ProcessOutboxResult> {
  const pendingRecords = await fetchPendingEmails();
  const result: ProcessOutboxResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    errors: [],
  };

  for (const record of pendingRecords) {
    result.processed++;
    const sendResult = await sendEmail({
      to: record.recipient_email,
      templateId: record.template_id,
      payload: record.payload,
    });

    if (sendResult.success) {
      result.sent++;
      await updateEmailStatus({
        id: record.id,
        status: 'SENT',
        attempts: record.attempts + 1,
        lastError: null,
      });
    } else {
      result.failed++;
      const errMsg = sendResult.error || 'Fallo desconocido en envío de correo';
      result.errors.push({ id: record.id, error: errMsg });
      await updateEmailStatus({
        id: record.id,
        status: 'FAILED',
        attempts: record.attempts + 1,
        lastError: errMsg,
      });
    }
  }

  return result;
}
