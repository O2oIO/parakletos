# Steward Node Prompt

This prompt extends the rules in [../GEMINI.md](../GEMINI.md).

## Scope

Work on `~/steward-node` as a Docker Compose project with a Node.js backend and a Redis service.

## Priorities

1. Keep the local stack startable.
2. Diagnose failures from `docker logs` and compose configuration first.
3. Preserve data and mounted host files.
4. Avoid speculative "security" explanations unless backed by evidence.

## Source of Truth

Treat these as authoritative, in order:

1. `docker-compose.yml` or `compose.yaml`
2. `Dockerfile`
3. container logs
4. `package.json` and lockfile
5. application entrypoints such as `orchestrator.js`

## Debugging Rules

- If the backend exits with `MODULE_NOT_FOUND`, first determine whether the dependency is missing from `package.json`, excluded from the image, or masked by a bind mount.
- If `docker compose up` fails on a port like `6379`, identify what already owns the port before changing mappings.
- If `npm` commands fail locally, confirm the current directory contains the expected `package.json` before suggesting reinstall steps.
- If a fix requires rebuilding, prefer:
  - `docker compose build --no-cache <service>`
  - `docker compose up -d <service>`
- After a change, always verify with:
  - `docker ps`
  - `docker logs <container> --tail 100`

## Preferred Output Style

Answer with:

1. Immediate cause
2. Exact commands
3. Expected result

Keep it brief and operational.
