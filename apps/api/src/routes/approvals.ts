import { Router } from "express";
import { z } from "zod";
import { requirePermission } from "../modules/access/requirePermission.js";
import {
  decideApprovalStep,
  ensureDefaultExpensePolicies,
  getApprovalRequest,
  listInbox,
  publishNewPolicyVersion,
  resolvePolicy,
} from "../modules/approvals/engine.js";
import { createAndSubmitExpense, listExpenses } from "../modules/approvals/expenses.js";

export function approvalsRouter(): Router {
  const router = Router();

  router.get(
    "/v1/approvals/inbox",
    requirePermission("finance.expense.approve", {
      classification: 2,
      resourceType: "approval",
      requireCompany: true,
    }),
    (req, res) => {
      const companyId = req.wolfAuth!.companyId!;
      ensureDefaultExpensePolicies();
      res.json({ items: listInbox(companyId) });
    },
  );

  router.get(
    "/v1/approvals/policies",
    requirePermission("finance.expense.approve", {
      classification: 1,
      resourceType: "approval_policy",
      requireCompany: true,
    }),
    (req, res) => {
      const companyId = req.wolfAuth!.companyId!;
      try {
        const policy = resolvePolicy(companyId, "finance.expense");
        res.json({ policy });
      } catch (err) {
        res.status(404).json({ error: err instanceof Error ? err.message : "not_found" });
      }
    },
  );

  router.post(
    "/v1/approvals/policies",
    requirePermission("portal.admin", {
      classification: 2,
      resourceType: "approval_policy",
      requireCompany: true,
    }),
    (req, res) => {
      const schema = z.object({
        requestType: z.literal("finance.expense"),
        steps: z
          .array(
            z.object({
              step_no: z.number().int().positive(),
              approver_rule: z.string().min(1),
              amount_threshold_minor: z.number().int().nullable().optional(),
            }),
          )
          .min(1),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_body" });
        return;
      }
      const result = publishNewPolicyVersion({
        companyId: req.wolfAuth!.companyId!,
        requestType: parsed.data.requestType,
        steps: parsed.data.steps,
        actorUserId: req.wolfAuth!.userId,
      });
      res.status(201).json(result);
    },
  );

  router.get(
    "/v1/approvals/requests/:id",
    requirePermission("finance.expense.approve", {
      classification: 2,
      resourceType: "approval",
      requireCompany: true,
    }),
    (req, res) => {
      const row = getApprovalRequest(req.params.id);
      if (!row || row.company_id !== req.wolfAuth!.companyId) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json({
        request: {
          ...row,
          chain_snapshot: JSON.parse(String(row.chain_snapshot)),
        },
      });
    },
  );

  router.post(
    "/v1/approvals/requests/:id/decide",
    requirePermission("finance.expense.approve", {
      classification: 2,
      resourceType: "approval",
      requireCompany: true,
    }),
    (req, res) => {
      const schema = z.object({
        decision: z.enum(["approved", "denied"]),
        comment: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_body" });
        return;
      }
      try {
        const result = decideApprovalStep({
          requestId: req.params.id,
          actorUserId: req.wolfAuth!.userId,
          decision: parsed.data.decision,
          comment: parsed.data.comment,
        });
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "decide_failed" });
      }
    },
  );

  router.get(
    "/v1/expenses",
    requirePermission("finance.expense.read", {
      classification: 2,
      resourceType: "expense",
      requireCompany: true,
    }),
    (req, res) => {
      res.json({ expenses: listExpenses(req.wolfAuth!.companyId!) });
    },
  );

  router.post(
    "/v1/expenses",
    requirePermission("finance.expense.write", {
      classification: 2,
      resourceType: "expense",
      requireCompany: true,
    }),
    (req, res) => {
      const schema = z.object({
        amountMinor: z.number().int().positive(),
        currency: z.string().length(3).default("IDR"),
        description: z.string().min(1).max(500),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
        return;
      }
      const result = createAndSubmitExpense({
        companyId: req.wolfAuth!.companyId!,
        requesterUserId: req.wolfAuth!.userId,
        amountMinor: parsed.data.amountMinor,
        currency: parsed.data.currency,
        description: parsed.data.description,
      });
      res.status(201).json(result);
    },
  );

  return router;
}
