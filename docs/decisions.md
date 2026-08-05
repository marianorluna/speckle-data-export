# Decisiones arquitectónicas (ADR)

Registro de las decisiones técnicas relevantes del proyecto. Una entrada por decisión, en orden cronológico. No borres entradas antiguas: el historial de *por qué* es tan valioso como el *qué*.

**Cuándo añadir un ADR:** al elegir un patrón, librería, estrategia de auth, estructura de BD, contrato de API o cualquier decisión que afecte a más de un módulo o a toda la app.

**Relación con otros docs:**

- Stack y producto → [`AGENTS.md`](../AGENTS.md) (no repetir aquí salvo que la decisión *cambie* el stack).
- Capas / carpetas / flujos → [`architecture.md`](./architecture.md).
- Al aceptar un ADR que cierre un ítem de “Decisiones abiertas” en `architecture.md`: marca el checkbox allí (`[x] → ADR-NNN`).

---

## Plantilla

```
### ADR-NNN — [Título corto de la decisión]

- **Fecha:** YYYY-MM-DD
- **Estado:** Propuesta | Aceptada | Obsoleta | Reemplazada por ADR-NNN
- **Contexto:** Qué problema o restricción motivó la decisión.
- **Opciones consideradas:**
  1. Opción A — pros / contras
  2. Opción B — pros / contras
- **Decisión:** Qué se eligió y por qué.
- **Consecuencias:** Qué cambia, qué deuda introduce, qué facilita.
```

---

## Registro

### ADR-001 — Uso de este template como base del proyecto

- **Fecha:** 2026-08-05
- **Estado:** Aceptada
- **Contexto:** Necesitamos una base de rules de Cursor AI y documentación de arquitectura reutilizable para cualquier stack.
- **Opciones consideradas:**
  1. `.cursorrules` único — simple pero no admite globs ni activación contextual.
  2. `.cursor/rules/*.mdc` — admite `alwaysApply`, globs por carpeta/extensión y es la API actual de Cursor.
- **Decisión:** `.cursor/rules/*.mdc` con reglas separadas por dominio (core, code-style, git, mentoring, frontend, backend).
- **Consecuencias:** Mejor precision contextual. Requiere ajustar globs al layout real del proyecto antes de la primera feature.

---

### ADR-002 — FastAPI como framework backend

- **Fecha:** 2026-08-05
- **Estado:** Aceptada
- **Contexto:** Necesitamos un servidor que soporte REST + WebSockets para el dashboard BIM en tiempo real, con tipado fuerte y validacion de datos integrada.
- **Opciones consideradas:**
  1. Node/Express + ws — ecosistema amplio pero tipado debil, requiere Zod/class-validator extra.
  2. FastAPI + uvicorn — async nativo, WebSockets integrados, Pydantic para validacion, OpenAPI generado automaticamente.
  3. Django + Channels — overkill para un MVP de API; WS requiere infraestructura extra (Redis, ASGI config).
- **Decision:** FastAPI por su soporte nativo de async/WebSockets, validacion con Pydantic, y documentacion OpenAPI automatica. Mejor relacion potencia/simplicidad para un backend de ingestion BIM + broadcast en tiempo real.
- **Consecuencias:** Menor ecosistema que Node para algunas librerias BIM, pero Speckle tiene SDK Python y SQLAlchemy cubre la persistencia. El tipado estricto con mypy evita bugs en la capa de normalizacion de datos.

---

### ADR-003 — SQLite async para MVP

- **Fecha:** 2026-08-05
- **Estado:** Aceptada
- **Contexto:** Necesitamos almacenar snapshots de elementos BIM (parametros, categorias, niveles) con bajo coste de setup y sin servicios externos.
- **Opciones consideradas:**
  1. SQLite + SQLAlchemy async — cero configuracion, portable, suficiente para single-writer (un solo Revit empujando).
  2. PostgreSQL — mejor concurrencia y tipos nativos (JSONB), pero requiere servicio extra en Docker.
  3. Supabase (Postgres cloud) — free tier generoso pero depende de conexion externa y latencia.
