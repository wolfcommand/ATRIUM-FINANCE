import type { AuthContext, Decision, Grant, PermissionKey, ResourceRef } from "./types.js";

function grantActive(g: Grant, now: Date): boolean {
  const from = new Date(g.validFrom);
  if (from > now) return false;
  if (g.validTo && new Date(g.validTo) <= now) return false;
  return true;
}

function scopeMatches(g: Grant, ctx: AuthContext, resource?: ResourceRef): boolean {
  if (g.scopeType === "group") return true;
  if (g.scopeType === "company") {
    const companyId = resource?.companyId ?? ctx.companyId;
    return Boolean(companyId && g.scopeId === companyId);
  }
  if (g.scopeType === "self") {
    return Boolean(resource?.ownerUserId && resource.ownerUserId === ctx.userId);
  }
  if (g.scopeType === "department") {
    const dept = resource?.attrs?.departmentId;
    return Boolean(dept && g.scopeId === dept);
  }
  return false;
}

/**
 * Single authorization decision function (architecture §5.2).
 * Deny by default.
 */
export function authorize(
  ctx: AuthContext,
  action: PermissionKey,
  resource: ResourceRef | undefined,
  grants: Grant[],
  now: Date = new Date(),
): Decision {
  const obligations: Decision["obligations"] = [];
  if (!ctx.userId || !ctx.sessionId) {
    return { allow: false, reason: "missing_identity", obligations };
  }

  const matching = grants.filter(
    (g) => g.permissionKey === action && grantActive(g, now) && scopeMatches(g, ctx, resource),
  );

  if (matching.length === 0) {
    return { allow: false, reason: `deny:${action}`, obligations };
  }

  const classification = resource?.classification ?? 0;
  if (classification >= 2) obligations.push("log_read");
  if (classification >= 3 || action.includes(".export") || action.includes(".approve")) {
    const authAgeMs = now.getTime() - ctx.authTime.getTime();
    if (authAgeMs > 15 * 60 * 1000 && ctx.authLevel < 2) {
      obligations.push("require_step_up");
    }
  }

  return { allow: true, reason: `allow:${action}`, obligations };
}

/** Test helper: fails if a route registry entry has no permission key. */
export function assertRoutesGuarded(
  routes: Array<{ method: string; path: string; permission: string | null }>,
): void {
  const unguarded = routes.filter((r) => !r.permission);
  if (unguarded.length > 0) {
    throw new Error(
      `unguarded_routes:${unguarded.map((r) => `${r.method} ${r.path}`).join(",")}`,
    );
  }
}
