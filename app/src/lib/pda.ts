import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, SEEDS } from "./constants";

const programId = new PublicKey(PROGRAM_ID);

export function jurisdictionPda(code: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.jurisdiction), Buffer.from(code)],
    programId,
  );
}

export function eventPda(organizer: PublicKey, eventId: bigint): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(eventId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.event), organizer.toBuffer(), buf],
    programId,
  );
}

export function seatTierPda(event: PublicKey, tierName: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.seatTier), event.toBuffer(), Buffer.from(tierName)],
    programId,
  );
}

export function ticketMintPda(seatTier: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.ticketMint), seatTier.toBuffer()],
    programId,
  );
}

export function bidQueuePda(seatTier: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.bidQueue), seatTier.toBuffer()],
    programId,
  );
}

export function bidQueueVaultPda(seatTier: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.bidQueueVault), seatTier.toBuffer()],
    programId,
  );
}

export function seatPda(
  event: PublicKey,
  seatTier: PublicKey,
  seatCode: string,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.seat), event.toBuffer(), seatTier.toBuffer(), Buffer.from(seatCode)],
    programId,
  );
}
