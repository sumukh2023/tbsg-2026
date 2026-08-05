/**
 * What a pass costs, and the only place that answers the question.
 *
 * Written as a rate CARD plus a pure quote function rather than as totals
 * anywhere, so that changing a price is a one-line edit here and every line,
 * subtotal and grand total on the site follows it. Nothing downstream may
 * multiply a quantity by a number of its own.
 *
 * Whole rupees throughout; see `@/utils/money`.
 */
import { formatRupees } from '@/utils/money';

export type VisitorType = 'student' | 'parent' | 'other';

/**
 * The rate card. Change a number here and the confirmation page, its
 * subtotals and its grand total all move with it.
 */
export const TICKET_PRICES: Record<VisitorType, number> = {
  student: 200,
  parent: 250,
  other: 250,
};

/** How each category is named to a visitor, in the order it is listed. */
export const TICKET_LABELS: Record<VisitorType, string> = {
  student: 'Student',
  parent: 'Parent',
  other: 'Others',
};

const ORDER: readonly VisitorType[] = ['student', 'parent', 'other'];

export type PriceLine = {
  type: VisitorType;
  label: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type Quote = {
  /** One per category actually booked, in rate-card order. */
  lines: PriceLine[];
  tickets: number;
  total: number;
};

/**
 * Prices a booking.
 *
 * Takes a count PER CATEGORY, so a booking that ever spans more than one
 * category prices correctly without this function changing. A category with
 * no tickets produces no line rather than a zero one — a "Parent 0 × ₹250 =
 * ₹0" row is noise on a receipt.
 *
 * Quantities are floored and clamped at zero: the form validates before it
 * gets here, but a price is the wrong place to trust that.
 */
export function quoteFor(counts: Partial<Record<VisitorType, number>>): Quote {
  const lines: PriceLine[] = [];
  for (const type of ORDER) {
    const raw = counts[type];
    const quantity =
      typeof raw === 'number' && Number.isFinite(raw)
        ? Math.max(0, Math.floor(raw))
        : 0;
    if (quantity === 0) continue;
    const unitPrice = TICKET_PRICES[type];
    lines.push({
      type,
      label: TICKET_LABELS[type],
      quantity,
      unitPrice,
      subtotal: quantity * unitPrice,
    });
  }
  return {
    lines,
    tickets: lines.reduce((n, l) => n + l.quantity, 0),
    total: lines.reduce((n, l) => n + l.subtotal, 0),
  };
}

/** "3 × ₹200 = ₹600", the line as it is read out. */
export function describeLine(line: PriceLine): string {
  return `${line.quantity} × ${formatRupees(line.unitPrice)} = ${formatRupees(
    line.subtotal
  )}`;
}
