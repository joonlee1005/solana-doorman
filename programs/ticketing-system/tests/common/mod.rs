#![allow(dead_code)]

use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_lang::{InstructionData, ToAccountMetas};
use anchor_spl::associated_token::spl_associated_token_account;
use anchor_spl::token_2022::spl_token_2022;
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_message::{Message, VersionedMessage};
use solana_signer::Signer;
use solana_transaction::versioned::VersionedTransaction;

use ticketing_system::{accounts as tkt_accounts, instruction as tkt_ix, ResalePolicy};

pub const PROGRAM_ID: Pubkey = ticketing_system::ID;

pub fn setup() -> (LiteSVM, Keypair) {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../../target/deploy/ticketing_system.so");
    svm.add_program(PROGRAM_ID, bytes).unwrap();

    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 1_000_000_000_000).unwrap();
    (svm, payer)
}

pub fn fund(svm: &mut LiteSVM, who: &Pubkey) {
    svm.airdrop(who, 1_000_000_000_000).unwrap();
}

pub fn send(
    svm: &mut LiteSVM,
    payer: &Keypair,
    ixs: &[Instruction],
    extra_signers: &[&Keypair],
) -> std::result::Result<litesvm::types::TransactionMetadata, litesvm::types::FailedTransactionMetadata>
{
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &blockhash);
    let mut signers: Vec<&Keypair> = vec![payer];
    for s in extra_signers {
        if !signers.iter().any(|existing| existing.pubkey() == s.pubkey()) {
            signers.push(s);
        }
    }
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &signers).unwrap();
    svm.send_transaction(tx)
}

// ---------- PDA derivation ----------

pub fn jurisdiction_pda(code: &str) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[ticketing_system::JURISDICTION_SEED, code.as_bytes()],
        &PROGRAM_ID,
    )
}

pub fn event_pda(organizer: &Pubkey, event_id: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            ticketing_system::EVENT_SEED,
            organizer.as_ref(),
            &event_id.to_le_bytes(),
        ],
        &PROGRAM_ID,
    )
}

pub fn seat_tier_pda(event: &Pubkey, tier_name: &str) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            ticketing_system::SEAT_TIER_SEED,
            event.as_ref(),
            tier_name.as_bytes(),
        ],
        &PROGRAM_ID,
    )
}

pub fn ticket_mint_pda(seat_tier: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[ticketing_system::TICKET_MINT_SEED, seat_tier.as_ref()],
        &PROGRAM_ID,
    )
}

pub fn bid_queue_pda(seat_tier: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[ticketing_system::BID_QUEUE_SEED, seat_tier.as_ref()],
        &PROGRAM_ID,
    )
}

pub fn bid_queue_vault_pda(seat_tier: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[ticketing_system::BID_QUEUE_VAULT_SEED, seat_tier.as_ref()],
        &PROGRAM_ID,
    )
}

pub fn seat_pda(event: &Pubkey, seat_tier: &Pubkey, seat_code: &str) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            ticketing_system::SEAT_SEED,
            event.as_ref(),
            seat_tier.as_ref(),
            seat_code.as_bytes(),
        ],
        &PROGRAM_ID,
    )
}

pub fn ata(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    spl_associated_token_account::address::get_associated_token_address_with_program_id(
        owner,
        mint,
        &spl_token_2022::ID,
    )
}

// ---------- Token-2022 payment ("USDC") mint setup ----------

pub fn create_payment_mint(
    svm: &mut LiteSVM,
    payer: &Keypair,
    mint_kp: &Keypair,
    mint_authority: &Pubkey,
    decimals: u8,
) {
    let space = spl_token_2022::state::Mint::LEN;
    let lamports = svm.minimum_balance_for_rent_exemption(space);

    let create_ix = anchor_lang::solana_program::system_instruction::create_account(
        &payer.pubkey(),
        &mint_kp.pubkey(),
        lamports,
        space as u64,
        &spl_token_2022::ID,
    );
    let init_ix = spl_token_2022::instruction::initialize_mint2(
        &spl_token_2022::ID,
        &mint_kp.pubkey(),
        mint_authority,
        None,
        decimals,
    )
    .unwrap();

    send(svm, payer, &[create_ix, init_ix], &[mint_kp]).unwrap();
}

pub fn create_ata(svm: &mut LiteSVM, payer: &Keypair, owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    let ix = spl_associated_token_account::instruction::create_associated_token_account(
        &payer.pubkey(),
        owner,
        mint,
        &spl_token_2022::ID,
    );
    send(svm, payer, &[ix], &[]).unwrap();
    ata(owner, mint)
}

pub fn mint_payment_to(
    svm: &mut LiteSVM,
    payer: &Keypair,
    mint: &Pubkey,
    mint_authority: &Keypair,
    dest_ata: &Pubkey,
    amount: u64,
) {
    let ix = spl_token_2022::instruction::mint_to(
        &spl_token_2022::ID,
        mint,
        dest_ata,
        &mint_authority.pubkey(),
        &[],
        amount,
    )
    .unwrap();
    send(svm, payer, &[ix], &[mint_authority]).unwrap();
}

