"""Async OpenRouter client (OpenAI-compatible chat completions)."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, NamedTuple

import httpx

logger = logging.getLogger(__name__)


class LLMError(RuntimeError):
    """Raised when the LLM provider returns an error or unexpected payload."""


class QuerySummary(NamedTuple):
    """NL answer plus whether result rows are safe to highlight in the viewer."""

    answer: str
    highlight_elements: bool


class LLMClient:
    """Thin adapter for DeepSeek (or any chat model) via OpenRouter."""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str,
        model: str,
        timeout: float = 30.0,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        if not api_key.strip():
            raise ValueError("OPENROUTER_API_KEY is required")
        self._api_key = api_key.strip()
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._timeout = timeout
        self._http = http_client
        self._owns_http = http_client is None

    async def __aenter__(self) -> LLMClient:
        if self._http is None:
            self._http = httpx.AsyncClient(
                timeout=self._timeout,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
            )
        return self

    async def __aexit__(self, *args: object) -> None:
        if self._owns_http and self._http is not None:
            await self._http.aclose()
            self._http = None

    async def generate_sql(self, question: str, schema_description: str) -> str:
        """Translate a natural-language BIM question into a SQLite SELECT."""
        system_prompt = f"""Eres un asistente que convierte preguntas en lenguaje natural
sobre UN MODELO BIM YA CARGADO en consultas SQL para SQLite.

Esquema de la base de datos:

{schema_description}

Reglas:
1. Solo genera SELECT (o WITH ... SELECT). Nunca INSERT, UPDATE, DELETE, DROP ni PRAGMA.
2. Solo usa la tabla bim_elements y las columnas del esquema proporcionado.
3. parameters es un campo TEXT que contiene JSON. Usa json_extract() de SQLite
   para acceder a parametros especificos (respeta mayusculas/espacios en el nombre).
4. Los materiales estan en: json_extract(parameters,'$.Structural Material')
   o json_extract(parameters,'$.material'). Para filtrar material usa LIKE con lower().
5. Las columnas volume, area, length ya estan pobladas. Usarlas directamente;
   solo recurre a json_extract si necesitas un parametro menos comun.
6. Si ordenas por un metrico (volumen, area, altura...), filtra NULLS
   (AND col IS NOT NULL) para no devolver filas arbitrarias.
7. CRITICO: cuando el usuario pregunta "cuantos X hay" o filtra elementos,
   incluye SIEMPRE element_id en el SELECT (nunca solo COUNT(*)).
   Para agregados puros (SUM, AVG, GROUP BY) si puede omitirse.
8. Usa solo las categorias exactas del esquema. No inventes categorias.
9. Responde SOLO con la query SQL, sin explicaciones ni markdown.
10. Si la pregunta NO consulta datos de este modelo (conocimiento general, clima,
    historia, chistes, codigo, politicas, definiciones abstractas sin pedír datos
    del modelo, u otros temas ajenos), responde exactamente: UNABLE_TO_ANSWER
11. Si la pregunta es sobre el modelo pero no se puede expresar con el esquema,
    responde tambien: UNABLE_TO_ANSWER
"""
        return await self._complete(
            system=system_prompt,
            user=question,
            temperature=0.1,
            max_tokens=500,
        )

    async def summarize_query_results(
        self,
        *,
        question: str,
        rows_preview: str,
        model_context: str,
    ) -> QuerySummary:
        """Explain SQL rows and whether they identify viewable elements."""
        system = (
            "Eres un asistente BIM. Resume en espanol (1-2 frases) los resultados "
            "SQL del modelo cargado. No respondas conocimiento general ni temas "
            "ajenos al modelo.\n"
            "Responde SOLO con un JSON valido (sin markdown) de la forma:\n"
            '{"answer":"<texto>","highlight_elements":true|false}\n'
            "highlight_elements=true solo si las filas identifican elementos "
            "concretos que SI responden la pregunta (listados utiles o el "
            "elemento que cumple la condicion con datos validos).\n"
            "highlight_elements=false si no hay respuesta concreta: metricas "
            "null/vacias, ranking indeterminado, agregados sin element_id, "
            "0 filas utiles, o la pregunta no se puede resolver con esos datos.\n"
            f"KPIs del modelo:\n{model_context}"
        )
        user = (
            f"Pregunta del usuario: {question}\n"
            f"Filas (vista previa): {rows_preview}"
        )
        raw = await self._complete(
            system=system,
            user=user,
            temperature=0.2,
            max_tokens=400,
        )
        return _parse_query_summary(raw)

    async def _complete(
        self,
        *,
        system: str,
        user: str,
        temperature: float,
        max_tokens: int,
    ) -> str:
        if self._http is None:
            raise LLMError("LLMClient must be used as an async context manager")

        try:
            response = await self._http.post(
                f"{self._base_url}/chat/completions",
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
            )
        except httpx.HTTPError as exc:
            logger.exception("OpenRouter request failed")
            raise LLMError(f"OpenRouter request failed: {exc}") from exc

        if response.status_code >= 400:
            detail = response.text[:500]
            raise LLMError(f"OpenRouter HTTP {response.status_code}: {detail}")

        data: dict[str, Any] = response.json()
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMError("Unexpected OpenRouter response shape") from exc

        if not isinstance(content, str):
            raise LLMError("OpenRouter returned non-string content")
        return content.strip()


_JSON_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)


def _parse_query_summary(raw: str) -> QuerySummary:
    """Parse structured summary; fall back to plain text without highlight."""
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    candidates = [text]
    match = _JSON_OBJECT_RE.search(text)
    if match and match.group(0) != text:
        candidates.append(match.group(0))

    for candidate in candidates:
        try:
            payload = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if not isinstance(payload, dict):
            continue
        answer = payload.get("answer")
        highlight = payload.get("highlight_elements")
        if isinstance(answer, str) and answer.strip() and isinstance(highlight, bool):
            return QuerySummary(answer=answer.strip(), highlight_elements=highlight)

    logger.warning("Query summary was not valid JSON; omitting viewer highlight")
    return QuerySummary(answer=raw.strip() or "Consulta ejecutada.", highlight_elements=False)