- **Decision:** SQLite async con aiosqlite + SQLAlchemy 2.0 para el MVP. El unico escritor es el backend (ingesta Speckle + WS de Revit). Migracion a Postgres documentada en el docker-compose para cuando haya multiples fuentes de escritura o need de JSONB avanzado.
- **Consecuencias:** Sin soporte para escritura concurrente real. Sin tipos JSON nativos (se usa TEXT con serializacion). El swap a Postgres requiere solo cambiar DATABASE_URL y regenerar migraciones.

---

### ADR-004 — React + Vite + Tailwind + @speckle/viewer

- **Fecha:** 2026-08-05
- **Estado:** Aceptada
- **Contexto:** El frontend necesita visualizar KPIs, tablas de datos BIM, graficos interactivos y un visor 3D embebido, todo actualizado en tiempo real via WebSocket.
- **Opciones consideradas:**
  1. Streamlit — rapido para prototipos Python pero limitado en interactividad 3D, WebSockets y UX personalizada.
  2. React + Vite + Tailwind + Recharts + @speckle/viewer — stack JS maduro, viewer oficial de Speckle, Recharts para graficos, Tailwind para estilado rapido.
  3. Next.js — SSR/SSG util para SEO pero innecesario en un dashboard interno; Vite es mas simple para SPA con WebSockets.
- **Decision:** Vite + React 19 + Tailwind + Recharts + @speckle/viewer. El viewer de Speckle se integra nativamente en React. TanStack Query para data fetching REST. WebSockets nativos para actualizaciones en tiempo real. Tailwind para un UI moderno con bajo esfuerzo.
- **Consecuencias:** Sin SSR (no necesario). El viewer de Speckle es una dependencia externa mantenida por Speckle Systems (licencia Apache 2.0).

---

### ADR-005 — JWT simple con un solo usuario admin

- **Fecha:** 2026-08-05
- **Estado:** Aceptada
- **Contexto:** El dashboard se comparte online. Necesitamos un mecanismo minimo de autenticacion para proteger el acceso de escritura y demostrar conciencia de seguridad.
- **Opciones consideradas:**
  1. Sin auth — el MVP seria publico. Riesgo: cualquiera con la URL puede ver/alterar datos.
  2. JWT con email+password — un solo usuario admin configurado por variables de entorno. Backend emite token, frontend lo almacena y envia en headers.
  3. OAuth2 (Google/GitHub) — mas seguro pero requiere configurar proveedores y callbacks; overkill para MVP con un solo usuario.
  4. Magic link — buena UX pero requiere servicio de email (SendGrid, Resend).
- **Decision:** JWT con pyjwt (backend) y jose (frontend). Un solo usuario admin definido en .env (ADMIN_EMAIL, ADMIN_PASSWORD_HASH). Login via POST /api/auth/token → devuelve access_token. Middleware protege rutas de escritura. Token expira en 24h.
- **Consecuencias:** Sin refresh token en MVP. Sin multi-usuario ni roles. Escalable a RBAC en el futuro cambiando el modelo de User.

---

### ADR-006 — DeepSeek via OpenRouter para consultas NL

- **Fecha:** 2026-08-05
- **Estado:** Aceptada
- **Contexto:** Queremos permitir consultas en lenguaje natural sobre el modelo BIM ("Que puertas del Nivel 2 no tienen resistencia al fuego?"). Necesitamos un LLM barato, bueno generando SQL, y con API simple.
- **Opciones consideradas:**
  1. Ollama local (Llama 3 / Qwen) — sin coste de API pero requiere GPU en el VPS y mas RAM.
  2. OpenAI GPT-4o — excelente pero caro para uso continuo.
  3. DeepSeek v3 via OpenRouter — significativamente mas barato que OpenAI, rendimiento comparable en generacion de codigo/SQL, API compatible con OpenAI SDK.
- **Decision:** DeepSeek v3 via OpenRouter. Coste ~10x menor que GPT-4o para text-to-SQL. OpenRouter abstrae la API y permite cambiar de modelo sin tocar codigo. Se usa solo para generar SQL/Pandas filters; nunca ejecuta queries arbitrarias (allowlist de tablas/columnas, dry-run, validacion).
- **Consecuencias:** Dependencia de API externa (OpenRouter). Latencias ~1-2s por consulta. Se implementa guardrail estricto: esquema fijo inyectado en el prompt, validacion de SQL generado antes de ejecutar.

