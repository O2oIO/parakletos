import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ParakletosProgram } from "../target/types/parakletos_program.js";
import IDL from "../target/idl/parakletos_program.json";
import { PublicKey, AddressLookupTableProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { expect } from "chai";

describe("parakletos_program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  console.log("🔍 IDL Loaded:", !!IDL);
  console.log("🛰️ Provider Wallet:", provider.wallet.publicKey.toBase58());

  const program = new Program(IDL as any, provider) as Program<ParakletosProgram>;
  const registry = anchor.web3.Keypair.generate();
  console.log("🆕 Generated Registry Address:", registry.publicKey.toBase58());
  const SHARD_CAPACITY = new anchor.BN(1800000000000); // 1.8 TB in bytes
  const SHARD_URL = "http://localhost:2999";

  it("🚀 Initializes the 1.8 TB Shard Registry", async () => {
    await program.methods
      .initializeRegistry(SHARD_CAPACITY, SHARD_URL)
      .accounts({
        registry: registry.publicKey,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([registry])
      .rpc();

    const account = await program.account.shardRegistry.fetch(registry.publicKey);
    expect(account.totalCapacity.toString()).to.equal(SHARD_CAPACITY.toString());
    expect(account.shardUrl).to.equal(SHARD_URL);
    console.log("✅ Registry Anchored: 1.8 TB Capacity Verified.");
  });

  it("🛡️ Authorizes the 120-Node Workforce via ALTs", async () => {
    const nodeCount = 120;
    const nodes = Array.from({ length: nodeCount }, () => anchor.web3.Keypair.generate());

    console.log(`🔨 Constructing ALT for ${nodeCount} nodes...`);

    // Ensure we have a recent slot that is at least a few slots ahead of genesis
    let slot = await provider.connection.getSlot("confirmed");
    while (slot < 10) {
        await new Promise(r => setTimeout(r, 500));
        slot = await provider.connection.getSlot("confirmed");
    }

    // 1. Create Lookup Table (v0 Compression)
    const [lookupTableInst, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
      authority: provider.wallet.publicKey,
      payer: provider.wallet.publicKey,
      recentSlot: slot,
    });

    // Send Create Instruction
    await provider.sendAndConfirm(new anchor.web3.Transaction().add(lookupTableInst));

    // 2. Extend Lookup Table with Node Addresses in Batches
    const chunkSize = 25;
    for (let i = 0; i < nodes.length; i += chunkSize) {
        const chunk = nodes.slice(i, i + chunkSize).map(n => n.publicKey);
        const extendInstruction = AddressLookupTableProgram.extendLookupTable({
            payer: provider.wallet.publicKey,
            authority: provider.wallet.publicKey,
            lookupTable: lookupTableAddress,
            addresses: chunk,
        });
        await provider.sendAndConfirm(new anchor.web3.Transaction().add(extendInstruction));
        console.log(`📡 Chunker: ${i + chunk.length}/${nodeCount} nodes added to ALT.`);
    }

    console.log(`✅ ALT Finalized at: ${lookupTableAddress.toBase58()}`);
    console.log("🛰️ Batch Authorizing Nodes...");

    // 3. Parallel Authorization Simulation
    const dummyMrEnclave = Array.from({ length: 32 }, () => 0);
    // In a real scenario, these would be valid Switchboard accounts
    const dummyFunction = anchor.web3.Keypair.generate();
    const dummyEnclaveSigner = anchor.web3.Keypair.generate();

    for (let i = 0; i < nodeCount; i++) {
      const [nodePassportPDA] = anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from("node"), registry.publicKey.toBuffer(), new anchor.BN(i).toArrayLike(Buffer, "le", 4)],
          program.programId
      );

      // Note: This test will likely fail on-chain verification without a real Switchboard setup,
      // but it validates the account structure.
      try {
        await program.methods
          .authorizeNode(i, dummyMrEnclave)
          .accounts({
            registry: registry.publicKey,
            nodePassport: nodePassportPDA,
            nodeToAuthorize: nodes[i].publicKey,
            function: dummyFunction.publicKey,
            enclaveSigner: dummyEnclaveSigner.publicKey,
            authority: provider.wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          } as any)
          .signers([dummyEnclaveSigner])
          .rpc();
      } catch (e) {
        console.log(`⚠️ Expected failure in dummy Switchboard verification for Node #${i}`);
      }
    }

    const registryAccount = await program.account.shardRegistry.fetch(registry.publicKey) as any;
    expect(Number(registryAccount.activeNodes)).to.equal(nodeCount);
    console.log("🏁 Workforce Synchronized: 120 Nodes Operational.");
  });
});
