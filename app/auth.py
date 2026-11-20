# -*- coding: utf-8 -*-
"""密码哈希与会话令牌。仅使用标准库，避免额外依赖。"""
import hashlib
import hmac
import re
import secrets

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
ITERATIONS = 200_000


def valid_email(email: str) -> bool:
    return bool(EMAIL_RE.match((email or "").strip()))


def hash_password(password: str, salt: str | None = None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), ITERATIONS)
    return salt, digest.hex()


def verify_password(password: str, salt: str, expected: str) -> bool:
    _, digest = hash_password(password, salt)
    return hmac.compare_digest(digest, expected)


def new_token() -> str:
    return secrets.token_urlsafe(32)
