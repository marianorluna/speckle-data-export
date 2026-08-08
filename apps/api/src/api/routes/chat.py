"""Natural-language chat / text-to-SQL over bim_elements."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, status

from src.api.deps import CurrentUser, SessionDep, SettingsDep
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


def _format_blocked_until(blocked_until: datetime) -> str:
    local = blocked_until.astimezone() if blocked_until.tzinfo else blocked_until
    return local.strftime("%H:%M")


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
    until_local = blocked_until.astimezone() if blocked_until.tzinfo else blocked_until
    until_label = until_local.strftime("%d/%m %H:%M")
    return (
        f"Has usado las {limit} preguntas de hoy (cuota de invitado). "
        f"Podrás volver a preguntar a partir de las {until_label} (hora local)."
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

    Requires JWT (admin or guest). Guests are limited to
    ``CHAT_GUEST_DAILY_LIMIT`` questions per IP per UTC day.
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

    apply_guest_quota = current_user.role == "guest"
    client_ip = _client_ip(request) if apply_guest_quota else ""
    if apply_guest_quota:
        limit = max(1, settings.chat_guest_daily_limit)
        chat_rate_limiter.set_daily_limit(limit)
        quota = chat_rate_limiter.check(client_ip)
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

    if apply_guest_quota:
        chat_rate_limiter.record(client_ip)

    element_repo = ElementRepository(session)
    async with LLMClient(
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        model=settings.openrouter_model,
    ) as llm:
        result = await ChatQuery(llm, element_repo).execute(body.question)

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
