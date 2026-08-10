use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::TicketError;
use crate::state::{Event, Seat, SeatStatus, SeatTier};

#[derive(Accounts)]
#[instruction(seat_code: String)]
pub struct CreateSeat<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,

    #[account(
        constraint = event.organizer == organizer.key() @ TicketError::Unauthorized
    )]
    pub event: Account<'info, Event>,

    #[account(constraint = seat_tier.event == event.key() @ TicketError::Unauthorized)]
    pub seat_tier: Account<'info, SeatTier>,

    #[account(
        init,
        payer = organizer,
        space = Seat::SPACE,
        seeds = [SEAT_SEED, event.key().as_ref(), seat_tier.key().as_ref(), seat_code.as_bytes()],
        bump
    )]
    pub seat: Account<'info, Seat>,

    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(
    ctx: Context<CreateSeat>,
    seat_code: String,
    display_name: String,
) -> Result<()> {
    require!(
        seat_code.len() <= MAX_SEAT_CODE_LEN,
        TicketError::SeatCodeTooLong
    );
    require!(
        display_name.len() <= MAX_DISPLAY_NAME_LEN,
        TicketError::DisplayNameTooLong
    );

    let seat = &mut ctx.accounts.seat;
    seat.seat_tier = ctx.accounts.seat_tier.key();
    seat.seat_code = seat_code;
    seat.display_name = display_name;
    seat.token_account = Pubkey::default();
    seat.owner = Pubkey::default();
    seat.status = SeatStatus::Available;
    seat.bump = ctx.bumps.seat;

    Ok(())
}
