import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import pkg from "@solana/web3.js";
const { PublicKey, AddressLookupTableProgram, Keypair, Transaction } = pkg;
import { IDL } from "./target/types/parakletos_program.js";
import fs from "fs";

async function run() {
    console.log("🚀 Starting Sovereign Node Authorization Test...");

    // Setup Provider
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const programId = new PublicKey("FsRpXPvwNbCaCU3CwC9UW9eFrwJYLCaq4hFVFhXyNd3w");
    const program = new Program(IDL, provider);
    const registry = Keypair.generate();
    const SHARD_CAPACITY = new anchor.BN(1800000000000); // 1.8 TB

    try {
        console.log("📡 Initializing Shard Registry...");
        const tx = await program.methods
            .initializeRegistry(SHARD_CAPACITY)
            .accounts({
                registry: registry.publicKey,
                authority: provider.wallet.publicKey,
            })
            .signers([registry])
            .rpc();
        console.log("✅ Registry Initialized. TX:", tx);

        const nodeCount = 10; // Reduced for quick test
        const nodes = Array.from({ length: nodeCount }, () => Keypair.generate());

        console.log(`🛰️ Batch Authorizing ${nodeCount} Nodes...`);
        for (let i = 0; i < nodeCount; i++) {
            await program.methods
                .authorizeNode(i)
                .accounts({
                    registry: registry.publicKey,
                    nodeToAuthorize: nodes[i].publicKey,
                    authority: provider.wallet.publicKey,
                })
                .rpc();
        }

        const registryAccount = await program.account.shardRegistry.fetch(registry.publicKey);
        console.log(`🏁 workforce Synchronized: ${registryAccount.activeNodes} Nodes Operational.`);
        console.log("🎉 Test Successful!");
    } catch (err) {
        console.error("❌ Test Failed:", err);
    }
}

run();
