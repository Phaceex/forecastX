use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo, Burn};
use anchor_spl::associated_token::AssociatedToken;
use anchor_lang::solana_program::instruction::{Instruction, AccountMeta};
use std::str::FromStr;

declare_id!("6N6ckvYjUgGZCgwoE6XCQbsMuoxjUvoT3QYUt6LbfTbi");

// CPI structs for TxLINE
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ScoresUpdateStats {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ScoresBatchSummary {
    pub fixture_id: i64,
    pub update_stats: ScoresUpdateStats,
    pub events_sub_tree_root: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct StatTerm {
    pub stat_to_prove: ScoreStat,
    pub event_stat_root: [u8; 32],
    pub stat_proof: Vec<ProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum Comparison {
    GreaterThan,
    LessThan,
    EqualTo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TraderPredicate {
    pub threshold: i32,
    pub comparison: Comparison,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum BinaryExpression {
    Add,
    Subtract,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ValidateStatArgs {
    pub ts: i64,
    pub fixture_summary: ScoresBatchSummary,
    pub fixture_proof: Vec<ProofNode>,
    pub main_tree_proof: Vec<ProofNode>,
    pub predicate: TraderPredicate,
    pub stat_a: StatTerm,
    pub stat_b: Option<StatTerm>,
    pub op: Option<BinaryExpression>,
}

fn solve_sell_quadratic(x: u64, y: u64, amount_in: u64) -> u64 {
    let x_f = x as f64;
    let y_f = y as f64;
    let a_f = amount_in as f64;
    let g = 0.997;

    let a = g;
    let b = x_f + g * (y_f - a_f);
    let c = -a_f * x_f;

    let discriminant = b * b - 4.0 * a * c;
    if discriminant < 0.0 {
        return 0;
    }

    let root = discriminant.sqrt();
    let da = (-b + root) / (2.0 * a);
    if da < 0.0 {
        0
    } else {
        da as u64
    }
}

fn swap_usdc_to_yes(ctx: Context<Swap>, amount_in: u64, min_amount_out: u64) -> Result<()> {
    let yes_reserve_amount = ctx.accounts.yes_reserve.amount;
    let no_reserve_amount = ctx.accounts.no_reserve.amount;

    let fixture_id_bytes = ctx.accounts.market.fixture_id.to_le_bytes();
    let stat_key_bytes = ctx.accounts.market.stat_key.to_le_bytes();
    let market_signer_seeds = &[
        b"market",
        fixture_id_bytes.as_ref(),
        stat_key_bytes.as_ref(),
        &[ctx.accounts.market.bump],
    ];
    let market_signer = &[&market_signer_seeds[..]];

    // 1. Transfer USDC from user to vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_collateral.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts);
    token::transfer(cpi_ctx, amount_in)?;

    // 2. Mint YES & NO complete sets to user (YES) and pool reserves (NO)
    let cpi_accounts_yes = MintTo {
        mint: ctx.accounts.yes_mint.to_account_info(),
        to: ctx.accounts.user_yes.to_account_info(),
        authority: ctx.accounts.market.to_account_info(),
    };
    let cpi_ctx_yes = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        cpi_accounts_yes,
        market_signer,
    );
    token::mint_to(cpi_ctx_yes, amount_in)?;

    let cpi_accounts_no = MintTo {
        mint: ctx.accounts.no_mint.to_account_info(),
        to: ctx.accounts.no_reserve.to_account_info(),
        authority: ctx.accounts.market.to_account_info(),
    };
    let cpi_ctx_no = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        cpi_accounts_no,
        market_signer,
    );
    token::mint_to(cpi_ctx_no, amount_in)?;

    // 3. Swap NO for YES
    let dy = amount_in as u128;
    let dy_fee_adjusted = dy * 997 / 1000;
    let x = yes_reserve_amount as u128;
    let y = no_reserve_amount as u128;
    let dx = x * dy_fee_adjusted / (y + dy_fee_adjusted);

    require!(dx >= min_amount_out as u128, ErrorCode::SlippageExceeded);

    let market_key = ctx.accounts.market.key();
    let pool_signer_seeds = &[b"pool", market_key.as_ref(), &[ctx.accounts.pool.bump]];
    let pool_signer = &[&pool_signer_seeds[..]];

    let cpi_accounts_swap = Transfer {
        from: ctx.accounts.yes_reserve.to_account_info(),
        to: ctx.accounts.user_yes.to_account_info(),
        authority: ctx.accounts.pool.to_account_info(),
    };
    let cpi_ctx_swap = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        cpi_accounts_swap,
        pool_signer,
    );
    token::transfer(cpi_ctx_swap, dx as u64)?;

    ctx.accounts.pool.k = (yes_reserve_amount - dx as u64) as u128
        * (no_reserve_amount + amount_in) as u128;

    msg!("Swapped {} USDC for {} YES", amount_in, amount_in + dx as u64);
    Ok(())
}

fn swap_usdc_to_no(ctx: Context<Swap>, amount_in: u64, min_amount_out: u64) -> Result<()> {
    let yes_reserve_amount = ctx.accounts.yes_reserve.amount;
    let no_reserve_amount = ctx.accounts.no_reserve.amount;

    let fixture_id_bytes = ctx.accounts.market.fixture_id.to_le_bytes();
    let stat_key_bytes = ctx.accounts.market.stat_key.to_le_bytes();
    let market_signer_seeds = &[
        b"market",
        fixture_id_bytes.as_ref(),
        stat_key_bytes.as_ref(),
        &[ctx.accounts.market.bump],
    ];
    let market_signer = &[&market_signer_seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.user_collateral.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts);
    token::transfer(cpi_ctx, amount_in)?;

    let cpi_accounts_yes = MintTo {
        mint: ctx.accounts.yes_mint.to_account_info(),
        to: ctx.accounts.yes_reserve.to_account_info(),
        authority: ctx.accounts.market.to_account_info(),
    };
    let cpi_ctx_yes = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        cpi_accounts_yes,
        market_signer,
    );
    token::mint_to(cpi_ctx_yes, amount_in)?;

    let cpi_accounts_no = MintTo {
        mint: ctx.accounts.no_mint.to_account_info(),
        to: ctx.accounts.user_no.to_account_info(),
        authority: ctx.accounts.market.to_account_info(),
    };
    let cpi_ctx_no = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        cpi_accounts_no,
        market_signer,
    );
    token::mint_to(cpi_ctx_no, amount_in)?;

    let dx = amount_in as u128;
    let dx_fee_adjusted = dx * 997 / 1000;
    let x = yes_reserve_amount as u128;
    let y = no_reserve_amount as u128;
    let dy = y * dx_fee_adjusted / (x + dx_fee_adjusted);

    require!(dy >= min_amount_out as u128, ErrorCode::SlippageExceeded);

    let market_key = ctx.accounts.market.key();
    let pool_signer_seeds = &[b"pool", market_key.as_ref(), &[ctx.accounts.pool.bump]];
    let pool_signer = &[&pool_signer_seeds[..]];

    let cpi_accounts_swap = Transfer {
        from: ctx.accounts.no_reserve.to_account_info(),
        to: ctx.accounts.user_no.to_account_info(),
        authority: ctx.accounts.pool.to_account_info(),
    };
    let cpi_ctx_swap = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        cpi_accounts_swap,
        pool_signer,
    );
    token::transfer(cpi_ctx_swap, dy as u64)?;

    ctx.accounts.pool.k = (yes_reserve_amount + amount_in) as u128
        * (no_reserve_amount - dy as u64) as u128;

    msg!("Swapped {} USDC for {} NO", amount_in, amount_in + dy as u64);
    Ok(())
}

