use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::TicketError;
use crate::state::Event;

#[derive(Accounts)]
#[instruction(event_id: u64)]
pub struct CreateEvent<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,

    #[account(
        init,
        payer = organizer,
        space = Event::SPACE,
        seeds = [EVENT_SEED, organizer.key().as_ref(), &event_id.to_le_bytes()],
        bump
    )]
    pub event: Account<'info, Event>,

    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(
    ctx: Context<CreateEvent>,
    event_id: u64,
    jurisdiction_registry: Pubkey,
    refund_deadline: i64,
    refund_bps: u16,
) -> Result<()> {
    require!(refund_bps <= 10_000, TicketError::InvalidMaxBps);

    let event = &mut ctx.accounts.event;
    event.organizer = ctx.accounts.organizer.key();
    event.event_id = event_id;
    event.jurisdiction_registry = jurisdiction_registry;
    event.refund_deadline = refund_deadline;
    event.refund_bps = refund_bps;
    event.bump = ctx.bumps.event;

    Ok(())
}
