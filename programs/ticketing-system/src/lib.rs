pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("2vPTZ9iRydqA3mbkkK6CPXhFuTBdVc8s3otKmfcABiVK");

#[program]
pub mod ticketing_system {
    use super::*;

    pub fn create_jurisdiction_registry(
        ctx: Context<CreateJurisdictionRegistry>,
        jurisdiction_code: String,
        legal_cap_bps: u16,
    ) -> Result<()> {
        create_jurisdiction_registry::handler(ctx, jurisdiction_code, legal_cap_bps)
    }

    pub fn create_event(
        ctx: Context<CreateEvent>,
        event_id: u64,
        jurisdiction_registry: Pubkey,
        refund_deadline: i64,
        refund_bps: u16,
    ) -> Result<()> {
        create_event::handler(ctx, event_id, jurisdiction_registry, refund_deadline, refund_bps)
    }

    pub fn create_seat_tier(
        ctx: Context<CreateSeatTier>,
        tier_name: String,
        face_value: u64,
        organizer_resale_policy: ResalePolicy,
        total_seats: u32,
    ) -> Result<()> {
        create_seat_tier::handler(ctx, tier_name, face_value, organizer_resale_policy, total_seats)
    }

    pub fn create_seat(
        ctx: Context<CreateSeat>,
        seat_code: String,
        display_name: String,
    ) -> Result<()> {
        create_seat::handler(ctx, seat_code, display_name)
    }

    pub fn buy_seat(ctx: Context<BuySeat>) -> Result<()> {
        buy_seat::handler(ctx)
    }

    pub fn join_queue(ctx: Context<JoinQueue>, amount: u64) -> Result<()> {
        join_queue::handler(ctx, amount)
    }

    pub fn leave_queue(ctx: Context<LeaveQueue>) -> Result<()> {
        leave_queue::handler(ctx)
    }

    pub fn execute_resale(ctx: Context<ExecuteResale>) -> Result<()> {
        execute_resale::handler(ctx)
    }

    pub fn refund_ticket(ctx: Context<RefundTicket>) -> Result<()> {
        refund_ticket::handler(ctx)
    }

    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        check_in::handler(ctx)
    }
}
