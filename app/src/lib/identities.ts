import { Keypair } from "@solana/web3.js";
import { DEMO_STORAGE_PREFIX } from "./constants";
import type { Lang } from "../i18n";

export type IdentityId = "organizer" | "customer1" | "customer2" | "customer3";

export interface Identity {
  id: IdentityId;
  labelKo: string;
  labelEn: string;
  role: "organizer" | "customer";
  keypair: Keypair;
}

const IDENTITY_DEFS: { id: IdentityId; labelKo: string; labelEn: string; role: "organizer" | "customer" }[] = [
  { id: "organizer", labelKo: "주최자 (Organizer)", labelEn: "Organizer", role: "organizer" },
  { id: "customer1", labelKo: "고객 1", labelEn: "Customer 1", role: "customer" },
  { id: "customer2", labelKo: "고객 2", labelEn: "Customer 2", role: "customer" },
  { id: "customer3", labelKo: "고객 3", labelEn: "Customer 3", role: "customer" },
];

export function identityLabel(identity: Identity, lang: Lang): string {
  return lang === "ko" ? identity.labelKo : identity.labelEn;
}

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
