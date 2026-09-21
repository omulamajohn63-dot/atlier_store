"""Defensive sanitization for anything persisted into the audit trail.

The audit log must never store passwords, tokens, card data or other
credentials/PII. ``sanitize`` recursively walks arbitrary client-provided
payloads and replaces the value of any sensitive-looking key with
``[REDACTED]``, truncates oversized strings and coerces exotic values to their
string form so the result is always JSON-serializable.
"""

import re

REDACTED = "[REDACTED]"
MAX_STRING_LENGTH = 1000

# Substrings (after lower-casing and normalising ``-`` to ``_``) that mark a
# key as sensitive. Intentionally conservative: an audit trail that
# over-redacts is still useful; one that leaks credentials is not.
_SENSITIVE_PARTS = (
    "password",
    "passwd",
    "pwd",
    "secret",
    "token",
    "bearer",
    "authorization",
    "api_key",
    "apikey",
    "client_secret",
    "card",
    "cvv",
    "cvc",
    "ccv",
    "otp",
    "pin",
    "verification_code",
    "session",
    "phone",
    "email",
    "ssn",
    "national_id",
    "id_number",
)

_SENSITIVE_HINT = re.compile(
    r"(password|passwd|pwd|secret|token|bearer|authorization|api_key|apikey|"
    r"client_secret|card|cvv|cvc|ccv|otp|pin|verification_code|session|phone|"
    r"email|ssn|national_id|id_number)",
    re.IGNORECASE,
)


def is_sensitive_key(key):
    normalized = str(key).lower().replace("-", "_")
    return _SENSITIVE_HINT.search(normalized) is not None


def truncate(value):
    text = str(value)
    if len(text) <= MAX_STRING_LENGTH:
        return text
    return text[:MAX_STRING_LENGTH] + "..."


def sanitize(value, _depth=0):
    """Recursively redact sensitive keys and coerce to JSON-safe primitives."""
    if _depth > 10:
        return truncate(value)
    if isinstance(value, dict):
        return {
            str(key): sanitize(REDACTED if is_sensitive_key(key) else item,
                               _depth + 1)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [sanitize(item, _depth + 1) for item in value]
    if isinstance(value, str):
        return truncate(value)
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    return truncate(value)