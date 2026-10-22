/**
 * HRIS API — /v1/hr/* (Prompt 6/7 greenfield).
 */
import { Router } from "express";
import { z } from "zod";
import { authorize } from "@wolf/access";
import {
  getHrAuth,
  requireHrPermission,
  requireHrSession,
} from "../modules/hr/sessionAuth.js";
import {
  createEmployee,
  getEmployee,
  importEmployeesCommit,
  importEmployeesPreview,
  listEmployees,
  updateEmployee,
} from "../modules/hr/employees.js";
import { offboardEmployment } from "../modules/hr/offboarding.js";
import {
  decideLeaveRequest,
  listBalances,
  listLeaveRequests,
  listLeaveTypes,
  seedLeaveTypesForCompany,
  submitLeaveRequest,
  upsertLeaveType,
} from "../modules/hr/leave.js";
import {
  calculatePayrollPeriod,
  createPayrollPeriod,
  emailPayslip,
  getPayrollPolicy,
  getPeriodDetail,
  listPayrollPeriods,
  listPayslips,
  setPayrollPolicy,
  transitionPayrollPeriod,
} from "../modules/hr/payroll.js";
import { ensureDemoOrg, listDepartments, listPositions } from "../modules/hr/org.js";

const createEmpSchema = z.object({
  fullName: z.string().min(1),
  preferredName: z.string().optional(),
  workEmail: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  nik: z.string().optional(),
  npwp: z.string().optional(),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  employmentType: z.string().optional(),
  jobTitle: z.string().optional(),
  jobLevel: z.string().optional(),
  serviceChargeEligible: z.boolean().optional(),
  costCentre: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountName: z.string().optional(),
  baseSalaryMinor: z.number().int().nonnegative().optional(),
  currency: z.string().optional(),
  joinDate: z.string().min(1),
});

