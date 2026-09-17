import tls from 'tls';
import { renderEmailTemplate, type EmailTemplateId } from './types.ts';

export interface SendEmailParams {
  to: string;
  templateId: EmailTemplateId;
  payload: Record<string, any>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Hook de testing para simular caídas del servidor SMTP (Caso H)
let mockSmtpFailure: boolean = false;

export function setMockSmtpFailure(fail: boolean) {
  mockSmtpFailure = fail;
}

/**
 * Envío de correos mediante Hostinger SMTP (smtp.hostinger.com)
 * Casilla oficial: team@natyentrenadora.com
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  // Verificación de simulación para pruebas de tolerancia a fallos
  if (mockSmtpFailure) {
    return {
      success: false,
      error: 'SMTP_CONNECTION_TIMEOUT: No se pudo conectar con smtp.hostinger.com:465',
    };
  }

  const { subject, html } = renderEmailTemplate(params.templateId, params.payload);
  const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER || 'team@natyentrenadora.com';
  const pass = process.env.SMTP_PASS;

  // Si no hay credenciales configuradas (modo local/test), simular despacho exitoso
  if (!pass) {
    return {
      success: true,
      messageId: `mock-msg-${Date.now()}`,
    };
  }

  return new Promise((resolve) => {
    try {
      const socket = tls.connect(
        {
          host,
          port,
          rejectUnauthorized: false,
        },
        () => {
          let step = 0;
          let buffer = '';

          const send = (cmd: string) => {
            socket.write(cmd + '\r\n');
          };

          socket.on('data', (data) => {
            buffer += data.toString();
            const lastLine = buffer.trim().split('\n').pop() || '';

            if (step === 0 && lastLine.startsWith('220')) {
              step++;
              send(`EHLO natyentrenadora.com`);
            } else if (step === 1 && lastLine.startsWith('250')) {
              step++;
              send('AUTH LOGIN');
            } else if (step === 2 && lastLine.startsWith('334')) {
              step++;
              send(Buffer.from(user).toString('base64'));
            } else if (step === 3 && lastLine.startsWith('334')) {
              step++;
              send(Buffer.from(pass).toString('base64'));
            } else if (step === 4 && lastLine.startsWith('235')) {
              step++;
              send(`MAIL FROM:<${user}>`);
            } else if (step === 5 && lastLine.startsWith('250')) {
              step++;
              send(`RCPT TO:<${params.to}>`);
            } else if (step === 6 && lastLine.startsWith('250')) {
              step++;
              send('DATA');
            } else if (step === 7 && lastLine.startsWith('354')) {
              step++;
              const emailData = [
                `From: "Team Naty Entrenadora" <${user}>`,
                `To: <${params.to}>`,
                `Subject: ${subject}`,
                'MIME-Version: 1.0',
                'Content-Type: text/html; charset=UTF-8',
                '',
                html,
                '.',
              ].join('\r\n');
              send(emailData);
            } else if (step === 8 && lastLine.startsWith('250')) {
              step++;
              send('QUIT');
              socket.end();
              resolve({
                success: true,
                messageId: `hostinger-${Date.now()}`,
              });
            } else if (lastLine.startsWith('4') || lastLine.startsWith('5')) {
              socket.destroy();
              resolve({
                success: false,
                error: `Error SMTP (${lastLine.slice(0, 3)}): ${lastLine}`,
              });
            }
          });

          socket.on('error', (err) => {
            resolve({
              success: false,
              error: `Error de socket SMTP: ${err.message}`,
            });
          });

          socket.setTimeout(10000, () => {
            socket.destroy();
            resolve({
              success: false,
              error: 'Timeout de conexión con servidor Hostinger SMTP',
            });
          });
        }
      );

      socket.on('error', (err) => {
        resolve({
          success: false,
          error: `Error de conexión TLS: ${err.message}`,
        });
      });
    } catch (err: any) {
      resolve({
        success: false,
        error: `Excepción en mailer: ${err?.message || String(err)}`,
      });
    }
  });
}
