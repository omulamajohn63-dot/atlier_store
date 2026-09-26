"""Authentication backends for the MODEZA admin portal."""

from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model


class EmailOrUsernameModelBackend(ModelBackend):
    """Allow administrator sign-in with either the username or the account email.

    Email lookups are case-insensitive; the username keeps Django's default
    case-sensitive exact matching. Password verification and the active-account
    guard behave exactly like the built-in ModelBackend.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        UserModel = get_user_model()
        if username is None:
            username = kwargs.get(UserModel.USERNAME_FIELD)
        if username is None or password is None:
            return None

        user = None
        for lookup, value in (('username', username), ('email__iexact', username)):
            try:
                user = UserModel._default_manager.get(**{lookup: value})
                break
            except UserModel.DoesNotExist:
                continue
            except UserModel.MultipleObjectsReturned:
                if lookup == 'email__iexact':
                    # Several rows can share an email: the staff account plus
                    # its Supabase customer mirror. Prefer the staff account.
                    staff_match = (UserModel._default_manager
                                   .filter(email__iexact=value, is_staff=True)
                                   .exclude(username__startswith='supabase_')
                                   .order_by('username')
                                   .first())
                    if staff_match is not None:
                        user = staff_match
                        break
                continue

        if user is None:
            # Run the default password hasher once to reduce the timing
            # difference between an existing and a nonexistent user.
            UserModel().set_password(password)
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None