#!/usr/bin/env bash
set -euo pipefail

# One-shot nginx setup for Liven API / CDN / MinIO console.
# Does NOT touch Sumer vhosts. Ports: API 3013, MinIO 9010/9011.

export DEBIAN_FRONTEND=noninteractive

if ! command -v nginx >/dev/null 2>&1; then
  apt-get update
  apt-get install -y nginx
fi

cat >/etc/nginx/sites-available/livenmode.conf <<'EOF'
server {
    listen 80;
    listen [::]:80;
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name api.livenmode.ir;

    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;

    client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:3013;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    listen [::]:80;
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name cdn.livenmode.ir;

    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;

    client_max_body_size 500m;

    location / {
        proxy_pass http://127.0.0.1:9010;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    listen [::]:80;
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name minio-console.livenmode.ir;

    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;

    location / {
        proxy_pass http://127.0.0.1:9011;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/livenmode.conf /etc/nginx/sites-enabled/livenmode.conf

nginx -t
systemctl enable nginx
systemctl restart nginx

curl -fsS -H "Host: api.livenmode.ir" http://127.0.0.1/ || true
curl -I -H "Host: cdn.livenmode.ir" http://127.0.0.1/ || true
curl -I -H "Host: minio-console.livenmode.ir" http://127.0.0.1/ || true
