import type { Request } from "express";
import { getFinanceSession } from "./wolfAuth.js";

/** Default fake backfill company code until real mapping is provided. */
export const DEFAULT_COMPANY_CODE = "AMG";

export function requireCompanyId(req: Request): string {
  const session = getFinanceSession(req);
  if (!session?.companyId) {
    throw new Error("company_required");
  }
  return session.companyId;
}

/** In-memory collections tagged with company_id for isolation tests. */
export type CompanyScoped<T> = T & { company_id: string };

export function filterByCompany<T extends { company_id?: string }>(
  rows: T[],
  companyId: string,
): T[] {
  return rows.filter((r) => r.company_id === companyId);
}

export function withCompanyId<T extends object>(row: T, companyId: string): T & { company_id: string } {
  return { ...row, company_id: companyId };
}
