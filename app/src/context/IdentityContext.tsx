import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { connection } from "../lib/program";
import { getStoredPaymentMint } from "../lib/paymentMint";
import { loadIdentities, type Identity, type IdentityId } from "../lib/identities";

interface IdentityContextValue {
  identities: Identity[];
  selectedId: IdentityId;
  selected: Identity;
  setSelectedId: (id: IdentityId) => void;
  balances: Record<IdentityId, number>;
  refreshBalances: () => Promise<void>;
  /** Payment-mint (test USDC) balance per identity, in display units (e.g. 150, not base units). */
  usdcBalances: Record<IdentityId, number>;
  refreshUsdcBalances: () => Promise<void>;
  airdrop: (id: IdentityId) => Promise<void>;
  airdropping: IdentityId | null;
}

const IdentityContext = createContext<IdentityContextValue | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [identities] = useState<Identity[]>(() => loadIdentities());
  const [selectedId, setSelectedId] = useState<IdentityId>("organizer");
  const [balances, setBalances] = useState<Record<IdentityId, number>>(
    {} as Record<IdentityId, number>,
  );
  const [usdcBalances, setUsdcBalances] = useState<Record<IdentityId, number>>(
    {} as Record<IdentityId, number>,
  );
  const [airdropping, setAirdropping] = useState<IdentityId | null>(null);

  const refreshBalances = useCallback(async () => {
    const entries = await Promise.all(
      identities.map(async (identity) => {
        try {
          const lamports = await connection.getBalance(identity.keypair.publicKey);
          return [identity.id, lamports] as const;
        } catch {
          return [identity.id, 0] as const;
        }
      }),
    );
    setBalances(Object.fromEntries(entries) as Record<IdentityId, number>);
  }, [identities]);

  const refreshUsdcBalances = useCallback(async () => {
    const mint = getStoredPaymentMint();
    if (!mint) {
      setUsdcBalances({} as Record<IdentityId, number>);
      return;
    }
    const entries = await Promise.all(
      identities.map(async (identity) => {
        try {
          const ata = getAssociatedTokenAddressSync(
            mint,
            identity.keypair.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID,
          );
          const { value } = await connection.getTokenAccountBalance(ata);
          return [identity.id, value.uiAmount ?? 0] as const;
        } catch {
          // No ATA yet (never funded) — treat as a zero balance, not an error.
          return [identity.id, 0] as const;
        }
      }),
    );
    setUsdcBalances(Object.fromEntries(entries) as Record<IdentityId, number>);
  }, [identities]);

  useEffect(() => {
    refreshBalances();
    refreshUsdcBalances();
    const interval = setInterval(() => {
      refreshBalances();
      refreshUsdcBalances();
    }, 15_000);
    return () => clearInterval(interval);
  }, [refreshBalances, refreshUsdcBalances]);

  const airdrop = useCallback(
    async (id: IdentityId) => {
      const identity = identities.find((i) => i.id === id);
      if (!identity) return;
      setAirdropping(id);
      try {
        const sig = await connection.requestAirdrop(identity.keypair.publicKey, 2_000_000_000);
        await connection.confirmTransaction(sig, "confirmed");
        await refreshBalances();
      } finally {
        setAirdropping(null);
      }
    },
    [identities, refreshBalances],
  );

  const selected = useMemo(
    () => identities.find((i) => i.id === selectedId) ?? identities[0],
    [identities, selectedId],
  );

  const value: IdentityContextValue = {
    identities,
    selectedId,
    selected,
    setSelectedId,
    balances,
    refreshBalances,
    usdcBalances,
    refreshUsdcBalances,
    airdrop,
    airdropping,
  };

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

export function useIdentity() {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error("useIdentity must be used within IdentityProvider");
  return ctx;
}
