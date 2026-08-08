"""Use case: natural-language question → validated SQL → results + element IDs."""

from __future__ import annotations

import json
import logging
from typing import Any

from src.application.sql_guard import is_safe_sql, normalize_llm_sql
from src.infrastructure.db.element_repository import ElementRepository
from src.infrastructure.llm.client import LLMClient, LLMError

logger = logging.getLogger(__name__)

_REFUSAL_MESSAGE = (
    "Solo puedo responder preguntas sobre el modelo BIM cargado "
    "(elementos, categorías, niveles, parámetros o métricas). "
    "Reformula tu consulta en esos términos."
)

_SCHEMA_DESCRIPTION = """
Tabla: bim_elements
Columnas:
- id (INTEGER PRIMARY KEY)
- element_id (TEXT UNIQUE) — UniqueId de Revit
- category (TEXT) — categoria del elemento. Valores exactos en este modelo:
    'Structural Framing', 'Generic Models', 'Structural Foundations',
    'Structural Beam Systems', 'Structural Columns', 'Walls', 'Floors',
    'Structural Rebar', 'Shaft Openings'
  Nota: NO existen categorias llamadas 'Doors', 'Windows', 'Foundations', 'Columns'.
  Para fundaciones usa category='Structural Foundations'.
  Para columnas usa category='Structural Columns'.
- family (TEXT, nullable) — Familia de Revit
- type_name (TEXT, nullable) — Tipo del elemento (ej. 'Concrete 10"', '24x24x20''')
- level (TEXT, nullable) — Nivel del edificio
- parameters (TEXT) — JSON con todos los parametros del elemento
- volume (REAL, nullable) — Volumen en metros cubicos (ya poblado desde parameters)
- area (REAL, nullable) — Area en metros cuadrados (ya poblado desde parameters)
- length (REAL, nullable) — Longitud en metros (ya poblado desde parameters)
- source (TEXT) — 'speckle' o 'revit_ws'
- created_at (TEXT), updated_at (TEXT)

Parametros importantes dentro del JSON 'parameters':
- Material del elemento: json_extract(parameters,'$.Structural Material')
  o json_extract(parameters,'$.material') — ej. 'Concrete, Cast-in-Place gray'
- Fire Rating: json_extract(parameters,'$.Fire Rating')
- Unconnected Height: json_extract(parameters,'$.Unconnected Height')
- Para otros parametros usa json_extract(parameters,'$.<Nombre exacto del parametro>')

REGLA CRITICA PARA EL BOTON DE SELECCION EN EL VISOR:
Cuando el usuario pregunta "cuantos X hay", "dame los X", "cuales son los X" o cualquier
filtrado de elementos → SIEMPRE incluye element_id en el SELECT (no uses solo COUNT(*)).
El recuento total se calcula automaticamente con las filas devueltas.
Usa COUNT(*) solo para sub-totales dentro de GROUP BY o cuando se mezcla con otros
agregados (SUM, AVG) sin posibilidad de incluir element_id.

Ejemplos de consultas:

- Cuantos muros hay (con boton visor):
  SELECT element_id, category, level, type_name, volume
  FROM bim_elements WHERE category='Walls'

- Muros de concreto con volumen:
  SELECT element_id, type_name, level, volume
  FROM bim_elements
  WHERE category='Walls'
    AND (
      lower(COALESCE(json_extract(parameters,'$.Structural Material'),'')) LIKE '%concrete%'
      OR lower(COALESCE(json_extract(parameters,'$.material'),'')) LIKE '%concrete%'
      OR lower(COALESCE(type_name,'')) LIKE '%concrete%'
    )
    AND volume IS NOT NULL

- Volumen total de muros de concreto (agregado puro):
  SELECT
    COUNT(*) as n_elementos,
    SUM(volume) as total_volume_m3,
    json_extract(parameters,'$.Structural Material') as material
  FROM bim_elements
  WHERE category='Walls'
    AND lower(COALESCE(json_extract(parameters,'$.Structural Material'),'')) LIKE '%concrete%'
  GROUP BY json_extract(parameters,'$.Structural Material')

- Cuantos tipos de fundaciones hay (agregado):
  SELECT type_name, COUNT(*) as n
  FROM bim_elements WHERE category='Structural Foundations'
  GROUP BY type_name ORDER BY n DESC

- Columnas por nivel (con element_id):
  SELECT element_id, level, family, type_name
  FROM bim_elements WHERE category='Structural Columns'
  ORDER BY level

- Elementos sin nivel:
  SELECT element_id, category FROM bim_elements
  WHERE level IS NULL OR level=''

- Volumen total por categoria (agregado puro):
  SELECT category, COUNT(*) as n, SUM(volume) as total_volume_m3
  FROM bim_elements
  WHERE volume IS NOT NULL
  GROUP BY category ORDER BY total_volume_m3 DESC
"""


