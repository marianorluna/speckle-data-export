"""Async OpenRouter client (OpenAI-compatible chat completions)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class LLMError(RuntimeError):
    """Raised when the LLM provider returns an error or unexpected payload."""


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
   para acceder a parametros especificos.
4. Los nombres de parametros dentro del JSON usan espacios y mayusculas
   (ej. 'Fire Rating', 'Width', 'Height').
5. Responde SOLO con la query SQL, sin explicaciones ni markdown.
6. Si la pregunta NO consulta datos de este modelo (conocimiento general, clima,
   historia, chistes, codigo, politicas, definiciones abstractas sin pedír datos
   del modelo, u otros temas ajenos), responde exactamente: UNABLE_TO_ANSWER
7. Si la pregunta es sobre el modelo pero no se puede expresar con el esquema,
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
    ) -> str:
        """Explain SQL result rows; never answer off-topic user intent."""
        system = (
            "Eres un asistente BIM. Tu UNICA tarea es resumir en espanol "
            "(1-2 frases) los resultados SQL del modelo cargado. "
            "No respondas conocimiento general ni temas ajenos al modelo. "
            f"KPIs del modelo:\n{model_context}"
        )
        user = (
            f"Pregunta del usuario: {question}\n"
            f"Filas (vista previa): {rows_preview}"
        )
        return await self._complete(
            system=system,
            user=user,
            temperature=0.2,
            max_tokens=400,
        )

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
