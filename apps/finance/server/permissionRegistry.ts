/**
 * Maps Finance Express routes → Wolf permission keys.
 * Full inventory also documented in docs/permission-inventory.md.
 */
export type RoutePerm = {
  method: string;
  path: string;
  permission: string;
};

/** Exact paths and prefix patterns (suffix `*`). More specific patterns listed first. */
export const FINANCE_ROUTE_PERMISSIONS: RoutePerm[] = [
  { method: "GET", path: "/api/health", permission: "finance.health.read" },
  { method: "GET", path: "/api/wolf/session", permission: "finance.session.read" },
  { method: "POST", path: "/api/wolf/handoff", permission: "finance.session.read" },
  { method: "POST", path: "/api/wolf/logout", permission: "finance.session.read" },
  { method: "POST", path: "/api/journals/*/approve", permission: "finance.journal.approve" },
  { method: "POST", path: "/api/journals/*/post", permission: "finance.journal.approve" },
  { method: "GET", path: "/api/status", permission: "finance.admin.read" },
  { method: "GET", path: "/api/sheets/*", permission: "finance.admin.read" },
  { method: "POST", path: "/api/sheets/*", permission: "finance.admin.write" },
  { method: "GET", path: "/api/admin/settings", permission: "finance.admin.read" },
  { method: "POST", path: "/api/admin/settings", permission: "finance.admin.write" },
  { method: "GET", path: "/api/admin/access-control*", permission: "finance.admin.access" },
  { method: "POST", path: "/api/admin/access-control*", permission: "finance.admin.access" },
  { method: "DELETE", path: "/api/admin/access-control*", permission: "finance.admin.access" },
  { method: "GET", path: "/api/admin/mock-data*", permission: "finance.admin.mock" },
  { method: "POST", path: "/api/admin/mock-data*", permission: "finance.admin.mock" },
  { method: "GET", path: "/api/accounts*", permission: "finance.accounts.read" },
  { method: "POST", path: "/api/accounts*", permission: "finance.accounts.write" },
  { method: "PUT", path: "/api/accounts*", permission: "finance.accounts.write" },
  { method: "DELETE", path: "/api/accounts*", permission: "finance.accounts.write" },
  { method: "GET", path: "/api/departments*", permission: "finance.accounts.read" },
  { method: "POST", path: "/api/departments*", permission: "finance.accounts.write" },
  { method: "GET", path: "/api/journals*", permission: "finance.journal.read" },
  { method: "POST", path: "/api/journals*", permission: "finance.journal.write" },
  { method: "PUT", path: "/api/journals*", permission: "finance.journal.write" },
  { method: "DELETE", path: "/api/journals*", permission: "finance.journal.write" },
  { method: "GET", path: "/api/ledger*", permission: "finance.journal.read" },
  { method: "GET", path: "/api/trial-balance*", permission: "finance.report.read" },
  { method: "GET", path: "/api/dashboard*", permission: "finance.report.read" },
  { method: "GET", path: "/api/reports*", permission: "finance.report.read" },
  { method: "POST", path: "/api/reports*", permission: "finance.report.export" },
  { method: "GET", path: "/api/controls*", permission: "finance.controls.read" },
  { method: "GET", path: "/api/revenue*", permission: "finance.ops.read" },
  { method: "POST", path: "/api/revenue*", permission: "finance.ops.write" },
  { method: "GET", path: "/api/spending*", permission: "finance.ops.read" },
  { method: "POST", path: "/api/spending*", permission: "finance.ops.write" },
  { method: "GET", path: "/api/mapping*", permission: "finance.config.read" },
  { method: "POST", path: "/api/mapping*", permission: "finance.config.write" },
  { method: "GET", path: "/api/config*", permission: "finance.config.read" },
  { method: "POST", path: "/api/config*", permission: "finance.config.write" },
  { method: "GET", path: "/api/inventory*", permission: "finance.inventory.read" },
  { method: "POST", path: "/api/inventory*", permission: "finance.inventory.write" },
  { method: "PUT", path: "/api/inventory*", permission: "finance.inventory.write" },
  { method: "DELETE", path: "/api/inventory*", permission: "finance.inventory.write" },
  { method: "GET", path: "/api/ar*", permission: "finance.arap.read" },
  { method: "POST", path: "/api/ar*", permission: "finance.arap.write" },
  { method: "GET", path: "/api/ap*", permission: "finance.arap.read" },
  { method: "POST", path: "/api/ap*", permission: "finance.arap.write" },
  { method: "GET", path: "/api/service-charge*", permission: "finance.service_charge.read" },
  { method: "POST", path: "/api/service-charge*", permission: "finance.service_charge.write" },
  { method: "GET", path: "/api/owner-pool*", permission: "finance.owner_pool.read" },
  { method: "POST", path: "/api/owner-pool*", permission: "finance.owner_pool.write" },
  { method: "GET", path: "/api/tax*", permission: "finance.tax.read" },
  { method: "POST", path: "/api/tax*", permission: "finance.tax.write" },
  { method: "GET", path: "/api/petty-cash*", permission: "finance.petty_cash.read" },
  { method: "POST", path: "/api/petty-cash*", permission: "finance.petty_cash.write" },
  { method: "POST", path: "/api/integrations*", permission: "finance.admin.write" },
];

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export function matchPermission(method: string, path: string): string | null {
  const m = method.toUpperCase();
  const ranked = [...FINANCE_ROUTE_PERMISSIONS].sort(
    (a, b) => b.path.length - a.path.length,
  );
  for (const route of ranked) {
    if (route.method !== m) continue;
    if (patternToRegex(route.path).test(path)) return route.permission;
  }
  return null;
}

/** Every registered API surface must have a permission (guard inventory completeness). */
export function listGuardedRoutes(): Array<{
  method: string;
  path: string;
  permission: string | null;
}> {
  return FINANCE_ROUTE_PERMISSIONS.map((r) => ({
    method: r.method,
    path: r.path,
    permission: r.permission,
  }));
}
