import { PublicKey } from "@solana/web3.js";
import { PAYMENT_DECIMALS } from "./constants";

export function shortAddr(addr: PublicKey | string, chars = 4): string {
  const s = typeof addr === "string" ? addr : addr.toBase58();
  return `${s.slice(0, chars)}…${s.slice(-chars)}`;
}

export function toBaseUnits(amount: string | number, decimals = PAYMENT_DECIMALS): bigint {
  const [whole, frac = ""] = String(amount).split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const wholeDigits = whole.replace(/[^0-9]/g, "") || "0";
  return BigInt(wholeDigits) * BigInt(10 ** decimals) + BigInt(fracPadded || "0");
}

export function toDisplayUnits(amount: bigint | number, decimals = PAYMENT_DECIMALS): string {
  const value = typeof amount === "bigint" ? amount : BigInt(Math.round(amount));
  const divisor = BigInt(10 ** decimals);
  const whole = value / divisor;
  const frac = value % divisor;
  return `${whole}.${frac.toString().padStart(decimals, "0")}`;
}

export function formatUsdc(amount: bigint | number): string {
  return `${toDisplayUnits(amount)} USDC`;
}

export function formatSol(lamports: number): string {
  return `${(lamports / 1_000_000_000).toFixed(3)} SOL`;
}
