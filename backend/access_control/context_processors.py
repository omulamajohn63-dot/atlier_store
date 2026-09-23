from .services import effective_permissions, has_staff_access


def staff_permissions(request):
    """Make the operator's permission set available to every admin template.

    Used by permission-aware navigation and buttons so that UI never shows an
    action that would be rejected on the backend anyway.
    """
    user = getattr(request, "user", None)
    if user is None or not user.is_authenticated:
        return {
            "staff_access": False,
            "staff_permission_codes": set(),
            "is_super_admin": False,
        }

    from .services import is_super_admin

    return {
        "staff_access": has_staff_access(user),
        "staff_permission_codes": effective_permissions(user),
        "is_super_admin": is_super_admin(user),
    }