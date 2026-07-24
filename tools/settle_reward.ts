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
    const owner_pubkey = new anchor.web3.PublicKey(process.argv[2]);
    const amount = parseInt(process.argv[3] || "100");
    
    console.log(`💱 Settling Survival Reward: ${amount} P-Units for ${owner_pubkey.toBase58()}`);

    try {
        const [passportPDA] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("passport"), owner_pubkey.toBuffer()],
            program.programId
        );

        const tx = await program.methods
            .issueReward(new anchor.BN(amount))
            .accounts({
                passport: passportPDA,
                owner: owner_pubkey,
                authority: provider.wallet.publicKey,
            } as any)
            .rpc();

        console.log(`✅ Reward Issued: ${tx}`);
    } catch (e) {
        console.error(`❌ Reward Settlement Failed: ${e}`);
        process.exit(1);
    }
}

main();
