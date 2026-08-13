use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{
    self, FreezeAccount, Mint, ThawAccount, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::*;
use crate::error::TicketError;
use crate::state::{Bid, BidQueue, ResalePolicy, Seat, SeatStatus, SeatTier};

#[derive(Accounts)]
pub struct ExecuteResale<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    /// CHECK: identity checked against bid_queue.bids[0].buyer in the handler.
    pub buyer: UncheckedAccount<'info>,

    pub seat_tier: Box<Account<'info, SeatTier>>,

    #[account(
        mut,
        constraint = seat.seat_tier == seat_tier.key() @ TicketError::Unauthorized,
        constraint = seat.owner == seller.key() @ TicketError::Unauthorized,
        constraint = seat.status == SeatStatus::Sold @ TicketError::InvalidSeatStatus,
    )]
    pub seat: Box<Account<'info, Seat>>,

    #[account(
        mut,
        seeds = [BID_QUEUE_SEED, seat_tier.key().as_ref()],
        bump = bid_queue.bump,
    )]
    pub bid_queue: Box<Account<'info, BidQueue>>,

    #[account(mut, address = bid_queue.vault)]
    pub bid_queue_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(address = seat_tier.ticket_mint)]
    pub ticket_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(address = seat_tier.payment_mint)]
    pub payment_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut, address = seat.token_account)]
    pub seller_ticket_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = seller,
        associated_token::mint = ticket_mint,
        associated_token::authority = buyer,
        associated_token::token_program = ticket_token_program,
    )]
    pub buyer_ticket_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = seller,
        associated_token::token_program = payment_token_program,
    )]
    pub seller_payment_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub ticket_token_program: Program<'info, Token2022>,
    pub payment_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<ExecuteResale>) -> Result<()> {
    let bid_queue = &ctx.accounts.bid_queue;
    require!(bid_queue.count > 0, TicketError::QueueEmpty);

    let front: Bid = bid_queue.bids[0];
    require!(
        front.buyer == ctx.accounts.buyer.key(),
        TicketError::QueueFrontMismatch
    );

    let seat_tier = &ctx.accounts.seat_tier;
    // cap = face_value + up to max_bps% markup over face_value (see join_queue.rs).
    let cap = match seat_tier.resale_policy {
        ResalePolicy::NonTransferable => None,
        ResalePolicy::Unrestricted => Some(u64::MAX),
        ResalePolicy::Capped { max_bps } => Some(
            (seat_tier.face_value as u128 * (10_000 + max_bps as u128) / 10_000) as u64,
        ),
    };
    let cap = cap.ok_or(TicketError::ResalePriceExceedsCap)?;
    require!(front.amount <= cap, TicketError::ResalePriceExceedsCap);

    let seat_tier_signer_seeds: &[&[u8]] = &[
        SEAT_TIER_SEED,
        seat_tier.event.as_ref(),
        seat_tier.tier_name.as_bytes(),
        &[seat_tier.bump],
    ];
    let seat_tier_key = seat_tier.key();
    let bid_queue_bump = bid_queue.bump;
    let vault_signer_seeds: &[&[u8]] =
        &[BID_QUEUE_SEED, seat_tier_key.as_ref(), &[bid_queue_bump]];

    // 1. Thaw both the seller's ticket and the (possibly freshly-created, and thus
    // Frozen-by-default) buyer ticket account so the transfer below can move funds.
    token_interface::thaw_account(CpiContext::new_with_signer(
        ctx.accounts.ticket_token_program.key(),
        ThawAccount {
            account: ctx.accounts.seller_ticket_ata.to_account_info(),
            mint: ctx.accounts.ticket_mint.to_account_info(),
            authority: ctx.accounts.seat_tier.to_account_info(),
        },
        &[seat_tier_signer_seeds],
    ))?;
    token_interface::thaw_account(CpiContext::new_with_signer(
        ctx.accounts.ticket_token_program.key(),
        ThawAccount {
            account: ctx.accounts.buyer_ticket_ata.to_account_info(),
            mint: ctx.accounts.ticket_mint.to_account_info(),
            authority: ctx.accounts.seat_tier.to_account_info(),
        },
        &[seat_tier_signer_seeds],
    ))?;

    // 2. Pay the seller out of the escrowed bid.
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.payment_token_program.key(),
            TransferChecked {
                from: ctx.accounts.bid_queue_vault.to_account_info(),
                mint: ctx.accounts.payment_mint.to_account_info(),
                to: ctx.accounts.seller_payment_ata.to_account_info(),
                authority: ctx.accounts.bid_queue.to_account_info(),
            },
            &[vault_signer_seeds],
        ),
        front.amount,
        ctx.accounts.payment_mint.decimals,
    )?;

    // 3. Move the ticket itself, seller -> queue front buyer.
    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.ticket_token_program.key(),
            TransferChecked {
                from: ctx.accounts.seller_ticket_ata.to_account_info(),
                mint: ctx.accounts.ticket_mint.to_account_info(),
                to: ctx.accounts.buyer_ticket_ata.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        1,
        0,
    )?;

    // 4. Re-freeze both accounts: tickets always rest Frozen.
    token_interface::freeze_account(CpiContext::new_with_signer(
        ctx.accounts.ticket_token_program.key(),
        FreezeAccount {
            account: ctx.accounts.seller_ticket_ata.to_account_info(),
            mint: ctx.accounts.ticket_mint.to_account_info(),
            authority: ctx.accounts.seat_tier.to_account_info(),
        },
        &[seat_tier_signer_seeds],
    ))?;
    token_interface::freeze_account(CpiContext::new_with_signer(
        ctx.accounts.ticket_token_program.key(),
        FreezeAccount {
            account: ctx.accounts.buyer_ticket_ata.to_account_info(),
            mint: ctx.accounts.ticket_mint.to_account_info(),
            authority: ctx.accounts.seat_tier.to_account_info(),
        },
        &[seat_tier_signer_seeds],
    ))?;

    let seat = &mut ctx.accounts.seat;
    seat.token_account = ctx.accounts.buyer_ticket_ata.key();
    seat.owner = ctx.accounts.buyer.key();

    let bid_queue = &mut ctx.accounts.bid_queue;
    let count = bid_queue.count as usize;
    for i in 0..count - 1 {
        bid_queue.bids[i] = bid_queue.bids[i + 1];
    }
    bid_queue.bids[count - 1] = Bid::default();
    bid_queue.count -= 1;

    Ok(())
}
