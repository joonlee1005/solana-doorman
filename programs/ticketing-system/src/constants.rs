pub const JURISDICTION_SEED: &[u8] = b"jurisdiction";
pub const EVENT_SEED: &[u8] = b"event";
pub const SEAT_TIER_SEED: &[u8] = b"seat_tier";
pub const SEAT_SEED: &[u8] = b"seat";
pub const TICKET_MINT_SEED: &[u8] = b"ticket_mint";
pub const BID_QUEUE_SEED: &[u8] = b"bid_queue";
pub const BID_QUEUE_VAULT_SEED: &[u8] = b"bid_queue_vault";

pub const MAX_JURISDICTION_CODE_LEN: usize = 8;
pub const MAX_TIER_NAME_LEN: usize = 16;
pub const MAX_SEAT_CODE_LEN: usize = 16;      // PDA seed용, 32바이트 제한 여유있게
pub const MAX_DISPLAY_NAME_LEN: usize = 64;   // 자유 형식 좌석명
pub const MAX_QUEUE_LEN: usize = 20;          // BidQueue 고정 슬롯 수 (데모용, 실서비스는 확장 필요)
