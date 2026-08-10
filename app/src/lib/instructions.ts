import { PublicKey, type Signer } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { Program } from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import type { TicketingSystem } from "../idl/ticketing_system";
import { bidQueueVaultPda, eventPda, seatPda, seatTierPda, ticketMintPda } from "./pda";
import { TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID as ATA_ID } from "./constants";
import type { ResalePolicy } from "./types";

const TOKEN_2022 = new PublicKey(TOKEN_2022_PROGRAM_ID);
const ATA_PROGRAM = new PublicKey(ATA_ID);

function ata(mint: PublicKey, owner: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022, ATA_PROGRAM);
}

type AnyProgram = Program<TicketingSystem>;

// Note: accounts derivable from PDA seeds (event, seatTier, seat, ticketMint,
// bidQueue, the *Ata accounts) or with a fixed IDL `address` (system_program,
// rent, ticket_token_program, associated_token_program) are auto-resolved by
// Anchor's client and must NOT be passed to `.accounts()` explicitly — doing
// so is a TS excess-property error against the generated IDL types.

export async function createJurisdictionRegistry(
  program: AnyProgram,
  authority: Signer,
  code: string,
  legalCapBps: number,
): Promise<string> {
  return program.methods
    .createJurisdictionRegistry(code, legalCapBps)
    .accounts({
      authority: authority.publicKey,
    })
    .signers([authority])
    .rpc();
}

export async function createEvent(
  program: AnyProgram,
  organizer: Signer,
  eventId: bigint,
  jurisdictionRegistry: PublicKey,
  refundDeadline: bigint,
  refundBps: number,
): Promise<{ signature: string; event: PublicKey }> {
  const [event] = eventPda(organizer.publicKey, eventId);
  const signature = await program.methods
    .createEvent(
      new BN(eventId.toString()),
      jurisdictionRegistry,
      new BN(refundDeadline.toString()),
      refundBps,
    )
    .accounts({
      organizer: organizer.publicKey,
    })
    .signers([organizer])
    .rpc();
  return { signature, event };
}

export async function createSeatTier(
  program: AnyProgram,
  organizer: Signer,
  event: PublicKey,
  jurisdictionRegistry: PublicKey,
  paymentMint: PublicKey,
  tierName: string,
  faceValue: bigint,
  organizerResalePolicy: ResalePolicy,
  totalSeats: number,
): Promise<{ signature: string; seatTier: PublicKey; ticketMint: PublicKey }> {
  const [seatTier] = seatTierPda(event, tierName);
  const [ticketMint] = ticketMintPda(seatTier);

  const signature = await program.methods
    .createSeatTier(tierName, new BN(faceValue.toString()), organizerResalePolicy, totalSeats)
    .accounts({
      organizer: organizer.publicKey,
      event,
      jurisdictionRegistry,
      paymentMint,
      paymentTokenProgram: TOKEN_2022,
    })
    .signers([organizer])
    .rpc();
  return { signature, seatTier, ticketMint };
}

export async function createSeat(
  program: AnyProgram,
  organizer: Signer,
  event: PublicKey,
  seatTier: PublicKey,
  seatCode: string,
  displayName: string,
): Promise<{ signature: string; seat: PublicKey }> {
  const [seat] = seatPda(event, seatTier, seatCode);
  const signature = await program.methods
    .createSeat(seatCode, displayName)
    .accounts({
      organizer: organizer.publicKey,
      event,
      seatTier,
    })
    .signers([organizer])
    .rpc();
  return { signature, seat };
}

export async function buySeat(
  program: AnyProgram,
  customer: Signer,
  event: PublicKey,
  organizer: PublicKey,
  seatTier: PublicKey,
  seat: PublicKey,
  ticketMint: PublicKey,
  paymentMint: PublicKey,
): Promise<string> {
  return program.methods
    .buySeat()
    .accounts({
      customer: customer.publicKey,
      event,
      organizer,
      seatTier,
      seat,
      ticketMint,
      paymentMint,
      paymentTokenProgram: TOKEN_2022,
    })
    .signers([customer])
    .rpc();
}

export async function joinQueue(
  program: AnyProgram,
  buyer: Signer,
  seatTier: PublicKey,
  paymentMint: PublicKey,
  amountBaseUnits: bigint,
): Promise<string> {
  const [bidQueueVault] = bidQueueVaultPda(seatTier);

  return program.methods
    .joinQueue(new BN(amountBaseUnits.toString()))
    .accounts({
      buyer: buyer.publicKey,
      seatTier,
      bidQueueVault,
      paymentMint,
      paymentTokenProgram: TOKEN_2022,
    })
    .signers([buyer])
    .rpc();
}

export async function leaveQueue(
  program: AnyProgram,
  buyer: Signer,
  seatTier: PublicKey,
  paymentMint: PublicKey,
): Promise<string> {
  const [bidQueueVault] = bidQueueVaultPda(seatTier);

  return program.methods
    .leaveQueue()
    .accounts({
      buyer: buyer.publicKey,
      seatTier,
      bidQueueVault,
      paymentMint,
      paymentTokenProgram: TOKEN_2022,
    })
    .signers([buyer])
    .rpc();
}

export async function executeResale(
  program: AnyProgram,
  seller: Signer,
  buyer: PublicKey,
  seatTier: PublicKey,
  seat: PublicKey,
  ticketMint: PublicKey,
  paymentMint: PublicKey,
): Promise<string> {
  const [bidQueueVault] = bidQueueVaultPda(seatTier);
  const sellerTicketAta = ata(ticketMint, seller.publicKey);

  return program.methods
    .executeResale()
    .accounts({
      seller: seller.publicKey,
      buyer,
      seatTier,
      seat,
      bidQueueVault,
      ticketMint,
      paymentMint,
      sellerTicketAta,
      paymentTokenProgram: TOKEN_2022,
    })
    .signers([seller])
    .rpc();
}

export async function refundTicket(
  program: AnyProgram,
  organizer: Signer,
  event: PublicKey,
  seatTier: PublicKey,
  seat: PublicKey,
  paymentMint: PublicKey,
  customer: PublicKey,
): Promise<string> {
  return program.methods
    .refundTicket()
    .accounts({
      organizer: organizer.publicKey,
      event,
      seatTier,
      seat,
      paymentMint,
      customer,
      paymentTokenProgram: TOKEN_2022,
    })
    .signers([organizer])
    .rpc();
}

export async function checkIn(
  program: AnyProgram,
  staff: Signer,
  event: PublicKey,
  seatTier: PublicKey,
  seat: PublicKey,
  ticketTokenAccount: PublicKey,
): Promise<string> {
  return program.methods
    .checkIn()
    .accounts({
      staff: staff.publicKey,
      event,
      seatTier,
      seat,
      ticketTokenAccount,
    })
    .signers([staff])
    .rpc();
}
