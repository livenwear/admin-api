#!/usr/bin/env bash
set -euo pipefail

# Bring Sumer + Liven MinIO back up as TWO separate containers.
# Never deletes /opt/sumer-data/minio or /opt/liven-data/minio.

log() { printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"; }

read_env() {
  local file="$1" key="$2"
  sed -n "s/^${key}=//p" "$file" | tail -n 1
}

container_exists() {
  docker ps -a --format '{{.Names}}' | grep -Fxq "$1"
}

container_running() {
  docker ps --format '{{.Names}}' | grep -Fxq "$1"
}

ensure_minio() {
  local name="$1"
  local host_api_port="$2"
  local host_console_port="$3"
  local data_dir="$4"
  local env_file="$5"

  local user pass
  user="$(read_env "$env_file" MINIO_ACCESS_KEY)"
  pass="$(read_env "$env_file" MINIO_SECRET_KEY)"

  if [ -z "$user" ] || [ -z "$pass" ]; then
    echo "Missing MINIO_ACCESS_KEY/MINIO_SECRET_KEY in $env_file" >&2
    exit 1
  fi

  mkdir -p "$data_dir"

  if container_running "$name"; then
    log "$name already running"
    return 0
  fi

  if container_exists "$name"; then
    log "Starting existing container $name"
    docker start "$name" >/dev/null
    return 0
  fi

  log "Creating container $name (data: $data_dir, ports: ${host_api_port}/${host_console_port})"
  docker run -d \
    --name "$name" \
    --restart unless-stopped \
    -p "${host_api_port}:9000" \
    -p "${host_console_port}:9001" \
    -e "MINIO_ROOT_USER=${user}" \
    -e "MINIO_ROOT_PASSWORD=${pass}" \
    -v "${data_dir}:/data" \
    minio/minio:latest \
    server /data --console-address ":9001" >/dev/null
}

log "Cleanup stale renamed Sumer container only (volume kept)"
if container_exists '75fe9d279a5a_sumer-minio'; then
  docker rm -f '75fe9d279a5a_sumer-minio' >/dev/null
fi

log "Sumer MinIO"
ensure_minio \
  'sumer-minio' \
  '9000' \
  '9001' \
  '/opt/sumer-data/minio' \
  '/opt/sumer-api/repo/.env'

log "Liven MinIO"
ensure_minio \
  'liven-minio' \
  '9010' \
  '9011' \
  '/opt/liven-data/minio' \
  '/opt/liven-api/repo/.env'

log "Status"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo
echo "Sumer buckets (must remain):"
ls -la /opt/sumer-data/minio
echo
echo "Liven data:"
ls -la /opt/liven-data/minio
echo
curl -sS -o /dev/null -w 'sumer:9000 live=%{http_code}\n' http://127.0.0.1:9000/minio/health/live || true
curl -sS -o /dev/null -w 'liven:9010 live=%{http_code}\n' http://127.0.0.1:9010/minio/health/live || true

log "Done"
