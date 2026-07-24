"use client";

import React, { useState, useEffect } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

// Default styles that can be overridden by your app
import "@solana/wallet-adapter-react-ui/styles.css";

export default function AppWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Use official devnet to prevent Phantom from blocking localhost RPC connections
  const endpoint = clusterApiUrl(WalletAdapterNetwork.Devnet);

  return (
    <ConnectionProvider endpoint={endpoint}>
      {/* 
        We pass an empty wallets array (or omit it) because modern 
        wallets like Phantom use the Wallet Standard and are auto-detected! 
      */}
      <WalletProvider wallets={[]} autoConnect={false}>
        <WalletModalProvider>{mounted ? children : null}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
