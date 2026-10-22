import { Router } from "express";
import { z } from "zod";
import {
  getContentAuth,
  requireContentPermission,
  requireContentSession,
} from "../modules/content/sessionAuth.js";
import {
  createCampaign,
  createPiece,
  listCampaigns,
  listPieces,
  updatePieceStatus,
} from "../modules/content/campaigns.js";

export function contentRouter(): Router {
  const router = Router();
  router.use("/v1/content", requireContentSession);

  router.get(
    "/v1/content/campaigns",
    requireContentPermission("content.campaign.read"),
    (req, res) => {
      const auth = getContentAuth(req);
      res.json({ campaigns: listCampaigns(auth.companyId) });
    },
  );

  router.post(
    "/v1/content/campaigns",
    requireContentPermission("content.campaign.write"),
    (req, res) => {
      const auth = getContentAuth(req);
      const parsed = z.object({ name: z.string().min(1).max(200) }).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_body" });
        return;
      }
      res.status(201).json(
        createCampaign({
          companyId: auth.companyId,
          name: parsed.data.name,
          actorUserId: auth.userId,
        }),
      );
    },
  );

  router.get(
    "/v1/content/pieces",
    requireContentPermission("content.piece.read"),
    (req, res) => {
      const auth = getContentAuth(req);
      const campaignId = req.query.campaignId ? String(req.query.campaignId) : undefined;
      res.json({ pieces: listPieces(auth.companyId, campaignId) });
    },
  );

  router.post(
    "/v1/content/pieces",
    requireContentPermission("content.piece.write"),
    (req, res) => {
      const auth = getContentAuth(req);
      const parsed = z
        .object({
          title: z.string().min(1).max(200),
          channel: z.enum(["social", "blog", "email", "video"]),
          bodyMd: z.string().min(1),
          campaignId: z.string().optional().nullable(),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_body" });
        return;
      }
      res.status(201).json(
        createPiece({
          companyId: auth.companyId,
          campaignId: parsed.data.campaignId,
          title: parsed.data.title,
          channel: parsed.data.channel,
          bodyMd: parsed.data.bodyMd,
          actorUserId: auth.userId,
        }),
      );
    },
  );

  router.post(
    "/v1/content/pieces/:id/status",
    requireContentPermission("content.piece.write"),
    (req, res) => {
      const auth = getContentAuth(req);
      const parsed = z
        .object({
          status: z.enum(["idea", "draft", "review", "published", "archived"]),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_body" });
        return;
      }
      try {
        res.json(
          updatePieceStatus({
            companyId: auth.companyId,
            pieceId: req.params.id,
            status: parsed.data.status,
            actorUserId: auth.userId,
          }),
        );
      } catch (err) {
        res.status(404).json({ error: err instanceof Error ? err.message : "not_found" });
      }
    },
  );

  return router;
}
