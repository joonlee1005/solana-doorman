import { useMemo } from "react";
import type { PublicKey } from "@solana/web3.js";
import { useChainData } from "../context/ChainDataContext";
import { useIdentity } from "../context/IdentityContext";
import { deriveDemoEventPdas, type DemoEventPdas } from "../lib/demoEvent";
import type { BidQueueAccount, EventAccount, SeatAccount, SeatTierAccount } from "../lib/types";

export interface ResolvedDemoSeat {
  code: string;
  seat: PublicKey;
  account: SeatAccount | null;
}

export interface ResolvedDemoTier {
  name: string;
  price: number;
  seatTier: PublicKey;
  ticketMint: PublicKey;
  account: SeatTierAccount | null;
  seatsResolved: ResolvedDemoSeat[];
  bidQueueAccount: BidQueueAccount | null;
}

/** Resolves lib/demoEvent.ts's fixed PDAs against live useChainData() state. Shared by
 * EventDetailPage, MyTicketsPage and ResalePage so all three agree on what's seeded. */
export function useDemoEventData() {
  const { identities } = useIdentity();
  const organizerIdentity = useMemo(() => identities.find((i) => i.id === "organizer")!, [identities]);
  const { events, seatTiers, seats, bidQueues } = useChainData();

  const demoPdas: DemoEventPdas = useMemo(
    () => deriveDemoEventPdas(organizerIdentity.keypair.publicKey),
    [organizerIdentity],
  );

  const eventAccount: EventAccount | null =
    events.find((e) => e.publicKey.equals(demoPdas.event))?.account ?? null;

  const tiers: ResolvedDemoTier[] = useMemo(
    () =>
      demoPdas.tiers.map((tier) => {
        const account = seatTiers.find((t) => t.publicKey.equals(tier.seatTier))?.account ?? null;
        const seatsResolved = tier.seats.map((s) => ({
          ...s,
          account: seats.find((sa) => sa.publicKey.equals(s.seat))?.account ?? null,
        }));
        const bidQueueAccount =
          bidQueues.find((bq) => bq.account.seatTier.equals(tier.seatTier))?.account ?? null;
        return { ...tier, account, seatsResolved, bidQueueAccount };
      }),
    [demoPdas, seatTiers, seats, bidQueues],
  );

  const isFullySeeded =
    !!eventAccount && tiers.every((tier) => !!tier.account && tier.seatsResolved.every((s) => !!s.account));

  return { organizerIdentity, demoPdas, eventAccount, tiers, isFullySeeded };
}
