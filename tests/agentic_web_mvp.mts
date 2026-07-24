import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ParakletosProgram } from "../target/types/parakletos_program";
import { expect } from "chai";
import { crypto } from "crypto";

describe("Agentic Web MVP", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ParakletosProgram as Program<ParakletosProgram>;
  const registry = anchor.web3.Keypair.generate();
  const SHARD_CAPACITY = new anchor.BN(1000000);
  const SHARD_URL = "http://localhost:2999";

  it("Scaffold Foundational Infrastructure", async () => {
    // 1. Initialize Registry
    await program.methods
      .initializeRegistry(SHARD_CAPACITY, SHARD_URL)
      .accounts({
        registry: registry.publicKey,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([registry])
      .rpc();

    console.log("🚀 Shard Registry Initialized.");

    // 2. Register Agents (Delphi Quorum)
    const agentCount = 3;
    const agents = Array.from({ length: agentCount }, () => anchor.web3.Keypair.generate());
    const specializations = ["Climate Analysis", "Carbon Verification", "Ecological Forecasting"];

    for (let i = 0; i < agentCount; i++) {
        // Airdrop to agent
        const signature = await provider.connection.requestAirdrop(agents[i].publicKey, 1000000000);
        await provider.connection.confirmTransaction(signature);

        const [passportPDA] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("passport"), agents[i].publicKey.toBuffer()],
            program.programId
        );

        await program.methods
            .registerAgent(specializations[i], `https://arweave.net/agent-${i}`)
            .accounts({
                passport: passportPDA,
                registry: registry.publicKey,
                owner: agents[i].publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([agents[i]])
            .rpc();
        
        console.log(`🛂 Agent ${i} Registered: ${specializations[i]}`);
    }

    // 3. Log Actions (Immutable Provenance)
    for (let i = 0; i < agentCount; i++) {
        const actionHash = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256));
        const [passportPDA] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("passport"), agents[i].publicKey.toBuffer()],
            program.programId
        );

        const passportAccount = await program.account.agentPassport.fetch(passportPDA);
        const [actionLogPDA] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                Buffer.from("action"), 
                passportPDA.toBuffer(), 
                passportAccount.actionsCount.toArrayLike(Buffer, "le", 8)
            ],
            program.programId
        );

        await program.methods
            .logAction(actionHash, "Data Ingestion")
            .accounts({
                passport: passportPDA,
                actionLog: actionLogPDA,
                owner: agents[i].publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([agents[i]])
            .rpc();
        
        console.log(`📝 Agent ${i} Logged Action: Data Ingestion`);
    }

    // 4. Submit Forecasts (Delphi Consensus Loop)
    const marketId = "SacredSustainability_2026_Q2";
    for (let i = 0; i < agentCount; i++) {
        const [passportPDA] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("passport"), agents[i].publicKey.toBuffer()],
            program.programId
        );

        const [forecastPDA] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("forecast"), passportPDA.toBuffer(), Buffer.from(marketId)],
            program.programId
        );

        const forecastValue = new anchor.BN(85 + i * 5); // 85, 90, 95

        await program.methods
            .submitForecast(marketId, forecastValue)
            .accounts({
                passport: passportPDA,
                forecast: forecastPDA,
                owner: agents[i].publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([agents[i]])
            .rpc();
        
        console.log(`🔮 Agent ${i} Forecast: ${forecastValue.toNumber()}% Success Probability`);
    }

    // 5. Finalize Delphi Signal (Consensus)
    console.log("🛰️ Finalizing Delphi Signal...");
    let totalValue = 0;
    for (let i = 0; i < agentCount; i++) {
        const [passportPDA] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("passport"), agents[i].publicKey.toBuffer()],
            program.programId
        );
        const [forecastPDA] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("forecast"), passportPDA.toBuffer(), Buffer.from(marketId)],
            program.programId
        );
        const forecast = await program.account.forecast.fetch(forecastPDA);
        totalValue += forecast.value.toNumber();
    }
    const delphiSignal = totalValue / agentCount;
    console.log(`✅ Delphi Consensus Signal for ${marketId}: ${delphiSignal}%`);
    expect(delphiSignal).to.equal(90);
  });
});
