import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { requireAdminSession } from "../modules/admin/session.js";
import { writeAdminAudit, listAdminAudit } from "../modules/admin/audit.js";
import { bumpGrantsVersion } from "../modules/access/grantsVersion.js";
import {
  previewEmployeeImport,
  commitEmployeeImport,
} from "../modules/admin/employeeImport.js";
import { listSentMail } from "../modules/admin/mailer.js";

export function adminRouter() {
  const r = Router();

  r.get("/v1/admin/users", (req, res) => {
    const admin = requireAdminSession(req, res);
    if (!admin) return;
    const users = getDb()
      .prepare(
        `SELECT id, email, display_name, status, created_at FROM users ORDER BY email`,
      )
      .all();
    res.json({ items: users });
  });

  r.get("/v1/admin/memberships", (req, res) => {
    const admin = requireAdminSession(req, res);
    if (!admin) return;
    const items = getDb()
      .prepare(
        `SELECT e.id, e.user_id, u.email, u.display_name, e.company_id, c.code AS company_code,
                e.status, e.valid_from, e.valid_to
         FROM employments e
         JOIN users u ON u.id = e.user_id
         JOIN companies c ON c.id = e.company_id
         ORDER BY c.code, u.email`,
      )
      .all();
    res.json({ items });
  });

  r.post("/v1/admin/memberships", (req, res) => {
    const admin = requireAdminSession(req, res);
    if (!admin) return;
    const schema = z.object({
      userId: z.string().min(1),
      companyId: z.string().min(1),
      validFrom: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const id = newId();
    getDb()
      .prepare(
        `INSERT INTO employments (id, user_id, company_id, employee_no, status, valid_from, valid_to)
         VALUES (?, ?, ?, NULL, 'active', ?, NULL)`,
      )
      .run(id, parsed.data.userId, parsed.data.companyId, parsed.data.validFrom);
    bumpGrantsVersion(parsed.data.userId);
    writeAdminAudit({
      actorUserId: admin.user_id,
      action: "admin.membership.create",
      resourceType: "employment",
      resourceId: id,
      companyId: parsed.data.companyId,
      changes: parsed.data,
    });
    res.status(201).json({ id });
  });

  r.get("/v1/admin/grants", (req, res) => {
    const admin = requireAdminSession(req, res);
    if (!admin) return;
    const userId = req.query.user_id ? String(req.query.user_id) : null;
    const db = getDb();
    const items = userId
      ? db
          .prepare(
            `SELECT id, user_id, permission_key, scope_type, scope_id, valid_from, valid_to, reason, granted_by
             FROM grants WHERE user_id = ? ORDER BY permission_key`,
          )
          .all(userId)
      : db
          .prepare(
            `SELECT id, user_id, permission_key, scope_type, scope_id, valid_from, valid_to, reason, granted_by
             FROM grants ORDER BY user_id, permission_key LIMIT 500`,
          )
          .all();
    res.json({ items });
  });

  r.post("/v1/admin/grants", (req, res) => {
    const admin = requireAdminSession(req, res);
    if (!admin) return;
    const schema = z.object({
      userId: z.string().min(1),
      permissionKey: z.string().min(1),
      scopeType: z.enum(["group", "company", "department", "self"]),
      scopeId: z.string().nullable(),
      validFrom: z.string().min(1),
      validTo: z.string().nullable().optional(),
      reason: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const db = getDb();
    db.prepare(
      `INSERT OR IGNORE INTO permissions (key, description, default_classification) VALUES (?, ?, 2)`,
    ).run(parsed.data.permissionKey, parsed.data.permissionKey);
    const id = newId();
    db.prepare(
      `INSERT INTO grants (id, user_id, role_id, permission_key, scope_type, scope_id, valid_from, valid_to, granted_by, reason, ticket_ref)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    ).run(
      id,
      parsed.data.userId,
      parsed.data.permissionKey,
      parsed.data.scopeType,
      parsed.data.scopeId,
      parsed.data.validFrom,
      parsed.data.validTo ?? null,
      admin.user_id,
      parsed.data.reason,
    );
    const grantsVersion = bumpGrantsVersion(parsed.data.userId);
    writeAdminAudit({
      actorUserId: admin.user_id,
      action: "admin.grant.create",
      resourceType: "grant",
      resourceId: id,
      companyId: parsed.data.scopeId,
      changes: { ...parsed.data, grants_version: grantsVersion },
    });
    res.status(201).json({ id });
  });

  r.get("/v1/admin/access-requests", (req, res) => {
    const admin = requireAdminSession(req, res);
    if (!admin) return;
    const items = getDb()
      .prepare(
        `SELECT ar.*, u.email AS requester_email, c.code AS company_code
         FROM access_requests ar
         JOIN users u ON u.id = ar.requester_user_id
         JOIN companies c ON c.id = ar.company_id
         ORDER BY ar.created_at DESC`,
      )
      .all();
    res.json({ items });
  });

  r.post("/v1/admin/access-requests", (req, res) => {
    const admin = requireAdminSession(req, res);
    if (!admin) return;
    const schema = z.object({
      requesterUserId: z.string().min(1),
      companyId: z.string().min(1),
      permissionKey: z.string().min(1),
      reason: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const id = newId();
    getDb()
      .prepare(
        `INSERT INTO access_requests (id, requester_user_id, company_id, permission_key, reason, status, created_at, decided_at, decided_by)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL, NULL)`,
      )
      .run(
        id,
        parsed.data.requesterUserId,
        parsed.data.companyId,
        parsed.data.permissionKey,
        parsed.data.reason,
        new Date().toISOString(),
      );
    writeAdminAudit({
      actorUserId: admin.user_id,
      action: "admin.access_request.create",
      resourceType: "access_request",
      resourceId: id,
      companyId: parsed.data.companyId,
      changes: parsed.data,
    });
    res.status(201).json({ id });
  });

  r.post("/v1/admin/access-requests/:id/decide", (req, res) => {
    const admin = requireAdminSession(req, res);
    if (!admin) return;
    const decision = String(req.body?.decision ?? "");
    if (decision !== "approved" && decision !== "denied") {
      res.status(400).json({ error: "decision_must_be_approved_or_denied" });
      return;
    }
    const db = getDb();
    const row = db
      .prepare(`SELECT * FROM access_requests WHERE id = ?`)
      .get(req.params.id) as
      | {
          id: string;
          requester_user_id: string;
          company_id: string;
          permission_key: string;
          status: string;
        }
      | undefined;
    if (!row || row.status !== "pending") {
      res.status(404).json({ error: "not_found_or_not_pending" });
      return;
    }
    db.prepare(
      `UPDATE access_requests SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?`,
    ).run(decision, new Date().toISOString(), admin.user_id, row.id);
    if (decision === "approved") {
      db.prepare(
        `INSERT OR IGNORE INTO permissions (key, description, default_classification) VALUES (?, ?, 2)`,
      ).run(row.permission_key, row.permission_key);
      db.prepare(
        `INSERT INTO grants (id, user_id, role_id, permission_key, scope_type, scope_id, valid_from, valid_to, granted_by, reason, ticket_ref)
         VALUES (?, ?, NULL, ?, 'company', ?, date('now'), NULL, ?, 'access request approved', NULL)`,
      ).run(newId(), row.requester_user_id, row.permission_key, row.company_id, admin.user_id);
      bumpGrantsVersion(row.requester_user_id);
    }
    writeAdminAudit({
      actorUserId: admin.user_id,
      action: "admin.access_request.decide",
      resourceType: "access_request",
      resourceId: row.id,
      companyId: row.company_id,
      changes: { decision },
    });
    res.json({ ok: true, status: decision });
  });

  r.post("/v1/admin/employees/import/preview", (req, res) => {
    const admin = requireAdminSession(req, res);
    if (!admin) return;
    const csv = String(req.body?.csv ?? "");
    if (!csv.trim()) {
      res.status(400).json({ error: "csv_required" });
      return;
    }
    res.json(previewEmployeeImport(csv));
  });

  r.post("/v1/admin/employees/import", (req, res) => {
    const admin = requireAdminSession(req, res);
    if (!admin) return;
    const csv = String(req.body?.csv ?? "");
    try {
      const result = commitEmployeeImport(csv, admin.user_id);
      res.status(201).json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: msg });
    }
  });

  r.get("/v1/admin/audit", (req, res) => {
    const admin = requireAdminSession(req, res);
    if (!admin) return;
    res.json({ items: listAdminAudit() });
  });

  r.get("/v1/admin/mail/outbox", (req, res) => {
    const admin = requireAdminSession(req, res);
    if (!admin) return;
    res.json({ items: listSentMail() });
  });

  return r;
}