pub fn read_token_account(svm: &LiteSVM, address: &Pubkey) -> spl_token_2022::state::Account {
    let raw = svm.get_account(address).expect("token account not found");
    spl_token_2022::extension::StateWithExtensions::<spl_token_2022::state::Account>::unpack(
        &raw.data,
    )
    .unwrap()
    .base
}

// ---------- Instruction builders for our program ----------

pub fn ix_create_jurisdiction_registry(
    authority: &Pubkey,
    jurisdiction_code: &str,
    legal_cap_bps: u16,
) -> Instruction {
    let (jurisdiction_registry, _) = jurisdiction_pda(jurisdiction_code);
    Instruction {
        program_id: PROGRAM_ID,
        accounts: tkt_accounts::CreateJurisdictionRegistry {
            authority: *authority,
            jurisdiction_registry,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
        data: tkt_ix::CreateJurisdictionRegistry {
            jurisdiction_code: jurisdiction_code.to_string(),
            legal_cap_bps,
        }
        .data(),
    }
}

pub fn ix_create_event(
    organizer: &Pubkey,
    event_id: u64,
    jurisdiction_registry: Pubkey,
    refund_deadline: i64,
    refund_bps: u16,
) -> Instruction {
    let (event, _) = event_pda(organizer, event_id);
    Instruction {
        program_id: PROGRAM_ID,
        accounts: tkt_accounts::CreateEvent {
            organizer: *organizer,
            event,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
        data: tkt_ix::CreateEvent {
            event_id,
            jurisdiction_registry,
            refund_deadline,
            refund_bps,
        }
        .data(),
    }
}

pub struct SeatTierAddrs {
    pub seat_tier: Pubkey,
    pub ticket_mint: Pubkey,
    pub bid_queue: Pubkey,
    pub bid_queue_vault: Pubkey,
}

pub fn ix_create_seat_tier(
    organizer: &Pubkey,
    event: &Pubkey,
    jurisdiction_registry: &Pubkey,
    payment_mint: &Pubkey,
    tier_name: &str,
    face_value: u64,
    organizer_resale_policy: ResalePolicy,
    total_seats: u32,
) -> (Instruction, SeatTierAddrs) {
    let (seat_tier, _) = seat_tier_pda(event, tier_name);
    let (ticket_mint, _) = ticket_mint_pda(&seat_tier);
    let (bid_queue, _) = bid_queue_pda(&seat_tier);
    let (bid_queue_vault, _) = bid_queue_vault_pda(&seat_tier);

    let ix = Instruction {
        program_id: PROGRAM_ID,
        accounts: tkt_accounts::CreateSeatTier {
            organizer: *organizer,
            event: *event,
            jurisdiction_registry: *jurisdiction_registry,
            seat_tier,
            ticket_mint,
            payment_mint: *payment_mint,
            bid_queue,
            bid_queue_vault,
            ticket_token_program: spl_token_2022::ID,
            payment_token_program: spl_token_2022::ID,
            system_program: anchor_lang::system_program::ID,
            rent: anchor_lang::solana_program::rent::ID,
        }
        .to_account_metas(None),
        data: tkt_ix::CreateSeatTier {
            tier_name: tier_name.to_string(),
            face_value,
            organizer_resale_policy,
            total_seats,
        }
        .data(),
    };
    (
        ix,
        SeatTierAddrs {
            seat_tier,
            ticket_mint,
            bid_queue,
            bid_queue_vault,
        },
    )
}

pub fn ix_create_seat(
    organizer: &Pubkey,
    event: &Pubkey,
    seat_tier: &Pubkey,
    seat_code: &str,
    display_name: &str,
) -> (Instruction, Pubkey) {
    let (seat, _) = seat_pda(event, seat_tier, seat_code);
    let ix = Instruction {
        program_id: PROGRAM_ID,
        accounts: tkt_accounts::CreateSeat {
            organizer: *organizer,
            event: *event,
            seat_tier: *seat_tier,
            seat,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
        data: tkt_ix::CreateSeat {
            seat_code: seat_code.to_string(),
            display_name: display_name.to_string(),
        }
        .data(),
    };
    (ix, seat)
}

pub struct BuySeatAddrs {
    pub customer_ticket_ata: Pubkey,
    pub organizer_payment_ata: Pubkey,
}

pub fn ix_buy_seat(
    customer: &Pubkey,
    event: &Pubkey,
    organizer: &Pubkey,
    seat_tier: &Pubkey,
    seat: &Pubkey,
    ticket_mint: &Pubkey,
    payment_mint: &Pubkey,
    customer_payment_ata: &Pubkey,
) -> (Instruction, BuySeatAddrs) {
    let customer_ticket_ata = ata(customer, ticket_mint);
    let organizer_payment_ata = ata(organizer, payment_mint);

    let ix = Instruction {
        program_id: PROGRAM_ID,
        accounts: tkt_accounts::BuySeat {
            customer: *customer,
            event: *event,
            organizer: *organizer,
            seat_tier: *seat_tier,
            seat: *seat,
            ticket_mint: *ticket_mint,
            payment_mint: *payment_mint,
            customer_ticket_ata,
            customer_payment_ata: *customer_payment_ata,
            organizer_payment_ata,
            ticket_token_program: spl_token_2022::ID,
            payment_token_program: spl_token_2022::ID,
            associated_token_program: spl_associated_token_account::program::ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
        data: tkt_ix::BuySeat {}.data(),
    };
    (
        ix,
        BuySeatAddrs {
            customer_ticket_ata,
            organizer_payment_ata,
        },
    )
}

pub fn ix_join_queue(
    buyer: &Pubkey,
    seat_tier: &Pubkey,
    bid_queue: &Pubkey,
    bid_queue_vault: &Pubkey,
    payment_mint: &Pubkey,
    buyer_payment_ata: &Pubkey,
    amount: u64,
) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: tkt_accounts::JoinQueue {
            buyer: *buyer,
            seat_tier: *seat_tier,
            bid_queue: *bid_queue,
            bid_queue_vault: *bid_queue_vault,
            payment_mint: *payment_mint,
            buyer_payment_ata: *buyer_payment_ata,
            payment_token_program: spl_token_2022::ID,
        }
        .to_account_metas(None),
        data: tkt_ix::JoinQueue { amount }.data(),
    }
}

pub fn ix_leave_queue(
    buyer: &Pubkey,
    seat_tier: &Pubkey,
    bid_queue: &Pubkey,
    bid_queue_vault: &Pubkey,
    payment_mint: &Pubkey,
    buyer_payment_ata: &Pubkey,
) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: tkt_accounts::LeaveQueue {
            buyer: *buyer,
            seat_tier: *seat_tier,
            bid_queue: *bid_queue,
            bid_queue_vault: *bid_queue_vault,
            payment_mint: *payment_mint,
            buyer_payment_ata: *buyer_payment_ata,
            payment_token_program: spl_token_2022::ID,
        }
        .to_account_metas(None),
        data: tkt_ix::LeaveQueue {}.data(),
    }
}

