import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";

export type ResalePolicy =
  | { capped: { maxBps: number } }
  | { unrestricted: Record<string, never> }
  | { nonTransferable: Record<string, never> };

export function resalePolicyLabel(policy: ResalePolicy): string {
  if ("capped" in policy) return `상한 ${(policy.capped.maxBps / 100).toFixed(1)}%`;
  if ("unrestricted" in policy) return "제한 없음";
  return "재판매 불가";
}

export function resalePolicyCapBps(policy: ResalePolicy): number | null {
  if ("capped" in policy) return policy.capped.maxBps;
  if ("unrestricted" in policy) return 10_000;
  return null; // NonTransferable: no resale allowed at all
}

export type SeatStatus =
  | { available: Record<string, never> }
  | { sold: Record<string, never> }
  | { refunded: Record<string, never> }
  | { checkedIn: Record<string, never> };

export function seatStatusLabel(status: SeatStatus): string {
  if ("available" in status) return "구매 가능";
  if ("sold" in status) return "판매 완료";
  if ("refunded" in status) return "환불됨";
  return "체크인 완료";
}

export interface EventAccount {
  organizer: PublicKey;
  eventId: BN;
  jurisdictionRegistry: PublicKey;
  refundDeadline: BN;
  refundBps: number;
  bump: number;
}

export interface SeatTierAccount {
  event: PublicKey;
  tierName: string;
  ticketMint: PublicKey;
  paymentMint: PublicKey;
  faceValue: BN;
  resalePolicy: ResalePolicy;
  totalSeats: number;
  bump: number;
}

export interface SeatAccount {
  seatTier: PublicKey;
  seatCode: string;
  displayName: string;
  tokenAccount: PublicKey;
  owner: PublicKey;
  status: SeatStatus;
  bump: number;
}

export interface Bid {
  buyer: PublicKey;
  amount: BN;
  joinedAt: BN;
}

export interface BidQueueAccount {
  seatTier: PublicKey;
  vault: PublicKey;
  bids: Bid[];
  count: number;
  bump: number;
}

export interface JurisdictionRegistryAccount {
  authority: PublicKey;
  jurisdictionCode: string;
  legalCapBps: number;
  bump: number;
}
