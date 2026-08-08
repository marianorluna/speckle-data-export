"""Domain entity: application user for JWT auth."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

UserRole = Literal["admin", "guest"]


class User(BaseModel):
    """Application user with bcrypt password hash and RBAC role."""

    model_config = ConfigDict(from_attributes=True)

    id: int | None = None
    email: str = Field(min_length=3)
    password_hash: str
    is_active: bool = True
    role: UserRole = "admin"