export function hrRouter(): Router {
  const router = Router();
  router.use("/v1/hr", requireHrSession);

  router.get("/v1/hr/health", requireHrPermission("hr.session.read"), (_req, res) => {
    res.json({ status: "ok", service: "wolf-hr" });
  });

  router.get("/v1/hr/meta", requireHrPermission("hr.session.read"), (req, res) => {
    const auth = getHrAuth(req);
    ensureDemoOrg(auth.companyId);
    seedLeaveTypesForCompany(auth.companyId);
    res.json({
      companyId: auth.companyId,
      userId: auth.userId,
      departments: listDepartments(auth.companyId),
      positions: listPositions(auth.companyId),
      leaveTypes: listLeaveTypes(auth.companyId),
      payrollPolicy: getPayrollPolicy(auth.companyId),
    });
  });

  // --- Employees ---
  router.get(
    "/v1/hr/employees",
    requireHrPermission("hr.employee.read"),
    (req, res) => {
      const auth = getHrAuth(req);
      res.json({ employees: listEmployees(auth.companyId) });
    },
  );

  router.post(
    "/v1/hr/employees",
    requireHrPermission("hr.employee.write"),
    (req, res) => {
      const auth = getHrAuth(req);
      const parsed = createEmpSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
        return;
      }
      try {
        const employee = createEmployee({
          ...parsed.data,
          workEmail: parsed.data.workEmail || undefined,
          companyId: auth.companyId,
          actorUserId: auth.userId,
        });
        res.status(201).json({ employee });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "create_failed" });
      }
    },
  );

  router.post(
    "/v1/hr/employees/import/preview",
    requireHrPermission("hr.employee.import"),
    (req, res) => {
      const auth = getHrAuth(req);
      const rows = z
        .array(
          z.object({
            fullName: z.string(),
            workEmail: z.string().optional(),
            departmentCode: z.string().optional(),
            jobTitle: z.string().optional(),
            joinDate: z.string(),
            employmentType: z.string().optional(),
            costCentre: z.string().optional(),
            baseSalaryMinor: z.number().int().optional(),
          }),
        )
        .safeParse(req.body?.rows);
      if (!rows.success) {
        res.status(400).json({ error: "invalid_body" });
        return;
      }
      res.json(importEmployeesPreview(auth.companyId, rows.data));
    },
  );

  router.post(
    "/v1/hr/employees/import/commit",
    requireHrPermission("hr.employee.import"),
    (req, res) => {
      const auth = getHrAuth(req);
      const rows = z.array(z.any()).safeParse(req.body?.rows);
      if (!rows.success) {
        res.status(400).json({ error: "invalid_body" });
        return;
      }
      try {
        const result = importEmployeesCommit(auth.companyId, rows.data, auth.userId);
        res.status(201).json(result);
      } catch (err) {
        const e = err as Error & { errors?: unknown };
        res.status(400).json({
          error: e.message,
          errors: e.errors ?? null,
        });
      }
    },
  );

  router.get(
    "/v1/hr/employees/:employmentId",
    requireHrPermission("hr.employee.read"),
    (req, res) => {
      const auth = getHrAuth(req);
      const restricted = String(req.query.restricted ?? "") === "1";
      if (restricted) {
        const decision = authorize(
          {
            userId: auth.userId,
            sessionId: auth.session.id,
            authLevel: auth.session.auth_level,
            authTime: new Date(auth.session.auth_time),
            companyId: auth.companyId,
          },
          "hr.employee.read_restricted",
          { type: "hr", companyId: auth.companyId, classification: 3 },
          auth.grants,
        );
        if (!decision.allow) {
          res.status(403).json({
            error: "forbidden",
            reason: decision.reason,
            permission: "hr.employee.read_restricted",
          });
          return;
        }
      }
      const emp = getEmployee(auth.companyId, req.params.employmentId, {
        includeRestricted: restricted,
        actorUserId: auth.userId,
      });
      if (!emp) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json({ employee: emp });
    },
  );

  router.patch(
    "/v1/hr/employees/:employmentId",
    requireHrPermission("hr.employee.write"),
    (req, res) => {
      const auth = getHrAuth(req);
      const parsed = createEmpSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_body" });
        return;
      }
      try {
        const employee = updateEmployee(
          auth.companyId,
          req.params.employmentId,
          { ...parsed.data, workEmail: parsed.data.workEmail || undefined },
          auth.userId,
        );
        res.json({ employee });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "update_failed" });
      }
    },
  );

  router.post(
    "/v1/hr/employees/:employmentId/offboard",
    requireHrPermission("hr.employee.offboard"),
    (req, res) => {
      const auth = getHrAuth(req);
      try {
        const result = offboardEmployment(
          auth.companyId,
          req.params.employmentId,
          auth.userId,
          String(req.body?.endDate ?? new Date().toISOString().slice(0, 10)),
        );
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "offboard_failed" });
      }
    },
  );

  // --- Leave ---
  router.get("/v1/hr/leave/types", requireHrPermission("hr.leave.read"), (req, res) => {
    const auth = getHrAuth(req);
    seedLeaveTypesForCompany(auth.companyId);
    res.json({ leaveTypes: listLeaveTypes(auth.companyId) });
  });

  router.post("/v1/hr/leave/types", requireHrPermission("hr.leave.admin"), (req, res) => {
    const auth = getHrAuth(req);
    const body = z
      .object({
        code: z.string(),
        name: z.string(),
        category: z.string(),
        defaultEntitlement: z.number(),
        requiresAttachment: z.boolean().optional(),
        requiresApproval: z.boolean().optional(),
        isPaid: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const id = upsertLeaveType(auth.companyId, body.data, auth.userId);
    res.status(201).json({ id });
  });

  router.get("/v1/hr/leave/balances/:employmentId", requireHrPermission("hr.leave.read"), (req, res) => {
    const auth = getHrAuth(req);
    const year = Number(req.query.year ?? new Date().getUTCFullYear());
    res.json({ balances: listBalances(auth.companyId, req.params.employmentId, year) });
  });

  router.get("/v1/hr/leave/requests", requireHrPermission("hr.leave.read"), (req, res) => {
    const auth = getHrAuth(req);
    res.json({
      requests: listLeaveRequests(auth.companyId, req.query.status ? String(req.query.status) : undefined),
    });
  });

  router.post("/v1/hr/leave/requests", requireHrPermission("hr.leave.request"), (req, res) => {
    const auth = getHrAuth(req);
    const body = z
      .object({
        employmentId: z.string(),
        leaveTypeId: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        reason: z.string().optional(),
      })
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    try {
      const request = submitLeaveRequest({
        companyId: auth.companyId,
        actorUserId: auth.userId,
        ...body.data,
      });
      res.status(201).json({ request });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "leave_failed" });
    }
  });

  router.post(
    "/v1/hr/leave/requests/:id/decide",
    requireHrPermission("hr.leave.approve"),
    (req, res) => {
      const auth = getHrAuth(req);
      const decision = String(req.body?.decision ?? "");
      if (decision !== "approved" && decision !== "rejected") {
        res.status(400).json({ error: "invalid_decision" });
        return;
      }
      try {
        const request = decideLeaveRequest(
          auth.companyId,
          req.params.id,
          decision,
          auth.userId,
          req.body?.rejectionReason,
        );
        res.json({ request });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "decide_failed" });
      }
    },
  );

  // --- Payroll ---
  router.get("/v1/hr/payroll/policy", requireHrPermission("hr.payroll.read"), (req, res) => {
    res.json({ policy: getPayrollPolicy(getHrAuth(req).companyId) });
  });

  router.put("/v1/hr/payroll/policy", requireHrPermission("hr.payroll.admin"), (req, res) => {
    const auth = getHrAuth(req);
    const policy = setPayrollPolicy(auth.companyId, req.body ?? {}, auth.userId);
    res.json({ policy });
  });

  router.get("/v1/hr/payroll/periods", requireHrPermission("hr.payroll.read"), (req, res) => {
    res.json({ periods: listPayrollPeriods(getHrAuth(req).companyId) });
  });

  router.post("/v1/hr/payroll/periods", requireHrPermission("hr.payroll.write"), (req, res) => {
    const auth = getHrAuth(req);
    const body = z
      .object({
        periodCode: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        payDate: z.string(),
        serviceChargePoolMinor: z.number().int().nonnegative().optional(),
      })
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    try {
      const period = createPayrollPeriod({
        companyId: auth.companyId,
        actorUserId: auth.userId,
        ...body.data,
      });
      res.status(201).json({ period });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "period_failed" });
    }
  });

  router.get("/v1/hr/payroll/periods/:id", requireHrPermission("hr.payroll.read"), (req, res) => {
    const detail = getPeriodDetail(getHrAuth(req).companyId, req.params.id);
    if (!detail) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(detail);
  });

  router.post(
    "/v1/hr/payroll/periods/:id/calculate",
    requireHrPermission("hr.payroll.calculate"),
    (req, res) => {
      const auth = getHrAuth(req);
      try {
        const pool =
          typeof req.body?.serviceChargePoolMinor === "number"
            ? req.body.serviceChargePoolMinor
            : undefined;
        res.json(
          calculatePayrollPeriod(auth.companyId, req.params.id, auth.userId, undefined, {
            serviceChargePoolMinor: pool,
          }),
        );
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "calc_failed" });
      }
    },
  );

  router.post(
    "/v1/hr/payroll/periods/:id/transition",
    requireHrPermission("hr.payroll.approve"),
    (req, res) => {
      const auth = getHrAuth(req);
      const toStatus = String(req.body?.status ?? "") as
        | "UNDER_REVIEW"
        | "APPROVED"
        | "FINALIZED"
        | "LOCKED";
      try {
        res.json(transitionPayrollPeriod(auth.companyId, req.params.id, toStatus, auth.userId));
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "transition_failed" });
      }
    },
  );

  router.get("/v1/hr/payroll/payslips", requireHrPermission("hr.payroll.read"), (req, res) => {
    const auth = getHrAuth(req);
    res.json({
      payslips: listPayslips(
        auth.companyId,
        req.query.periodId ? String(req.query.periodId) : undefined,
      ),
    });
  });

  router.post(
    "/v1/hr/payroll/payslips/:id/email",
    requireHrPermission("hr.payroll.write"),
    async (req, res) => {
      const auth = getHrAuth(req);
      try {
        const result = await emailPayslip(auth.companyId, req.params.id, auth.userId);
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "email_failed" });
      }
    },
  );

  return router;
}