fn swap_yes_to_usdc(ctx: Context<Swap>, amount_in: u64, min_amount_out: u64) -> Result<()> {
    let yes_reserve_amount = ctx.accounts.yes_reserve.amount;
    let no_reserve_amount = ctx.accounts.no_reserve.amount;

    let fixture_id_bytes = ctx.accounts.market.fixture_id.to_le_bytes();
    let stat_key_bytes = ctx.accounts.market.stat_key.to_le_bytes();
    let market_signer_seeds = &[
        b"market",
        fixture_id_bytes.as_ref(),
        stat_key_bytes.as_ref(),
        &[ctx.accounts.market.bump],
    ];
    let market_signer = &[&market_signer_seeds[..]];

    let da = solve_sell_quadratic(yes_reserve_amount, no_reserve_amount, amount_in);
    require!(da > 0 && da < amount_in, ErrorCode::InvalidAmount);
    let db = amount_in - da;

    let cpi_accounts_swap_yes = Transfer {
        from: ctx.accounts.user_yes.to_account_info(),
        to: ctx.accounts.yes_reserve.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };
    let cpi_ctx_swap_yes = CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts_swap_yes);
    token::transfer(cpi_ctx_swap_yes, da)?;

    let market_key = ctx.accounts.market.key();
    let pool_signer_seeds = &[b"pool", market_key.as_ref(), &[ctx.accounts.pool.bump]];
    let pool_signer = &[&pool_signer_seeds[..]];

    let cpi_accounts_swap_no = Transfer {
        from: ctx.accounts.no_reserve.to_account_info(),
        to: ctx.accounts.user_no.to_account_info(),
        authority: ctx.accounts.pool.to_account_info(),
    };
    let cpi_ctx_swap_no = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        cpi_accounts_swap_no,
        pool_signer,
    );
    token::transfer(cpi_ctx_swap_no, db)?;

    let cpi_accounts_burn_yes = Burn {
        mint: ctx.accounts.yes_mint.to_account_info(),
        from: ctx.accounts.user_yes.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };
    let cpi_ctx_burn_yes = CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts_burn_yes);
    token::burn(cpi_ctx_burn_yes, db)?;

    let cpi_accounts_burn_no = Burn {
        mint: ctx.accounts.no_mint.to_account_info(),
        from: ctx.accounts.user_no.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };
    let cpi_ctx_burn_no = CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts_burn_no);
    token::burn(cpi_ctx_burn_no, db)?;

    let cpi_accounts_usdc = Transfer {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.user_collateral.to_account_info(),
        authority: ctx.accounts.market.to_account_info(),
    };
    let cpi_ctx_usdc = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        cpi_accounts_usdc,
        market_signer,
    );
    token::transfer(cpi_ctx_usdc, db)?;

    require!(db >= min_amount_out, ErrorCode::SlippageExceeded);

    ctx.accounts.pool.k = (yes_reserve_amount + da) as u128
        * (no_reserve_amount - db) as u128;

    msg!("Swapped {} YES for {} USDC", amount_in, db);
    Ok(())
}

