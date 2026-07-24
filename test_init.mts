import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { IDL } from "./target/types/parakletos_program.ts";
import { PublicKey } from "@solana/web3.js";

const provider = anchor.AnchorProvider.env();
try {
  console.log("Starting program init...");
  const program = new Program(IDL as any, provider);
  console.log("Program init success!");
} catch (e) {
  console.error("Program init failed:", e);
}
