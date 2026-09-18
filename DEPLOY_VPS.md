# Deploy Liven API to VPS (GitHub Actions)

Deploys on push to `dev` / `main`, or via `workflow_dispatch`.

## Layout on the shared VPS (no collision with Sumer)

| Path | Purpose |
|------|---------|
| `/opt/liven-api/repo` | API source + `.env` + PM2 cwd |
| `/opt/liven-data/minio` | Liven MinIO data volume (separate from `/opt/sumer-data/minio`) |
| `/etc/nginx/sites-available/livenmode.conf` | api / cdn / minio-console |

| Service | Host port | Domain |
|---------|-----------|--------|
| Liven API (PM2) | **3013** | `api.livenmode.ir` |
| Liven MinIO S3 | **9010** | `cdn.livenmode.ir` |
| Liven MinIO console | **9011** | `minio-console.livenmode.ir` |
| Sumer MinIO (unchanged) | 9000 / 9001 | `cdn.sumeracademy.com` |
| Sumer API (unchanged) | 3001 | `api.sumeracademy.com` |
| Postgres (shared host) | 5432 | DB name **`liven_prod`** (separate DB) |

## Required GitHub secrets (`vps-secrets` environment)

- `VPS_PASSWORD`
- `API_ENV_FILE` — full production `.env` (multiline)
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`

Optional overrides: `VPS_HOST`, `VPS_USER`, `VPS_PORT`.

## Example `API_ENV_FILE`

```env
PORT=3013
NODE_ENV=production

CORS_ORIGIN=https://livenmode.ir,https://www.livenmode.ir,https://console.livenmode.ir
CORS_METHODS=GET,HEAD,PUT,PATCH,POST,DELETE
CORS_HEADERS=Content-Type,Authorization,X-Guest-Cart-Token
CORS_CREDENTIALS=true

DATABASE_HOST=127.0.0.1
DATABASE_PORT=5432
DATABASE_USER=liven_app
DATABASE_PASSWORD=CHANGE_ME
DATABASE_DB=liven_prod

SUPER_ADMIN_EMAIL=superadmin@livenmode.ir
SUPER_ADMIN_PASSWORD=CHANGE_ME
SUPER_ADMIN_FIRST_NAME=Super
SUPER_ADMIN_LAST_NAME=Admin

THROTTLE_TTL=60000
THROTTLE_LIMIT=120
JWT_SECRET_KEY=CHANGE_ME_LONG_RANDOM
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
OTP_EXPIRES_SECONDS=120
CUSTOMER_WEB_URL=https://livenmode.ir
IMPERSONATION_TTL_SECONDS=60

MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9010
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=CHANGE_ME_SAME_AS_ROOT_USER
MINIO_SECRET_KEY=CHANGE_ME_SAME_AS_ROOT_PASSWORD
MINIO_PUBLIC_URL=https://cdn.livenmode.ir
MINIO_CONSOLE_URL=https://minio-console.livenmode.ir
MINIO_BUCKET_IMAGES=liven-images
MINIO_BUCKET_FILES=liven-files
MINIO_BUCKET_TEMP=liven-temp
```

Deploy script forces `MINIO_ENDPOINT=127.0.0.1`, `MINIO_PORT=9010`, `MINIO_USE_SSL=false`, `DATABASE_HOST=127.0.0.1`.

## One-shot nginx (API/CDN)

```bash
bash /opt/liven-api/repo/scripts/vps-setup-nginx.sh
```

Console and portal nginx are written by their own deploy scripts.
