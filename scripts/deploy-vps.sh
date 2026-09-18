#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

APP_DIR="${APP_DIR:-/opt/liven-api}"
REPO_DIR="$APP_DIR/repo"
MINIO_COMPOSE_FILE="$REPO_DIR/deploy/docker-compose.minio.yml"
PM2_APP_NAME="${PM2_APP_NAME:-liven-api}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-dev}"
# Dedicated host ports — must not collide with Sumer (9000/9001).
MINIO_HOST_PORT="${MINIO_HOST_PORT:-9010}"
MINIO_CONSOLE_HOST_PORT="${MINIO_CONSOLE_HOST_PORT:-9011}"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

manage_service() {
  local service_name="$1"
  local action="$2"

  if has_cmd systemctl; then
    $SUDO systemctl "$action" "$service_name" >/dev/null 2>&1 || true
    return 0
  fi

  if has_cmd service; then
    $SUDO service "$service_name" "$action" >/dev/null 2>&1 || true
    return 0
  fi

  if has_cmd rc-service; then
    $SUDO rc-service "$service_name" "$action" >/dev/null 2>&1 || true
    return 0
  fi

  log "No service manager found for $service_name ($action skipped)"
  return 0
}

sql_escape_literal() {
  printf "%s" "$1" | sed "s/'/''/g"
}

require_root() {
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    if has_cmd sudo; then
      SUDO="sudo"
    else
      echo "This script needs root privileges or sudo installed." >&2
      exit 1
    fi
  else
    SUDO=""
  fi
}

install_if_missing() {
  local cmd="$1"
  local pkg="$2"
  if ! has_cmd "$cmd"; then
    log "Installing missing package: $pkg"
    $SUDO apt-get install -y "$pkg"
  fi
}

ensure_node() {
  if has_cmd node && has_cmd npm; then
    local major_version
    major_version="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
    if [ "${major_version:-0}" -ge 18 ]; then
      return
    fi
  fi

  log "Installing Node.js and npm from apt"
  $SUDO apt-get install -y nodejs npm

  if has_cmd node && has_cmd npm; then
    local apt_major_version
    apt_major_version="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
    if [ "${apt_major_version:-0}" -ge 18 ]; then
      return
    fi
  fi

  if ! has_cmd npm; then
    echo "npm was not installed correctly; cannot continue." >&2
    exit 1
  fi

  log "Upgrading Node.js to v20 using n"
  $SUDO npm install -g n
  $SUDO n 20

  hash -r
  if [ -x /usr/local/bin/node ] && [ -x /usr/local/bin/npm ]; then
    export PATH="/usr/local/bin:$PATH"
  fi

  if ! has_cmd node || ! has_cmd npm; then
    echo "Node.js installation failed." >&2
    exit 1
  fi

  local final_major_version
  final_major_version="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "${final_major_version:-0}" -lt 18 ]; then
    echo "Node.js version is too old (${final_major_version}). Need >= 18." >&2
    exit 1
  fi

  log "Using Node.js $(node -v) and npm $(npm -v)"
}

ensure_pm2() {
  if ! has_cmd pm2; then
    log "Installing PM2 globally"
    $SUDO npm install -g pm2
  fi
}

ensure_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker compose"
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
    return
  fi

  echo "Docker Compose is not available." >&2
  exit 1
}

ensure_docker() {
  if has_cmd docker; then
    return
  fi

  log "Installing Docker (fallback-safe)"
  if ! $SUDO apt-get install -y docker.io docker-compose-plugin; then
    $SUDO apt-get install -y docker.io docker-compose
  fi
  manage_service docker enable
  manage_service docker restart

  if ! has_cmd docker; then
    echo "Docker installation failed." >&2
    exit 1
  fi
}

ensure_postgres() {
  if ! has_cmd psql; then
    log "Installing PostgreSQL on host"
    $SUDO apt-get install -y postgresql postgresql-contrib
  fi

  manage_service postgresql enable
  manage_service postgresql restart
}

ensure_postgres_auth_from_env() {
  if [ ! -f "$REPO_DIR/.env" ]; then
    echo ".env not found at $REPO_DIR/.env" >&2
    exit 1
  fi

  local DATABASE_USER DATABASE_PASSWORD DATABASE_DB
  DATABASE_USER="$(sed -n 's/^DATABASE_USER=//p' "$REPO_DIR/.env" | tail -n 1)"
  DATABASE_PASSWORD="$(sed -n 's/^DATABASE_PASSWORD=//p' "$REPO_DIR/.env" | tail -n 1)"
  DATABASE_DB="$(sed -n 's/^DATABASE_DB=//p' "$REPO_DIR/.env" | tail -n 1)"

  if [ -z "${DATABASE_USER:-}" ] || [ -z "${DATABASE_PASSWORD:-}" ] || [ -z "${DATABASE_DB:-}" ]; then
    echo "DATABASE_USER, DATABASE_PASSWORD, or DATABASE_DB is missing in .env" >&2
    exit 1
  fi

  local role_literal password_literal db_literal role_ident db_ident
  role_literal="$(sql_escape_literal "$DATABASE_USER")"
  password_literal="$(sql_escape_literal "$DATABASE_PASSWORD")"
  db_literal="$(sql_escape_literal "$DATABASE_DB")"
  role_ident="${DATABASE_USER//\"/\"\"}"
  db_ident="${DATABASE_DB//\"/\"\"}"

  log "Syncing PostgreSQL role and database from .env (Liven only)"

  su - postgres -c "psql -v ON_ERROR_STOP=1 -c \"DO \\\$\\\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$role_literal') THEN CREATE ROLE \\\"$role_ident\\\" LOGIN PASSWORD '$password_literal'; ELSE ALTER ROLE \\\"$role_ident\\\" WITH LOGIN PASSWORD '$password_literal'; END IF; END \\\$\\\$;\""

  if ! su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='$db_literal';\"" | grep -q 1; then
    su - postgres -c "psql -v ON_ERROR_STOP=1 -c \"CREATE DATABASE \\\"$db_ident\\\" OWNER \\\"$role_ident\\\";\""
  else
    su - postgres -c "psql -v ON_ERROR_STOP=1 -c \"ALTER DATABASE \\\"$db_ident\\\" OWNER TO \\\"$role_ident\\\";\"" || true
  fi
}

