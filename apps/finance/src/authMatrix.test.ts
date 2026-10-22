import assert from "node:assert/strict";
import test from "node:test";
import { assertRoutesGuarded, authorize, type Grant } from "@wolf/access";
import {
  FINANCE_ROUTE_PERMISSIONS,
  listGuardedRoutes,
  matchPermission,
} from "../server/permissionRegistry.js";

test("every registered finance route has a permission key", () => {
  assertRoutesGuarded(listGuardedRoutes());
});

test("unknown api path is unguarded (deny)", () => {
  assert.equal(matchPermission("GET", "/api/definitely-not-a-route"), null);
});

test("authorization matrix: finance controller vs staff", () => {
  const companyId = "c-amg";
  const financeGrants: Grant[] = FINANCE_ROUTE_PERMISSIONS.map((r) => ({
    permissionKey: r.permission,
    scopeType: "company",
    scopeId: companyId,
    validFrom: "2020-01-01",
    validTo: null,
  }));
  const staffGrants: Grant[] = [
    {
      permissionKey: "finance.health.read",
      scopeType: "company",
      scopeId: companyId,
      validFrom: "2020-01-01",
      validTo: null,
    },
  ];

  const ctx = {
    userId: "u-fin",
    sessionId: "s1",
    authLevel: 1,
    authTime: new Date(),
    companyId,
  };

  const journalRead = authorize(
    ctx,
    "finance.journal.read",
    { type: "journal", companyId, classification: 2 },
    financeGrants,
  );
  assert.equal(journalRead.allow, true);

  const staffJournal = authorize(
    { ...ctx, userId: "u-staff" },
    "finance.journal.read",
    { type: "journal", companyId, classification: 2 },
    staffGrants,
  );
  assert.equal(staffJournal.allow, false);

  const otherCompany = authorize(
    ctx,
    "finance.journal.read",
    { type: "journal", companyId: "c-bzg", classification: 2 },
    financeGrants,
  );
  assert.equal(otherCompany.allow, false);
});
