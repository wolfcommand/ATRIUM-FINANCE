import { Router } from "express";
import { authorize, type Grant } from "@wolf/access";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { requirePermission } from "../modules/access/requirePermission.js";
import { getGrantsVersion } from "../modules/access/grantsVersion.js";

const bodySchema = z.object({
  action: z.string().min(1),
  companyId: z.string().optional(),
  resource: z
    .object({
      type: z.string(),
      id: z.string().optional(),
      companyId: z.string().optional(),
      ownerUserId: z.string().optional(),
      classification: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
    })
    .optional(),
});

function loadGrants(userId: string): Grant[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT permission_key, scope_type, scope_id, valid_from, valid_to
       FROM grants WHERE user_id = ? AND permission_key IS NOT NULL`,
    )
    .all(userId) as Array<{
    permission_key: string;
    scope_type: Grant["scopeType"];
    scope_id: string | null;
    valid_from: string;
    valid_to: string | null;
  }>;
  return rows.map((r) => ({
    permissionKey: r.permission_key,
    scopeType: r.scope_type,
    scopeId: r.scope_id,
    validFrom: r.valid_from,
    validTo: r.valid_to,
  }));
}

export function accessRouter(): Router {
  const router = Router();

  router.get(
    "/v1/access/grants",
    requirePermission("identity.me.read", { classification: 1, resourceType: "grants" }),
    (req, res) => {
      const auth = req.wolfAuth!;
      res.json({
        grants: loadGrants(auth.userId),
        grants_version: getGrantsVersion(auth.userId),
      });
    },
  );

  /** Finance service lookup: session header must match the user (authorize already ran). */
  router.get(
    "/v1/access/grants-for-user/:userId",
    requirePermission("identity.me.read", { classification: 1, resourceType: "grants" }),
    (req, res) => {
      const auth = req.wolfAuth!;
      if (auth.userId !== req.params.userId) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      res.json({
        grants: loadGrants(auth.userId),
        grants_version: getGrantsVersion(auth.userId),
      });
    },
  );

  router.post(
    "/v1/access/authorize",
    requirePermission("identity.me.read", { classification: 1, resourceType: "authorize" }),
    (req, res) => {
      const auth = req.wolfAuth!;
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_body" });
        return;
      }
      const grants = loadGrants(auth.userId);
      const decision = authorize(
        {
          userId: auth.userId,
          sessionId: auth.session.id,
          authLevel: auth.session.auth_level,
          authTime: new Date(auth.session.auth_time),
          companyId: parsed.data.companyId,
        },
        parsed.data.action,
        parsed.data.resource ??
          (parsed.data.companyId
            ? { type: "company", companyId: parsed.data.companyId }
            : undefined),
        grants,
      );
      res.json({ ...decision, grants_version: getGrantsVersion(auth.userId) });
    },
  );

  return router;
}

export { loadGrants };
