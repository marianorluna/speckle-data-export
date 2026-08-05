# BIM Dashboard — Tiempo real desde Revit

Dashboard BIM con actualizacion en tiempo real para modelos de Revit. Visualiza KPIs, parametros y geometria 3D en un panel web compartible, con alertas de calidad de datos y consultas en lenguaje natural via IA.

## Caracteristicas principales

- **Tiempo real:** los cambios en Revit se reflejan en el dashboard al instante via WebSocket (pyRevit).
- **Visor 3D:** geometria del modelo embebida con Speckle Viewer, vinculada a los datos tabulares.
- **KPIs interactivos:** cards, graficos (Recharts) y tabla filtrable por categoria, nivel y parametros.
- **Control de calidad:** deteccion automatica de parametros faltantes o inconsistentes.
- **IA conversacional:** preguntas en lenguaje natural sobre el modelo ("Que puertas del Nivel 2 no tienen resistencia al fuego?") via DeepSeek.
- **Compartible online:** desplegado en un VPS con Coolify, accesible via URL publica con login JWT.

## Stack

| Capa          | Herramienta                   |
| ------------- | ----------------------------- |
| Backend       | FastAPI + uvicorn + WebSocket |
| Base de datos | SQLite + SQLAlchemy 2.0 async |
| Frontend      | React 19 + Vite + Tailwind    |
| Visor 3D      | @speckle/viewer               |
| Graficos      | Recharts                      |
| IA            | DeepSeek v3 via OpenRouter    |
| Auth          | JWT (pyjwt / jose)            |
| Revit push    | pyRevit + websocket-client    |
| Deploy        | Docker Compose + Coolify VPS  |

## Documentacion

| Archivo | Funcion |
|---------|---------|
| `AGENTS.md` | Stack, producto, estado de sesion (SSOT) |
| `docs/architecture.md` | Patron, capas, carpetas, flujos |
| `docs/decisions.md` | ADRs — por que se eligio cada decision |
| `docs/onboarding.md` | Setup local paso a paso |
| `docs/prompts/` | Prompts paso a paso para desarrollar el proyecto |
| `.cursor/rules/` | Reglas de Cursor AI (como programar, que esta prohibido) |

## Arranque rapido

```bash
# Backend
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.api.main:app --reload --port 8000

# Frontend
cd apps/web
npm install && npm run dev
```

Ver [`docs/onboarding.md`](docs/onboarding.md) para instrucciones completas.

## Licencia

Privado — Uso interno.