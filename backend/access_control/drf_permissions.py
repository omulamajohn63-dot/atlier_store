"""DRF permission class that enforces MODEZA granular permissions.

Works for both Django-session staff and Supabase JWT staff, and follows the
same rules as ``access_control.services.user_has_permission``: fail-closed,
respects staff profiles, roles, direct permissions and deactivation state.
"""

from rest_framework.permissions import BasePermission

from .services import has_staff_access, user_has_permission


class AdminPermission(BasePermission):
    """Admin endpoint permission.

    A view may declare ``required_permissions`` (a string or list of codes).
    When declared, *all* of the codes must be held by the operator. When
    absent, any active staff member may access the endpoint.
    """

    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if not has_staff_access(user):
            return False

        codes = getattr(view, "required_permissions", None)
        if not codes:
            return True
        if isinstance(codes, str):
            codes = [codes]
        return all(user_has_permission(user, code) for code in codes)