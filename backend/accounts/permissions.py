from rest_framework.permissions import BasePermission


class IsAuthenticatedSupabaseUser(BasePermission):
    message = 'A valid Supabase access token is required.'

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        # Deactivated accounts are denied on every protected endpoint.
        if not getattr(request.user, 'is_active', False):
            return False
        return True


class IsStaffOrAdmin(BasePermission):
    message = 'Staff or administrator access is required.'

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if not getattr(request.user, 'is_active', False):
            return False
        return bool(
            getattr(request.user, 'supabase_role', None) in {'staff', 'admin'}
        )


class IsAdmin(BasePermission):
    message = 'Administrator access is required.'

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if not getattr(request.user, 'is_active', False):
            return False
        return bool(
            getattr(request.user, 'supabase_role', None) == 'admin'
        )
