use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::constants::*;
use crate::error::TicketError;
use crate::state::{Bid, BidQueue, SeatTier};

#[derive(Accounts)]
pub struct LeaveQueue<'info> {
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

pub(crate) fn handler(ctx: Context<LeaveQueue>) -> Result<()> {
    let seat_tier_key = ctx.accounts.seat_tier.key();
    let bid_queue = &mut ctx.accounts.bid_queue;
    let count = bid_queue.count as usize;

    let idx = (0..count)
        .find(|&i| bid_queue.bids[i].buyer == ctx.accounts.buyer.key())
        .ok_or(TicketError::NotInQueue)?;

    let refund_amount = bid_queue.bids[idx].amount;
    let bump = bid_queue.bump;
    let vault_signer_seeds: &[&[u8]] = &[BID_QUEUE_SEED, seat_tier_key.as_ref(), &[bump]];

    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.payment_token_program.key(),
            TransferChecked {
                from: ctx.accounts.bid_queue_vault.to_account_info(),
                mint: ctx.accounts.payment_mint.to_account_info(),
                to: ctx.accounts.buyer_payment_ata.to_account_info(),
                authority: bid_queue.to_account_info(),
            },
            &[vault_signer_seeds],
        ),
        refund_amount,
        ctx.accounts.payment_mint.decimals,
    )?;

    let bid_queue = &mut ctx.accounts.bid_queue;
    for i in idx..count - 1 {
        bid_queue.bids[i] = bid_queue.bids[i + 1];
    }
    bid_queue.bids[count - 1] = Bid::default();
    bid_queue.count -= 1;

    Ok(())
}
