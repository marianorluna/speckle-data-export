"""Auth routes: login token and current user profile."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict

from src.api.deps import CurrentUser, SessionDep, SettingsDep
from src.infrastructure.auth.jwt import create_access_token, verify_password
from src.infrastructure.db.user_repository import UserRepository

router = APIRouter()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserPublic(BaseModel):
    """Authenticated user payload without password hash."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    is_active: bool
    role: str


@router.post("/token", response_model=TokenResponse)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: SessionDep,
    settings: SettingsDep,
) -> TokenResponse:
    """Exchange email (username) + password for a JWT access token."""
    repo = UserRepository(session)
    user = await repo.get_by_email(form_data.username)
    if user is None or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(
        user.email,
        secret=settings.jwt_secret,
        expires_hours=settings.jwt_expires_hours,
    )
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserPublic)
async def read_current_user(current_user: CurrentUser) -> UserPublic:
    """Return the authenticated user (password hash excluded)."""
    assert current_user.id is not None
    return UserPublic(
        id=current_user.id,
        email=current_user.email,
        is_active=current_user.is_active,
        role=current_user.role,
    )
