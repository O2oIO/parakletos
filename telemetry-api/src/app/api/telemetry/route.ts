import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

// Parakletos Program ID from lib.rs
const PROGRAM_ID = new PublicKey('FsRpXPvwNbCaCU3CwC9UW9eFrwJYLCaq4hFVFhXyNd3w');

// Using the local validator loop (or devnet)
const CONNECTION_URL = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');
const connection = new Connection(CONNECTION_URL, 'confirmed');

// In-memory store for fleet state (clears on server restart)
const fleetState: Array<any> = [];

export async function GET() {
  return NextResponse.json({
    status: 'online',
    fleet_count: fleetState.length,
    agents: fleetState
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agent_id, hardware_proof, power_level, trust_score, action, risk, ...metadata } = body;

    if (!agent_id) {
      return NextResponse.json({ error: 'Missing agent_id (Public Key) in telemetry payload' }, { status: 400 });
    }

    // 1. Derive Public Key from incoming raw string inputs
    let ownerPubkey: PublicKey | null = null;
    let derivedPdaString = 'SIMULATED_PDA_' + Math.random().toString(36).substring(7);
    let isLive = false;

    try {
      ownerPubkey = new PublicKey(agent_id);
      
      // 2. Compute PDA Seeds (Agent Passport)
      const [passportPda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('passport'), ownerPubkey.toBuffer()],
        PROGRAM_ID
      );
      derivedPdaString = passportPda.toBase58();

      // 3. Cross-check their live activation status against the local validator loop
      const accountInfo = await connection.getAccountInfo(passportPda);
      isLive = accountInfo !== null;
    } catch (e) {
      // If it's not a valid public key (like a simulator ID), just accept it as simulated
      console.log(`Accepted non-crypto ID: ${agent_id}`);
    }

    const payload = {
      timestamp: new Date().toISOString(),
      agent_id,
      derived_pda: derivedPdaString,
      validator_status: isLive ? 'ACTIVE_ON_CHAIN' : 'ACTIVE_ON_BARRIER',
      power_level,
      hardware_proof: hardware_proof || 'PENDING',
      trust_score: trust_score || '1.00',
      action: action || 'deploy',
      risk: risk || 'low'
    };

    // Store in memory for the Enterprise Fleet Interface
    fleetState.push(payload);

    return NextResponse.json({ success: true, ...payload, bump });

  } catch (error: any) {
    console.error('Telemetry Ingestion Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
