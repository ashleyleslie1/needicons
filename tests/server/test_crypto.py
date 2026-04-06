import pytest
from needicons.server.crypto import encrypt_value, decrypt_value

def test_encrypt_decrypt_roundtrip():
    original = "sk-test-api-key-12345"
    encrypted = encrypt_value(original)
    assert encrypted != original
    assert decrypt_value(encrypted) == original

def test_encrypted_value_is_not_plaintext():
    encrypted = encrypt_value("sk-secret")
    assert "sk-secret" not in encrypted

def test_decrypt_empty_returns_empty():
    assert decrypt_value("") == ""
