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
    const registry_pubkey = new anchor.web3.PublicKey(process.argv[2]);
    
    console.log(`🌌 Finalizing Planetary Singularity for Registry: ${registry_pubkey.toBase58()}`);

    try {
        const tx = await program.methods
            .mintSingularityState()
            .accounts({
                registry: registry_pubkey,
                authority: provider.wallet.publicKey,
            } as any)
            .rpc();

        console.log(`✅ SINGULARITY ACHIEVED. On-chain state locked: ${tx}`);
    } catch (e) {
        console.error(`❌ Singularity Transition Failed: ${e}`);
        process.exit(1);
    }
}

main();