fn swap_no_to_usdc(ctx: Context<Swap>, amount_in: u64, min_amount_out: u64) -> Result<()> {
    let yes_reserve_amount = ctx.accounts.yes_reserve.amount;
    let no_reserve_amount = ctx.accounts.no_reserve.amount;

    let fixture_id_bytes = ctx.accounts.market.fixture_id.to_le_bytes();
    let stat_key_bytes = ctx.accounts.market.stat_key.to_le_bytes();
    let market_signer_seeds = &[
        b"market",
        fixture_id_bytes.as_ref(),
        stat_key_bytes.as_ref(),
        &[ctx.accounts.market.bump],
    ];
    let market_signer = &[&market_signer_seeds[..]];

    let da = solve_sell_quadratic(no_reserve_amount, yes_reserve_amount, amount_in);
    require!(da > 0 && da < amount_in, ErrorCode::InvalidAmount);
    let db = amount_in - da;

    let cpi_accounts_swap_no = Transfer {
        from: ctx.accounts.user_no.to_account_info(),
        to: ctx.accounts.no_reserve.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };
    let cpi_ctx_swap_no = CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts_swap_no);
    token::transfer(cpi_ctx_swap_no, da)?;

    let market_key = ctx.accounts.market.key();
    let pool_signer_seeds = &[b"pool", market_key.as_ref(), &[ctx.accounts.pool.bump]];
    let pool_signer = &[&pool_signer_seeds[..]];

    let cpi_accounts_swap_yes = Transfer {
        from: ctx.accounts.yes_reserve.to_account_info(),
        to: ctx.accounts.user_yes.to_account_info(),
        authority: ctx.accounts.pool.to_account_info(),
    };
    let cpi_ctx_swap_yes = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        cpi_accounts_swap_yes,
        pool_signer,
    );
    token::transfer(cpi_ctx_swap_yes, db)?;

    let cpi_accounts_burn_yes = Burn {
        mint: ctx.accounts.yes_mint.to_account_info(),
        from: ctx.accounts.user_yes.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };
    let cpi_ctx_burn_yes = CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts_burn_yes);
    token::burn(cpi_ctx_burn_yes, db)?;

    let cpi_accounts_burn_no = Burn {
        mint: ctx.accounts.no_mint.to_account_info(),
        from: ctx.accounts.user_no.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };
    let cpi_ctx_burn_no = CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts_burn_no);
    token::burn(cpi_ctx_burn_no, db)?;

    let cpi_accounts_usdc = Transfer {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.user_collateral.to_account_info(),
        authority: ctx.accounts.market.to_account_info(),
    };
    let cpi_ctx_usdc = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        cpi_accounts_usdc,
        market_signer,
    );
    token::transfer(cpi_ctx_usdc, db)?;

    require!(db >= min_amount_out, ErrorCode::SlippageExceeded);

    ctx.accounts.pool.k = (yes_reserve_amount - db) as u128
        * (no_reserve_amount + da) as u128;

    msg!("Swapped {} NO for {} USDC", amount_in, db);
    Ok(())
}

#[program]
pub mod programs {
    use super::*;

    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        fixture_id: u64,
        stat_key: u16,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        market.fixture_id = fixture_id;
        market.stat_key = stat_key;
        market.resolved = false;
        market.winning_outcome = 0;
        market.authority = ctx.accounts.authority.key();
        market.collateral_mint = ctx.accounts.collateral_mint.key();
        market.yes_mint = ctx.accounts.yes_mint.key();
        market.no_mint = ctx.accounts.no_mint.key();
        market.vault = ctx.accounts.vault.key();
        market.bump = ctx.bumps.market;

