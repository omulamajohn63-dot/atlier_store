"""Audit hooks for Django's own authentication lifecycle (admin UI).

The customer storefront authenticates 100% client-side via Supabase, so the
server never observes those login/logout events — the browser reports them
through ``POST /api/audit/events``. These receivers cover the server-side
admin login flow instead.
"""

from django.contrib.auth.signals import (
    user_logged_in,
    user_logged_out,
    user_login_failed,
)
from django.dispatch import receiver

from .services import AuditLogService


@receiver(user_logged_in)
def _audit_admin_login(sender, request, user, **kwargs):
    AuditLogService.log(
        "login",
        actor=user,
        category="auth",
        result="success",
        description=f"Admin login for {user.get_username()}.",
    )


@receiver(user_logged_out)
def _audit_admin_logout(sender, request, user, **kwargs):
    AuditLogService.log(
        "logout",
        actor=user,
        category="auth",
        result="success",
        description=f"Admin logout for {user.get_username()}.",
    )


@receiver(user_login_failed)
def _audit_admin_login_failed(sender, credentials, request=None, **kwargs):
    AuditLogService.log(
        "login_failed",
        category="auth",
        result="failure",
        severity="medium",
        description="Admin login attempt failed.",
        metadata={"username": credentials.get("username") or ""},
    )