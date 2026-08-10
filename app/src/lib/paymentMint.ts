import { PublicKey, type Signer } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { connection } from "./program";
import { DEMO_STORAGE_PREFIX, PAYMENT_DECIMALS } from "./constants";

const STORAGE_KEY = `${DEMO_STORAGE_PREFIX}paymentMint`;

export function getStoredPaymentMint(): PublicKey | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
}

export async function createDemoPaymentMint(organizer: Signer): Promise<PublicKey> {
  const mint = await createMint(
    connection,
    organizer,
    organizer.publicKey,
    null,
    PAYMENT_DECIMALS,
    undefined,
    { commitment: "confirmed" },
    TOKEN_2022_PROGRAM_ID,
  );
  localStorage.setItem(STORAGE_KEY, mint.toBase58());
  return mint;
}

export async function fundWithTestUsdc(
  organizer: Signer,
  mint: PublicKey,
  owner: PublicKey,
  amountBaseUnits: bigint,
): Promise<string> {
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    organizer,
    mint,
    owner,
    false,
    "confirmed",
    { commitment: "confirmed" },
    TOKEN_2022_PROGRAM_ID,
  );
  return mintTo(
    connection,
    organizer,
    mint,
    ata.address,
    organizer,
    amountBaseUnits,
    [],
    { commitment: "confirmed" },
    TOKEN_2022_PROGRAM_ID,
  );
}