        msg!("Market created for fixture {}", fixture_id);
        Ok(())
    }

    pub fn close_market(ctx: Context<CloseMarket>) -> Result<()> {
        let dest_starting_lamports = ctx.accounts.authority.lamports();
        **ctx.accounts.authority.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(ctx.accounts.market.lamports())
            .unwrap();
        **ctx.accounts.market.lamports.borrow_mut() = 0;
        
        let mut source_data = ctx.accounts.market.data.borrow_mut();
        source_data.fill(0);
        Ok(())
    }

    pub fn mint_complete_set(
        ctx: Context<MintCompleteSet>,
        amount: u64,
    ) -> Result<()> {
        // Transfer collateral USDC from user to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_collateral.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.user_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // Mint YES and NO tokens to user
        let fixture_id_bytes = ctx.accounts.market.fixture_id.to_le_bytes();
        let stat_key_bytes = ctx.accounts.market.stat_key.to_le_bytes();
        let signer_seeds = &[
            b"market",
            fixture_id_bytes.as_ref(),
            stat_key_bytes.as_ref(),
            &[ctx.accounts.market.bump],
        ];
        let signer = &[&signer_seeds[..]];

        // YES Mint
        let cpi_accounts_yes = MintTo {
            mint: ctx.accounts.yes_mint.to_account_info(),
            to: ctx.accounts.user_yes.to_account_info(),
            authority: ctx.accounts.market.to_account_info(),
        };
        let cpi_ctx_yes = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts_yes,
            signer,
        );
        token::mint_to(cpi_ctx_yes, amount)?;

        // NO Mint
        let cpi_accounts_no = MintTo {
            mint: ctx.accounts.no_mint.to_account_info(),
            to: ctx.accounts.user_no.to_account_info(),
            authority: ctx.accounts.market.to_account_info(),
        };
        let cpi_ctx_no = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts_no,
            signer,
        );
        token::mint_to(cpi_ctx_no, amount)?;

        msg!("Minted {} complete sets", amount);
        Ok(())
    }

    pub fn burn_complete_set(
        ctx: Context<BurnCompleteSet>,
        amount: u64,
    ) -> Result<()> {
        // Burn YES tokens
        let cpi_accounts_yes = Burn {
            mint: ctx.accounts.yes_mint.to_account_info(),
            from: ctx.accounts.user_yes.to_account_info(),
            authority: ctx.accounts.user_authority.to_account_info(),
        };
        let cpi_ctx_yes = CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts_yes);
        token::burn(cpi_ctx_yes, amount)?;

        // Burn NO tokens
        let cpi_accounts_no = Burn {
            mint: ctx.accounts.no_mint.to_account_info(),
            from: ctx.accounts.user_no.to_account_info(),
            authority: ctx.accounts.user_authority.to_account_info(),
        };
        let cpi_ctx_no = CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts_no);
        token::burn(cpi_ctx_no, amount)?;

        // Transfer collateral USDC back to user
        let fixture_id_bytes = ctx.accounts.market.fixture_id.to_le_bytes();
        let stat_key_bytes = ctx.accounts.market.stat_key.to_le_bytes();
        let signer_seeds = &[
            b"market",
            fixture_id_bytes.as_ref(),
            stat_key_bytes.as_ref(),
            &[ctx.accounts.market.bump],
        ];
        let signer = &[&signer_seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_collateral.to_account_info(),
            authority: ctx.accounts.market.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts,
            signer,
        );
        token::transfer(cpi_ctx, amount)?;

        msg!("Burned {} complete sets", amount);
        Ok(())
    }

    pub fn init_pool(
        ctx: Context<InitPool>,
        initial_usdc_amount: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.market = ctx.accounts.market.key();
        pool.lp_mint = ctx.accounts.lp_mint.key();
        pool.yes_reserve = ctx.accounts.yes_reserve.key();
        pool.no_reserve = ctx.accounts.no_reserve.key();
        pool.k = (initial_usdc_amount as u128) * (initial_usdc_amount as u128);
        pool.bump = ctx.bumps.pool;

        // 1. Transfer collateral USDC from user to vault
        let cpi_accounts_transfer = Transfer {
            from: ctx.accounts.user_collateral.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_ctx_transfer = CpiContext::new(
            ctx.accounts.token_program.key(),
            cpi_accounts_transfer,
        );
        token::transfer(cpi_ctx_transfer, initial_usdc_amount)?;

        // 2. Mint YES and NO tokens to pool reserves
        let fixture_id_bytes = ctx.accounts.market.fixture_id.to_le_bytes();
        let stat_key_bytes = ctx.accounts.market.stat_key.to_le_bytes();
        let market_signer_seeds = &[
            b"market",
            fixture_id_bytes.as_ref(),
            stat_key_bytes.as_ref(),
            &[ctx.accounts.market.bump],
        ];
        let market_signer = &[&market_signer_seeds[..]];

        // YES to reserve
        let cpi_accounts_yes = MintTo {
            mint: ctx.accounts.yes_mint.to_account_info(),
            to: ctx.accounts.yes_reserve.to_account_info(),
            authority: ctx.accounts.market.to_account_info(),
        };
        let cpi_ctx_yes = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts_yes,
            market_signer,
        );
        token::mint_to(cpi_ctx_yes, initial_usdc_amount)?;

        // NO to reserve
        let cpi_accounts_no = MintTo {
            mint: ctx.accounts.no_mint.to_account_info(),
            to: ctx.accounts.no_reserve.to_account_info(),
            authority: ctx.accounts.market.to_account_info(),
        };
        let cpi_ctx_no = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts_no,
            market_signer,
        );
        token::mint_to(cpi_ctx_no, initial_usdc_amount)?;

        // 3. Mint LP shares to user
        let market_key = ctx.accounts.market.key();
        let pool_signer_seeds = &[
            b"pool",
            market_key.as_ref(),
            &[pool.bump],
        ];
        let pool_signer = &[&pool_signer_seeds[..]];

        let cpi_accounts_lp = MintTo {
            mint: ctx.accounts.lp_mint.to_account_info(),
            to: ctx.accounts.user_lp.to_account_info(),
            authority: pool.to_account_info(),
        };
        let cpi_ctx_lp = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts_lp,
            pool_signer,
        );
        token::mint_to(cpi_ctx_lp, initial_usdc_amount)?;

        msg!("Pool initialized with {} USDC", initial_usdc_amount);
        Ok(())
    }

    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        amount_usdc: u64,
    ) -> Result<()> {
        // 1. Transfer collateral USDC from user to vault
        let cpi_accounts_transfer = Transfer {
            from: ctx.accounts.user_collateral.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_ctx_transfer = CpiContext::new(
            ctx.accounts.token_program.key(),
            cpi_accounts_transfer,
        );
        token::transfer(cpi_ctx_transfer, amount_usdc)?;

        // 2. Mint YES and NO tokens to pool reserves
        let fixture_id_bytes = ctx.accounts.market.fixture_id.to_le_bytes();
        let stat_key_bytes = ctx.accounts.market.stat_key.to_le_bytes();
        let market_signer_seeds = &[
            b"market",
            fixture_id_bytes.as_ref(),
            stat_key_bytes.as_ref(),
            &[ctx.accounts.market.bump],
        ];
        let market_signer = &[&market_signer_seeds[..]];

        // YES to reserve
        let cpi_accounts_yes = MintTo {
            mint: ctx.accounts.yes_mint.to_account_info(),
            to: ctx.accounts.yes_reserve.to_account_info(),
            authority: ctx.accounts.market.to_account_info(),
        };
        let cpi_ctx_yes = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts_yes,
            market_signer,
        );
        token::mint_to(cpi_ctx_yes, amount_usdc)?;

        // NO to reserve
        let cpi_accounts_no = MintTo {
            mint: ctx.accounts.no_mint.to_account_info(),
            to: ctx.accounts.no_reserve.to_account_info(),
            authority: ctx.accounts.market.to_account_info(),
        };
        let cpi_ctx_no = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts_no,
            market_signer,
        );
        token::mint_to(cpi_ctx_no, amount_usdc)?;

        // 3. Mint LP shares to user
        let market_key = ctx.accounts.market.key();
        let pool_signer_seeds = &[
            b"pool",
            market_key.as_ref(),
            &[ctx.accounts.pool.bump],
        ];
        let pool_signer = &[&pool_signer_seeds[..]];

        let cpi_accounts_lp = MintTo {
            mint: ctx.accounts.lp_mint.to_account_info(),
            to: ctx.accounts.user_lp.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        };
        let cpi_ctx_lp = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts_lp,
            pool_signer,
        );
        token::mint_to(cpi_ctx_lp, amount_usdc)?;

        // Update k
        ctx.accounts.pool.k = ((ctx.accounts.yes_reserve.amount + amount_usdc) as u128)
            * ((ctx.accounts.no_reserve.amount + amount_usdc) as u128);

        msg!("Added {} USDC liquidity", amount_usdc);
        Ok(())
    }

    pub fn remove_liquidity(
        ctx: Context<RemoveLiquidity>,
        amount_lp: u64,
    ) -> Result<()> {
        let lp_supply = ctx.accounts.lp_mint.supply;
        let yes_reserve_amount = ctx.accounts.yes_reserve.amount;
        let no_reserve_amount = ctx.accounts.no_reserve.amount;

        let yes_to_return = ((amount_lp as u128) * (yes_reserve_amount as u128) / (lp_supply as u128)) as u64;
        let no_to_return = ((amount_lp as u128) * (no_reserve_amount as u128) / (lp_supply as u128)) as u64;

        // 1. Burn LP shares
        let cpi_accounts_burn = Burn {
            mint: ctx.accounts.lp_mint.to_account_info(),
            from: ctx.accounts.user_lp.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_ctx_burn = CpiContext::new(
            ctx.accounts.token_program.key(),
            cpi_accounts_burn,
        );
        token::burn(cpi_ctx_burn, amount_lp)?;

        // 2. Transfer YES and NO from reserves to user
        let market_key = ctx.accounts.market.key();
        let pool_signer_seeds = &[
            b"pool",
            market_key.as_ref(),
            &[ctx.accounts.pool.bump],
        ];
        let pool_signer = &[&pool_signer_seeds[..]];

        // YES transfer
        let cpi_accounts_yes = Transfer {
            from: ctx.accounts.yes_reserve.to_account_info(),
            to: ctx.accounts.user_yes.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        };
        let cpi_ctx_yes = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts_yes,
            pool_signer,
        );
        token::transfer(cpi_ctx_yes, yes_to_return)?;

        // NO transfer
        let cpi_accounts_no = Transfer {
            from: ctx.accounts.no_reserve.to_account_info(),
            to: ctx.accounts.user_no.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        };
        let cpi_ctx_no = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts_no,
            pool_signer,
        );
        token::transfer(cpi_ctx_no, no_to_return)?;

        // Update k
        ctx.accounts.pool.k = ((yes_reserve_amount - yes_to_return) as u128)
            * ((no_reserve_amount - no_to_return) as u128);

        msg!("Removed {} LP shares, returned {} YES and {} NO", amount_lp, yes_to_return, no_to_return);
        Ok(())
    }

    pub fn swap(
        ctx: Context<Swap>,
        swap_type: u8,
        amount_in: u64,
        min_amount_out: u64,
    ) -> Result<()> {
        match swap_type {
            0 => swap_usdc_to_yes(ctx, amount_in, min_amount_out),
            1 => swap_usdc_to_no(ctx, amount_in, min_amount_out),
            2 => swap_yes_to_usdc(ctx, amount_in, min_amount_out),
            3 => swap_no_to_usdc(ctx, amount_in, min_amount_out),
            _ => err!(ErrorCode::InvalidSwapType),
        }
    }

    pub fn resolve_market(
        ctx: Context<ResolveMarket>,
        resolve_yes: bool,
        ts: i64,
        fixture_summary: ScoresBatchSummary,
        fixture_proof: Vec<ProofNode>,
        main_tree_proof: Vec<ProofNode>,
        predicate: TraderPredicate,
        stat_a: StatTerm,
        stat_b: Option<StatTerm>,
        op: Option<BinaryExpression>,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(!market.resolved, ErrorCode::MarketAlreadyResolved);

        // Security check: must match the fixture and stat key
        require!(fixture_summary.fixture_id == market.fixture_id as i64, ErrorCode::FixtureIdMismatch);
        require!(stat_a.stat_to_prove.key == market.stat_key as u32, ErrorCode::StatKeyMismatch);

        // Call TxLINE validate_stat via CPI
        let txline_program_id = Pubkey::from_str("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J").unwrap();

        let mut ix_data = vec![107, 197, 232, 90, 191, 136, 105, 185]; // validate_stat discriminator
        let args = ValidateStatArgs {
            ts,
            fixture_summary,
            fixture_proof,
            main_tree_proof,
            predicate,
            stat_a,
            stat_b,
            op,
        };

        // let ix_args_data = <ValidateStatArgs as anchor_lang::prelude::borsh::BorshSerialize>::try_to_vec(&args).map_err(|_| error!(ErrorCode::CpiReturnDataDeserializationFailed))?;
        let ix_args_data = anchor_lang::prelude::borsh::to_vec(&args).map_err(|_| error!(ErrorCode::CpiReturnDataDeserializationFailed))?;
        ix_data.extend(ix_args_data);

        let accounts = vec![
            AccountMeta::new_readonly(ctx.accounts.daily_scores_merkle_roots.key(), false),
        ];

        let ix = Instruction {
            program_id: txline_program_id,
            accounts,
            data: ix_data,
        };

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[ctx.accounts.daily_scores_merkle_roots.to_account_info(),
             ctx.accounts.txline_program.to_account_info(),
             ],
           
        )?;

        let (key, return_data) = anchor_lang::solana_program::program::get_return_data()
            .ok_or(error!(ErrorCode::CpiReturnDataMissing))?;

        if key != txline_program_id {
            return err!(ErrorCode::InvalidCpiProgram);
        }

        let is_valid = bool::try_from_slice(&return_data)
            .map_err(|_| error!(ErrorCode::CpiReturnDataDeserializationFailed))?;

        require!(is_valid, ErrorCode::OracleValidationFailed);

        market.resolved = true;
        market.winning_outcome = if resolve_yes { 1 } else { 2 };

        msg!("Market resolved successfully. Winning outcome: {}", market.winning_outcome);
        Ok(())
    }

    pub fn redeem(
        ctx: Context<Redeem>,
        amount: u64,
    ) -> Result<()> {
        let market = &ctx.accounts.market;
        require!(market.resolved, ErrorCode::MarketNotResolved);

        let winning_outcome = market.winning_outcome;
        require!(winning_outcome == 1 || winning_outcome == 2, ErrorCode::InvalidWinningOutcome);

        // Burn the winning tokens
        let cpi_accounts_burn = Burn {
            mint: if winning_outcome == 1 {
                ctx.accounts.yes_mint.to_account_info()
            } else {
                ctx.accounts.no_mint.to_account_info()
            },
            from: ctx.accounts.user_winning_tokens.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_ctx_burn = CpiContext::new(
            ctx.accounts.token_program.key(),
            cpi_accounts_burn,
        );
        token::burn(cpi_ctx_burn, amount)?;

        // Transfer USDC from vault to user
        let fixture_id_bytes = market.fixture_id.to_le_bytes();
        let stat_key_bytes = market.stat_key.to_le_bytes();
        let market_signer_seeds = &[
            b"market",
            fixture_id_bytes.as_ref(),
            stat_key_bytes.as_ref(),
            &[market.bump],
        ];
        let market_signer = &[&market_signer_seeds[..]];

        let cpi_accounts_transfer = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_collateral.to_account_info(),
            authority: ctx.accounts.market.to_account_info(),
        };
        let cpi_ctx_transfer = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts_transfer,
            market_signer,
        );
        token::transfer(cpi_ctx_transfer, amount)?;

        msg!("Redeemed {} winning tokens for USDC", amount);
        Ok(())
    }
}

