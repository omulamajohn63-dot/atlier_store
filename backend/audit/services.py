"""Centralized writer for the Modeza audit trail.

Every audit record in the application is created through
:class:`AuditLogService.log`. The service:

* auto-derives the actor, request ID, client IP, user agent and request path
  from the active request (when one exists),
* sanitizes metadata before it is persisted (``[REDACTED]`` for sensitive
  values),
* coerces unknown actions to ``security_event`` with a warning,
* defers writes until the surrounding transaction commits where possible, so
  records from rolled-back operations never survive, and
* never raises — an audit write failure is logged and swallowed.
"""

import logging

from django.db import connection, transaction

from . import constants
from .context import current_request_context
from .models import AuditLog
from .sanitizers import sanitize

logger = logging.getLogger("audit")


class AuditLogService:
    @classmethod
    def log(cls, action, *, actor=None, category=None, object_type="",
            object_id="", object_repr="", description=None, metadata=None,
            result="success", severity=None, status_code=None, path=None,
            request_id=None, ip_address=None, user_agent=None):
        try:
            return cls._write(
                action=action,
                actor=actor,
                category=category,
                object_type=object_type,
                object_id=object_id,
                object_repr=object_repr,
                description=description,
                metadata=metadata,
                result=result,
                severity=severity,
                status_code=status_code,
                path=path,
                request_id=request_id,
                ip_address=ip_address,
                user_agent=user_agent,
            )
        except Exception:
            # An audit write must never break the business operation that
            # triggered it. Log the failure and carry on.
            logger.exception("Audit log write failed; continuing.")

    # -- internals ---------------------------------------------------------

    @classmethod
    def _write(cls, action, *, actor, category, object_type, object_id,
               object_repr, description, metadata, result, severity,
               status_code, path, request_id, ip_address, user_agent):
        canonical = constants.coerce_action(action or "")
        if canonical != (action or ""):
            logger.warning("Coerced unknown audit action %r to %r.",
                           action, canonical)

        context = current_request_context()
        request = context.get("request")
        user = actor or cls._authenticated_user(request)

        if not request_id:
            request_id = context.get("request_id") or ""
        if ip_address is None:
            ip_address = context.get("ip_address")
        if not user_agent:
            user_agent = context.get("user_agent") or ""
        if not path and request is not None:
            path = getattr(request, "path", "") or ""
        path = path or ""
        if not category:
            category = constants.CATEGORY_BY_ACTION.get(canonical, "") or "system"
        if not severity:
            severity = constants.SEVERITY_BY_ACTION.get(canonical, "info")
        if not description:
            description = (
                f"{canonical} {object_repr or object_type or 'record'}".strip())
        result = result if result in constants.RESULTS else "success"

        record = AuditLog(
            actor=user if user is not None and getattr(user, "pk", None) else None,
            actor_role=getattr(user, "supabase_role", "") if user is not None else "",
            actor_email=getattr(user, "email", "") if user is not None else "",
            action=canonical,
            category=category,
            object_type=object_type or "",
            object_id=str(object_id) if object_id else "",
            object_repr=object_repr or "",
            description=description,
            metadata=sanitize(metadata) if metadata else {},
            result=result,
            severity=severity,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
            path=path,
            status_code=status_code,
        )
        if connection.in_atomic_block and not connection.needs_rollback:
            # Inside a real (non-test) atomic block: defer until commit so a
            # rolled-back operation does not leave orphan audit records.
            transaction.on_commit(lambda: _persist(record))
        else:
            _persist(record)
        return record

    @staticmethod
    def _authenticated_user(request):
        if request is None:
            return None
        candidate = getattr(request, "user", None)
        if candidate is None:
            return None
        try:
            if candidate.is_authenticated:
                return candidate
        except Exception:
            return None
        return None

    @classmethod
    def current_request_id(cls):
        return current_request_context().get("request_id") or ""

    @classmethod
    def current_ip(cls):
        return current_request_context().get("ip_address") or None


def _persist(record):
    record.save()