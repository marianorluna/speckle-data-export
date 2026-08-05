# Start — punto de entrada

**Punto de entrada — lee esto primero al especializar el template.**

Guía de qué copiar tal cual y qué rellenar antes de arrancar cualquier proyecto.

---

## Fuente canónica (SSOT) — no duplicar

Cada dato vive en **un solo archivo**. El resto solo enlaza.

| Dato | Dónde vive (única vez) | Dónde se menciona |
|------|------------------------|-------------------|
| Stack | [`AGENTS.md` §2](../AGENTS.md#2-stack-del-proyecto) | Enlace corto en otros docs |
| Producto / dominio | [`AGENTS.md` §3](../AGENTS.md#3-contexto-de-negocio) | Idem |
| Estado de sesión | [`AGENTS.md` §4](../AGENTS.md#4-estado-actual) | Solo aquí |
| Capas / carpetas / flujos | [`architecture.md`](./architecture.md) | Enlace desde onboarding / AGENTS mapa |
| Decisiones ya tomadas | [`decisions.md`](./decisions.md) | Checklist en architecture al cerrar → ADR |
| Cómo arrancar en local | [`onboarding.md`](./onboarding.md) | Enlace corto en [`README.md`](../README.md) |

Si cambias el stack o el producto, edita **solo** `AGENTS.md`. No copies la lista a `architecture.md` ni a `onboarding.md`.

> Recuerda: un enlace Markdown **no** inyecta el contenido en el agente. En chats importantes, menciona también `@AGENTS.md`.

---

## Archivos universales — úsalos sin tocar

Estos archivos funcionan para **cualquier stack, lenguaje o tipo de proyecto**. Cópialos y olvídate.

| Archivo | Qué hace | ¿Cuándo revisar? |
|---------|----------|-----------------|
| `.cursor/rules/core.mdc` | Rol del agente, idioma, regla de 3 archivos, anti-alucinación, review loop | Solo si cambias el rol o el idioma base |
| `.cursor/rules/code-style.mdc` | Tipado estricto, naming, inmutabilidad, async/await, env vars | Nunca salvo que el proyecto tenga convenciones muy distintas |
| `.cursor/rules/git.mdc` | Conventional Commits, staging selectivo, prohibiciones destructivas | Nunca — es independiente del stack |
| `.cursor/rules/mentoring.mdc` | Proactividad, blueprint de tests, aviso de edge cases | Nunca — es comportamiento del agente, no del stack |
| `docs/prompting-learning.md` | Prompts Pre-Flight, regla del 10%, reverse engineering | Solo si quieres añadir más prompts de mentoría |

---

## Archivos que DEBES editar antes de empezar

Estos archivos son **placeholders**. Si arrancas el proyecto sin rellenarlos, el agente trabajará a ciegas.

### Prioridad 1 — Rellenar el primer día

| Archivo | Qué rellenar | Impacto si no lo haces |
|---------|-------------|----------------------|
| `AGENTS.md` §2 Stack | Framework, ORM, lenguaje, testing, despliegue | El agente propone soluciones del stack equivocado |
| `AGENTS.md` §3 Contexto de negocio | Producto, reglas de dominio, integraciones, deuda conocida | El agente no entiende restricciones del dominio |
| `docs/architecture.md` | Patrón arquitectónico y árbol de carpetas real | El agente puede crear archivos en rutas incorrectas |
| `.env.example` | Variables reales del proyecto (sin valores secretos) | Los devs no saben qué configurar; riesgo de `.env` mal formado |

### Prioridad 2 — Ajustar antes de la primera feature

| Archivo | Qué ajustar | Detalle |
|---------|------------|---------|
| `.cursor/rules/frontend.mdc` | Globs de activación | Cambia `*.{tsx,jsx,vue,svelte}` al patrón real de tu proyecto |
| `.cursor/rules/backend.mdc` | Globs de activación | Cambia las rutas `**/backend/**` al layout real de tu monorepo o servicio |
| `README.md` | Descripción del proyecto derivado | Reemplaza la descripción del template por la del producto real |
| `docs/onboarding.md` | Comandos reales de setup | Derivados del stack en `AGENTS.md` §2 (sin re-listar el stack) |

### Prioridad 3 — Mantener vivo durante el desarrollo

| Archivo | Qué actualizar y cuándo |
|---------|------------------------|
| `AGENTS.md` §4 Estado actual | Al cerrar cada sesión importante: fecha, foco, checklist, bloqueadores |
| `docs/architecture.md` → Decisiones abiertas | Al resolver: `[x] → ADR-NNN` y escribir el ADR en `docs/decisions.md` |

---

## Del proyecto derivado (no vienen en este boilerplate)

No se incluyen a propósito: hinchan el template y obligan a borrarlos o reescribirlos en cada clon. Créalos en el **repo del producto** cuando toque.

| Archivo / recurso | Cuándo crearlo |
|-------------------|----------------|
| `LICENSE` | Repo público, entrega a clientes, o quieres dejar claro el uso del código |
| `CHANGELOG.md` | Cuando empieces a etiquetar releases (`v0.1.0`, `v1.0.0`…) |
| Versión de la app | En el manifiesto del stack (`package.json`, `pyproject.toml`, etc.), no aquí |
| `CONTRIBUTING.md` | Cuando entre un segundo colaborador o contribuciones externas |
| `SECURITY.md` / `CODE_OF_CONDUCT.md` | Repos abiertos o producto con usuarios reales |
| `.github/` (PR / issue templates) | Equipo o open source con flujo de review |
| `.github/workflows/ci.yml` (o equivalente) | Primer PR en equipo, o `main` protegida: lint, typecheck, test |
| Deploy (Vercel, Railway, AWS…) | Al publicar: configura la plataforma; documenta la elección en `AGENTS.md` §2 (Despliegue) |
| `Dockerfile` / `docker-compose.yml` | BD/redis locales reproducibles, API multi-servicio, o imagen propia para producción |
| `.cursor/rules/docker.mdc` / `ci.mdc` | Opcional, cuando Docker o CI formen parte habitual del flujo |
| ESLint / Biome / Prettier | Al existir código: lint + formato; declara la elección en `AGENTS.md` §2 si aplica |
| Typecheck (`tsc --noEmit` / tipado del lenguaje) | Junto al lenguaje estricto; en CI cuando haya pipeline |
| Tests unitarios (Vitest, Jest, pytest…) | Al primer módulo de dominio; documenta el runner en `AGENTS.md` §2 (Testing) |
| Tests e2e (Playwright, Cypress…) | Cuando haya flujos críticos de UI o API a proteger |
| Validación de entrada (Zod, Valibot, Pydantic, class-validator…) | En boundaries (HTTP, forms, env); no hardcodear schemas en docs |
| Pre-commit / husky / lint-staged | Opcional, cuando el equipo quiera gates locales antes del push |

La versión de **este template** vive en `AGENTS.md` (`Template versión`). No la confundas con la versión de la app. Un MVP en Vercel a menudo no necesita Docker ni CI el día 1; lint + tests sí conviene montarlos pronto en el **proyecto derivado**, no en este boilerplate.

---

## Resumen visual

```
cursor-project-template/
│
├── ✅ COPIAR SIN TOCAR
│   ├── .cursor/rules/core.mdc
│   ├── .cursor/rules/code-style.mdc
│   ├── .cursor/rules/git.mdc
│   ├── .cursor/rules/mentoring.mdc
│   └── docs/prompting-learning.md
│
├── ✏️  RELLENAR (fuentes canónicas — Prioridad 1)
│   ├── AGENTS.md              ← stack + negocio + estado (SSOT)
│   ├── docs/architecture.md   ← patrón + árbol de carpetas (SSOT)
│   └── .env.example           ← variables del proyecto
│
├── 🔧 AJUSTAR (Prioridad 2)
│   ├── .cursor/rules/frontend.mdc
│   ├── .cursor/rules/backend.mdc
│   ├── docs/onboarding.md     ← comandos; stack → enlace a AGENTS
│   └── README.md
│
├── 📎 REFERENCIA (no duplicar datos de AGENTS)
│   ├── docs/decisions.md      ← ADRs
│   └── docs/start.md          ← este archivo (punto de entrada)
│
└── ➕ CREAR EN EL PROYECTO DERIVADO (cuando toque)
    ├── LICENSE / CHANGELOG / CONTRIBUTING
    ├── versión en package.json / pyproject.toml / …
    ├── .github/workflows/ci.yml
    ├── Dockerfile / docker-compose.yml
    ├── config de deploy (Vercel, Railway, …)
    ├── ESLint|Biome|Prettier + typecheck
    ├── Vitest|Jest|pytest + Playwright|Cypress
    └── validación (Zod|Valibot|Pydantic|…)
```
