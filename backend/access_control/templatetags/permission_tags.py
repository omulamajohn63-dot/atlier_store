from django import template

from ..services import effective_permissions, has_staff_access, is_super_admin, user_has_permission

register = template.Library()


@register.filter
def can(user, code):
    """Template-friendly permission check.

    Usage: ``{% if request.user|can:'orders.confirm' %}``
    """
    return user_has_permission(user, code)


@register.filter
def perms(user):
    """Return the set of permission codes a user currently holds."""
    return effective_permissions(user)


@register.filter
def staff_access(user):
    """True when the user currently has admin access."""
    return has_staff_access(user)


@register.filter
def super_admin(user):
    """True when the user is a MODEZA Super Admin."""
    return is_super_admin(user)