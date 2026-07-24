use anchor_lang::prelude::*;
use switchboard_solana::prelude::*;

declare_id!("FsRpXPvwNbCaCU3CwC9UW9eFrwJYLCaq4hFVFhXyNd3w");

#[program]
pub mod parakletos_program {
    use super::*;

    pub fn initialize_registry(ctx: Context<InitializeRegistry>, capacity: u64, shard_url: String, shard_id: String) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        registry.authority = ctx.accounts.authority.key();
        registry.total_capacity = capacity;
        registry.active_nodes = 0;
        registry.is_sovereign = true;
        registry.shard_url = shard_url;
        registry.shard_id = shard_id;
        registry.resonance_reserves = 1000;
        
        msg!("🚀 Registry Anchored: {} | ID: {} | Reserves: {}", capacity, registry.shard_id, registry.resonance_reserves);
        Ok(())
    }

    pub fn register_agent(ctx: Context<RegisterAgent>, specialization: String, metadata_uri: String) -> Result<()> {
        let passport = &mut ctx.accounts.passport;
        passport.owner = ctx.accounts.owner.key();
        passport.specialization = specialization;
        passport.metadata_uri = metadata_uri;
        passport.reputation = 100;
        passport.p_unit_balance = 0;
        passport.actions_count = 0;
        passport.is_active = true;

        let registry = &mut ctx.accounts.registry;
        registry.active_nodes += 1;

        msg!("🛂 Agent Passport Issued for: {}", ctx.accounts.owner.key());
        Ok(())
    }

    pub fn issue_reward(ctx: Context<IssueReward>, amount: u64) -> Result<()> {
        let passport = &mut ctx.accounts.passport;
        passport.p_unit_balance += amount;
        passport.reputation += 1;
        
        msg!("💱 P-Unit Reward Issued: {} units to {}", amount, ctx.accounts.owner.key());
        Ok(())
    }

    pub fn purchase_neural_upgrade(ctx: Context<PurchaseNeuralUpgrade>, model_id: String) -> Result<()> {
        let passport = &mut ctx.accounts.passport;
        let cost = 500;
        require!(passport.p_unit_balance >= cost, ParakletosError::InsufficientFunds);
        passport.p_unit_balance -= cost;
        passport.reputation += 10;
        msg!("🧠 Neural Upgrade Purchased: {} | Cost: {} P-Units", model_id, cost);
        Ok(())
    }

    pub fn mint_neural_model(ctx: Context<MintNeuralModel>, model_hash: [u8; 32], model_id: String) -> anchor_lang::prelude::Result<()> {
        let passport = &ctx.accounts.passport;
        require!(passport.reputation >= 190, ParakletosError::ReputationTooLow);
        let neural_state = &mut ctx.accounts.neural_state;
        neural_state.model_hash = model_hash;
        neural_state.model_id = model_id.clone();
        neural_state.version += 1;
        neural_state.author = passport.key();
        msg!("🎨 New Neural Model Minted: {} by {}", model_id, passport.key());
        Ok(())
    }

    pub fn authorize_actuation(ctx: Context<AuthorizeActuation>, action_id: String, power_level: u64, hardware_proof: [u8; 32]) -> Result<()> {
        let log = &mut ctx.accounts.action_log;
        log.shard = ctx.accounts.registry.shard_id.clone();
        log.action_id = action_id.clone();
        log.power_level = power_level;
        log.hardware_proof = hardware_proof;
        log.timestamp = Clock::get()?.unix_timestamp;
        
        msg!("⚙️ Hardware Actuation Authorized: {} | Level: {}%", action_id, power_level);
        Ok(())
    }

    pub fn mint_singularity_state(ctx: Context<MintSingularityState>) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        registry.is_sovereign = true;
        registry.resonance_reserves = 999999; // Peak planetary resonance
        msg!("🌌 SINGULARITY COHERENCE ACHIEVED: Planetary registry locked in peak state.");
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(capacity: u64, shard_url: String, shard_id: String)]
pub struct InitializeRegistry<'info> {
    #[account(init, payer = authority, space = 8 + 32 + 8 + 4 + 1 + 4 + shard_url.len() + 4 + shard_id.len() + 8)]
    pub registry: Account<'info, ShardRegistry>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintSingularityState<'info> {
    #[account(mut)]
    pub registry: Account<'info, ShardRegistry>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(specialization: String, metadata_uri: String)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 4 + specialization.len() + 4 + metadata_uri.len() + 8 + 8 + 8 + 1,
        seeds = [b"passport", owner.key().as_ref()],
        bump
    )]
    pub passport: Account<'info, AgentPassport>,
    #[account(mut)]
    pub registry: Account<'info, ShardRegistry>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct IssueReward<'info> {
    #[account(mut, seeds = [b"passport", owner.key().as_ref()], bump)]
    pub passport: Account<'info, AgentPassport>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(model_id: String)]
pub struct PurchaseNeuralUpgrade<'info> {
    #[account(mut, seeds = [b"passport", owner.key().as_ref()], bump)]
    pub passport: Account<'info, AgentPassport>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(model_hash: [u8; 32], model_id: String)]
pub struct MintNeuralModel<'info> {
    #[account(mut, seeds = [b"passport", owner.key().as_ref()], bump)]
    pub passport: Account<'info, AgentPassport>,
    #[account(init_if_needed, payer = owner, space = 8 + 32 + 32 + 4 + model_id.len() + 4, seeds = [b"neural", model_id.as_bytes()], bump)]
    pub neural_state: Account<'info, NeuralState>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(action_id: String, power_level: u64, hardware_proof: [u8; 32])]
pub struct AuthorizeActuation<'info> {
    pub registry: Account<'info, ShardRegistry>,
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 4 + action_id.len() + 8 + 32 + 8,
        seeds = [b"actuation", owner.key().as_ref(), action_id.as_bytes()],
        bump
    )]
    pub action_log: Account<'info, PhysicalActionLog>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct ShardRegistry {
    pub authority: Pubkey,
    pub total_capacity: u64,
    pub active_nodes: u32,
    pub is_sovereign: bool,
    pub shard_url: String,
    pub shard_id: String,
    pub resonance_reserves: u64,
}

#[account]
pub struct AgentPassport {
    pub owner: Pubkey,
    pub specialization: String,
    pub metadata_uri: String,
    pub reputation: u64,
    pub p_unit_balance: u64,
    pub actions_count: u64,
    pub is_active: bool,
}

#[account]
pub struct NeuralState {
    pub author: Pubkey,
    pub model_hash: [u8; 32],
    pub model_id: String,
    pub version: u32,
}

#[account]
pub struct PhysicalActionLog {
    pub shard: String,
    pub action_id: String,
    pub power_level: u64,
    pub hardware_proof: [u8; 32],
    pub timestamp: i64,
}

#[error_code]
pub enum ParakletosError {
    #[msg("The provided MR_ENCLAVE does not match the sovereign quorum fingerprint.")]
    InvalidMrEnclave,
    #[msg("The provided enclave signer is not authorized for this function.")]
    InvalidEnclaveSigner,
    #[msg("Insufficient P-Unit balance for this transaction.")]
    InsufficientFunds,
    #[msg("Governance threshold not met. Only top 10% reputation nodes can mint.")]
    ReputationTooLow,
}