#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

if ! command -v git >/dev/null 2>&1; then
  echo "Git is required. Install the Xcode Command Line Tools with: xcode-select --install" >&2
  exit 1
fi

NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
export NVM_DIR
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  source "$NVM_DIR/nvm.sh"
elif [[ -s /opt/homebrew/opt/nvm/nvm.sh ]]; then
  mkdir -p "$NVM_DIR"
  # shellcheck source=/dev/null
  source /opt/homebrew/opt/nvm/nvm.sh
elif [[ -s /usr/local/opt/nvm/nvm.sh ]]; then
  mkdir -p "$NVM_DIR"
  # shellcheck source=/dev/null
  source /usr/local/opt/nvm/nvm.sh
else
  echo "nvm is required. Install it with 'brew install nvm', create $NVM_DIR, then rerun this script." >&2
  exit 1
fi

nvm install
nvm use
corepack enable
corepack prepare pnpm@12.3.4 --activate

if command -v gh >/dev/null 2>&1; then
  gh auth status >/dev/null 2>&1 || echo "GitHub CLI is optional and not authenticated; run: gh auth login"
else
  echo "GitHub CLI is optional; install with: brew install gh"
fi

pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm skills:install
pnpm run doctor

if [[ "${1:-}" == "--with-docker" ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is not installed. Install Docker Desktop, then rerun with --with-docker." >&2
    exit 1
  fi
  docker info >/dev/null
  pnpm infra:up
  for attempt in {1..30}; do
    if docker compose exec -T postgres pg_isready -U traquenard >/dev/null 2>&1; then
      break
    fi
    if [[ "$attempt" == "30" ]]; then
      echo "PostgreSQL did not become ready within 30 seconds." >&2
      exit 1
    fi
    sleep 1
  done
  pnpm db:migrate
  DATABASE_URL="postgres://traquenard:traquenard@localhost:5432/traquenard" pnpm test:integration
fi

pnpm verify
