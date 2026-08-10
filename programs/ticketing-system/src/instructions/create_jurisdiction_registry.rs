use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::TicketError;
use crate::state::JurisdictionRegistry;

#[derive(Accounts)]
#[instruction(jurisdiction_code: String)]
pub struct CreateJurisdictionRegistry<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = JurisdictionRegistry::SPACE,
        seeds = [JURISDICTION_SEED, jurisdiction_code.as_bytes()],
        bump
    )]
    pub jurisdiction_registry: Account<'info, JurisdictionRegistry>,

    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(
    ctx: Context<CreateJurisdictionRegistry>,
    jurisdiction_code: String,
    legal_cap_bps: u16,
) -> Result<()> {
    require!(
        jurisdiction_code.len() <= MAX_JURISDICTION_CODE_LEN,
        TicketError::JurisdictionCodeTooLong
    );
    require!(legal_cap_bps <= 10_000, TicketError::InvalidMaxBps);

    let registry = &mut ctx.accounts.jurisdiction_registry;
    registry.authority = ctx.accounts.authority.key();
    registry.jurisdiction_code = jurisdiction_code;
    registry.legal_cap_bps = legal_cap_bps;
    registry.bump = ctx.bumps.jurisdiction_registry;

    Ok(())
}