class ChatQuery:
    """Orchestrates LLM SQL generation, guardrails, execution, and NL summary."""

    def __init__(self, llm_client: LLMClient, element_repo: ElementRepository) -> None:
        self._llm = llm_client
        self._repo = element_repo

    async def execute(self, question: str) -> dict[str, Any]:
        question = question.strip()
        if not question:
            return {
                "type": "error",
                "question": question,
                "answer": "La pregunta no puede estar vacía.",
                "results": [],
                "total_results": 0,
                "element_ids": [],
                "sql": None,
                "blocked_until": None,
                "strikes": None,
            }

        try:
            raw_sql = await self._llm.generate_sql(question, _SCHEMA_DESCRIPTION)
        except LLMError as exc:
            logger.warning("LLM generate_sql failed: %s", exc)
            return {
                "type": "error",
                "question": question,
                "answer": f"No se pudo contactar al modelo de IA: {exc}",
                "results": [],
                "total_results": 0,
                "element_ids": [],
                "sql": None,
                "blocked_until": None,
                "strikes": None,
            }

        sql = normalize_llm_sql(raw_sql)

        if sql.upper() == "UNABLE_TO_ANSWER":
            return {
                "type": "refused",
                "question": question,
                "answer": _REFUSAL_MESSAGE,
                "results": [],
                "total_results": 0,
                "element_ids": [],
                "sql": None,
                "blocked_until": None,
                "strikes": None,
            }

        if not is_safe_sql(sql):
            return {
                "type": "error",
                "question": question,
                "answer": "La consulta generada no pasó la validación de seguridad.",
                "results": [],
                "total_results": 0,
                "element_ids": [],
                "sql": sql,
                "blocked_until": None,
                "strikes": None,
            }

        try:
            results = await self._repo.execute_raw_sql(sql)
        except Exception as exc:
            logger.exception("Raw SQL execution failed")
            return {
                "type": "error",
                "question": question,
                "answer": f"Error al ejecutar la consulta: {exc}",
                "results": [],
                "total_results": 0,
                "element_ids": [],
                "sql": sql,
                "blocked_until": None,
                "strikes": None,
            }

        element_ids = [
            str(row["element_id"])
            for row in results
            if row.get("element_id") is not None
        ]
        capped = results[:50]
        capped_ids = element_ids[:50]

        summary = await self._model_summary()
        try:
            query_summary = await self._llm.summarize_query_results(
                question=question,
                rows_preview=json.dumps(capped[:10], default=str),
                model_context=summary,
            )
            answer = query_summary.answer
            if not query_summary.highlight_elements:
                capped_ids = []
        except LLMError:
            answer = (
                f"Consulta ejecutada: {len(results)} resultado(s). "
                f"Mostrando hasta {len(capped)}."
            )

        return {
            "type": "query",
            "question": question,
            "answer": answer,
            "results": capped,
            "total_results": len(results),
            "element_ids": capped_ids,
            "sql": sql,
            "blocked_until": None,
            "strikes": None,
        }

    async def _model_summary(self) -> str:
        kpis = await self._repo.compute_kpis()
        return (
            f"total_elements={kpis.get('total_elements')}; "
            f"by_category={kpis.get('elements_by_category')}; "
            f"by_level={kpis.get('elements_by_level')}; "
            f"missing_fire_rating={kpis.get('missing_fire_rating')}; "
            f"missing_level={kpis.get('missing_level')}"
        )
