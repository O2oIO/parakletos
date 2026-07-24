"use client";

import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Program, AnchorProvider, Idl, BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import parakletosIdl from '../parakletos_program.json';

// Terminal Auth Wall
function AuthWall({ onAuthenticate }: { onAuthenticate: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'PARAKLETOS') { // Simple hardcoded secure key for demo
      onAuthenticate();
    } else {
      setError(true);
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 font-mono text-green-500">
      <div className="w-full max-w-md bg-gray-900 border border-green-500/30 p-8 rounded-lg shadow-2xl">
        <h1 className="text-2xl mb-2 flex items-center gap-2">
          <span className="animate-pulse">_</span> PARAKLETOS SECURE
        </h1>
        <p className="text-sm text-green-500/70 mb-6">FEDERAL CASE 87356931 // AUTHORIZED ACCESS ONLY</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider mb-2 opacity-70">Access Key</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              className="w-full bg-black border border-green-500/50 p-3 text-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="Enter cryptographic key..."
            />
          </div>
          {error && <p className="text-red-500 text-sm">ACCESS DENIED. INVALID SIGNATURE.</p>}
          <button type="submit" className="w-full bg-green-500/10 hover:bg-green-500/20 border border-green-500 text-green-500 py-3 font-bold tracking-widest transition-all">
            INITIALIZE HANDSHAKE
          </button>
        </form>
      </div>
    </div>
  );
}

