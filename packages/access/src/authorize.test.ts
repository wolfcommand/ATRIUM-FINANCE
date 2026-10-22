import assert from "node:assert/strict";
import test from "node:test";
import { assertRoutesGuarded, authorize } from "./authorize.js";
import type { AuthContext, Grant } from "./types.js";

const ctx: AuthContext = {
  userId: "u1",
  sessionId: "s1",
  authLevel: 1,
  authTime: new Date(),
  companyId: "c-amg",
};

test("deny by default without grants", () => {
  const d = authorize(ctx, "finance.journal.read", { type: "journal", companyId: "c-amg" }, []);
  assert.equal(d.allow, false);
});

test("allow when company-scoped grant matches", () => {
  const grants: Grant[] = [
    {
      permissionKey: "finance.journal.read",
      scopeType: "company",
      scopeId: "c-amg",
      validFrom: "2020-01-01",
      validTo: null,
    },
  ];
  const d = authorize(ctx, "finance.journal.read", { type: "journal", companyId: "c-amg" }, grants);
  assert.equal(d.allow, true);
});

test("deny when company scope mismatches", () => {
  const grants: Grant[] = [
    {
      permissionKey: "finance.journal.read",
      scopeType: "company",
      scopeId: "c-bzg",
      validFrom: "2020-01-01",
      validTo: null,
    },
  ];
  const d = authorize(ctx, "finance.journal.read", { type: "journal", companyId: "c-amg" }, grants);
  assert.equal(d.allow, false);
});

test("assertRoutesGuarded fails on null permission", () => {
  assert.throws(() =>
    assertRoutesGuarded([{ method: "GET", path: "/api/x", permission: null }]),
  );
});
