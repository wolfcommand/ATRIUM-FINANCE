import { Router } from "express";
import { SignJWT } from "jose";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { getSigningKeys } from "../lib/keys.js";
import { getActiveSession } from "../modules/identity/sessions.js";
import { requirePermission } from "../modules/access/requirePermission.js";

const handoffSchema = z.object({
  audience: z.enum(["finance", "hr"]),
  companyId: z.string().min(1),
});

export function handoffRouter(): Router {
  const router = Router();

  router.get("/.well-known/jwks.json", async (_req, res) => {
    const keys = await getSigningKeys();
    res.json({ keys: [keys.publicJwk] });
  });

  router.post(
    "/v1/handoff/token",
    requirePermission("identity.handoff.create", {
      classification: 1,
      resourceType: "handoff",
    }),
    async (req, res) => {
      const parsed = handoffSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_body" });
        return;
      }
      const db = getDb();
      const session = req.wolfAuth!.session;

      const entitled = db
        .prepare(
          `SELECT 1 AS ok FROM app_entitlements
         WHERE user_id = ? AND company_id = ? AND app_key = ?`,
        )
        .get(session.user_id, parsed.data.companyId, parsed.data.audience) as
        | { ok: number }
        | undefined;
      if (!entitled) {
        res.status(403).json({ error: "app_not_entitled" });
        return;
      }

      const keys = await getSigningKeys();
      const now = Math.floor(Date.now() / 1000);
      const token = await new SignJWT({
        user_id: session.user_id,
        session_id: session.id,
        company_id: parsed.data.companyId,
        auth_level: session.auth_level,
        auth_time: session.auth_time,
      })
        .setProtectedHeader({ alg: "EdDSA", kid: keys.kid })
        .setIssuer("wolf-api")
        .setAudience(parsed.data.audience)
        .setIssuedAt(now)
        .setExpirationTime(now + 60)
        .sign(keys.privateKey);

      res.json({
        token,
        expiresIn: 60,
        audience: parsed.data.audience,
      });
    },
  );

  router.get("/v1/sessions/:id/active", (req, res) => {
    const db = getDb();
    const session = getActiveSession(db, req.params.id);
    res.json({ active: Boolean(session) });
  });

  return router;
}
