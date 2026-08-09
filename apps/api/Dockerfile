# BIM Dashboard API — FastAPI + uvicorn (single worker; in-memory chat quota).
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini .
COPY alembic ./alembic
COPY scripts ./scripts
COPY src ./src
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh \
    && mkdir -p /data

EXPOSE 8000

# Persist SQLite outside the image; override via DATABASE_URL in Compose/Coolify.
ENV DATABASE_URL=sqlite+aiosqlite:////data/bim.db

ENTRYPOINT ["/docker-entrypoint.sh"]
