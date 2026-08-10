import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import type { PublicKey } from "@solana/web3.js";
import idl from "../idl/ticketing_system.json";
import type { TicketingSystem } from "../idl/ticketing_system";
import { DEVNET_RPC } from "./constants";

export const connection = new Connection(DEVNET_RPC, "confirmed");

// Structural match for @coral-xyz/anchor's internal `Wallet` interface. The
// package's concrete `Wallet` class is Node-only (relies on fs) and isn't
// exported from its browser bundle, so we implement the interface ourselves
// against a locally-held demo Keypair (no real wallet extension here).
interface DemoWallet {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}

function keypairWallet(keypair: Keypair): DemoWallet {
  return {
    publicKey: keypair.publicKey,
    async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
      if (tx instanceof VersionedTransaction) {
        tx.sign([keypair]);
      } else {
        tx.partialSign(keypair);
      }
      return tx;
    },
    async signAllTransactions<T extends Transaction | VersionedTransaction>(
      txs: T[],
    ): Promise<T[]> {
      for (const tx of txs) {
        if (tx instanceof VersionedTransaction) {
          tx.sign([keypair]);
        } else {
          tx.partialSign(keypair);
        }
      }
      return txs;
    },
  };
}

export function getProgram(signer: Keypair): Program<TicketingSystem> {
  const provider = new AnchorProvider(connection, keypairWallet(signer), {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  return new Program<TicketingSystem>(idl as TicketingSystem, provider);
}
