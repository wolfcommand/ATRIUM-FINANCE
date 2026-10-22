import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";
import { newId } from "../../lib/ids.js";
import { writeAdminAudit } from "../admin/audit.js";

export function listCampaigns(companyId: string, db: Db = getDb()) {
  return db
    .prepare(
      `SELECT id, company_id, name, status, created_by, created_at, updated_at
       FROM content_campaigns WHERE company_id = ? ORDER BY updated_at DESC`,
    )
    .all(companyId);
}

export function createCampaign(input: {
  companyId: string;
  name: string;
  actorUserId: string;
  db?: Db;
}) {
  const db = input.db ?? getDb();
  const id = newId();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO content_campaigns (id, company_id, name, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, ?, ?)`,
  ).run(id, input.companyId, input.name, input.actorUserId, now, now);
  writeAdminAudit({
    actorUserId: input.actorUserId,
    action: "content.campaign.create",
    resourceType: "content_campaign",
    resourceId: id,
    companyId: input.companyId,
    changes: { name: input.name },
  });
  return { id };
}

export function listPieces(companyId: string, campaignId: string | undefined, db: Db = getDb()) {
  if (campaignId) {
    return db
      .prepare(
        `SELECT id, company_id, campaign_id, title, channel, body_md, status, created_by, updated_at, published_at
         FROM content_pieces WHERE company_id = ? AND campaign_id = ? ORDER BY updated_at DESC`,
      )
      .all(companyId, campaignId);
  }
  return db
    .prepare(
      `SELECT id, company_id, campaign_id, title, channel, body_md, status, created_by, updated_at, published_at
       FROM content_pieces WHERE company_id = ? ORDER BY updated_at DESC`,
    )
    .all(companyId);
}

export function createPiece(input: {
  companyId: string;
  campaignId?: string | null;
  title: string;
  channel: string;
  bodyMd: string;
  actorUserId: string;
  db?: Db;
}) {
  const db = input.db ?? getDb();
  const id = newId();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO content_pieces
      (id, company_id, campaign_id, title, channel, body_md, status, created_by, updated_by, created_at, updated_at, published_at)
     VALUES (?, ?, ?, ?, ?, ?, 'idea', ?, ?, ?, ?, NULL)`,
  ).run(
    id,
    input.companyId,
    input.campaignId ?? null,
    input.title,
    input.channel,
    input.bodyMd,
    input.actorUserId,
    input.actorUserId,
    now,
    now,
  );
  writeAdminAudit({
    actorUserId: input.actorUserId,
    action: "content.piece.create",
    resourceType: "content_piece",
    resourceId: id,
    companyId: input.companyId,
    changes: { title: input.title, channel: input.channel },
  });
  return { id };
}

export function updatePieceStatus(input: {
  companyId: string;
  pieceId: string;
  status: string;
  actorUserId: string;
  db?: Db;
}) {
  const db = input.db ?? getDb();
  const row = db
    .prepare(`SELECT id, company_id FROM content_pieces WHERE id = ?`)
    .get(input.pieceId) as { id: string; company_id: string } | undefined;
  if (!row || row.company_id !== input.companyId) throw new Error("not_found");
  const now = new Date().toISOString();
  const publishedAt = input.status === "published" ? now : null;
  db.prepare(
    `UPDATE content_pieces SET status = ?, updated_by = ?, updated_at = ?,
      published_at = COALESCE(?, published_at) WHERE id = ?`,
  ).run(input.status, input.actorUserId, now, publishedAt, input.pieceId);
  writeAdminAudit({
    actorUserId: input.actorUserId,
    action: "content.piece.status",
    resourceType: "content_piece",
    resourceId: input.pieceId,
    companyId: input.companyId,
    changes: { status: input.status },
  });
  return { id: input.pieceId, status: input.status };
}
