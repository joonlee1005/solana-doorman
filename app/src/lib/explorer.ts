import type { PublicKey } from "@solana/web3.js";

export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function explorerAddressUrl(address: PublicKey | string): string {
  const s = typeof address === "string" ? address : address.toBase58();
  return `https://explorer.solana.com/address/${s}?cluster=devnet`;
}
