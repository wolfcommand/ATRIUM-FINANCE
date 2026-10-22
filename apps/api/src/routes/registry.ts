/**
 * Wolf API route → permission registry (architecture §12).
 * `public` = intentionally unauthenticated. Every other entry must be a real permission key
 * enforced via authorize() (or equivalent middleware that calls it).
 */

export type ApiRouteEntry = {
  method: string;
  path: string;
  /** Permission key, or the sentinel `public`. */
  permission: string;
  notes?: string;
};

export const API_ROUTE_REGISTRY: ApiRouteEntry[] = [
  { method: "GET", path: "/health", permission: "public", notes: "liveness" },
  { method: "GET", path: "/.well-known/jwks.json", permission: "public" },

  { method: "POST", path: "/v1/auth/login", permission: "public" },
  { method: "POST", path: "/v1/auth/logout", permission: "public", notes: "clears cookie; optional session" },
  { method: "POST", path: "/v1/auth/sessions/:id/revoke", permission: "identity.session.revoke" },
  { method: "GET", path: "/v1/me", permission: "identity.me.read" },
  { method: "GET", path: "/v1/auth/me", permission: "identity.me.read" },

  { method: "POST", path: "/v1/handoff/token", permission: "identity.handoff.create" },
  {
    method: "GET",
    path: "/v1/sessions/:id/active",
    permission: "public",
    notes: "opaque session-id capability check for Finance/HR; caller must know the id",
  },

  { method: "GET", path: "/v1/access/grants", permission: "identity.me.read" },
  { method: "GET", path: "/v1/access/grants-for-user/:userId", permission: "identity.me.read" },
  { method: "POST", path: "/v1/access/authorize", permission: "identity.me.read" },

  { method: "POST", path: "/v1/events/inject", permission: "integration.events.inject" },
  { method: "POST", path: "/v1/events/relay", permission: "integration.events.relay" },
  { method: "GET", path: "/v1/events/dead-letters", permission: "integration.events.read" },
  { method: "GET", path: "/v1/finance/employee-refs", permission: "finance.employee_ref.read" },

  { method: "GET", path: "/v1/admin/users", permission: "portal.admin" },
  { method: "GET", path: "/v1/admin/memberships", permission: "portal.admin" },
  { method: "POST", path: "/v1/admin/memberships", permission: "portal.admin" },
  { method: "GET", path: "/v1/admin/grants", permission: "portal.admin" },
  { method: "POST", path: "/v1/admin/grants", permission: "portal.admin" },
  { method: "GET", path: "/v1/admin/access-requests", permission: "portal.admin" },
  { method: "POST", path: "/v1/admin/access-requests", permission: "portal.admin" },
  { method: "POST", path: "/v1/admin/access-requests/:id/decide", permission: "portal.admin" },
  { method: "POST", path: "/v1/admin/employees/import/preview", permission: "portal.admin" },
  { method: "POST", path: "/v1/admin/employees/import", permission: "portal.admin" },
  { method: "GET", path: "/v1/admin/audit", permission: "portal.admin" },
  { method: "GET", path: "/v1/admin/mail/outbox", permission: "portal.admin" },

  { method: "GET", path: "/v1/hr/health", permission: "hr.session.read" },
  { method: "GET", path: "/v1/hr/meta", permission: "hr.session.read" },
  { method: "GET", path: "/v1/hr/employees", permission: "hr.employee.read" },
  { method: "POST", path: "/v1/hr/employees", permission: "hr.employee.write" },
  { method: "POST", path: "/v1/hr/employees/import/preview", permission: "hr.employee.import" },
  { method: "POST", path: "/v1/hr/employees/import/commit", permission: "hr.employee.import" },
  { method: "GET", path: "/v1/hr/employees/:employmentId", permission: "hr.employee.read" },
  { method: "PATCH", path: "/v1/hr/employees/:employmentId", permission: "hr.employee.write" },
  {
    method: "POST",
    path: "/v1/hr/employees/:employmentId/offboard",
    permission: "hr.employee.offboard",
  },
  { method: "GET", path: "/v1/hr/leave/types", permission: "hr.leave.read" },
  { method: "POST", path: "/v1/hr/leave/types", permission: "hr.leave.admin" },
  { method: "GET", path: "/v1/hr/leave/balances/:employmentId", permission: "hr.leave.read" },
  { method: "GET", path: "/v1/hr/leave/requests", permission: "hr.leave.read" },
  { method: "POST", path: "/v1/hr/leave/requests", permission: "hr.leave.request" },
  { method: "POST", path: "/v1/hr/leave/requests/:id/decide", permission: "hr.leave.approve" },
  { method: "GET", path: "/v1/hr/payroll/policy", permission: "hr.payroll.read" },
  { method: "PUT", path: "/v1/hr/payroll/policy", permission: "hr.payroll.admin" },
  { method: "GET", path: "/v1/hr/payroll/periods", permission: "hr.payroll.read" },
  { method: "POST", path: "/v1/hr/payroll/periods", permission: "hr.payroll.write" },
  { method: "GET", path: "/v1/hr/payroll/periods/:id", permission: "hr.payroll.read" },
  { method: "POST", path: "/v1/hr/payroll/periods/:id/calculate", permission: "hr.payroll.calculate" },
  { method: "POST", path: "/v1/hr/payroll/periods/:id/transition", permission: "hr.payroll.approve" },
  { method: "GET", path: "/v1/hr/payroll/payslips", permission: "hr.payroll.read" },
  { method: "POST", path: "/v1/hr/payroll/payslips/:id/email", permission: "hr.payroll.write" },
];

/** Tables with company_id that must have RLS enabled in Postgres migrations. */
export const COMPANY_SCOPED_TABLES = [
  "employments",
  "app_entitlements",
  "finance_employee_ref",
  "employee_profiles",
  "hr_departments",
  "hr_positions",
  "leave_types",
  "leave_balances",
  "leave_requests",
  "payroll_policy_config",
  "payroll_periods",
  "payroll_records",
  "payroll_items",
  "payslips",
  "access_requests",
] as const;

export function listApiRoutesForGuardCheck(): Array<{
  method: string;
  path: string;
  permission: string | null;
}> {
  return API_ROUTE_REGISTRY.map((r) => ({
    method: r.method,
    path: r.path,
    // `public` counts as declared; assertRoutesGuarded only rejects null/empty
    permission: r.permission === "public" ? "public" : r.permission,
  }));
}
