"""Structured logging helpers for Modeza.

* :class:`RequestContextFilter` — injects the active request's correlation
  fields (request_id, user_id, ip) into every record so console log lines and
  JSON payloads are always traceable back to a request.
* :class:`JsonFormatter` — emits records as single-line JSON. Dict-valued
  messages (e.g. the HTTP request envelope) are flattened into the payload.
"""

import json
import logging

from audit.context import current_request_context

_CORRELATION_ATTRS = ("request_id", "request_user_id", "request_ip")


class RequestContextFilter(logging.Filter):
    def filter(self, record):
        context = current_request_context()
        record.request_id = context.get("request_id") or ""
        record.request_ip = context.get("ip_address") or ""

        user_id = ""
        request = context.get("request")
        if request is not None:
            user = getattr(request, "user", None)
            if user is not None:
                try:
                    if user.is_authenticated:
                        user_id = str(getattr(user, "pk", "") or "")
                except Exception:
                    user_id = ""
        record.request_user_id = user_id
        return True


class JsonFormatter(logging.Formatter):
    """Emit one JSON object per line."""

    def format(self, record):
        payload = {
            "timestamp": self.formatTime(
                record, datefmt="%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
        }
        for attr in _CORRELATION_ATTRS:
            payload[attr] = getattr(record, attr, "")

        message = record.msg
        if isinstance(message, dict):
            payload.update(message)
        else:
            payload["message"] = record.getMessage()

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        try:
            return json.dumps(payload, default=str, sort_keys=True)
        except (TypeError, ValueError):
            payload["message"] = str(message)
            return json.dumps(payload, default=str, sort_keys=True)


class TextFormatter(logging.Formatter):
    """Human-readable lines with a correlation suffix when (and only when) a
    request is active, so background log lines stay clean."""

    def format(self, record):
        base = super().format(record)
        request_id = getattr(record, "request_id", "") or ""
        request_user_id = getattr(record, "request_user_id", "") or ""
        request_ip = getattr(record, "request_ip", "") or ""
        if not request_id:
            return base
        suffix = " ".join(
            part for part in (
                f"request_id={request_id}",
                f"user_id={request_user_id}" if request_user_id else "",
                f"ip={request_ip}" if request_ip else "",
            ) if part
        )
        return f"{base} {suffix}" if suffix else base