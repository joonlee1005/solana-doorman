import type { Connection, PublicKey } from "@solana/web3.js";

// execute_resale.rs's #[derive(Accounts)] field order (seller, buyer, seat_tier,
// seat, ...) — a compiled instruction's `accounts` index list preserves this
// exact declared order regardless of how the transaction's overall accountKeys
// got deduped/sorted, so these indices are stable as long as that struct's
// field order doesn't change.
const EXECUTE_RESALE_BUYER_ACCOUNT_INDEX = 1;
const EXECUTE_RESALE_SEAT_ACCOUNT_INDEX = 3;

export interface ResaleMatchNotification {
  signature: string;
  seat: string; // base58
  blockTime: number | null;
}

/** No off-chain indexer here — this scans the buyer's recent tx history on
 * devnet for ExecuteResale instructions where they were the matched buyer.
 * Bounded by `limit` (most recent signatures only). */
export async function fetchResaleMatchesForBuyer(
  connection: Connection,
  programId: PublicKey,
  buyer: PublicKey,
  limit = 25,
): Promise<ResaleMatchNotification[]> {
  const sigInfos = await connection.getSignaturesForAddress(buyer, { limit });
  const out: ResaleMatchNotification[] = [];

  for (const info of sigInfos) {
    if (info.err) continue;
    const tx = await connection.getTransaction(info.signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    if (!tx) continue;

    const logs = tx.meta?.logMessages ?? [];
    if (!logs.some((l) => l.includes("Instruction: ExecuteResale"))) continue;

    const message = tx.transaction.message as {
      accountKeys?: PublicKey[];
      getAccountKeys?: () => { staticAccountKeys: PublicKey[] };
      instructions?: { programIdIndex: number; accounts: number[] }[];
      compiledInstructions?: { programIdIndex: number; accountKeyIndexes: number[] }[];
    };
    const accountKeys = message.accountKeys ?? message.getAccountKeys?.().staticAccountKeys ?? [];
    const instructions =
      message.instructions ??
      message.compiledInstructions?.map((ix) => ({
        programIdIndex: ix.programIdIndex,
        accounts: ix.accountKeyIndexes,
      })) ??
      [];

    for (const ix of instructions) {
      if (!accountKeys[ix.programIdIndex]?.equals(programId)) continue;
      const buyerKey = accountKeys[ix.accounts[EXECUTE_RESALE_BUYER_ACCOUNT_INDEX]];
      const seatKey = accountKeys[ix.accounts[EXECUTE_RESALE_SEAT_ACCOUNT_INDEX]];
      if (!buyerKey || !seatKey || !buyerKey.equals(buyer)) continue;
      out.push({ signature: info.signature, seat: seatKey.toBase58(), blockTime: tx.blockTime ?? null });
    }
  }

  return out;
}
