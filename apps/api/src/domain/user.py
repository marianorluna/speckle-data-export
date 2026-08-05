"""Domain entity: admin user for JWT auth (used from prompt 03)."""

from pydantic import BaseModel, ConfigDict, Field


class User(BaseModel):
    """Application user with bcrypt password hash."""

    model_config = ConfigDict(from_attributes=True)

    id: int | None = None
    email: str = Field(min_length=3)
    password_hash: str
    is_active: bool = True
