"""Auth backend abstract base class."""
from __future__ import annotations
from abc import ABC, abstractmethod
from pydantic import BaseModel


class User(BaseModel):
    id: str
    name: str


class AuthBackend(ABC):
    @abstractmethod
    async def get_user(self, request) -> User:
        """Get current user from request."""
        ...
