#!/bin/bash
echo "🛑 Initiating Graceful Shutdown for Parakletos-Shard..."

# 1. Stop the Dashboard (if running in background)
echo "Stopping Dashboard..."
pkill -f "vite" || echo "Dashboard not running."

# 2. Stop the Orchestrator
echo "Stopping Orchestrator..."
pkill -f "orchestrator.py" || echo "Orchestrator not running."

# 3. Stop the Quorum Node
echo "Stopping Quorum Node..."
pkill -f "quorum-node" || echo "Quorum Node not running."

# 4. Stop Solana Local Validator (if active)
echo "Stopping Solana Validator..."
solana-validator exit || echo "No local validator active."

# 5. Backup current state
echo "Backing up state.json..."
cp dashboard/public/state.json dashboard/public/state.json.bak 2>/dev/null || echo "No state to backup."

echo "✅ All systems prepped for restart. Safe to proceed with macOS Update."
