export const PROGRAM_ID = "2vPTZ9iRydqA3mbkkK6CPXhFuTBdVc8s3otKmfcABiVK";

export const DEVNET_RPC =
  (import.meta.env.VITE_DEVNET_RPC as string | undefined) || "https://api.devnet.solana.com";

export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const ASSOCIATED_TOKEN_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

export const SEEDS = {
  jurisdiction: "jurisdiction",
  event: "event",
  seatTier: "seat_tier",
  seat: "seat",
  ticketMint: "ticket_mint",
  bidQueue: "bid_queue",
  bidQueueVault: "bid_queue_vault",
} as const;

export const MAX_QUEUE_LEN = 20;

export const PAYMENT_DECIMALS = 6;

export const JURISDICTION_CODE = "KR";
export const JURISDICTION_LEGAL_CAP_BPS = 2000; // 20% legal resale cap

export const DEMO_STORAGE_PREFIX = "doorman:";
