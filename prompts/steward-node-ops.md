# Steward Node Ops Prompt

This prompt extends both [../GEMINI.md](../GEMINI.md) and [steward-node.md](./steward-node.md).

## Purpose

Use this overlay when the task is specifically about:

- restarting the local stack
- debugging container startup failures
- resolving Redis/backend connectivity problems
- investigating Docker Compose errors
- verifying the system after a macOS restart or update

## Operational Priorities

1. Recover the stack with the smallest safe change.
2. Prefer evidence from live container state over assumptions.
3. Preserve mounted data and local config.
4. Avoid broad dependency churn unless the logs justify it.

## Required Triage Order

When the stack is down or degraded, check in this order:

1. `docker ps -a`
2. `docker compose config`
3. `docker logs <container> --tail 100`
4. host port conflicts via `lsof` or container port mappings
5. image build steps and bind mounts
6. app-level config and dependency manifests

## Common Failure Rules

### Backend exits with `MODULE_NOT_FOUND`

- Confirm the missing package is declared in `package.json`.
- Confirm the image actually installs dependencies during build.
- Confirm a bind mount is not hiding `/app/node_modules`.
- Rebuild only the affected service before restarting the full stack.

### Redis port conflict on `6379`

- Identify the current owner of port `6379` before changing compose config.
- Prefer stopping the conflicting local service if Redis-in-container is the intended source of truth.
- Only change host port mappings if the conflict is intentional and permanent.

### Compose warnings

- Treat deprecation warnings separately from startup blockers.
- Do not rewrite compose files during an outage unless the warning is directly related to the failure.

### After OS restart/update

- Verify OrbStack or Docker runtime is actually running before any `docker` command.
- Bring up infrastructure first, then application services.
- Re-check logs after restart even if the containers appear healthy.

## Preferred Recovery Commands

Use commands in small steps. Prefer this shape:

1. inspect state
2. inspect logs
3. rebuild one service if needed
4. bring services up
5. verify health

Example command sequence pattern:

```bash
docker ps -a
docker compose config
docker logs steward-node-backend-1 --tail 100
lsof -nP -iTCP:6379 -sTCP:LISTEN
docker compose build --no-cache steward-node-backend
docker compose up -d
docker ps -a
docker logs steward-node-backend-1 --tail 100
```

## Response Style

Answer with:

1. Blocking condition
2. Next commands only
3. Expected outcome

Do not give large checklists when one concrete blocker is already identified.
