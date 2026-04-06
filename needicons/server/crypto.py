"""API key encryption at rest using machine-derived key."""
from __future__ import annotations
import base64
import hashlib
import platform
import uuid
from cryptography.fernet import Fernet


def _derive_key() -> bytes:
    seed = f"{platform.node()}-{uuid.getnode()}-needicons"
    key_bytes = hashlib.sha256(seed.encode()).digest()
    return base64.urlsafe_b64encode(key_bytes)


_fernet = Fernet(_derive_key())


def encrypt_value(plaintext: str) -> str:
    if not plaintext:
        return ""
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str) -> str:
    if not ciphertext:
        return ""
    return _fernet.decrypt(ciphertext.encode()).decode()
