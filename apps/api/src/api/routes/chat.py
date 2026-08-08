"""Natural-language chat / text-to-SQL over bim_elements."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from math import ceil

from fastapi import APIRouter, HTTPException, Request, status

from src.api.deps import CurrentUser, SessionDep, SettingsDep, Settings
from src.api.schemas import ApiDataResponse, ChatRequest, ChatResultOut
from src.application.chat_abuse_guard import chat_abuse_guard
from src.application.chat_query import ChatQuery
from src.application.chat_rate_limiter import chat_rate_limiter
from src.domain.user import User
from src.infrastructure.db.element_repository import ElementRepository
from src.infrastructure.llm.client import LLMClient

router = APIRouter()

_MAX_STRIKES = 3


def _user_key(user: User) -> str:
    if user.id is not None:
        return f"id:{user.id}"
    return f"email:{user.email}"


def _client_ip(request: Request) -> str:
    """Best-effort client IP (first X-Forwarded-For hop behind Coolify/proxy)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _quota_key_and_limit(
    user: User, request: Request, settings: Settings
) -> tuple[str, int] | None:
    """Return (rate-limit key, daily limit) for guest roles; None if exempt."""
    if user.role == "guest":
        return f"ip:{_client_ip(request)}", max(1, settings.chat_guest_daily_limit)
    if user.role == "guest_extended":
        uid = user.id if user.id is not None else user.email
        return f"user:{uid}", max(1, settings.chat_guest_extended_daily_limit)
    return None


def _format_blocked_until(blocked_until: datetime) -> str:
    local = blocked_until.astimezone() if blocked_until.tzinfo else blocked_until
    return local.strftime("%H:%M")


def _format_wait_relative(
    blocked_until: datetime, *, now: datetime | None = None
) -> str:
    """Human-friendly wait label: ~1 hora / ~N horas / ~1 día."""
    instant = now if now is not None else datetime.now(UTC)
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=UTC)
    until = blocked_until
    if until.tzinfo is None:
        until = until.replace(tzinfo=UTC)
    delta = until - instant
    if delta <= timedelta(0):
        return "aproximadamente 1 hora"
    total_minutes = delta.total_seconds() / 60
    if total_minutes < 90:
        return "aproximadamente 1 hora"
    total_hours = total_minutes / 60
    if total_hours < 20:
        hours = max(2, ceil(total_hours))
        return f"aproximadamente {hours} horas"
    return "aproximadamente 1 día"


def _abuse_blocked_answer(blocked_until: datetime, *, just_blocked: bool) -> str:
    until = _format_blocked_until(blocked_until)
    if just_blocked:
        return (
            f"Has hecho {_MAX_STRIKES} o más preguntas ajenas al modelo. "
            f"El chat queda bloqueado hasta las {until}."
        )
    return (
        f"El chat está temporalmente bloqueado por uso indebido. "
        f"Podrás volver a consultar el modelo a partir de las {until}."
    )


def _quota_blocked_answer(*, limit: int, blocked_until: datetime) -> str:
    wait = _format_wait_relative(blocked_until)
    return (
        f"Has usado las {limit} preguntas de hoy (cuota de invitado). "
        f"Debes esperar {wait}. "
        "Si quieres consultar más veces, comunícate con el administrador "
        "para obtener un usuario con más intentos."
    )


@router.post("", response_model=ApiDataResponse[ChatResultOut])
async def chat(
    body: ChatRequest,
    request: Request,
    current_user: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> ApiDataResponse[ChatResultOut]:
    """
    Ask a natural-language question about the ingested BIM model.

    Requires JWT (admin, guest, or guest_extended). Guests are limited to
    ``CHAT_GUEST_DAILY_LIMIT`` billable questions per IP per UTC day;
    ``guest_extended`` uses ``CHAT_GUEST_EXTENDED_DAILY_LIMIT`` per user id.
    A question is billable only when it returns ``element_ids`` (viewer select).
    Off-topic questions are refused; repeated abuse blocks the chat for one hour.
    """
    if not settings.openrouter_api_key.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPENROUTER_API_KEY is not configured",
        )

    key = _user_key(current_user)
    abuse = chat_abuse_guard.check(key)
    if abuse.blocked_until is not None and abuse.blocked_until > datetime.now(UTC):
        return ApiDataResponse(
            data=ChatResultOut(
                type="blocked",
                question=body.question,
                answer=_abuse_blocked_answer(abuse.blocked_until, just_blocked=False),
                blocked_until=abuse.blocked_until,
                strikes=abuse.strikes,
            )
        )

    quota_ctx = _quota_key_and_limit(current_user, request, settings)
    if quota_ctx is not None:
        quota_key, limit = quota_ctx
        quota = chat_rate_limiter.check(quota_key, limit=limit)
        if quota.blocked and quota.blocked_until is not None:
            return ApiDataResponse(
                data=ChatResultOut(
                    type="blocked",
                    question=body.question,
                    answer=_quota_blocked_answer(
                        limit=quota.limit,
                        blocked_until=quota.blocked_until,
                    ),
                    blocked_until=quota.blocked_until,
                    strikes=None,
                )
            )

    element_repo = ElementRepository(session)
    async with LLMClient(
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        model=settings.openrouter_model,
    ) as llm:
        result = await ChatQuery(llm, element_repo).execute(body.question)

    if (
        quota_ctx is not None
        and result.get("type") == "query"
        and result.get("element_ids")
    ):
        quota_key, limit = quota_ctx
        chat_rate_limiter.record(quota_key, limit=limit)

    if result["type"] == "query":
        chat_abuse_guard.record_success(key)
    elif result["type"] == "refused":
        abuse = chat_abuse_guard.record_refusal(key)
        result["strikes"] = abuse.strikes
        if abuse.blocked_until is not None:
            result["type"] = "blocked"
            result["blocked_until"] = abuse.blocked_until
            result["answer"] = _abuse_blocked_answer(
                abuse.blocked_until,
                just_blocked=abuse.just_blocked,
            )
        else:
            remaining = _MAX_STRIKES - abuse.strikes
            remaining_hint = (
                f"; te quedan {remaining}" if remaining > 0 else ""
            )
            result["answer"] = (
                f"{result['answer']} "
                f"(Aviso: {abuse.strikes}/{_MAX_STRIKES} consultas fuera de tema. "
                f"Tras {_MAX_STRIKES}, el chat se bloquea 1 hora{remaining_hint}.)"
            )

    return ApiDataResponse(data=ChatResultOut.model_validate(result))
