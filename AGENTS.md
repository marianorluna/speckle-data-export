# AGENTS.md

Documento vivo del **qué** y el **quién**. Las leyes técnicas (cómo / no) viven en `.cursor/rules/`.

> **Template versión:** 1.2.0

### Fuente canónica (SSOT)

Este archivo es la **única fuente** de stack (§2), contexto de negocio (§3) y estado de sesión (§4). El resto de docs solo enlazan aquí.

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
  - El usuario admin es el único con acceso de escritura (login JWT). Existe un rol `guest` para demos (lectura + chat con cuota). Las URLs de solo lectura sin auth pueden ampliarse en el futuro.
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

## 4. Estado actual

- **Última sesión:** 2026-08-08 — Demo readiness: roles admin/guest, cuota chat 3/día/IP, viewer token separado, README + prompt 12.
- **Foco actual:** ejecutar prompt 12 (Docker/Coolify) + gate e2e chat con `OPENROUTER_API_KEY`.
- **Checklist:**
 - [x] Definir stack completo en AGENTS.md §2
 - [x] Rellenar contexto de negocio en AGENTS.md §3
 - [x] Ejecutar prompt 01 (fundación monorepo: API `/health` + web Vite)
 - [x] Ejecutar prompt 02 (dominio + DB: entidades, ORM, Alembic, repo base)
 - [x] Ejecutar prompt 03 (auth JWT: seed, token, `/me`, login UI)
 - [x] Ejecutar prompt 04 (ingesta Speckle: cliente, IngestCommit, poller, `/api/admin/ingest`)
 - [x] Verificar prompt 04 contra stream Speckle real (`probe_speckle` + SQLite + skip idempotente)
 - [x] Documentar PAT Speckle (scopes) y pruebas de ingesta en `docs/onboarding.md`
 - [x] Ejecutar prompt 05 (API REST: elements / KPIs / QC + OpenAPI)
 - [x] Ejecutar prompt 06 (WebSockets: dashboard + revit + heartbeat + broadcast ingest)
 - [x] Ejecutar prompt 07 (pyRevit push: spool + relay + onboarding + probes)
 - [x] Gate e2e prompt 07: botón ON + editar → spool → relay → `bim_elements.source=revit_ws`
 - [x] Documentar arquitectura final prompt 07 (`architecture.md`, ADR-010, onboarding, prompt 07)
 - [x] Registrar ADRs 002-009 en docs/decisions.md
 - [x] ADR-010 — spool JSONL + relay CPython (sin red dentro de Revit)
 - [x] Ejecutar prompt 08 (shell frontend: layout, UI base, WS + Query hooks)
 - [ ] Actualizar docs/onboarding.md con resto de comandos reales (Windows activate, etc.)
 - [x] Actualizar .env.example con variables del proyecto (hash via `bcrypt` nativo; Speckle PAT/project id; `REVIT_API_KEY`)
 - [x] Actualizar README.md con descripción del producto + demo/install
 - [ ] Actualizar globs de frontend.mdc y backend.mdc
 - [x] Crear prompts 01-03 (fase 1: fundación) — ejecutados
 - [x] Crear prompts 04-06 (fase 2: backend core) — ejecutados
 - [x] Crear prompt 07 (fase 3: pyRevit push) — cerrado e2e
 - [x] Crear/ejecutar prompt 08 (fase 4 frontend init)
 - [x] Ejecutar prompt 09 (KPIs, Recharts, tabla + filtros, indicador WS)
 - [x] Ejecutar prompt 10 (viewer 3D Speckle + map + selección cruzada)
 - [x] Ejecutar prompt 11 (chat IA / text-to-SQL + UI)
 - [x] Chat como widget flotante en Dashboard (FAB; sin ítem IA Chat en sidebar)
- [x] Dashboard 3 pestañas: Resumen + Elementos (tabla) + Visor 3D; chat «Ver en visor»
 - [x] Demo readiness: roles admin/guest, cuota chat guest, `SPECKLE_VIEWER_TOKEN`, ADR-011
 - [x] Crear prompt 12 (fase 6: deploy)
 - [ ] Gate e2e prompt 11: `OPENROUTER_API_KEY` + pregunta real + highlight dashboard
 - [ ] Ejecutar prompt 12 (Docker/Coolify + URL pública)
- **Bloqueadores:** Gate e2e chat pendiente de `OPENROUTER_API_KEY` (reiniciar uvicorn tras editar `.env`). Deploy pendiente (prompt 12). Deuda previa: relay sin `pong` al heartbeat; `parameters` no planos; Materials/IDs duplicados; QC sin motor de reglas; live `commit_processed` tras ingest admin; filtro UI «Sin nivel» no soportado; mapa `element_id`→`applicationId` es identidad. SQLite Snowdon (`structure/snowdon-towers-r27`, 1390 elems; sin Doors — sugerencias chat usan Walls/Framing). Chat: FAB global; guest 3 preguntas/día/IP; `/chat` redirige a `/dashboard`. Credenciales demo públicas: `invitado@marianorluna.com` / `abc123` (solo guest).

### Protocolo de cierre de sesión

1. **Última sesión** → fecha de hoy + resumen de lo hecho en una frase.
2. **Foco actual** → próxima tarea o PR pendiente.
3. **Checklist** → marca lo completado, añade lo que quedó abierto.
4. **Bloqueadores** → cualquier decisión pendiente o dependencia externa.
5. Si tomaste una decisión arquitectónica relevante → añade un ADR en `docs/decisions.md`.

---

## 5. Mapa de contexto

| Recurso | Dueño |
|---------|-------|
| **Este archivo** (`AGENTS.md`) | Stack (§2), producto/dominio (§3), estado de sesión (§4) |
| `.cursor/rules/` | Cómo programar y qué está prohibido |
| `docs/architecture.md` | Patrón, capas, carpetas, flujos client ↔ server |
| `docs/decisions.md` | ADRs — porqués ya tomados |
| `docs/onboarding.md` | Cómo arrancar el proyecto en local |
| `.env.example` | Nombres de variables de entorno (sin secretos) |
| `docs/prompts/` | Prompts paso a paso para desarrollo |

Si el agente pierde el hilo: menciona `@AGENTS.md` y/o `@docs/architecture.md` en el chat.
