use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::error::TicketError;
use crate::state::{Event, Seat, SeatStatus, SeatTier};

// Note: v5 recommends burning the ticket token on refund, but SPL Token's Burn
// instruction requires the token account owner's (the customer's) signature, which
// this organizer-only-signed flow does not have. We invalidate the ticket by flipping
// Seat.status to Refunded instead (the spec explicitly allows this simplification);
// the token itself stays minted but frozen and Seat.status is the source of truth for
// check_in / any future resale gating.
#[derive(Accounts)]
pub struct RefundTicket<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,

    #[account(constraint = event.organizer == organizer.key() @ TicketError::Unauthorized)]
    pub event: Account<'info, Event>,

    #[account(address = seat.seat_tier)]
    pub seat_tier: Account<'info, SeatTier>,

    #[account(
        mut,
        constraint = seat_tier.event == event.key() @ TicketError::Unauthorized,
        constraint = seat.status == SeatStatus::Sold @ TicketError::InvalidSeatStatus,
    )]
    pub seat: Account<'info, Seat>,

    #[account(address = seat_tier.payment_mint)]
    pub payment_mint: InterfaceAccount<'info, Mint>,

    /// CHECK: only used as the destination authority for the customer's payment ATA;
    /// validated against seat.owner.
    #[account(address = seat.owner)]
    pub customer: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = organizer,
        associated_token::token_program = payment_token_program,
    )]
    pub organizer_payment_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = customer,
        associated_token::token_program = payment_token_program,
    )]
    pub customer_payment_ata: InterfaceAccount<'info, TokenAccount>,

    pub payment_token_program: Interface<'info, TokenInterface>,
}

pub(crate) fn handler(ctx: Context<RefundTicket>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(
        now <= ctx.accounts.event.refund_deadline,
        TicketError::RefundDeadlinePassed
    );

    let refund_amount = (ctx.accounts.seat_tier.face_value as u128
        * ctx.accounts.event.refund_bps as u128
        / 10_000) as u64;

    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.payment_token_program.key(),
            TransferChecked {
                from: ctx.accounts.organizer_payment_ata.to_account_info(),
                mint: ctx.accounts.payment_mint.to_account_info(),
                to: ctx.accounts.customer_payment_ata.to_account_info(),
                authority: ctx.accounts.organizer.to_account_info(),
            },
        ),
        refund_amount,
        ctx.accounts.payment_mint.decimals,
    )?;

    ctx.accounts.seat.status = SeatStatus::Refunded;

    Ok(())
}
