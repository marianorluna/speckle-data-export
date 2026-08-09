# BIM Dashboard — Tiempo real desde Revit

Dashboard BIM con actualización en tiempo real para modelos de Revit. Visualiza KPIs, parámetros y geometría 3D en un panel web compartible, con alertas de calidad de datos y consultas en lenguaje natural vía IA.

## Características

- **Tiempo real:** cambios en Revit → WebSocket (pyRevit spool + relay).
- **Visor 3D:** Speckle Viewer vinculado a la tabla y al chat.
- **KPIs:** cards, gráficos (Recharts) y tabla filtrable.
- **QC:** hallazgos de calidad de datos.
- **IA:** preguntas en lenguaje natural (DeepSeek vía OpenRouter) con resaltado en el visor.
- **Roles:** `admin` (escritura / ingest) e `invitado` (demo con cuota de chat).

## Demo online

- **URL:** [https://bim-dashboard.demo.marianorluna.com](https://bim-dashboard.demo.marianorluna.com) *(DNS/Coolify pendiente si aún no responde)*
- **Invitado (público a propósito):**
  - Email: `invitado@marianorluna.com`
  - Password: `abc123`
- El invitado puede explorar el dashboard y hacer **hasta 3 preguntas de chat con resultado en el visor por día e IP** (consultas sin elementos seleccionables no consumen cuota). El usuario admin no se publica.

## Stack

| Capa | Herramienta |
|------|-------------|
| Backend | FastAPI + uvicorn + WebSocket |
| Base de datos | SQLite + SQLAlchemy 2.0 async |
| Frontend | React 19 + Vite + Tailwind |
| Visor 3D | @speckle/viewer |
| Gráficos | Recharts |
| IA | DeepSeek v3 vía OpenRouter |
| Auth | JWT (admin / guest) |
| Revit push | pyRevit spool JSONL → relay → `/ws/revit` |
| Deploy | Docker Compose + Coolify (ver prompt 12) |

## Requisitos para instalar en local

- Python **3.12+**
- Node.js **20+** y npm
- Git
- Cuenta Speckle + PAT (y opcionalmente un segundo PAT de solo lectura para el viewer)
- (Opcional) OpenRouter API key para el chat
- (Opcional) Revit + Speckle Connector + pyRevit para el push en vivo

## Instalación local (arranque rápido)

```bash
git clone <URL_DEL_REPO>
cd data-speckle
cp .env.example .env
```

Edita `.env` (ver [docs/onboarding.md](docs/onboarding.md)). Como mínimo:

- `JWT_SECRET`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH`
- `GUEST_EMAIL` / `GUEST_PASSWORD_HASH` (para probar el rol invitado)
- `SPECKLE_TOKEN`, `SPECKLE_SERVER_URL`, `SPECKLE_STREAM_ID`, `SPECKLE_BRANCH_NAME`
- `SPECKLE_VIEWER_TOKEN` (recomendado: PAT distinto, solo lectura; si vacío, se reutiliza `SPECKLE_TOKEN`)
- `OPENROUTER_API_KEY` (si quieres chat IA)
- `CORS_ORIGINS=http://localhost:5173` (prod Coolify: `https://bim-dashboard.demo.marianorluna.com`)

Generar un hash de password:

```bash
python -c "import bcrypt; print(bcrypt.hashpw(b'tu-password', bcrypt.gensalt(rounds=12)).decode())"
```

### Backend

```bash
cd apps/api
python -m venv .venv
# Git Bash / Windows:
source .venv/Scripts/activate
# macOS / Linux:
# source .venv/bin/activate
pip install -r requirements.txt
python -m alembic upgrade head
uvicorn src.api.main:app --reload --port 8000
```

API: `http://localhost:8000` · OpenAPI: `/docs`  
Al arrancar se hace **upsert** de admin y guest desde el `.env`.

### Frontend (otra terminal)

```bash
cd apps/web
npm install
npm run dev
```

Dashboard: `http://localhost:5173` — login con invitado o admin.

Detalle (ingesta Speckle, pyRevit, troubleshooting): [docs/onboarding.md](docs/onboarding.md).

### Docker local (smoke del prompt 12)

Requisitos: Docker Desktop en marcha y un `.env` válido en la raíz del repo.

```bash
docker compose --env-file .env.compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

- App: `http://localhost:8080` (nginx → SPA + proxy `/api` y `/ws`)
- Health: `http://localhost:8080/health`
- Coolify: solo `docker-compose.yml` (sin publicar `:8080`; Traefik usa el dominio de `web`). Secretos en el panel.
- **Hashes bcrypt en Coolify:** cada `$` del hash debe ir como `$$` (si no, Compose parte el valor y verás warnings `variable is not set`). Ejemplo: `$2b$12$abc…` → `$$2b$$12$$abc…`.

## Seguridad — no publiques secretos

**Nunca** subas a GitHub ni pegues en LinkedIn:

- Archivo `.env`
- `JWT_SECRET`, `ADMIN_PASSWORD_HASH` (ni la password admin en claro)
- `SPECKLE_TOKEN` / `SPECKLE_VIEWER_TOKEN`
- `OPENROUTER_API_KEY`, `REVIT_API_KEY`

Sí puedes publicar las credenciales de **invitado** de la demo (están pensadas para eso). Usa un PAT de Speckle **de solo lectura** en `SPECKLE_VIEWER_TOKEN`: el frontend lo recibe vía `/api/speckle/viewer-config`.

## Documentación

| Archivo | Función |
|---------|---------|
| [`AGENTS.md`](AGENTS.md) | Stack, producto, estado de sesión |
| [`docs/architecture.md`](docs/architecture.md) | Capas y flujos |
| [`docs/decisions.md`](docs/decisions.md) | ADRs |
| [`docs/onboarding.md`](docs/onboarding.md) | Setup local completo |
| [`docs/prompts/`](docs/prompts/) | Prompts de desarrollo (incl. deploy) |

## Licencia

Privado — uso interno / demo bajo tu criterio. No redistribuir secretos ni datos de proyecto ajenos.
