use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{
    self, default_account_state_initialize, spl_token_2022::extension::ExtensionType,
    spl_token_2022::state::AccountState, DefaultAccountStateInitialize, Mint, TokenAccount,
    TokenInterface,
};

use crate::constants::*;
use crate::error::TicketError;
use crate::state::{BidQueue, ResalePolicy, SeatTier};
use crate::JurisdictionRegistry;

#[derive(Accounts)]
#[instruction(tier_name: String)]
pub struct CreateSeatTier<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,

    #[account(
        constraint = event.organizer == organizer.key() @ TicketError::Unauthorized
    )]
    pub event: Box<Account<'info, crate::state::Event>>,

    #[account(address = event.jurisdiction_registry)]
    pub jurisdiction_registry: Box<Account<'info, JurisdictionRegistry>>,

    #[account(
        init,
        payer = organizer,
        space = SeatTier::SPACE,
        seeds = [SEAT_TIER_SEED, event.key().as_ref(), tier_name.as_bytes()],
        bump
    )]
    pub seat_tier: Box<Account<'info, SeatTier>>,

    /// CHECK: created manually below via CPI (Token-2022 mint with DefaultAccountState=Frozen
    /// extension, which the declarative `mint::` constraint does not support).
    #[account(
        mut,
        seeds = [TICKET_MINT_SEED, seat_tier.key().as_ref()],
        bump
    )]
    pub ticket_mint: UncheckedAccount<'info>,

    pub payment_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = organizer,
        space = BidQueue::SPACE,
        seeds = [BID_QUEUE_SEED, seat_tier.key().as_ref()],
        bump
    )]
    pub bid_queue: Box<Account<'info, BidQueue>>,

    #[account(
        init,
        payer = organizer,
        seeds = [BID_QUEUE_VAULT_SEED, seat_tier.key().as_ref()],
        bump,
        token::mint = payment_mint,
        token::authority = bid_queue,
        token::token_program = payment_token_program,
    )]
    pub bid_queue_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub ticket_token_program: Program<'info, Token2022>,
    pub payment_token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub(crate) fn handler(
    ctx: Context<CreateSeatTier>,
    tier_name: String,
    face_value: u64,
    organizer_resale_policy: ResalePolicy,
    total_seats: u32,
) -> Result<()> {
    require!(
        tier_name.len() <= MAX_TIER_NAME_LEN,
        TicketError::TierNameTooLong
    );
    if let ResalePolicy::Capped { max_bps } = organizer_resale_policy {
        require!(max_bps <= 10_000, TicketError::InvalidMaxBps);
    }

    let legal_cap = ResalePolicy::Capped {
        max_bps: ctx.accounts.jurisdiction_registry.legal_cap_bps,
    };
    let resale_policy = ResalePolicy::more_restrictive(organizer_resale_policy, legal_cap);

    // --- Manually create the Token-2022 ticket mint with the DefaultAccountState
    // extension (must be initialized before InitializeMint2). Anchor's declarative
    // `mint::` / `extensions::` constraints don't support this extension in this
    // anchor-spl version, so we build the account and CPI calls by hand.
    let extensions = vec![ExtensionType::DefaultAccountState];
    let mint_space = token_interface::spl_token_2022::extension::ExtensionType::try_calculate_account_len::<
        token_interface::spl_token_2022::state::Mint,
    >(&extensions)?;
    let lamports = ctx.accounts.rent.minimum_balance(mint_space);

    let seat_tier_key = ctx.accounts.seat_tier.key();
    let mint_bump = ctx.bumps.ticket_mint;
    let mint_seeds: &[&[u8]] = &[TICKET_MINT_SEED, seat_tier_key.as_ref(), &[mint_bump]];

    system_program::create_account(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.key(),
            system_program::CreateAccount {
                from: ctx.accounts.organizer.to_account_info(),
                to: ctx.accounts.ticket_mint.to_account_info(),
            },
            &[mint_seeds],
        ),
        lamports,
        mint_space as u64,
        &ctx.accounts.ticket_token_program.key(),
    )?;

    default_account_state_initialize(
        CpiContext::new(
            ctx.accounts.ticket_token_program.key(),
            DefaultAccountStateInitialize {
                token_program_id: ctx.accounts.ticket_token_program.to_account_info(),
                mint: ctx.accounts.ticket_mint.to_account_info(),
            },
        ),
        &AccountState::Frozen,
    )?;

    token_interface::initialize_mint2(
        CpiContext::new(
            ctx.accounts.ticket_token_program.key(),
            token_interface::InitializeMint2 {
                mint: ctx.accounts.ticket_mint.to_account_info(),
            },
        ),
        0,
        &seat_tier_key,
        Some(&seat_tier_key),
    )?;

    let seat_tier = &mut ctx.accounts.seat_tier;
    seat_tier.event = ctx.accounts.event.key();
    seat_tier.tier_name = tier_name;
    seat_tier.ticket_mint = ctx.accounts.ticket_mint.key();
    seat_tier.payment_mint = ctx.accounts.payment_mint.key();
    seat_tier.face_value = face_value;
    seat_tier.resale_policy = resale_policy;
    seat_tier.total_seats = total_seats;
    seat_tier.bump = ctx.bumps.seat_tier;

    let bid_queue = &mut ctx.accounts.bid_queue;
    bid_queue.seat_tier = seat_tier.key();
    bid_queue.vault = ctx.accounts.bid_queue_vault.key();
    bid_queue.bids = [crate::state::Bid::default(); MAX_QUEUE_LEN];
    bid_queue.count = 0;
    bid_queue.bump = ctx.bumps.bid_queue;

    Ok(())
}
