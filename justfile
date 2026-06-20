# Tripwire — per-account buying-signal radar (HubSpot-embedded).
# Single source of truth for commands. See TOOLS.md for details.

# List available recipes
default:
    @just --list --unsorted

# (internal) Fail helpfully until the pnpm workspace exists (DESIGN.md M0)
_bootstrapped:
    @if [ ! -f package.json ]; then echo "tripwire is not bootstrapped: no package.json in repo root." >&2; echo "Scaffold the pnpm workspace per DESIGN.md milestone M0, then run 'just setup'." >&2; exit 1; fi

# (internal) Fail helpfully until docker-compose.yml exists (DESIGN.md M0)
_compose:
    @if [ ! -f docker-compose.yml ]; then echo "No docker-compose.yml yet — local Postgres (pgvector/pgvector:pg16) is defined in DESIGN.md milestone M0." >&2; exit 1; fi

# Enable corepack and install workspace dependencies
setup: _bootstrapped
    corepack enable
    pnpm install

# Run the dev servers (Next.js + Inngest dev) via the root dev script
dev: _bootstrapped
    pnpm dev

# Start local Postgres with pgvector in Docker
db-up: _compose
    docker compose up -d postgres

# Stop local Postgres
db-down: _compose
    docker compose down

# Apply Drizzle migrations to DATABASE_URL
migrate: _bootstrapped
    pnpm migrate

# Run unit tests (vitest across the workspace)
test: _bootstrapped
    pnpm test

# Run Playwright end-to-end tests
e2e: _bootstrapped
    pnpm e2e

# Lint all packages with ESLint
lint: _bootstrapped
    pnpm lint

# Format the repo with Prettier
format: _bootstrapped
    pnpm format

# verify formatting (prettier --check); CI gate
format-check: _bootstrapped
    pnpm run format:check

# audit dependencies for high+ severity advisories; CI gate
audit: _bootstrapped
    pnpm audit --audit-level=high

# Type-check all packages (tsc --noEmit)
typecheck: _bootstrapped
    pnpm typecheck

# Production build of all packages
build: _bootstrapped
    pnpm build

# Full merge gate: lint + typecheck + test + build (CI runs exactly this)
ci: lint format-check typecheck test build audit