pub struct ExecuteResaleAddrs {
    pub buyer_ticket_ata: Pubkey,
    pub seller_payment_ata: Pubkey,
}

pub fn ix_execute_resale(
    seller: &Pubkey,
    buyer: &Pubkey,
    seat_tier: &Pubkey,
    seat: &Pubkey,
    bid_queue: &Pubkey,
    bid_queue_vault: &Pubkey,
    ticket_mint: &Pubkey,
    payment_mint: &Pubkey,
    seller_ticket_ata: &Pubkey,
) -> (Instruction, ExecuteResaleAddrs) {
    let buyer_ticket_ata = ata(buyer, ticket_mint);
    let seller_payment_ata = ata(seller, payment_mint);

    let ix = Instruction {
        program_id: PROGRAM_ID,
        accounts: tkt_accounts::ExecuteResale {
            seller: *seller,
            buyer: *buyer,
            seat_tier: *seat_tier,
            seat: *seat,
            bid_queue: *bid_queue,
            bid_queue_vault: *bid_queue_vault,
            ticket_mint: *ticket_mint,
            payment_mint: *payment_mint,
            seller_ticket_ata: *seller_ticket_ata,
            buyer_ticket_ata,
            seller_payment_ata,
            ticket_token_program: spl_token_2022::ID,
            payment_token_program: spl_token_2022::ID,
            associated_token_program: spl_associated_token_account::program::ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
        data: tkt_ix::ExecuteResale {}.data(),
    };
    (
        ix,
        ExecuteResaleAddrs {
            buyer_ticket_ata,
            seller_payment_ata,
        },
    )
}

pub fn ix_refund_ticket(
    organizer: &Pubkey,
    event: &Pubkey,
    seat_tier: &Pubkey,
    seat: &Pubkey,
    payment_mint: &Pubkey,
    customer: &Pubkey,
    organizer_payment_ata: &Pubkey,
    customer_payment_ata: &Pubkey,
) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: tkt_accounts::RefundTicket {
            organizer: *organizer,
            event: *event,
            seat_tier: *seat_tier,
            seat: *seat,
            payment_mint: *payment_mint,
            customer: *customer,
            organizer_payment_ata: *organizer_payment_ata,
            customer_payment_ata: *customer_payment_ata,
            payment_token_program: spl_token_2022::ID,
        }
        .to_account_metas(None),
        data: tkt_ix::RefundTicket {}.data(),
    }
}

pub fn ix_check_in(
    staff: &Pubkey,
    event: &Pubkey,
    seat_tier: &Pubkey,
    seat: &Pubkey,
    ticket_token_account: &Pubkey,
) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts: tkt_accounts::CheckIn {
            staff: *staff,
            event: *event,
            seat_tier: *seat_tier,
            seat: *seat,
            ticket_token_account: *ticket_token_account,
        }
        .to_account_metas(None),
        data: tkt_ix::CheckIn {}.data(),
    }
}

pub use anchor_lang::solana_program::instruction::Instruction;
