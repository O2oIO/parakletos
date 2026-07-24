import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import fs from "fs";

// Load IDL
const idlPath = "./target/idl/parakletos_program.json";
const IDL = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

// Config
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = new Program(IDL as any, provider);

async function main() {
    const amount = parseInt(process.argv[2]);
    const target_shard = process.argv[3];
    const user_pubkey = new anchor.web3.PublicKey(process.argv[4]);
    
    console.log(`🤝 Proposing Shard Trade: ${amount} P-Units to ${target_shard} for ${user_pubkey.toBase58()}`);

    try {
        const [passportPDA] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("passport"), user_pubkey.toBuffer()],
            program.programId
        );

        const [tradePDA] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("trade"), user_pubkey.toBuffer(), Buffer.from(target_shard)],
            program.programId
        );

        const tx = await program.methods
            .proposeShardTrade(new anchor.BN(amount), target_shard)
            .accounts({
                passport: passportPDA,
                tradeEscrow: tradePDA,
                owner: user_pubkey,
                systemProgram: anchor.web3.SystemProgram.programId,
            } as any)
            .rpc();

        console.log(`✅ Trade Proposed: ${tx}`);
    } catch (e) {
        console.error(`❌ Trade Proposal Failed: ${e}`);
        process.exit(1);
    }
}

main();
