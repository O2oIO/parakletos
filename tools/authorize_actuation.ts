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
    const action_id = process.argv[2];
    const power_level = parseInt(process.argv[3]);
    const hardware_proof_hex = process.argv[4];
    const registry_pubkey = new anchor.web3.PublicKey(process.argv[5]);
    const user_pubkey = new anchor.web3.PublicKey(process.argv[6]);
    
    // Convert hex proof to [u8; 32]
    const hardware_proof = Buffer.from(hardware_proof_hex.replace('0x', ''), 'hex');
    const proof_array = Array.from(new Uint8Array(hardware_proof.buffer, hardware_proof.byteOffset, 32));

    console.log(`⚙️ Authorizing Hardened Actuation: ${action_id} | Level: ${power_level}%`);

    try {
        const [actionPDA] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("actuation"), user_pubkey.toBuffer(), Buffer.from(action_id)],
            program.programId
        );

        const tx = await program.methods
            .authorizeActuation(action_id, new anchor.BN(power_level), proof_array)
            .accounts({
                registry: registry_pubkey,
                actionLog: actionPDA,
                owner: user_pubkey,
                systemProgram: anchor.web3.SystemProgram.programId,
            } as any)
            .rpc();

        console.log(`✅ Actuation Proof Anchored: ${tx}`);
    } catch (e) {
        console.error(`❌ Actuation Proof Failed: ${e}`);
        process.exit(1);
    }
}

main();
