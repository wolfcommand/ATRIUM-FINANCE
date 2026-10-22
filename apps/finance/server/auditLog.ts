/**
 * Append-only finance audit log (Prompt 5).
 * Application code may INSERT only — no update/delete API.
 */

import { randomUUID } from "node:crypto";

export type AuditOutcome = "allow" | "deny";

export type AuditEvent = {
  id: string;
  occurred_at: string;
  actor_user_id: string | null;
  session_id: string | null;
  company_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  outcome: AuditOutcome;
  request_id: string | null;
  /** Redacted change summary — never store secrets or full PII dumps */
  changes: Record<string, unknown> | null;
};

const events: AuditEvent[] = [];

export function resetAuditLogForTests(): void {
  events.length = 0;
}

export function appendAuditEvent(input: Omit<AuditEvent, "id" | "occurred_at"> & {
  id?: string;
  occurred_at?: string;
}): AuditEvent {
  const event: AuditEvent = {
    id: input.id ?? randomUUID(),
    occurred_at: input.occurred_at ?? new Date().toISOString(),
    actor_user_id: input.actor_user_id,
    session_id: input.session_id,
    company_id: input.company_id,
    action: input.action,
    resource_type: input.resource_type,
    resource_id: input.resource_id,
    outcome: input.outcome,
    request_id: input.request_id,
    changes: input.changes,
  };
  events.push(event);
  return event;
}

export function listAuditEvents(filter?: {
  company_id?: string;
  resource_type?: string;
  action?: string;
}): AuditEvent[] {
  return events.filter((e) => {
    if (filter?.company_id && e.company_id !== filter.company_id) return false;
    if (filter?.resource_type && e.resource_type !== filter.resource_type) return false;
    if (filter?.action && e.action !== filter.action) return false;
    return true;
  });
}

/** Explicitly no-op — audit is append-only. */
export function updateAuditEvent(): never {
  throw new Error("audit_append_only");
}

export function deleteAuditEvent(): never {
  throw new Error("audit_append_only");
}
