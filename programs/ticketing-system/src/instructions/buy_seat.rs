use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{
    self, FreezeAccount, Mint, MintTo, ThawAccount, TokenAccount, TokenInterface,
    TransferChecked,
};

use crate::constants::*;
use crate::error::TicketError;
use crate::state::{Event, Seat, SeatStatus, SeatTier};

#[derive(Accounts)]
pub struct BuySeat<'info> {
    #[account(mut)]
    pub customer: Signer<'info>,

    #[account(address = seat_tier.event)]
    pub event: Box<Account<'info, Event>>,

    /// CHECK: only used as the destination authority for the organizer's payment ATA;
    /// validated against event.organizer.
    #[account(address = event.organizer)]
    pub organizer: UncheckedAccount<'info>,

    pub seat_tier: Box<Account<'info, SeatTier>>,

    #[account(
        mut,
        constraint = seat.seat_tier == seat_tier.key() @ TicketError::Unauthorized,
        constraint = seat.status == SeatStatus::Available @ TicketError::SeatNotAvailable
    )]
    pub seat: Box<Account<'info, Seat>>,

    #[account(mut, address = seat_tier.ticket_mint)]
    pub ticket_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(address = seat_tier.payment_mint)]
    pub payment_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = customer,
        associated_token::mint = ticket_mint,
        associated_token::authority = customer,
        associated_token::token_program = ticket_token_program,
    )]
    pub customer_ticket_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = customer,
        associated_token::token_program = payment_token_program,
    )]
    pub customer_payment_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = customer,
        associated_token::mint = payment_mint,
        associated_token::authority = organizer,
        associated_token::token_program = payment_token_program,
    )]
    pub organizer_payment_ata: Box<InterfaceAccount<'info, TokenAccount>>,

    pub ticket_token_program: Program<'info, Token2022>,
    pub payment_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<BuySeat>) -> Result<()> {
    let seat_tier = &ctx.accounts.seat_tier;
    let seat_tier_signer_seeds: &[&[u8]] = &[
        SEAT_TIER_SEED,
        seat_tier.event.as_ref(),
        seat_tier.tier_name.as_bytes(),
        &[seat_tier.bump],
    ];

    // 1. Customer pays the organizer face_value in the payment token.
    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.payment_token_program.key(),
            TransferChecked {
                from: ctx.accounts.customer_payment_ata.to_account_info(),
                mint: ctx.accounts.payment_mint.to_account_info(),
                to: ctx.accounts.organizer_payment_ata.to_account_info(),
                authority: ctx.accounts.customer.to_account_info(),
            },
        ),
        seat_tier.face_value,
        ctx.accounts.payment_mint.decimals,
    )?;

    // 2. The freshly created ticket ATA starts Frozen (DefaultAccountState extension on
    // the mint). Thaw it, mint the single ticket into it, then re-freeze so tickets are
    // always at rest in a Frozen state and can only move through an atomic instruction
    // controlled by this program.
    token_interface::thaw_account(CpiContext::new_with_signer(
        ctx.accounts.ticket_token_program.key(),
        ThawAccount {
            account: ctx.accounts.customer_ticket_ata.to_account_info(),
            mint: ctx.accounts.ticket_mint.to_account_info(),
            authority: seat_tier.to_account_info(),
        },
        &[seat_tier_signer_seeds],
    ))?;

    token_interface::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.ticket_token_program.key(),
            MintTo {
                mint: ctx.accounts.ticket_mint.to_account_info(),
                to: ctx.accounts.customer_ticket_ata.to_account_info(),
                authority: seat_tier.to_account_info(),
            },
            &[seat_tier_signer_seeds],
        ),
        1,
    )?;

    token_interface::freeze_account(CpiContext::new_with_signer(
        ctx.accounts.ticket_token_program.key(),
        FreezeAccount {
            account: ctx.accounts.customer_ticket_ata.to_account_info(),
            mint: ctx.accounts.ticket_mint.to_account_info(),
            authority: seat_tier.to_account_info(),
        },
        &[seat_tier_signer_seeds],
    ))?;

    let seat = &mut ctx.accounts.seat;
    seat.token_account = ctx.accounts.customer_ticket_ata.key();
    seat.owner = ctx.accounts.customer.key();
    seat.status = SeatStatus::Sold;

    Ok(())
}
