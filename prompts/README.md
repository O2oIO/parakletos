# Prompt Layout

This directory keeps Gemini prompts aligned across projects without duplicating the full policy text in each file.

## Files

- `../GEMINI.md`
  - Shared operating rules
  - Debugging posture
  - Evidence standards
  - Response format
- `steward-node.md`
  - Docker/Node/Redis-specific overlay for `~/steward-node`
- `parakletos-solana.md`
  - Solana/Anchor/Git-layout-specific overlay for `~/parakletos-solana`

## Recommended Usage

For a new Gemini Terminal session:

1. Load `GEMINI.md`
2. Load the project-specific prompt for the repo you are working in

Helper scripts are available in `bin/`:

- `bin/gemini-steward`
- `bin/gemini-parakletos`

These print the prompt files to load and the suggested working directory.

Example:

- `~/steward-node`:
  - base: `~/parakletos-solana/GEMINI.md`
  - overlay: `~/parakletos-solana/prompts/steward-node.md`
- `~/parakletos-solana`:
  - base: `~/parakletos-solana/GEMINI.md`
  - overlay: `~/parakletos-solana/prompts/parakletos-solana.md`

## Maintenance Rule

When changing prompt behavior:

1. Update `GEMINI.md` if the rule should apply everywhere.
2. Update only the project overlay if the rule is project-specific.
3. Avoid copying large chunks of shared policy into the overlays.

## Why This Layout

This keeps prompts:

- reusable across projects
- harmonized under one shared operating model
- easier to update without drift
