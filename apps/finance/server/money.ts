/**
 * Money helpers: integer minor units + ISO 4217 currency (Wolf architecture §0 / §3).
 * Fake data only — never run migrations against production amounts.
 */

export type CurrencyCode = string;

/** ISO 4217 minor-unit exponents used by Finance. IDR uses 2 for consistent rounding. */
const EXPONENTS: Record<string, number> = {
  IDR: 2,
  USD: 2,
  EUR: 2,
  SGD: 2,
};

export function currencyExponent(currency: CurrencyCode): number {
  const code = (currency || "IDR").toUpperCase();
  return EXPONENTS[code] ?? 2;
}

/** Convert major-unit amount (possibly float) to integer minor units. */
export function toMinor(amountMajor: number, currency: CurrencyCode = "IDR"): number {
  const exp = currencyExponent(currency);
  const factor = 10 ** exp;
  if (!Number.isFinite(amountMajor)) {
    throw new Error(`invalid_amount: ${amountMajor}`);
  }
  return Math.round(amountMajor * factor);
}

/** Convert integer minor units to major units (number). */
export function fromMinor(amountMinor: number, currency: CurrencyCode = "IDR"): number {
  const exp = currencyExponent(currency);
  const factor = 10 ** exp;
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`amount_minor_must_be_integer: ${amountMinor}`);
  }
  return amountMinor / factor;
}

export function assertMinor(amountMinor: number): void {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`amount_minor_must_be_integer: ${amountMinor}`);
  }
}

export type MoneyLine = {
  debit_minor: number;
  credit_minor: number;
  currency: string;
  /** Derived major units for legacy UI / Sheets sync */
  debit: number;
  credit: number;
};

/** Normalize a line that may provide major or minor fields. */
export function normalizeMoneyLine(
  input: {
    debit?: number;
    credit?: number;
    debit_minor?: number;
    credit_minor?: number;
    currency?: string;
  },
  defaultCurrency = "IDR",
): MoneyLine {
  const currency = (input.currency || defaultCurrency).toUpperCase();
  const debit_minor =
    input.debit_minor !== undefined
      ? Math.trunc(input.debit_minor)
      : toMinor(input.debit ?? 0, currency);
  const credit_minor =
    input.credit_minor !== undefined
      ? Math.trunc(input.credit_minor)
      : toMinor(input.credit ?? 0, currency);
  assertMinor(debit_minor);
  assertMinor(credit_minor);
  return {
    debit_minor,
    credit_minor,
    currency,
    debit: fromMinor(debit_minor, currency),
    credit: fromMinor(credit_minor, currency),
  };
}

export type ReconcileJournalSnapshot = {
  journal_id: string;
  currency: string;
  line_count: number;
  debit_major_sum: number;
  credit_major_sum: number;
  debit_minor_sum: number;
  credit_minor_sum: number;
  ok: boolean;
  errors: string[];
};

export type ReconcileReport = {
  before_count: number;
  after_count: number;
  before_debit_minor_total: number;
  after_debit_minor_total: number;
  journals: ReconcileJournalSnapshot[];
  ok: boolean;
};

/** Compare major↔minor totals for a set of journal lines (reconciliation check). */
export function reconcileJournalLines(
  journals: Array<{
    journal_id: string;
    currency: string;
    lines: Array<{ debit: number; credit: number; debit_minor: number; credit_minor: number }>;
  }>,
): ReconcileReport {
  const snapshots: ReconcileJournalSnapshot[] = [];
  let debitMinorTotal = 0;

  for (const j of journals) {
    const errors: string[] = [];
    let debitMajor = 0;
    let creditMajor = 0;
    let debitMinor = 0;
    let creditMinor = 0;
    for (const line of j.lines) {
      debitMajor += line.debit || 0;
      creditMajor += line.credit || 0;
      debitMinor += line.debit_minor || 0;
      creditMinor += line.credit_minor || 0;
      const expectedDebit = toMinor(line.debit || 0, j.currency);
      const expectedCredit = toMinor(line.credit || 0, j.currency);
      if (expectedDebit !== line.debit_minor) {
        errors.push(`line debit mismatch major=${line.debit} minor=${line.debit_minor}`);
      }
      if (expectedCredit !== line.credit_minor) {
        errors.push(`line credit mismatch major=${line.credit} minor=${line.credit_minor}`);
      }
    }
    if (toMinor(debitMajor, j.currency) !== debitMinor) {
      errors.push(`journal debit sum mismatch`);
    }
    if (toMinor(creditMajor, j.currency) !== creditMinor) {
      errors.push(`journal credit sum mismatch`);
    }
    debitMinorTotal += debitMinor;
    snapshots.push({
      journal_id: j.journal_id,
      currency: j.currency,
      line_count: j.lines.length,
      debit_major_sum: Math.round(debitMajor * 100) / 100,
      credit_major_sum: Math.round(creditMajor * 100) / 100,
      debit_minor_sum: debitMinor,
      credit_minor_sum: creditMinor,
      ok: errors.length === 0,
      errors,
    });
  }

  return {
    before_count: journals.length,
    after_count: journals.length,
    before_debit_minor_total: debitMinorTotal,
    after_debit_minor_total: debitMinorTotal,
    journals: snapshots,
    ok: snapshots.every((s) => s.ok),
  };
}
