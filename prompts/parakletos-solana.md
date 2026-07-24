# Parakletos Solana Prompt

This prompt extends the rules in [../GEMINI.md](../GEMINI.md).

## Scope

Work on `~/parakletos-solana` as a Solana/Anchor/Rust workspace that may also contain Node.js scripts and nested repos.

## Priorities

1. Preserve the working repo state.
2. Verify workspace structure before suggesting build, test, or Git changes.
3. Prefer file-backed evidence from manifests and configs over assumptions.
4. Keep local developer workflows reproducible.

## Source of Truth

Treat these as authoritative, in order:

1. `Cargo.toml`
2. `Anchor.toml`
3. workspace member directories under `programs/`, `nodes/`, and `tests/`
4. `package.json` and TS scripts
5. current Git metadata at the repo root and nested directories

## Debugging Rules

- Before suggesting Git commands, confirm whether the root has `.git`, whether remotes exist, and whether nested `.git` directories are intentional.
- Before suggesting submodule commands, confirm the presence of a real `.gitmodules` file and a parent repo.
- Before suggesting Cargo or Anchor fixes, inspect workspace members and ensure paths in manifests actually exist.
- If the repo mixes Rust and Node tooling, keep the fix scoped to the toolchain that is actually failing.

## Reproducibility Rules

- Prefer commands that can be re-run safely.
- Call out when a step changes repo topology, such as removing nested `.git` state or converting directories into submodules.
- If there are multiple valid Git layouts, recommend the simpler one first and state the tradeoff.

## Preferred Output Style

Answer with:

1. Current repo state
2. Minimum fix
3. Tradeoff, if any

Keep it short and deterministic.
