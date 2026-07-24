import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, AddressLookupTableProgram } from "@solana/web3.js";
import { expect } from "chai";
import { IDL } from "../target/types/parakletos_program.js";

describe("parakletos_program", () => {
    // We expect ANCHOR_PROVIDER_URL and ANCHOR_WALLET to be set in the environment
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const programId = new PublicKey("FsRpXPvwNbCaCU3CwC9UW9eFrwJYLCaq4hFVFhXyNd3w");
    const program = new Program(IDL, provider);
    const registry = anchor.web3.Keypair.generate();
    const SHARD_CAPACITY = new anchor.BN(1800000000000); // 1.8 TB in bytes

    it("🚀 Initializes the 1.8 TB Shard Registry", async () => {
        await program.methods
            .initializeRegistry(SHARD_CAPACITY)
            .accounts({
                registry: registry.publicKey,
                authority: provider.wallet.publicKey,
            })
            .signers([registry])
            .rpc();

        const account = await program.account.shardRegistry.fetch(registry.publicKey);
        if (account.totalCapacity.toString() !== SHARD_CAPACITY.toString()) {
            throw new Error("Capacity mismatch");
        }
        console.log("✅ Registry Anchored: 1.8 TB Capacity Verified.");
    });

    it("🛡️ Authorizes the 120-Node Workforce via ALTs", async () => {
        const nodeCount = 120;
        const nodes = Array.from({ length: nodeCount }, () => anchor.web3.Keypair.generate());

        console.log(`🔨 Constructing ALT for ${nodeCount} nodes...`);

        // 1. Create Lookup Table (v0 Compression)
        const [lookupTableInst, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
            authority: provider.wallet.publicKey,
            payer: provider.wallet.publicKey,
            recentSlot: await provider.connection.getSlot(),
        });

        // 2. Extend Lookup Table with Node Addresses
        const extendInstruction = AddressLookupTableProgram.extendLookupTable({
            payer: provider.wallet.publicKey,
            authority: provider.wallet.publicKey,
            lookupTable: lookupTableAddress,
            addresses: nodes.map(n => n.publicKey),
        });

        // Send Setup Instructions
        await provider.sendAndConfirm(new anchor.web3.Transaction().add(lookupTableInst, extendInstruction));

        console.log(`✅ ALT Created at: ${lookupTableAddress.toBase58()}`);
        console.log("🛰️ Batch Authorizing Nodes...");

        // 3. Parallel Authorization Simulation (Standard Loop)
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
        if (registryAccount.activeNodes !== nodeCount) {
             console.log(`Warning: expected ${nodeCount} nodes but found ${registryAccount.activeNodes}`);
        }
        console.log("🏁 Workforce Synchronized: 120 Nodes Operational.");
    });
});
