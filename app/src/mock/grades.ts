// Seat-grade catalog ported from the Claude Design export (Doorman.dc.html).
// TODO: replace with useChainData().seatTiers once real seat tiers exist per event.
export interface MockGrade {
  name: string;
  price: number;
  rows: number;
  seatsPerRow: number;
}

export const GRADES: MockGrade[] = [
  { name: "VIP", price: 100, rows: 3, seatsPerRow: 10 },
  { name: "R", price: 70, rows: 4, seatsPerRow: 12 },
  { name: "S", price: 40, rows: 5, seatsPerRow: 14 },
];

// Tailwind class lookups keyed by grade name — kept as static literal strings
// (not string-concatenated) so the Tailwind v4 scanner picks them up.
export const GRADE_DOT_BG: Record<string, string> = {
  VIP: "bg-grade-vip",
  R: "bg-grade-r",
  S: "bg-grade-s",
};

export const GRADE_TEXT: Record<string, string> = {
  VIP: "text-grade-vip",
  R: "text-grade-r",
  S: "text-grade-s",
};

export const GRADE_BORDER: Record<string, string> = {
  VIP: "border-grade-vip",
  R: "border-grade-r",
  S: "border-grade-s",
};

export const GRADE_SEAT_AVAILABLE_BG: Record<string, string> = {
  VIP: "bg-grade-vip/55",
  R: "bg-grade-r/50",
  S: "bg-grade-s/40",
};

export const GRADE_CHIP_ACTIVE_BG: Record<string, string> = {
  VIP: "bg-grade-vip/10",
  R: "bg-grade-r/10",
  S: "bg-grade-s/10",
};

// Stand-in for "my" wallet within the WAITLIST_MOCK lists below, matching the
// default demo identity (customer1) in the Claude Design export. TODO: replace
// isMine checks with a real pubkey comparison once wired to useIdentity().
export const MY_WALLET_MOCK = "7P9v...41SJq";

// Waitlist demo entries per grade — deposit-desc, then registration-order tiebreak
// (price priority, then time priority), matching the on-chain FIFO-within-cap intent.
// TODO: replace with useChainData().bidQueues once wired.
export interface MockWaitlistEntry {
  wallet: string;
  deposit: number;
  matched?: boolean;
}

export const WAITLIST_MOCK: Record<string, MockWaitlistEntry[]> = {
  VIP: [
    { wallet: "4kQ2...9fVn", deposit: 120, matched: true },
    { wallet: "1zQe...7bLk", deposit: 118 },
    { wallet: "6mPa...5dWx", deposit: 115 },
    { wallet: "GkTr...2pQm", deposit: 112 },
    { wallet: "7P9v...41SJq", deposit: 110 },
    { wallet: "9fXo...6bNs", deposit: 108 },
    { wallet: "2wLp...8dRk", deposit: 105 },
    { wallet: "HqYt...3mVx", deposit: 104 },
    { wallet: "8yTn...3cMp", deposit: 102 },
    { wallet: "ZxCv...7nQe", deposit: 101 },
    { wallet: "MjNb...5wTp", deposit: 100 },
  ],
  R: [
    { wallet: "BqLm...9zXe", deposit: 84, matched: true },
    { wallet: "DtVn...4wYk", deposit: 84 },
    { wallet: "3xK9...9mPqL", deposit: 82 },
    { wallet: "KpRs...1cWy", deposit: 81 },
    { wallet: "7P9v...41SJq", deposit: 80 },
    { wallet: "9zRe...4tQb", deposit: 78 },
    { wallet: "5hUo...1cNp", deposit: 76 },
    { wallet: "FnVb...8xQr", deposit: 75 },
    { wallet: "TgHj...2sLm", deposit: 73 },
    { wallet: "WeRt...6yUo", deposit: 71 },
    { wallet: "PmKl...9jXc", deposit: 70 },
  ],
  S: [
    { wallet: "8yTn...3cMp", deposit: 48, matched: true },
    { wallet: "4kQ2...9fVn", deposit: 46 },
    { wallet: "QaZx...5wSe", deposit: 45 },
    { wallet: "1zQe...7bLk", deposit: 44 },
    { wallet: "7P9v...41SJq", deposit: 43 },
    { wallet: "NmBv...7cXz", deposit: 42 },
    { wallet: "UjIk...3oPl", deposit: 41 },
    { wallet: "RfTg...9bHn", deposit: 40 },
  ],
};