bootstrap_schema_if_needed() {
  local DATABASE_DB
  DATABASE_DB="$(sed -n 's/^DATABASE_DB=//p' "$REPO_DIR/.env" | tail -n 1)"

  if [ -z "${DATABASE_DB:-}" ]; then
    echo "DATABASE_DB is missing in .env" >&2
    exit 1
  fi

  local users_exists
  users_exists="$(su - postgres -c "psql -d \"$DATABASE_DB\" -tAc \"SELECT to_regclass('public.users') IS NOT NULL;\"")"
  if [ "$users_exists" = "t" ]; then
    return
  fi

  log "Bootstrapping schema (first deploy on empty database)"
  timeout 90s env NODE_ENV=production node dist/main >/tmp/liven-bootstrap.log 2>&1 || true

  users_exists="$(su - postgres -c "psql -d \"$DATABASE_DB\" -tAc \"SELECT to_regclass('public.users') IS NOT NULL;\"")"
  if [ "$users_exists" != "t" ]; then
    echo "Schema bootstrap failed. Last logs:" >&2
    tail -n 80 /tmp/liven-bootstrap.log >&2 || true
    exit 1
  fi
}

write_env_file() {
  log "Writing production .env"
  umask 077
  if [ -s "$REPO_DIR/.deploy.env" ]; then
    cp "$REPO_DIR/.deploy.env" "$REPO_DIR/.env"
    rm -f "$REPO_DIR/.deploy.env"
    return
  fi

  if [ -z "${API_ENV_FILE:-}" ]; then
    echo "No env source found. Provide API_ENV_FILE secret." >&2
    exit 1
  fi

  printf "%s" "$API_ENV_FILE" > "$REPO_DIR/.env"
}

upsert_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$REPO_DIR/.env"; then
    sed -i "s#^${key}=.*#${key}=${value}#" "$REPO_DIR/.env"
  else
    echo "${key}=${value}" >> "$REPO_DIR/.env"
  fi
}

normalize_runtime_env() {
  # API talks to dedicated Liven MinIO on the host — never Sumer's 9000/9001.
  upsert_env "MINIO_ENDPOINT" "127.0.0.1"
  upsert_env "MINIO_PORT" "$MINIO_HOST_PORT"
  upsert_env "MINIO_USE_SSL" "false"
  upsert_env "DATABASE_HOST" "127.0.0.1"
}

deploy_minio() {
  if [ -z "${MINIO_ROOT_USER:-}" ] || [ -z "${MINIO_ROOT_PASSWORD:-}" ]; then
    echo "MINIO_ROOT_USER or MINIO_ROOT_PASSWORD secret is missing." >&2
    exit 1
  fi

  log "Starting/updating Liven MinIO container (ports ${MINIO_HOST_PORT}/${MINIO_CONSOLE_HOST_PORT})"
  mkdir -p /opt/liven-data/minio
  export MINIO_ROOT_USER MINIO_ROOT_PASSWORD
  $DOCKER_COMPOSE_CMD -f "$MINIO_COMPOSE_FILE" up -d
}

build_api() {
  log "Installing dependencies"
  cd "$REPO_DIR"
  npm ci --include=dev

  log "Building NestJS app"
  npm run build
}

start_api() {
  log "Starting/reloading app with PM2"
  cd "$REPO_DIR"
  PM2_APP_NAME="$PM2_APP_NAME" pm2 startOrReload ecosystem.config.cjs --update-env
  pm2 save
}

print_status() {
  log "Deployment status"
  echo "Branch deployed: $DEPLOY_BRANCH"
  docker ps --filter "name=liven-minio" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  pm2 status "$PM2_APP_NAME" || pm2 ls
  log "Done"
}

wait_for_api_health() {
  local port
  port="$(sed -n 's/^PORT=//p' "$REPO_DIR/.env" | tail -n 1)"
  port="${port:-3013}"

  log "Waiting for API health on port $port (/api/v1/)"
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:${port}/api/v1/" >/dev/null 2>&1; then
      log "API is healthy"
      return 0
    fi
    sleep 3
  done

  echo "API health check failed on http://127.0.0.1:${port}/api/v1/" >&2
  pm2 logs "$PM2_APP_NAME" --lines 80 --nostream >&2 || true
  return 1
}

main() {
  require_root
  log "Preparing host"
  $SUDO apt-get update
  install_if_missing git git
  install_if_missing curl curl
  install_if_missing ca-certificates ca-certificates

  ensure_node
  ensure_pm2
  ensure_docker
  ensure_compose_cmd
  ensure_postgres

  if [ ! -d "$REPO_DIR" ]; then
    echo "Repository directory not found: $REPO_DIR" >&2
    exit 1
  fi

  write_env_file
  normalize_runtime_env
  ensure_postgres_auth_from_env
  deploy_minio
  build_api
  # Stop briefly so first-boot schema sync does not race PM2.
  pm2 delete "$PM2_APP_NAME" >/dev/null 2>&1 || true
  bootstrap_schema_if_needed
  start_api
  wait_for_api_health
  print_status
}

main "$@"
