import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { PublicKey } from "@solana/web3.js";
import { getProgram } from "../lib/program";
import { useIdentity } from "./IdentityContext";
import type {
  BidQueueAccount,
  EventAccount,
  JurisdictionRegistryAccount,
  SeatAccount,
  SeatTierAccount,
} from "../lib/types";

interface WithPubkey<T> {
  publicKey: PublicKey;
  account: T;
}

interface ChainDataContextValue {
  jurisdictions: WithPubkey<JurisdictionRegistryAccount>[];
  events: WithPubkey<EventAccount>[];
  seatTiers: WithPubkey<SeatTierAccount>[];
  seats: WithPubkey<SeatAccount>[];
  bidQueues: WithPubkey<BidQueueAccount>[];
  loading: boolean;
  refresh: () => Promise<void>;
  selectedEvent: string | null;
  setSelectedEvent: (pk: string | null) => void;
  selectedSeatTier: string | null;
  setSelectedSeatTier: (pk: string | null) => void;
}

const ChainDataContext = createContext<ChainDataContextValue | null>(null);

export function ChainDataProvider({ children }: { children: ReactNode }) {
  const { selected } = useIdentity();
  const program = useMemo(() => getProgram(selected.keypair), [selected]);

  const [jurisdictions, setJurisdictions] = useState<
    WithPubkey<JurisdictionRegistryAccount>[]
  >([]);
  const [events, setEvents] = useState<WithPubkey<EventAccount>[]>([]);
  const [seatTiers, setSeatTiers] = useState<WithPubkey<SeatTierAccount>[]>([]);
  const [seats, setSeats] = useState<WithPubkey<SeatAccount>[]>([]);
  const [bidQueues, setBidQueues] = useState<WithPubkey<BidQueueAccount>[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [selectedSeatTier, setSelectedSeatTier] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [j, e, st, s, bq] = await Promise.all([
        program.account.jurisdictionRegistry.all(),
        program.account.event.all(),
        program.account.seatTier.all(),
        program.account.seat.all(),
        program.account.bidQueue.all(),
      ]);
      setJurisdictions(j as unknown as WithPubkey<JurisdictionRegistryAccount>[]);
      setEvents(e as unknown as WithPubkey<EventAccount>[]);
      setSeatTiers(st as unknown as WithPubkey<SeatTierAccount>[]);
      setSeats(s as unknown as WithPubkey<SeatAccount>[]);
      setBidQueues(bq as unknown as WithPubkey<BidQueueAccount>[]);
    } finally {
      setLoading(false);
    }
  }, [program]);

  const value: ChainDataContextValue = {
    jurisdictions,
    events,
    seatTiers,
    seats,
    bidQueues,
    loading,
    refresh,
    selectedEvent,
    setSelectedEvent,
    selectedSeatTier,
    setSelectedSeatTier,
  };

  return <ChainDataContext.Provider value={value}>{children}</ChainDataContext.Provider>;
}

export function useChainData() {
  const ctx = useContext(ChainDataContext);
  if (!ctx) throw new Error("useChainData must be used within ChainDataProvider");
  return ctx;
}