---

### ADR-007 — Hibrido Speckle + WebSocket

- **Fecha:** 2026-08-05
- **Estado:** Aceptada
- **Contexto:** Necesitamos dos capacidades distintas: (a) visor 3D web con historial de versiones, (b) metricas/KPIs actualizadas en tiempo real al editar en Revit.
- **Opciones consideradas:**
  1. Solo Speckle — visor 3D nativo y commits historicos, pero sin actualizacion en tiempo real (depende de Send manual).
  2. Solo WebSocket custom — metricas en tiempo real, pero sin visor 3D ni historial de commits.
  3. Hibrido Speckle + WebSocket — Speckle para geometria 3D + historial; WebSocket para metricas/KPIs en vivo.
- **Decision:** Arquitectura hibrida. Speckle gestiona el 3D y el historial (cada Send genera un commit consultable). El WebSocket (pyRevit → FastAPI → frontend) actualiza metricas en tiempo real entre Sends. Ambos convergen en la misma tabla SQLite: Speckle da el snapshot completo; WebSocket actualiza campos incrementales.
- **Consecuencias:** Dos fuentes de verdad que deben reconciliarse (el ultimo commit de Speckle siempre gana en caso de conflicto). Mayor complejidad inicial pero cada canal resuelve su problema de forma optima.

---

### ADR-008 — Coolify + Docker Compose en VPS

- **Fecha:** 2026-08-05
- **Estado:** Aceptada
- **Contexto:** El dashboard debe estar online y accesible via URL publica (HTTPS). El usuario ya dispone de un VPS con Coolify.
- **Opciones consideradas:**
  1. Vercel + Railway — frontend en Vercel (gratis), API en Railway. WebSockets problematicos en serverless; dos plataformas = CORS + latencia.
  2. Coolify + Docker Compose — un solo VPS, un solo docker-compose con api + web. Coolify gestiona HTTPS, dominios y healthchecks. Sin coste extra.
  3. Cloudflare Tunnel — expone localhost sin VPS. No escala bien y depende de la maquina local encendida.
- **Decision:** Docker Compose con dos servicios (api + web) desplegados en Coolify en el VPS del usuario. Coolify provee HTTPS automatico via LetsEncrypt, reverse proxy y reinicios. Un solo volumen para SQLite. Sin dependencia de plataformas serverless.
- **Consecuencias:** El VPS debe estar siempre encendido. SQLite en volumen Docker (backups manuales por ahora). Migracion futura a Speckle self-hosted anade servicios extra al compose (postgres, redis, speckle-server).

---

### ADR-009 — Speckle Cloud Free Tier para MVP

- **Fecha:** 2026-08-05
- **Estado:** Aceptada
- **Contexto:** Speckle requiere un servidor (cloud o self-hosted) para recibir los datos del conector de Revit y servir el visor 3D. Arrancar con self-hosted anade configuracion de infraestructura antes de validar el producto.
- **Opciones consideradas:**
  1. Speckle Cloud Free Tier — 1 proyecto, streams ilimitados, ~5 GB, 3 colaboradores. Arranque inmediato.
  2. Speckle Server Docker self-hosted — sin limites pero requiere Postgres + Redis + speckle-server en el VPS desde el dia 1.
- **Decision:** Speckle Cloud Free Tier para el MVP. El limite de 1 proyecto no afecta al MVP (un solo modelo/stream). La API es identica en ambos casos: migrar a self-hosted solo requiere cambiar la variable SPECKLE_SERVER_URL en .env y reconfigurar el connector de Revit. El prompt 12-deploy.md documenta la migracion completa.
- **Consecuencias:** Dependencia de servicio externo (Speckle Cloud). Limite de storage (~5 GB) suficiente para modelos de prueba. Sin coste. Migracion a self-hosted no requiere cambios de codigo.

---
