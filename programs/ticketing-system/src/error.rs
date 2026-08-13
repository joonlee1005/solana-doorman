use anchor_lang::prelude::*;

#[error_code]
pub enum TicketError {
    #[msg("max_bps must be between 0 and 10000")]
    InvalidMaxBps,
    #[msg("seat is not available for purchase")]
    SeatNotAvailable,
    #[msg("seat code exceeds max length")]
    SeatCodeTooLong,
    #[msg("display name exceeds max length")]
    DisplayNameTooLong,
    #[msg("tier name exceeds max length")]
    TierNameTooLong,
    #[msg("jurisdiction code exceeds max length")]
    JurisdictionCodeTooLong,
    #[msg("resale price exceeds policy cap")]
    ResalePriceExceedsCap,
    #[msg("refund deadline has passed")]
    RefundDeadlinePassed,
    #[msg("ticket already checked in or invalid state for this operation")]
    InvalidSeatStatus,
    #[msg("caller is not authorized organizer")]
    Unauthorized,
    #[msg("bid queue is full")]
    QueueFull,
    #[msg("bid queue is empty, nothing to resell")]
    QueueEmpty,
    #[msg("bid amount exceeds resale policy cap")]
    BidExceedsCap,
    #[msg("bid amount is below the seat tier's face value")]
    BidBelowFaceValue,
    #[msg("caller has no bid in this queue")]
    NotInQueue,
    #[msg("supplied buyer does not match the queue front")]
    QueueFrontMismatch,
}
