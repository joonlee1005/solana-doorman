import { GRADES } from "./grades";

// Deterministic per-event admin seat generator ported from the Claude Design
// export (Doorman.dc.html). Seat counts here are intentionally separate from
// the buyer-facing seat map in EventDetailPage (GRADES.rows*seatsPerRow) —
// that's a quirk already present in the source prototype, kept as-is.
// TODO: replace with real per-tier seats from useChainData().seats once wired.
export type AdminSeatStatus = "구매가능" | "판매완료" | "체크인완료" | "환불됨";

export const ADMIN_GRADE_COUNTS: Record<string, number> = { VIP: 10, R: 20, S: 20 };

export const WALLET_SHORTS = [
  "7P9v...41SJq",
  "4kQ2...9fVn",
  "8yTn...3cMp",
  "1zQe...7bLk",
  "6mPa...5dWx",
  "3xK9...9mPqL",
  "DtVn...4wYk",
  "5hUo...1cNp",
  "BqLm...9zXe",
  "9zRe...4tQb",
];

export const IDENTITIES = [
  "customer1",
  "customer2",
  "customer3",
  "customer4",
  "customer5",
  "customer6",
  "customer7",
  "customer8",
  "customer9",
  "customer10",
];

export interface AdminSeat {
  key: string;
  code: string;
  status: AdminSeatStatus;
  ownerText: string;
  purchasedAt: string;
  price: number;
}

export interface AdminGradeSummary {
  name: string;
  price: number;
  seats: AdminSeat[];
  soldCount: number;
  totalCount: number;
}

export function buildAdminEventSeats(
  eventIdx: number,
  overrides: Record<string, AdminSeatStatus>,
): AdminGradeSummary[] {
  return GRADES.map((g, gi) => {
    const count = ADMIN_GRADE_COUNTS[g.name];
    const seats: AdminSeat[] = [];
    let sold = 0;
    for (let j = 0; j < count; j++) {
      const seed = eventIdx * 37 + gi * 13 + j;
      const key = `${eventIdx}-${gi}-${j}`;
      const mod = seed % 6;
      const defaultStatus: AdminSeatStatus =
        mod === 5 ? "구매가능" : mod === 4 ? "환불됨" : mod === 3 ? "체크인완료" : "판매완료";
      const status = overrides[key] ?? defaultStatus;
      if (status !== "구매가능") sold++;
      const ownerIdx = seed % WALLET_SHORTS.length;
      seats.push({
        key,
        code: `${g.name[0]}${j + 1}`,
        status,
        ownerText: status === "구매가능" ? "" : `${WALLET_SHORTS[ownerIdx]} (${IDENTITIES[ownerIdx]})`,
        purchasedAt: status === "구매가능" ? "" : `2026.08.${(seed % 20) + 1}`,
        price: g.price,
      });
    }
    return { name: g.name, price: g.price, seats, soldCount: sold, totalCount: count };
  });
}
