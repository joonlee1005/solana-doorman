use anchor_lang::prelude::*;
use crate::constants::*;

#[account]
pub struct JurisdictionRegistry {
    pub authority: Pubkey,
    pub jurisdiction_code: String,
    pub legal_cap_bps: u16,
    pub bump: u8,
}

impl JurisdictionRegistry {
    pub const SPACE: usize = 8 + 32 + (4 + MAX_JURISDICTION_CODE_LEN) + 2 + 1;
}

#[account]
pub struct Event {
    pub organizer: Pubkey,
    pub event_id: u64,
    pub jurisdiction_registry: Pubkey,
    pub refund_deadline: i64,
    pub refund_bps: u16,
    pub bump: u8,
}

impl Event {
    pub const SPACE: usize = 8 + 32 + 8 + 32 + 8 + 2 + 1;
}

#[account]
pub struct SeatTier {
    pub event: Pubkey,
    pub tier_name: String,
    pub ticket_mint: Pubkey,
    pub payment_mint: Pubkey,
    pub face_value: u64,
    pub resale_policy: ResalePolicy,
    pub total_seats: u32,
    pub bump: u8,
}

impl SeatTier {
    pub const SPACE: usize =
        8 + 32 + (4 + MAX_TIER_NAME_LEN) + 32 + 32 + 8 + ResalePolicy::SPACE + 4 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum ResalePolicy {
    Capped { max_bps: u16 },
    Unrestricted,
    NonTransferable,
}

impl ResalePolicy {
    pub const SPACE: usize = 1 + 2;

    pub fn more_restrictive(a: ResalePolicy, b: ResalePolicy) -> ResalePolicy {
        use ResalePolicy::*;
        match (a, b) {
            (NonTransferable, _) | (_, NonTransferable) => NonTransferable,
            (Capped { max_bps: a_bps }, Capped { max_bps: b_bps }) => {
                Capped { max_bps: a_bps.min(b_bps) }
            }
            (Capped { max_bps }, Unrestricted) | (Unrestricted, Capped { max_bps }) => {
                Capped { max_bps }
            }
            (Unrestricted, Unrestricted) => Unrestricted,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum SeatStatus {
    Available,
    Sold,
    Refunded,
    CheckedIn,
}

#[account]
pub struct Seat {
    pub seat_tier: Pubkey,
    pub seat_code: String,       // PDA seed용, 짧게
    pub display_name: String,    // 자유 형식
    pub token_account: Pubkey,
    pub owner: Pubkey,
    pub status: SeatStatus,
    pub bump: u8,
}

impl Seat {
    pub const SPACE: usize = 8
        + 32
        + (4 + MAX_SEAT_CODE_LEN)
        + (4 + MAX_DISPLAY_NAME_LEN)
        + 32
        + 32
        + 1  // SeatStatus enum discriminant
        + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub struct Bid {
    pub buyer: Pubkey,
    pub amount: u64,
    pub joined_at: i64,
}

impl Bid {
    pub const SPACE: usize = 32 + 8 + 8;
}

#[account]
pub struct BidQueue {
    pub seat_tier: Pubkey,
    pub vault: Pubkey,
    pub bids: [Bid; MAX_QUEUE_LEN],
    pub count: u8,
    pub bump: u8,
}

impl BidQueue {
    pub const SPACE: usize = 8 + 32 + 32 + (MAX_QUEUE_LEN * Bid::SPACE) + 1 + 1;
}