// Enterprise Fleet Dashboard
function Dashboard() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [agents, setAgents] = useState<any[]>([]);
  const [latency, setLatency] = useState('< 1.0ms');
  const [isMinting, setIsMinting] = useState(false);
  
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch('/api/telemetry');
        const data = await res.json();
        if (data.agents) {
          // reverse so newest is on top
          setAgents([...data.agents].reverse());
        }
      } catch (err) {
        console.error('Failed to fetch telemetry', err);
      }
    };

    // Poll every 3 seconds
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, []);

  // Simulate latency fluctuations
  useEffect(() => {
    const latInterval = setInterval(() => {
      const ms = (0.5 + Math.random() * 1.5).toFixed(2);
      setLatency(`< ${ms}ms`);
    }, 2000);
    return () => clearInterval(latInterval);
  }, []);

  const handleMintAgent = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return;

    try {
      setIsMinting(true);
      
      const provider = new AnchorProvider(connection, wallet as any, { preflightCommitment: 'confirmed' });
      const program = new Program(parakletosIdl as Idl, provider);
      
      const [passportPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('passport'), wallet.publicKey.toBuffer()],
        program.programId
      );

      // Create a deterministic registry keypair for the master class demo
      const { Keypair } = require('@solana/web3.js');
      const registrySeed = new Uint8Array(32);
      const registryKeypair = Keypair.fromSeed(registrySeed);

      // 1. Check if the global registry exists, if not, initialize it
      const registryInfo = await connection.getAccountInfo(registryKeypair.publicKey);
      if (!registryInfo) {
        console.log("Initializing Global Shard Registry...");
        await program.methods
          .initializeRegistry(new BN(1000), "https://shard.parakletos.network", "SHARD_ALPHA")
          .accounts({
            registry: registryKeypair.publicKey,
            authority: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([registryKeypair])
          .rpc();
      }

      // 2. Invoke register_agent which issues the Agent Passport
      console.log("Sending register_agent transaction...");
      const tx = await program.methods
        .registerAgent("CYBER_WARFARE", "ipfs://QmTz.../meta.json")
        .accounts({
          passport: passportPda,
          registry: registryKeypair.publicKey,
          owner: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Transaction confirmed! Signature:", tx);
      
      // Inject telemetry so UI populates instantly
      await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: wallet.publicKey.toBase58(),
          hardware_proof: 'PHANTOM_ENCLAVE_AUTH',
          power_level: 100
        })
      });

    } catch (err: any) {
      console.error("Mint failed:", err);
      // Fallback injection so the UI still triggers if local validator isn't deployed yet
      if (err.message?.includes("AccountNotFound") || err.message?.includes("Program")) {
        console.warn("Local program missing, simulating telemetry for visual demo...");
        await fetch('/api/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_id: wallet.publicKey.toBase58(),
            hardware_proof: 'PHANTOM_SIMULATED',
            power_level: 100
          })
        });
      } else {
        alert("Minting failed! See console.");
      }
    } finally {
      setIsMinting(false);
    }
  };

  const handleSimulateDemo = async () => {
    try {
      setIsMinting(true);
      await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: "SIMULATED_" + Math.random().toString(36).substring(7),
          hardware_proof: 'MASTERCLASS_BYPASS',
          power_level: 999
        })
      });
    } catch (err) {
      console.error("Simulation failed:", err);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 font-sans p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex justify-between items-end border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight">OmniOps Barrier Gateway</h1>
            <p className="text-slate-500 mt-2">120-Agent Trust Economy Simulator</p>
          </div>
          <div className="flex items-center gap-4">
            <WalletMultiButton className="!bg-slate-800 hover:!bg-slate-700 !font-mono !text-sm !h-10" />
            <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-400 px-3 py-1.5 rounded-full text-sm font-medium border border-green-500/20">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              SYSTEM ONLINE
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Hardware Quorum Module */}
          <div className="md:col-span-1 bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Hardware Quorum</h2>
            
            <div className="space-y-6">
              <div className="flex justify-between items-center p-4 bg-black/40 rounded-lg border border-slate-800/50">
                <div>
                  <div className="text-white font-medium">Node Alpha</div>
                  <div className="text-xs text-slate-500 font-mono">Mothership (MBP)</div>
                </div>
                <div className="text-green-400 text-xs font-mono bg-green-400/10 px-2 py-1 rounded border border-green-400/20">LOCKED</div>
              </div>

              <div className="flex justify-center -my-3 relative z-10">
                <div className="bg-slate-800 text-slate-300 text-xs font-mono px-3 py-1 rounded-full border border-slate-700 flex items-center gap-2">
                  <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                  {latency}
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-black/40 rounded-lg border border-slate-800/50">
                <div>
                  <div className="text-white font-medium">Node Beta</div>
                  <div className="text-xs text-slate-500 font-mono">Exodus Shard (MBA)</div>
                </div>
                <div className="text-green-400 text-xs font-mono bg-green-400/10 px-2 py-1 rounded border border-green-400/20">LOCKED</div>
              </div>
            </div>

            {/* Sovereign Execution Layer */}
            <div className="mt-8 pt-8 border-t border-slate-800">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Sovereign Deployment</h3>
              {wallet.connected ? (
                <div className="flex flex-col gap-4">
                  <button
                    onClick={handleMintAgent}
                    disabled={isMinting}
                    className="px-6 py-3 w-full bg-red-900/40 border border-red-500/50 rounded text-red-100 font-mono text-sm hover:bg-red-800/40 transition-all disabled:opacity-50"
                  >
                    {isMinting ? "> EXECUTING ON-CHAIN..." : "> MINT SOVEREIGN AGENT"}
                  </button>
                  <button
                    onClick={handleSimulateDemo}
                    disabled={isMinting}
                    className="px-6 py-3 w-full bg-blue-900/40 border border-blue-500/50 rounded text-blue-100 font-mono text-sm hover:bg-blue-800/40 transition-all disabled:opacity-50"
                  >
                    {isMinting ? "> SIMULATING..." : "> SIMULATE MASTERCLASS DEMO (BYPASS WALLET)"}
                  </button>
                </div>
              ) : (
                <div className="text-center p-6 border border-zinc-800 rounded bg-black/50 backdrop-blur-md">
                  <p className="text-zinc-500 mb-4 font-mono text-sm">Connect wallet to enable execution.</p>
                  <button
                    onClick={handleSimulateDemo}
                    disabled={isMinting}
                    className="px-6 py-3 w-full bg-blue-900/40 border border-blue-500/50 rounded text-blue-100 font-mono text-sm hover:bg-blue-800/40 transition-all disabled:opacity-50"
                  >
                    {isMinting ? "> SIMULATING..." : "> SIMULATE MASTERCLASS DEMO (BYPASS WALLET)"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Deployment Tracking Grid */}
          <div className="md:col-span-2 bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm flex flex-col min-h-[400px]">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Multi-Agent Deployment Status</h2>
            
            <div className="flex-1 overflow-auto">
              {agents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 pt-12">
                  <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                  <p className="font-mono text-sm">Awaiting OmniOps Simulator payloads...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                        <th className="pb-3 font-medium px-2">Timestamp</th>
                        <th className="pb-3 font-medium px-2">Agent ID</th>
                        <th className="pb-3 font-medium px-2">Action / Risk</th>
                        <th className="pb-3 font-medium px-2">Trust Score</th>
                        <th className="pb-3 font-medium px-2 text-right">Validator Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {agents.map((agent, i) => (
                        <tr key={i} className="border-b border-slate-800/50 hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 px-2 text-slate-400 font-mono text-xs whitespace-nowrap">{new Date(agent.timestamp).toLocaleTimeString()}</td>
                          <td className="py-4 px-2 text-white font-mono">{agent.agent_id.substring(0, 12)}</td>
                          <td className="py-4 px-2 text-slate-400 font-mono flex items-center gap-2 mt-2">
                            <span className="text-cyan-400 uppercase text-xs font-bold">{agent.action}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                              agent.risk === 'critical' ? 'bg-red-500/10 text-red-500 border-red-500/30' :
                              agent.risk === 'high' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' :
                              agent.risk === 'medium' ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' :
                              'bg-green-500/10 text-green-500 border-green-500/30'
                            }`}>{agent.risk}</span>
                          </td>
                          <td className="py-4 px-2">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500" style={{width: `${parseFloat(agent.trust_score) * 100}%`}}></div>
                              </div>
                              <span className="text-indigo-400 font-mono text-xs">{agent.trust_score}</span>
                            </div>
                          </td>
                          <td className="py-4 px-2 text-right">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-mono font-medium ${
                              agent.validator_status === 'ACTIVE_ON_CHAIN' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {agent.validator_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // The password for the Secure Auth Wall is: PARAKLETOS
  if (!isAuthenticated) {
    return <AuthWall onAuthenticate={() => setIsAuthenticated(true)} />;
  }

  return <Dashboard />;
}
