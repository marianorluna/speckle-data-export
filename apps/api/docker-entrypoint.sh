#!/bin/sh
set -eu

cd /app

echo "Running Alembic migrations..."
python -m alembic upgrade head

echo "Starting uvicorn (single worker)..."
# --proxy-headers: trust X-Forwarded-* from Coolify/Traefik/nginx (HTTPS + client IP).
exec uvicorn src.api.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --proxy-headers \
  --forwarded-allow-ips='*'
