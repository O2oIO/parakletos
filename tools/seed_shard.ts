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
    const shard_id = process.argv[2];
    const parent_id = process.argv[3];
    
    console.log(`🌱 Seeding New Shard: ${shard_id} (Parent: ${parent_id})`);

    try {
        const [shardPDA] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("shard"), Buffer.from(shard_id)],
            program.programId
        );

        const tx = await program.methods
            .seedShard(shard_id, parent_id)
            .accounts({
                registry: shardPDA,
                authority: provider.wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            } as any)
            .rpc();

        console.log(`✅ Shard Seeded on-chain: ${tx}`);
    } catch (e) {
        console.error(`❌ Shard Seeding Failed: ${e}`);
        process.exit(1);
    }
}

main();
