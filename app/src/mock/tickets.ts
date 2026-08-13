import type { PublicKey } from "@solana/web3.js";

// Held-ticket & waitlist-registration demo data ported from the Claude Design
// export (Doorman.dc.html).
// TODO: replace with real data derived from useChainData().seats (tickets the
// connected wallet owns) and useChainData().bidQueues (this wallet's bids)
// for the other 7 catalog events too, once they're chain-backed like the demo
// event (see lib/demoEvent.ts / hooks/useDemoEventData.ts).
// Resale is atomic (executeResale settles against the top of the bid queue in
// one instruction) — there is no "listing pending" state, so a resold ticket
// goes straight to "재판매완료".
export type TicketStatus = "보유중" | "재판매완료" | "체크인완료" | "환불됨";

export interface MockTicket {
  id: string;
  eventTitle: string;
  seat: string;
  price: number;
  purchasedAt: string;
  status: TicketStatus;
  txHash: string;
  resaleAmount?: number;
  resaleMatchedAt?: string;
  resaleBuyerWallet?: string;
  /** Present only for tickets backed by the real devnet demo event. */
  demo?: {
    seatTier: PublicKey;
    seat: PublicKey;
    ticketMint: PublicKey;
    paymentMint: PublicKey;
  };
}

export const MOCK_TICKETS: MockTicket[] = [
  { id: "t1", eventTitle: "블루문 나이트: 재즈 콘서트", seat: "V1-3", price: 100, purchasedAt: "2026.08.02 14:21", status: "보유중", txHash: "4kQ2…9fVn" },
  { id: "t2", eventTitle: "가을 락 페스티벌 2026", seat: "R2-5", price: 70, purchasedAt: "2026.08.05 09:10", status: "재판매완료", txHash: "7pXa…2mLc", resaleAmount: 82, resaleMatchedAt: "2026.08.10 16:45", resaleBuyerWallet: "9zRe...4tQb" },
  { id: "t3", eventTitle: "인디 쇼케이스 : 노을", seat: "S3-9", price: 40, purchasedAt: "2026.07.20 20:00", status: "체크인완료", txHash: "9zRe…4tQb" },
  { id: "t4", eventTitle: "뮤지컬 <먼 바다의 노래>", seat: "R1-2", price: 70, purchasedAt: "2026.07.15 11:32", status: "환불됨", txHash: "2fWs…8kDn" },
  { id: "t5", eventTitle: "KBL 올스타전 2026", seat: "V1-1", price: 100, purchasedAt: "2026.08.09 16:45", status: "보유중", txHash: "5jYm…1rHp" },
];

export interface MockQueueRegistration {
  id: string;
  eventTitle: string;
  grade: string;
  qty: number;
  deposit: number;
  position: number;
  registeredAt: string;
  matched?: boolean;
  matchedAt?: string;
  /** Present only for registrations backed by the real devnet demo event. Each
   * on-chain bid is exactly one seat, so a demo registration always has qty=1. */
  demo?: {
    seatTier: PublicKey;
    paymentMint: PublicKey;
  };
}

export const MOCK_QUEUE_REGISTRATIONS: MockQueueRegistration[] = [
  { id: "wq1", eventTitle: "가을 락 페스티벌 2026", grade: "R", qty: 2, deposit: 160, position: 5, registeredAt: "2026.08.09 10:12" },
  { id: "wq2", eventTitle: "블루문 나이트: 재즈 콘서트", grade: "VIP", qty: 1, deposit: 110, position: 5, registeredAt: "2026.08.07 15:40", matched: true, matchedAt: "2026.08.11 18:24" },
  { id: "wq3", eventTitle: "가을 락 페스티벌 2026", grade: "S", qty: 1, deposit: 43, position: 5, registeredAt: "2026.08.10 09:02" },
];
