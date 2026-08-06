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

/**
 * A flat fee PER TICKET, the same on every category.
 *
 * Per ticket, not per booking: ten passes carry ₹250, not ₹25. It is
 * deliberately not part of the rate card above, because it does not vary by
 * category and putting it there would make it something that could drift
 * between a student and a parent, which is exactly what it must not do.
 */
export const CONVENIENCE_FEE_PER_TICKET = 25;

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
  /** The passes alone. This is the "Tickets" row on a summary. */
  ticketsTotal: number;
  /** `CONVENIENCE_FEE_PER_TICKET` times the ticket count. */
  convenienceFee: number;
  /** WHAT IS PAYABLE: tickets plus the fee. Never one without the other. */
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
  const tickets = lines.reduce((n, l) => n + l.quantity, 0);
  const ticketsTotal = lines.reduce((n, l) => n + l.subtotal, 0);
  // Multiplying by the count is also what keeps an empty quote at zero: the
  // form asks for a quote before anything is chosen, and a fee on a screen
  // with no order on it would be wrong.
  const convenienceFee = tickets * CONVENIENCE_FEE_PER_TICKET;
  return {
    lines,
    tickets,
    ticketsTotal,
    convenienceFee,
    total: ticketsTotal + convenienceFee,
  };
}

/** "3 × ₹200 = ₹600", the line as it is read out. */
export function describeLine(line: PriceLine): string {
  return `${line.quantity} × ${formatRupees(line.unitPrice)} = ${formatRupees(
    line.subtotal
  )}`;
}
