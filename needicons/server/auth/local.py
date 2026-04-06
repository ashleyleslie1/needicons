"""Local auth backend — always returns a default local user."""
from __future__ import annotations
from needicons.server.auth.base import AuthBackend, User

_LOCAL_USER = User(id="local", name="Local User")


class LocalAuth(AuthBackend):
    async def get_user(self, request) -> User:
        return _LOCAL_USER
