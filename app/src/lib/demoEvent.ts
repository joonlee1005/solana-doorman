import type { PublicKey } from "@solana/web3.js";
import { eventPda, jurisdictionPda, seatPda, seatTierPda, ticketMintPda } from "./pda";

// A single, real devnet-backed event layered on top of the RAW_EVENTS mock
// catalog (mock/events.ts) so HomePage/AdminPage/other 7 catalog entries stay
// pure mock, untouched. This is RAW_EVENTS[DEMO_EVENT_RAW_IDX] — clicking that
// specific card is how a user reaches the chain-backed EventDetailPage branch.
export const DEMO_EVENT_RAW_IDX = 0;

// Fixed eventId (not Date.now()-based like AdminCreateEventForm) so every
// browser session derives the same event PDA under the organizer identity's
// pubkey, without needing to persist anything beyond that keypair itself.
export const DEMO_EVENT_ID = 20260813n;
export const DEMO_REFUND_DEADLINE = 1_900_000_000n; // far future, matches program tests

export const DEMO_JURISDICTION_CODE = "KOR";
export const DEMO_JURISDICTION_CAP_BPS = 2000; // 20% legal resale cap

export interface DemoTierDef {
  name: string;
  price: number; // display USDC (whole units)
  seatCodes: string[];
}

// Prices match mock/grades.ts GRADES so the demo event's grade cards/waitlist
// caps line up with the rest of the (still mock) seat-grade UI. Seat counts
// are intentionally small so seeding is a handful of txs, but padded to 4 per
// grade (not 2) so there's rehearsal headroom — on-chain Seat accounts have
// no "un-sell" path (Sold is permanent, see refund_ticket.rs), so the only
// way to get more available demo seats is to add more codes here and re-run
// the idempotent seed step (only the new ones get created).
export const DEMO_TIERS: DemoTierDef[] = [
  { name: "VIP", price: 100, seatCodes: ["V-1", "V-2", "V-3", "V-4"] },
  { name: "R", price: 70, seatCodes: ["R-1", "R-2", "R-3", "R-4"] },
  { name: "S", price: 40, seatCodes: ["S-1", "S-2", "S-3", "S-4"] },
];

export interface DemoSeatPda {
  code: string;
  seat: PublicKey;
}

export interface DemoTierPdas extends DemoTierDef {
  seatTier: PublicKey;
  ticketMint: PublicKey;
  seats: DemoSeatPda[];
}

export interface DemoEventPdas {
  jurisdictionRegistry: PublicKey;
  event: PublicKey;
  tiers: DemoTierPdas[];
}

/** Pure PDA derivation — no chain reads. Same organizer pubkey always yields the same addresses. */
export function deriveDemoEventPdas(organizer: PublicKey): DemoEventPdas {
  const [jurisdictionRegistry] = jurisdictionPda(DEMO_JURISDICTION_CODE);
  const [event] = eventPda(organizer, DEMO_EVENT_ID);
  const tiers = DEMO_TIERS.map((tier) => {
    const [seatTier] = seatTierPda(event, tier.name);
    const [ticketMint] = ticketMintPda(seatTier);
    const seats = tier.seatCodes.map((code) => ({ code, seat: seatPda(event, seatTier, code)[0] }));
    return { ...tier, seatTier, ticketMint, seats };
  });
  return { jurisdictionRegistry, event, tiers };
}
