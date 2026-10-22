/**
 * Company scoping helpers for Finance journals (Prompt 5).
 * Session company_id from Wolf handoff is the only trusted tenant key.
 */

/** Fake AMG company placeholder when backfilling pre-scoped rows (see DECISIONS). */
export const DEFAULT_BACKFILL_COMPANY_CODE = "AMG";

export function requireCompanyId(companyId: string | undefined | null): string {
  if (!companyId || typeof companyId !== "string") {
    throw new Error("company_id_required");
  }
  return companyId;
}

export function assertSameCompany(
  resourceCompanyId: string | undefined | null,
  sessionCompanyId: string,
): void {
  if (!resourceCompanyId || resourceCompanyId !== sessionCompanyId) {
    const err = new Error("company_isolation_violation");
    (err as Error & { status?: number }).status = 404;
    throw err;
  }
}

export function filterByCompanyId<T extends { company_id?: string }>(
  rows: T[],
  companyId: string,
): T[] {
  return rows.filter((r) => r.company_id === companyId);
}
