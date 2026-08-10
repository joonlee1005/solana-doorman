use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenAccount;

use crate::error::TicketError;
use crate::state::{Event, Seat, SeatStatus, SeatTier};

#[derive(Accounts)]
pub struct CheckIn<'info> {
    pub staff: Signer<'info>,

    #[account(constraint = event.organizer == staff.key() @ TicketError::Unauthorized)]
    pub event: Account<'info, Event>,

    #[account(address = seat.seat_tier)]
    pub seat_tier: Account<'info, SeatTier>,

    #[account(
        mut,
        constraint = seat_tier.event == event.key() @ TicketError::Unauthorized,
        constraint = seat.status == SeatStatus::Sold @ TicketError::InvalidSeatStatus,
    )]
    pub seat: Account<'info, Seat>,

    #[account(address = seat.token_account)]
    pub ticket_token_account: InterfaceAccount<'info, TokenAccount>,
}

pub(crate) fn handler(ctx: Context<CheckIn>) -> Result<()> {
    require!(
        ctx.accounts.ticket_token_account.amount == 1,
        TicketError::InvalidSeatStatus
    );

    ctx.accounts.seat.status = SeatStatus::CheckedIn;

    Ok(())
}
