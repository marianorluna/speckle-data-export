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
- **Revit push:** pyRevit + websocket-client → eventos DocumentChanged
- **Transporte BIM:** Speckle Cloud Free Tier (conector de Revit + GraphQL API)
- **Despliegue:** Docker Compose + Coolify en VPS propio

---

## 3. Contexto de negocio

- **Producto:** Dashboard BIM con actualización en tiempo real para modelos de Revit. Permite a un profesional AEC visualizar KPIs, parámetros y geometría 3D de su modelo en un panel web compartible, con alertas de calidad de datos y consultas en lenguaje natural.
- **Reglas de dominio clave:**
  - Cada elemento BIM tiene una categoría, un nivel y un conjunto de parámetros (algunos obligatorios como `fire_rating` en puertas).
  - Un snapshot de datos se genera en cada envío (Speckle Send) y en cada cambio detectado por pyRevit (DocumentChanged). El dashboard refleja el último estado conocido.
  - El visor 3D se actualiza por commit de Speckle; los KPIs y métricas tabulares se actualizan por WebSocket en tiempo real.
  - El usuario admin es el único con acceso de escritura (login JWT). Las URLs de solo lectura pueden compartirse sin auth en el futuro.
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

- **Última sesión:** 2026-08-05 — Ejecutado prompt 02: dominio Pydantic (`BimElement`, `ParameterSnapshot`, `QcFinding`, `User`), modelos SQLAlchemy, Alembic async + migración inicial, `BaseRepository`.
- **Foco actual:** prompt 03 (auth JWT).
- **Checklist:**
  - [x] Definir stack completo en AGENTS.md §2
  - [x] Rellenar contexto de negocio en AGENTS.md §3
  - [x] Ejecutar prompt 01 (fundación monorepo: API `/health` + web Vite)
  - [x] Ejecutar prompt 02 (dominio + DB: entidades, ORM, Alembic, repo base)
  - [ ] Actualizar docs/architecture.md con estructura real
  - [ ] Registrar ADRs 002-009 en docs/decisions.md
  - [ ] Actualizar docs/onboarding.md con comandos reales
  - [ ] Actualizar .env.example con variables del proyecto
  - [ ] Actualizar README.md con descripción del producto
  - [ ] Actualizar globs de frontend.mdc y backend.mdc
  - [ ] Crear prompts 01-03 (fase 1: fundación) — prompts ya en docs/prompts/; falta ejecutar 03
  - [ ] Crear prompts 04-06 (fase 2: backend core)
  - [ ] Crear prompt 07 (fase 3: pyRevit push)
  - [ ] Crear prompts 08-10 (fase 4: frontend)
  - [ ] Crear prompt 11 (fase 5: IA)
  - [ ] Crear prompt 12 (fase 6: deploy)
- **Bloqueadores:** `passlib` + `bcrypt>=5` incompatible al generar hashes; usar `bcrypt.hashpw` directamente hasta el prompt 03 (auth).

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
