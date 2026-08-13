import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { connection } from "../lib/program";
import { PROGRAM_ID } from "../lib/constants";
import { fetchResaleMatchesForBuyer, type ResaleMatchNotification } from "../lib/notifications";
import { useIdentity } from "../context/IdentityContext";
import { useDemoEventData } from "./useDemoEventData";
import { RAW_EVENTS } from "../mock/events";
import { DEMO_EVENT_RAW_IDX } from "../lib/demoEvent";
import type { IdentityId } from "../lib/identities";

export interface ResaleNotificationItem {
  signature: string;
  seatCode: string;
  tierName: string;
  eventTitle: string;
  blockTime: number | null;
}

const programId = new PublicKey(PROGRAM_ID);

function seenKey(id: IdentityId): string {
  return `doorman:seenResaleNotifs:${id}`;
}

function loadSeen(id: IdentityId): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey(id));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveSeen(id: IdentityId, sigs: Set<string>) {
  localStorage.setItem(seenKey(id), JSON.stringify([...sigs]));
}

/** Surfaces "you were matched in a resale" notifications for the currently
 * selected identity — refetched on mount and whenever the selected identity
 * changes (covers "next reload" / "switch to that account" per today's
 * scope; a same-session live push while staying on another account would
 * need a websocket subscription, deliberately left out for now). */
export function useResaleNotifications() {
  const { selected, selectedId } = useIdentity();
  const { tiers } = useDemoEventData();
  const [rawMatches, setRawMatches] = useState<ResaleMatchNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [seenVersion, setSeenVersion] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const matches = await fetchResaleMatchesForBuyer(connection, programId, selected.keypair.publicKey);
      setRawMatches(matches);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    refresh();
    // Only re-fetch on an actual identity switch/mount, not on every chain
    // refresh — resolving seat/tier names for already-fetched matches is
    // handled separately below without hitting the RPC again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const items = useMemo<ResaleNotificationItem[]>(() => {
    const seatLookup = new Map<string, { code: string; tierName: string }>();
    for (const tier of tiers) {
      for (const s of tier.seatsResolved) seatLookup.set(s.seat.toBase58(), { code: s.code, tierName: tier.name });
    }
    const eventTitle = RAW_EVENTS[DEMO_EVENT_RAW_IDX]?.title ?? "";
    return rawMatches
      .map((m) => {
        const info = seatLookup.get(m.seat);
        if (!info) return null;
        return { signature: m.signature, seatCode: info.code, tierName: info.tierName, eventTitle, blockTime: m.blockTime };
      })
      .filter((x): x is ResaleNotificationItem => x !== null)
      .sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));
  }, [rawMatches, tiers]);

  const unreadCount = useMemo(() => {
    const seen = loadSeen(selectedId);
    return items.filter((i) => !seen.has(i.signature)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, selectedId, seenVersion]);

  const markAllRead = useCallback(() => {
    if (items.length === 0) return;
    const seen = loadSeen(selectedId);
    items.forEach((i) => seen.add(i.signature));
    saveSeen(selectedId, seen);
    setSeenVersion((v) => v + 1);
  }, [items, selectedId]);

  return { items, unreadCount, loading, markAllRead, refresh };
}
