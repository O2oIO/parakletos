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
    const market_id = process.argv[2] || "SYSTEM_GENERAL";
    const value = parseInt(process.argv[3] || "0");
    
    console.log(`🔮 Anchoring Forecast: ${market_id} | Risk: ${value}%`);

    try {
        // Find Agent Passport (assuming root authority for now)
        const [passportPDA] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("passport"), provider.wallet.publicKey.toBuffer()],
            program.programId
        );

        const tx = await program.methods
            .submitForecast(market_id, new anchor.BN(value))
            .accounts({
                passport: passportPDA,
                owner: provider.wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            } as any)
            .rpc();

        console.log(`✅ Forecast Anchored: ${tx}`);
    } catch (e) {
        console.error(`❌ Anchoring Failed: ${e}`);
        process.exit(1);
    }
}

main();
