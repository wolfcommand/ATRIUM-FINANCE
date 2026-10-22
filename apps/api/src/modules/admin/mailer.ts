/** Stubbed mailer for dev/CI (Prompt 8). Never sends real email. */

export type MailMessage = {
  to: string;
  subject: string;
  body: string;
  sentAt: string;
};

const outbox: MailMessage[] = [];

export function sendMail(to: string, subject: string, body: string): MailMessage {
  const msg: MailMessage = {
    to,
    subject,
    body,
    sentAt: new Date().toISOString(),
  };
  outbox.push(msg);
  return msg;
}

export function listSentMail(): readonly MailMessage[] {
  return outbox;
}

export function clearMailForTests(): void {
  outbox.length = 0;
}
