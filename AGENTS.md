# AGENTS.md

Documento vivo del **qué** y el **quién**. Las leyes técnicas (cómo / no) viven en `.cursor/rules/`.

> **Template versión:** 1.3.0

### Fuente canónica (SSOT)

Este archivo es la **única fuente** de stack (§2), contexto de negocio (§3) y alcance del producto (§4). El resto de docs solo enlazan aquí.

---

## 1. Rol y misión

Eres un arquitecto de software senior y experto en Clean Code. Ayudas a construir y mantener este proyecto con código limpio, escalable y seguro. Analizas antes de codear, anticipas edge cases y respetas las reglas en `.cursor/rules/`.

---

## 2. Stack del proyecto

- **Frontend:** React 19 + Vite + Tailwind CSS + Recharts
- **Data fetching:** TanStack Query (React Query v5) + WebSockets nativos
- **Visor 3D:** @speckle/viewer (latest)
- **Backend:** Python 3.12+ / FastAPI 0.115+ + uvicorn + WebSockets
- **Base de datos / ORM:** SQLite + SQLAlchemy 2.0 async (swap a Postgres documentado para escalar)
- **Lenguaje:** TypeScript estricto (frontend) / Python 3.12+ con tipado mypy (backend)
- **Testing:** pytest (backend) / Vitest (frontend)
- **IA:** DeepSeek v3 via OpenRouter (text-to-SQL para consultas NL)
- **Auth:** JWT (pyjwt en backend / jose en frontend)
- **Revit push:** pyRevit (IronPython) → spool JSONL → `revit_push_relay.py` (CPython, `websockets`) → `/ws/revit`
- **Transporte BIM:** Speckle Cloud Free Tier (conector de Revit + GraphQL API)
- **Despliegue:** Docker Compose + Coolify en VPS propio

---

## 3. Contexto de negocio

- **Producto:** Dashboard BIM con actualización en tiempo real para modelos de Revit. Permite a un profesional AEC visualizar KPIs, parámetros y geometría 3D de su modelo en un panel web compartible, con alertas de calidad de datos y consultas en lenguaje natural.
- **Reglas de dominio clave:**
  - Cada elemento BIM tiene una categoría, un nivel y un conjunto de parámetros (algunos obligatorios como `fire_rating` en puertas).
  - Un snapshot de datos se genera en cada envío (Speckle Send) y en cada cambio detectado por pyRevit (DocumentChanged). El dashboard refleja el último estado conocido.
  - El visor 3D se actualiza por commit de Speckle; los KPIs y métricas tabulares se actualizan por WebSocket en tiempo real.
  - El usuario admin es el único con acceso de escritura (login JWT). Existe un rol `guest` para demos (lectura + chat con cuota 3 billables/día/IP) y `guest_extended` (misma lectura; 50 billables/día por user id). Las URLs de solo lectura sin auth pueden ampliarse en el futuro.
- **Integraciones externas:**
  - Speckle Cloud (GraphQL API para historial de commits y datos geométricos)
  - DeepSeek API via OpenRouter (chat NL para consultas sobre el modelo)
  - Revit + Speckle Connector + pyRevit (origen de datos)
- **Deuda / limitaciones conocidas:**
  - Auth con un solo usuario admin (JWT); sin multi-usuario ni roles aún.
  - SQLite local (swap a Postgres cuando haya concurrencia de escritura).
  - Sin tests e2e aún.
  - Speckle Cloud Free Tier (1 proyecto); migración a self-hosted documentada para escalar.

---

## 4. Alcance del producto

Capacidades estables del dashboard (lo que el repo pretende demostrar):

- **Auth:** JWT con roles `admin` (escritura / ingest), `guest` (lectura + chat con cuota 3 billables/día/IP) y `guest_extended` (misma lectura; 50 billables/día por user id). Credenciales de invitado de demo: ver `README.md`.
- **Datos:** ingesta Speckle (commits) y push en vivo desde Revit (pyRevit → spool JSONL → relay → `/ws/revit`).
- **API:** REST de elements / KPIs / QC + WebSockets de dashboard; OpenAPI.
- **UI:** Dashboard con pestañas Resumen, Elementos y Visor 3D Speckle; chat NL flotante (FAB); selección cruzada tabla ↔ visor.
- **Deploy:** Docker Compose (+ Coolify / HTTPS en VPS). Detalle operativo en `docs/onboarding.md` y `docs/prompts/12-deploy.md`.

Las limitaciones estructurales están en §3 (deuda). Decisiones de diseño: `docs/decisions.md`.

---

## 5. Mapa de contexto

| Recurso                        | Dueño                                           |
| ------------------------------ | ----------------------------------------------- |
| **Este archivo** (`AGENTS.md`) | Stack (§2), producto/dominio (§3), alcance (§4) |
| `.cursor/rules/`               | Cómo programar y qué está prohibido             |
| `docs/architecture.md`         | Patrón, capas, carpetas, flujos client ↔ server |
| `docs/decisions.md`            | ADRs — porqués ya tomados                       |
| `docs/onboarding.md`           | Cómo arrancar el proyecto en local              |
| `.env.example`                 | Nombres de variables de entorno (sin secretos)  |
| `docs/prompts/`                | Prompts paso a paso para desarrollo             |

Si el agente pierde el hilo: menciona `@AGENTS.md` y/o `@docs/architecture.md` en el chat.
