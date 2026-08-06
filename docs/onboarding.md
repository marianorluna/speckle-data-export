# Onboarding — Setup local

Guia para levantar el proyecto desde cero.

## Stack y producto

- **Stack:** [`AGENTS.md` §2](../AGENTS.md#2-stack-del-proyecto)
- **Producto / dominio:** [`AGENTS.md` §3](../AGENTS.md#3-contexto-de-negocio)
- **Capas / carpetas:** [`docs/architecture.md`](./architecture.md)

---

## Requisitos previos

- [ ] Python 3.12+ (con pip)
- [ ] Node.js 20+ (con npm)
- [ ] Git
- [ ] Docker (opcional, para despliegue)
- [ ] Revit 2023+ con Speckle Connector y pyRevit instalados (para el push en tiempo real)
- [ ] Cuenta en Speckle (gratuita) y token de acceso personal
- [ ] Cuenta en OpenRouter (opcional, para IA) y API key

---

## 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPO>
cd data-speckle
```

---

## 2. Variables de entorno

```bash
cp .env.example .env
```

Abre `.env` y completa los valores. Variables obligatorias:

- `SPECKLE_TOKEN` — Personal Access Token (PAT); ver seccion siguiente
- `SPECKLE_SERVER_URL` — host del proyecto (p. ej. `https://app.speckle.systems`)
- `SPECKLE_STREAM_ID` — project id (en la UI nueva, Stream ≈ Project)
- `JWT_SECRET` — clave secreta para firmar tokens JWT
- `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` — credenciales del unico usuario

---

## 2.1 Speckle — token (PAT) y project id

### No confundir con Share tokens

El dialogo **Share this model** y **Project settings → Tokens** crean **share tokens** (enlaces de solo lectura para el viewer). **No sirven** para autenticar GraphQL desde este backend.

Necesitas un **Personal Access Token** de tu usuario.

### Crear el PAT

1. Entra en [https://app.speckle.systems](https://app.speckle.systems) (o el host que uses).
2. Avatar (abajo/izquierda o arriba) → **Settings** → **Developer** / Access tokens.
3. **Create token** / New token.
4. **Name:** p. ej. `bim-dashboard-local` (solo etiqueta).
5. **Scopes (minimo, Projects):**
   | Scope | ID | Nivel |
   |-------|-----|--------|
   | Core | `project.core` | Read (o el minimo disponible) |
   | Model | `project.model` | **Create and edit** si no hay Read (no uses Fully manage) |
   | Version | `project.version` | Read |
6. Deja en **No access** / 0 scopes: Workspaces, Dashboards, Automate, Account, Server, Invite, Issue, Webhook, etc.
7. **Create**, copia el token **una sola vez** → `SPECKLE_TOKEN` en `.env`.

### Project id (`SPECKLE_STREAM_ID`)

Con el proyecto abierto, la URL es:

```text
https://app.speckle.systems/projects/<SPECKLE_STREAM_ID>/...
```

Copia solo ese id (no el nombre del proyecto ni un share link).

### Server URL

`SPECKLE_SERVER_URL` debe ser **el mismo host** que en el navegador. Si el proyecto esta en `app.speckle.systems` y pones `https://speckle.xyz` (o al reves), GraphQL responde `STREAM_NOT_FOUND`.

---

## 3. Instalar dependencias

### Backend (Python)

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate  # En Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend (Node)

```bash
cd apps/web
npm install
```

---

## 4. Base de datos

El backend usa SQLite (sin servidor externo). Las tablas se crean automaticamente al iniciar.

Para crear la DB manualmente:

```bash
cd apps/api
python -m alembic upgrade head
```

---

## 5. Levantar el servidor de desarrollo

### Backend

```bash
cd apps/api
source .venv/bin/activate
uvicorn src.api.main:app --reload --port 8000
```

### Frontend

```bash
cd apps/web
npm run dev
```

- API disponible en `http://localhost:8000` (docs en `http://localhost:8000/docs`)
- Dashboard disponible en `http://localhost:5173`

---

## 6. Verificar que todo funciona

- [ ] API: `GET http://localhost:8000/health` responde `{"status": "ok"}`
- [ ] Login: `POST http://localhost:8000/api/auth/token` con email/password devuelve JWT
- [ ] Frontend: la pagina de login carga en `http://localhost:5173`
- [ ] Speckle / ingesta (prompt 04): ver seccion siguiente
- [ ] El agente de Cursor responde en espanol (ver `core.mdc`)

---

## 6.1 Verificar ingesta Speckle (prompt 04)

Requisitos: `.env` con PAT + project id + server URL; al menos un Send/version en el proyecto; API en `:8000`; venv activo en `apps/api`.

### A) Sonda (sin escribir en DB)

```bash
cd apps/api
source .venv/Scripts/activate   # Linux/mac: source .venv/bin/activate
python -m scripts.probe_speckle --limit 30
```

**OK:** imprime `stream: <id> — <nombre>`, un `commit:` y filas `element_id` / `category`.

### B) Login JWT + ingest manual

```bash
curl -s -X POST http://localhost:8000/api/auth/token \
  -d "username=TU_ADMIN_EMAIL&password=TU_PASSWORD"
```

Copia el `access_token` del JSON y:

```bash
curl -s -X POST http://localhost:8000/api/admin/ingest \
  -H "Authorization: Bearer PEGA_EL_JWT" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**OK:** `success: true` con `elements_processed` > 0, **o** `skipped: true` / `Commit already processed` si el poller de fondo ya ingirio ese commit.

Forzar re-proceso del mismo commit:

```bash
curl -s -X POST http://localhost:8000/api/admin/ingest \
  -H "Authorization: Bearer PEGA_EL_JWT" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

### C) Comprobar SQLite (sin CLI `sqlite3`)

```bash
cd apps/api
python -c "
import sqlite3
c = sqlite3.connect('data/bim.db')
print('bim_elements', c.execute('SELECT COUNT(*) FROM bim_elements').fetchone()[0])
print('processed_commits', c.execute('SELECT COUNT(*) FROM processed_commits').fetchone()[0])
print('sample', c.execute('SELECT element_id, category, level FROM bim_elements LIMIT 5').fetchall())
"
```

**OK:** `bim_elements` > 0 y `processed_commits` >= 1.

### D) Polling (opcional)

Con uvicorn en marcha, un **nuevo Send** desde Revit al mismo proyecto deberia anadir otro `commit_id` en `processed_commits` en ~`SPECKLE_POLL_INTERVAL_SECONDS` (default 30).

Detalle del prompt: [`docs/prompts/04-ingesta-datos.md`](./prompts/04-ingesta-datos.md).

---

## 7. WebSockets (tiempo real)

Endpoints (API en `:8000`):

| Canal | URL | Auth |
|-------|-----|------|
| Dashboard | `ws://localhost:8000/ws/dashboard` | Ninguna (MVP) |
| pyRevit | `ws://localhost:8000/ws/revit` | Primer mensaje `{"type":"auth","api_key":"<REVIT_API_KEY>"}` |

- **Heartbeat:** el servidor envia `{"type":"ping"}` cada `WS_HEARTBEAT_INTERVAL` s (default 30). El cliente debe responder `{"type":"pong"}`. Sin pong en 2 intervalos, se cierra la conexion.
- **Reconexion (frontend, prompt 09):** el hook `useWebSocket` debe usar backoff exponencial `1s → 2s → 4s → … → max 30s`.
- **Mensajes:** usan `type` (p. ej. `initial_state`, `element_updated`, `commit_processed`); **no** el envelope REST `{success,data}`.

Prueba rapida (con la API levantada):

```bash
# Escuchar dashboard — debe imprimir initial_state al conectar
python - <<'PY'
import asyncio, json, websockets
async def main():
    async with websockets.connect("ws://127.0.0.1:8000/ws/dashboard") as ws:
        print(await ws.recv())
asyncio.run(main())
PY
```

O con `websocat` si lo tienes instalado: `websocat ws://localhost:8000/ws/dashboard`.

### pyRevit (push en tiempo real)

Arquitectura final ([ADR-010](./decisions.md)): **la red no vive dentro de Revit**.
El pushbutton solo escribe cambios en un archivo spool; un proceso relay (CPython)
los envia al API.

```
Revit (IronPython)                          Repo (CPython, venv)
pushbutton: DocumentChanged -> JSONL   ->   revit_push_relay.py -> /ws/revit
%LOCALAPPDATA%\BIMDashboard\revit-spool.jsonl
```

El handler se registra en el **primer clic** del boton (delegate fuerte en
`AppDomain` + `bundle.yaml` `engine.persistent: true`). Sin `startup.py`, sin
ventana al arrancar Revit. Cada edicion con push ON escribe al spool al acto
(no hace falta un segundo clic para flush).

1. Instalar pyRevit: https://github.com/eirannejad/pyRevit
2. Estructura en tu extension:

```
arqfi.extension/
  arqfi/                     # paquete (mismo nombre que la extension)
    __init__.py              # vacio
    config.py
    element_extractor.py
  Datos.tab/
    Exportar.panel/
      Dashboard.pushbutton/
        script.py            # ON/OFF + registro del handler
        bundle.yaml          # engine.persistent: true
        on.png / off.png     # icono via script.toggle_icon
```

Copia `config.py`, `element_extractor.py`, `script.py`, `bundle.yaml` desde
`apps/api/scripts/revit_push/`; crea `arqfi/__init__.py` vacio. Anade
`on.png` / `off.png` en el pushbutton. **Borra** `startup.py` de la raiz si lo
tenias de pruebas anteriores.

3. `pyRevit > Reload` basta (no hace falta reiniciar Revit).
4. Arrancar el relay (desde `apps/api`, venv activo, API en :8000):

```bash
python -m scripts.revit_push_relay
```

El relay lee `REVIT_API_KEY` del `.env` y sigue el spool. Reconecta solo si cae.
Hazlo en cada sesion de edicion (no es solo un test).

5. En Revit: pulsa **BIM Push** → icono ON. Modifica un elemento → el spool
   crece al instante → relay `ack elements_processed=N` → SQLite
   `source = "revit_ws"`. Otro clic = OFF (pausa). El script cierra las
   ventanas de output para no acumularlas.

> Sin red ni hilos dentro de Revit. Errores graves se muestran con TaskDialog;
> los writes al spool son silenciosos.

Verificacion del contrato **sin** Revit (API levantada, desde `apps/api`):

```bash
python -m scripts.probe_revit_ws          # WS directo
python -m scripts.revit_push_relay --self-test && python -m scripts.revit_push_relay
```

---

## Solucion de problemas frecuentes

| Sintoma | Causa probable | Solucion |
|---------|---------------|---------|
| `ModuleNotFoundError: No module named 'speckle'` | Dependencias no instaladas | `pip install -r requirements.txt` |
| `Connection refused` en WebSocket | API no levantada | Verificar `uvicorn` corriendo en :8000 |
| Error de autenticacion Speckle / 401 | PAT invalido, caducado o share token | Crear PAT en User settings → Developer (no Project → Tokens) |
| `STREAM_NOT_FOUND` | `SPECKLE_SERVER_URL` distinto del host del proyecto, o id incorrecto | Alinear URL con el browser; usar id de `/projects/<id>` |
| `probe_speckle` → 0 elements | Proyecto sin Send / sin objetos con `category` | Enviar modelo desde Revit Connector |
| `skipped: true` en `/api/admin/ingest` | Commit ya en `processed_commits` (poller) | Normal; usar `{"force": true}` o contar filas en SQLite |
| `sqlite3: command not found` | CLI no instalado | Usar el one-liner Python de la seccion 6.1 |
| `npm run dev` falla | Node version antigua | Usar Node 20+ (`node -v`) |
| `invalid api_key` en `/ws/revit` | `REVIT_API_KEY` en `.env` no coincide con la usada | Revisar `.env`; reiniciar relay |
| Revit se bloquea al usar el push | Red/hilos dentro de Revit (arquitectura vieja) | Usar el spool + `revit_push_relay` de esta seccion |
| Icono ON pero spool no crece | Handler GC'd (sin `persistent` / sin delegate fuerte) | Copiar `bundle.yaml` actual + `script.py`; Reload; primer clic de nuevo |
| Relay cierra con codigo 4000 | Heartbeat sin `pong` del relay | Deuda conocida; reconecta solo. Fix futuro: responder pong |
| Encoding / `SyntaxError` en IronPython | Non-ASCII o `from __future__ import annotations` | Mantener ASCII + `# -*- coding: utf-8 -*-` |

---

## Contexto adicional

| Tema | Fuente |
|------|--------|
| Stack / producto | [`AGENTS.md`](../AGENTS.md) |
| Capas / carpetas / flujos | [`architecture.md`](./architecture.md) |
| Decisiones (ADRs) | [`decisions.md`](./decisions.md) |
| Prompts paso a paso | [`prompts/`](./prompts/) |