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
- category (TEXT) — Walls, Doors, Floors, Windows, etc.
- family (TEXT, nullable) — Familia de Revit
- type_name (TEXT, nullable) — Tipo del elemento
- level (TEXT, nullable) — Nivel del edificio (Level 1, Level 2...)
- parameters (TEXT) — JSON con parametros del elemento
- volume (REAL, nullable) — Volumen en metros cubicos
- area (REAL, nullable) — Area en metros cuadrados
- length (REAL, nullable) — Longitud en metros
- source (TEXT) — 'speckle' o 'revit_ws'
- commit_id (TEXT, nullable) — ID del commit de Speckle
- created_at (TEXT)
- updated_at (TEXT)

Ejemplos de consultas:
- Muros del modelo:
  SELECT element_id, category, level, family, type_name, volume
  FROM bim_elements WHERE category='Walls'

- Elementos sin nivel:
  SELECT element_id, category FROM bim_elements WHERE level IS NULL OR level=''

- Volumen total por categoria:
  SELECT category, SUM(volume) as total_volume, COUNT(*) as n
  FROM bim_elements GROUP BY category ORDER BY total_volume DESC

- Structural Framing por nivel:
  SELECT level, COUNT(*) as n FROM bim_elements
  WHERE category='Structural Framing' GROUP BY level
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
            answer = await self._llm.summarize_query_results(
                question=question,
                rows_preview=json.dumps(capped[:10], default=str),
                model_context=summary,
            )
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
