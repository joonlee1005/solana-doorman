import { Keypair } from "@solana/web3.js";
import { DEMO_STORAGE_PREFIX } from "./constants";

export type IdentityId = "organizer" | "customer1" | "customer2" | "customer3";

export interface Identity {
  id: IdentityId;
  label: string;
  role: "organizer" | "customer";
  keypair: Keypair;
}

const IDENTITY_DEFS: { id: IdentityId; label: string; role: "organizer" | "customer" }[] = [
  { id: "organizer", label: "주최자 (Organizer)", role: "organizer" },
  { id: "customer1", label: "고객 1", role: "customer" },
  { id: "customer2", label: "고객 2", role: "customer" },
  { id: "customer3", label: "고객 3", role: "customer" },
];

function storageKey(id: IdentityId): string {
  return `${DEMO_STORAGE_PREFIX}identity:${id}`;
}

function loadOrCreateKeypair(id: IdentityId): Keypair {
  const raw = localStorage.getItem(storageKey(id));
  if (raw) {
    try {
      const secret = Uint8Array.from(JSON.parse(raw) as number[]);
      return Keypair.fromSecretKey(secret);
    } catch {
      // fall through and regenerate if corrupted
    }
  }
  const kp = Keypair.generate();
  localStorage.setItem(storageKey(id), JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

export function loadIdentities(): Identity[] {
  return IDENTITY_DEFS.map((def) => ({
    ...def,
    keypair: loadOrCreateKeypair(def.id),
  }));
}

export function resetIdentity(id: IdentityId): Identity {
  localStorage.removeItem(storageKey(id));
  const def = IDENTITY_DEFS.find((d) => d.id === id)!;
  return { ...def, keypair: loadOrCreateKeypair(id) };
}
