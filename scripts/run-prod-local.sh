#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/deploy/docker-compose.yml"

cd "${PROJECT_ROOT}"

log() {
  printf '\n[project-z] %s\n' "$*"
}

fail() {
  printf '\n[project-z] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required."
}

use_docker_desktop_cli_if_needed() {
  if command -v docker >/dev/null 2>&1; then
    return
  fi

  local docker_desktop_bin="/Applications/Docker.app/Contents/Resources/bin"

  if [ -x "${docker_desktop_bin}/docker" ]; then
    export PATH="${docker_desktop_bin}:${PATH}"
    log "Using Docker CLI from Docker Desktop"
    return
  fi

  fail "docker is required. Install Docker Desktop and start it once, or add Docker CLI to PATH."
}

if [ -z "${NVM_DIR:-}" ]; then
  export NVM_DIR="${HOME}/.nvm"
fi

if [ -s "${NVM_DIR}/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "${NVM_DIR}/nvm.sh"
fi

if command -v nvm >/dev/null 2>&1 && [ -f "${PROJECT_ROOT}/.nvmrc" ]; then
  log "Using Node from .nvmrc"
  nvm use
fi

require_command npm
use_docker_desktop_cli_if_needed

docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin is required."
docker info >/dev/null 2>&1 || fail "Docker Desktop is not running. Start Docker Desktop, then rerun this script."

export PROJECT_Z_POSTGRES_DB="${PROJECT_Z_POSTGRES_DB:-project_z}"
export PROJECT_Z_POSTGRES_USER="${PROJECT_Z_POSTGRES_USER:-project_z}"
export PROJECT_Z_POSTGRES_PASSWORD="${PROJECT_Z_POSTGRES_PASSWORD:-project_z_local_password}"
export PROJECT_Z_DB_PORT="${PROJECT_Z_DB_PORT:-54321}"
export PROJECT_Z_PROXY_PORT="${PROJECT_Z_PROXY_PORT:-8080}"
export PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN="${PROJECT_Z_ANNOUNCEMENT_WORKER_TOKEN:-local-worker-token}"
export PROJECT_Z_PACHCA_DELIVERY_MODE="${PROJECT_Z_PACHCA_DELIVERY_MODE:-dry-run}"

DEFAULT_DATABASE_URL="postgres://${PROJECT_Z_POSTGRES_USER}:${PROJECT_Z_POSTGRES_PASSWORD}@127.0.0.1:${PROJECT_Z_DB_PORT}/${PROJECT_Z_POSTGRES_DB}"
DATABASE_URL="${DATABASE_URL:-${DEFAULT_DATABASE_URL}}"
APP_URL="http://127.0.0.1:${PROJECT_Z_PROXY_PORT}"

if [ ! -d "${PROJECT_ROOT}/node_modules" ]; then
  log "Installing npm dependencies"
  npm install
fi

log "Building production frontend bundle"
npm run build

log "Starting PostgreSQL on host port ${PROJECT_Z_DB_PORT}"
docker compose -f "${COMPOSE_FILE}" up -d db

log "Waiting for PostgreSQL to accept connections"
DB_READY=0
for _ in {1..60}; do
  if docker compose -f "${COMPOSE_FILE}" exec -T db pg_isready \
    -U "${PROJECT_Z_POSTGRES_USER}" \
    -d "${PROJECT_Z_POSTGRES_DB}" >/dev/null 2>&1; then
    DB_READY=1
    break
  fi

  sleep 1
done

if [ "${DB_READY}" != "1" ]; then
  fail "PostgreSQL did not become ready."
fi

log "Applying DB migrations"
DATABASE_URL="${DATABASE_URL}" npm run db:migrate

log "Building and starting API plus nginx proxy"
docker compose -f "${COMPOSE_FILE}" up --build -d

if command -v curl >/dev/null 2>&1; then
  log "Waiting for app at ${APP_URL}"
  APP_READY=0
  for _ in {1..60}; do
    if curl -fsS "${APP_URL}/healthz" >/dev/null 2>&1; then
      APP_READY=1
      break
    fi

    sleep 1
  done

  if [ "${APP_READY}" != "1" ]; then
    docker compose -f "${COMPOSE_FILE}" ps
    fail "App did not become healthy at ${APP_URL}."
  fi

  curl -fsS "${APP_URL}/" >/dev/null
  curl -fsS "${APP_URL}/api/me" >/dev/null
else
  log "curl not found; skipping HTTP smoke checks"
fi

cat <<EOF

[project-z] Production-like local build is running:
  ${APP_URL}/

[project-z] Useful commands:
  docker compose -f deploy/docker-compose.yml ps
  docker compose -f deploy/docker-compose.yml logs -f api proxy
  docker compose -f deploy/docker-compose.yml down
EOF
