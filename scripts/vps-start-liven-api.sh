#!/usr/bin/env bash
set -euo pipefail

REPO=/opt/liven-api/repo
cd "$REPO"

# Ensure CORS allows browser preflight + storefront origin
if grep -q '^CORS_METHODS=' .env; then
  sed -i 's/^CORS_METHODS=.*/CORS_METHODS=GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS/' .env
else
  echo 'CORS_METHODS=GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS' >> .env
fi

if ! grep -q 'https://livenmode.ir' .env; then
  if grep -q '^CORS_ORIGIN=' .env; then
    sed -i 's|^CORS_ORIGIN=.*|CORS_ORIGIN=https://livenmode.ir,https://www.livenmode.ir,https://console.livenmode.ir|' .env
  else
    echo 'CORS_ORIGIN=https://livenmode.ir,https://www.livenmode.ir,https://console.livenmode.ir' >> .env
  fi
fi

echo "=== install + build ==="
npm ci --include=dev
npm run build
test -f dist/main.js

echo "=== start pm2 ==="
# drop failed ghost if any
pm2 delete liven-api >/dev/null 2>&1 || true
PM2_APP_NAME=liven-api pm2 start ecosystem.config.cjs --update-env
pm2 save

sleep 5
pm2 ls
ss -tlnp | grep 3013 || true

echo "=== health ==="
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3013/api/v1/ >/dev/null 2>&1; then
    echo "API up"
    break
  fi
  sleep 2
done

echo "=== CORS preflight ==="
curl -sS -D - -o /dev/null -X OPTIONS http://127.0.0.1:3013/api/v1/customer/auth/login \
  -H 'Origin: https://livenmode.ir' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,x-guest-cart-token' \
  --max-time 10 | tr -d '\r' | grep -iE 'HTTP/|access-control|HTTP'

echo "=== POST with Origin ==="
curl -sS -D - -o /tmp/liven-login.out -X POST http://127.0.0.1:3013/api/v1/customer/auth/login \
  -H 'Origin: https://livenmode.ir' \
  -H 'Content-Type: application/json' \
  -H 'X-Guest-Cart-Token: c436aca5-44e4-4032-9986-d79bcd2c74eb' \
  --data-raw '{"phone":"09381378120","password":"x"}' \
  --max-time 10 | tr -d '\r' | grep -iE 'HTTP/|access-control'
echo "body:"; head -c 300 /tmp/liven-login.out; echo

echo "=== via nginx host header ==="
curl -sS -o /dev/null -w 'nginx api=%{http_code}\n' -H 'Host: api.livenmode.ir' http://127.0.0.1/api/v1/
