import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type AuditEvent = {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  sessionId: string | null;
  companyId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: "allow" | "deny";
  requestId: string | null;
  changes: Record<string, unknown> | null;
};

const events: AuditEvent[] = [];
const FILE = path.join(process.cwd(), "data", "audit_events.jsonl");

export function writeAudit(event: Omit<AuditEvent, "id" | "occurredAt">): AuditEvent {
  const row: AuditEvent = {
    id: randomUUID(),
    occurredAt: new Date().toISOString(),
    ...event,
  };
  events.push(row);
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.appendFileSync(FILE, JSON.stringify(row) + "\n");
  } catch {
    /* disk optional in tests */
  }
  return row;
}

export function listAudit(): readonly AuditEvent[] {
  return events;
}

export function clearAuditForTests(): void {
  events.length = 0;
}
