/** Integer minor units + ISO currency (architecture §3). */

export type Money = { amountMinor: number; currency: string };

export function toMinor(amount: number, currency = "IDR"): Money {
  // IDR has 0 decimal places in practice for this hotel app; still store *100 for consistency
  // with Wolf integer-minor rule. Reconciliation script documents the scale.
  const scale = currency === "IDR" ? 100 : 100;
  return { amountMinor: Math.round(amount * scale), currency };
}

export function fromMinor(money: Money): number {
  const scale = money.currency === "IDR" ? 100 : 100;
  return money.amountMinor / scale;
}

export type MoneySnapshot = {
  label: string;
  count: number;
  sumFloat: number;
  sumMinor: number;
  currency: string;
};

export function reconcileAmounts(
  rows: Array<{ amount: number }>,
  currency = "IDR",
): { before: MoneySnapshot; after: MoneySnapshot; ok: boolean } {
  const sumFloat = rows.reduce((s, r) => s + r.amount, 0);
  const minors = rows.map((r) => toMinor(r.amount, currency));
  const sumMinor = minors.reduce((s, m) => s + m.amountMinor, 0);
  const before: MoneySnapshot = {
    label: "before",
    count: rows.length,
    sumFloat,
    sumMinor: Math.round(sumFloat * 100),
    currency,
  };
  const after: MoneySnapshot = {
    label: "after",
    count: minors.length,
    sumFloat: fromMinor({ amountMinor: sumMinor, currency }),
    sumMinor,
    currency,
  };
  const ok = before.count === after.count && before.sumMinor === after.sumMinor;
  return { before, after, ok };
}
