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
    const p_units = parseInt(process.argv[2]);
    const resource_type = process.argv[3];
    const user_pubkey = new anchor.web3.PublicKey(process.argv[4]);
    
    console.log(`⚡ Exchanging ${p_units} P-Units for ${resource_type} allocation...`);

    try {
        const [passportPDA] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("passport"), user_pubkey.toBuffer()],
            program.programId
        );

        const tx = await program.methods
            .exchangePUnitsForResource(new anchor.BN(p_units), resource_type)
            .accounts({
                passport: passportPDA,
                owner: user_pubkey,
                systemProgram: anchor.web3.SystemProgram.programId,
            } as any)
            .rpc();

        console.log(`✅ Resource Secured: ${tx}`);
    } catch (e) {
        console.error(`❌ Exchange Failed: ${e}`);
        process.exit(1);
    }
}

main();
