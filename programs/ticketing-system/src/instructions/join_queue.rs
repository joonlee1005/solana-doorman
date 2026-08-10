use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::constants::*;
use crate::error::TicketError;
use crate::state::{Bid, BidQueue, ResalePolicy, SeatTier};

#[derive(Accounts)]
pub struct JoinQueue<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    pub seat_tier: Box<Account<'info, SeatTier>>,

    #[account(
        mut,
        seeds = [BID_QUEUE_SEED, seat_tier.key().as_ref()],
        bump = bid_queue.bump,
    )]
    pub bid_queue: Box<Account<'info, BidQueue>>,

    #[account(mut, address = bid_queue.vault)]
    pub bid_queue_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(address = seat_tier.payment_mint)]
    pub payment_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = buyer,
        associated_token::token_program = payment_token_program,
    )]
    pub buyer_payment_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub payment_token_program: Interface<'info, TokenInterface>,
}

pub(crate) fn handler(ctx: Context<JoinQueue>, amount: u64) -> Result<()> {
    let seat_tier = &ctx.accounts.seat_tier;
    let cap = match seat_tier.resale_policy {
        ResalePolicy::NonTransferable => None,
        ResalePolicy::Unrestricted => Some(u64::MAX),
        ResalePolicy::Capped { max_bps } => Some(
            (seat_tier.face_value as u128 * max_bps as u128 / 10_000) as u64,
        ),
    };
    let cap = cap.ok_or(TicketError::BidExceedsCap)?;
    require!(amount <= cap, TicketError::BidExceedsCap);

    let bid_queue = &mut ctx.accounts.bid_queue;
    require!(
        (bid_queue.count as usize) < MAX_QUEUE_LEN,
        TicketError::QueueFull
    );

    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.payment_token_program.key(),
            TransferChecked {
                from: ctx.accounts.buyer_payment_ata.to_account_info(),
                mint: ctx.accounts.payment_mint.to_account_info(),
                to: ctx.accounts.bid_queue_vault.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.payment_mint.decimals,
    )?;

    let idx = bid_queue.count as usize;
    bid_queue.bids[idx] = Bid {
        buyer: ctx.accounts.buyer.key(),
        amount,
        joined_at: Clock::get()?.unix_timestamp,
    };
    bid_queue.count += 1;

    Ok(())
}