#[account]
pub struct Market {
    pub fixture_id: u64,
    pub stat_key: u16,
    pub resolved: bool,
    pub winning_outcome: u8,
    pub authority: Pubkey,
    pub collateral_mint: Pubkey,
    pub yes_mint: Pubkey,
    pub no_mint: Pubkey,
    pub vault: Pubkey,
    pub bump: u8,
}

#[account]
pub struct Pool {
    pub market: Pubkey,
    pub lp_mint: Pubkey,
    pub yes_reserve: Pubkey,
    pub no_reserve: Pubkey,
    pub k: u128,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(fixture_id: u64, stat_key: u16)]
pub struct InitializeMarket<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 8 + 2 + 1 + 1 + 32 + 32 + 32 + 32 + 32 + 1, // 181
        seeds = [b"market", fixture_id.to_le_bytes().as_ref(), stat_key.to_le_bytes().as_ref()],
        bump
    )]
    pub market: Box<Account<'info, Market>>,

    pub collateral_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = market,
        seeds = [b"yes_mint", market.key().as_ref()],
        bump
    )]
    pub yes_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = market,
        seeds = [b"no_mint", market.key().as_ref()],
        bump
    )]
    pub no_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = authority,
        token::mint = collateral_mint,
        token::authority = market,
        seeds = [b"vault", market.key().as_ref()],
        bump
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintCompleteSet<'info> {
    pub market: Account<'info, Market>,

    #[account(mut, address = market.collateral_mint)]
    pub collateral_mint: Account<'info, Mint>,

    #[account(mut, address = market.yes_mint)]
    pub yes_mint: Account<'info, Mint>,

    #[account(mut, address = market.no_mint)]
    pub no_mint: Account<'info, Mint>,

    #[account(mut, address = market.vault)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_collateral: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_yes: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_no: Account<'info, TokenAccount>,

    pub user_authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnCompleteSet<'info> {
    pub market: Account<'info, Market>,

    #[account(mut, address = market.collateral_mint)]
    pub collateral_mint: Account<'info, Mint>,

    #[account(mut, address = market.yes_mint)]
    pub yes_mint: Account<'info, Mint>,

    #[account(mut, address = market.no_mint)]
    pub no_mint: Account<'info, Mint>,

    #[account(mut, address = market.vault)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_collateral: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_yes: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_no: Account<'info, TokenAccount>,

    pub user_authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitPool<'info> {
    #[account(mut)]
    pub market: Box<Account<'info, Market>>,

    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 32 + 16 + 1, // 153
        seeds = [b"pool", market.key().as_ref()],
        bump
    )]
    pub pool: Box<Account<'info, Pool>>,

    #[account(mut)]
    pub collateral_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = pool,
        seeds = [b"lp_mint", market.key().as_ref()],
        bump
    )]
    pub lp_mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub yes_mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub no_mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = authority,
        token::mint = yes_mint,
        token::authority = pool,
        seeds = [b"yes_reserve", market.key().as_ref()],
        bump
    )]
    pub yes_reserve: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = authority,
        token::mint = no_mint,
        token::authority = pool,
        seeds = [b"no_reserve", market.key().as_ref()],
        bump
    )]
    pub no_reserve: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub user_collateral: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = lp_mint,
        associated_token::authority = authority,
    )]
    pub user_lp: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    pub market: Box<Account<'info, Market>>,

    #[account(
        mut,
        seeds = [b"pool", market.key().as_ref()],
        bump = pool.bump
    )]
    pub pool: Box<Account<'info, Pool>>,

    #[account(mut, address = market.yes_mint)]
    pub yes_mint: Box<Account<'info, Mint>>,

    #[account(mut, address = market.no_mint)]
    pub no_mint: Box<Account<'info, Mint>>,

    #[account(mut, address = pool.lp_mint)]
    pub lp_mint: Box<Account<'info, Mint>>,

    #[account(mut, address = market.vault)]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(mut, address = pool.yes_reserve)]
    pub yes_reserve: Box<Account<'info, TokenAccount>>,

    #[account(mut, address = pool.no_reserve)]
    pub no_reserve: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub user_collateral: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub user_lp: Box<Account<'info, TokenAccount>>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    pub market: Box<Account<'info, Market>>,

    #[account(
        mut,
        seeds = [b"pool", market.key().as_ref()],
        bump = pool.bump
    )]
    pub pool: Box<Account<'info, Pool>>,

    #[account(mut, address = pool.lp_mint)]
    pub lp_mint: Box<Account<'info, Mint>>,

    #[account(mut, address = pool.yes_reserve)]
    pub yes_reserve: Box<Account<'info, TokenAccount>>,

    #[account(mut, address = pool.no_reserve)]
    pub no_reserve: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub user_lp: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub user_yes: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub user_no: Box<Account<'info, TokenAccount>>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    pub market: Box<Account<'info, Market>>,

    #[account(
        mut,
        seeds = [b"pool", market.key().as_ref()],
        bump = pool.bump
    )]
    pub pool: Box<Account<'info, Pool>>,

    #[account(mut, address = market.yes_mint)]
    pub yes_mint: Box<Account<'info, Mint>>,

    #[account(mut, address = market.no_mint)]
    pub no_mint: Box<Account<'info, Mint>>,

    #[account(mut, address = market.vault)]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(mut, address = pool.yes_reserve)]
    pub yes_reserve: Box<Account<'info, TokenAccount>>,

    #[account(mut, address = pool.no_reserve)]
    pub no_reserve: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub user_collateral: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub user_yes: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub user_no: Box<Account<'info, TokenAccount>>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(
        mut,
        seeds = [b"market", market.fixture_id.to_le_bytes().as_ref(), market.stat_key.to_le_bytes().as_ref()],
        bump = market.bump
    )]
    pub market: Account<'info, Market>,

    /// CHECK: Daily Merkle roots account of TxLINE
    pub daily_scores_merkle_roots: AccountInfo<'info>,

    /// CHECK: constrained to TxLINE's known program address below
    #[account(address = Pubkey::from_str("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J").unwrap())]
    pub txline_program: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Redeem<'info> {
    pub market: Account<'info, Market>,

    #[account(mut, address = market.yes_mint)]
    pub yes_mint: Account<'info, Mint>,

    #[account(mut, address = market.no_mint)]
    pub no_mint: Account<'info, Mint>,

    #[account(mut, address = market.vault)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_winning_tokens: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_collateral: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CloseMarket<'info> {
    /// CHECK: This is the market account we want to close
    #[account(mut)]
    pub market: AccountInfo<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Market has not been resolved yet")]
    MarketNotResolved,
    #[msg("Invalid winning outcome")]
    InvalidWinningOutcome,
    #[msg("Market is already resolved")]
    MarketAlreadyResolved,
    #[msg("Mismatch in fixture ID")]
    FixtureIdMismatch,
    #[msg("Mismatch in stat key")]
    StatKeyMismatch,
    #[msg("TxLINE oracle returned false for validation")]
    OracleValidationFailed,
    #[msg("CPI to TxLINE did not return any data")]
    CpiReturnDataMissing,
    #[msg("Returned data was not from the expected TxLINE program")]
    InvalidCpiProgram,
    #[msg("Failed to deserialize return data from TxLINE")]
    CpiReturnDataDeserializationFailed,
    #[msg("Invalid swap type")]
    InvalidSwapType,
    #[msg("Slippage limit exceeded")]
    SlippageExceeded,
    #[msg("Invalid input or calculated amount for swap")]
    InvalidAmount,
}