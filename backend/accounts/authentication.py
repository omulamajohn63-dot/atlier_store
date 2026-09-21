import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from audit.services import AuditLogService


class SupabaseJWTAuthentication(BaseAuthentication):
    keyword = b'bearer'
    jwks_client = None

    def authenticate_header(self, request):
        return 'Bearer'

    def authenticate(self, request):
        parts = get_authorization_header(request).split()
        if not parts:
            return None
        if len(parts) != 2 or parts[0].lower() != self.keyword:
            raise AuthenticationFailed(
                'Authorization header must use Bearer authentication.')
        return self.authenticate_token(parts[1].decode('utf-8'))

    def authenticate_token(self, token):
        if not settings.SUPABASE_JWT_SECRET and not settings.SUPABASE_JWT_JWKS_URL:
            raise AuthenticationFailed(
                'Supabase JWT verification is not configured.')
        options = {'require': ['sub', 'exp', 'iat']}
        if settings.SUPABASE_JWT_ISSUER:
            issuer = settings.SUPABASE_JWT_ISSUER
        try:
            token_header = jwt.get_unverified_header(token)
            algorithm = token_header.get('alg')
            if algorithm == 'ES256':
                if not settings.SUPABASE_JWT_JWKS_URL:
                    raise AuthenticationFailed(
                        'Supabase JWKS verification is not configured.')
                if self.jwks_client is None:
                    self.jwks_client = jwt.PyJWKClient(
                        settings.SUPABASE_JWT_JWKS_URL)
                signing_key = self.jwks_client.get_signing_key_from_jwt(
                    token).key
                decode_kwargs = {
                    'key': signing_key,
                    'algorithms': ['ES256'],
                    'audience': settings.SUPABASE_JWT_AUDIENCE,
                    'options': options,
                }
            else:
                if not settings.SUPABASE_JWT_SECRET:
                    raise AuthenticationFailed(
                        'Supabase legacy JWT verification is not configured.')
                decode_kwargs = {
                    'key': settings.SUPABASE_JWT_SECRET,
                    'algorithms': ['HS256'],
                    'audience': settings.SUPABASE_JWT_AUDIENCE,
                    'options': options,
                }
            if settings.SUPABASE_JWT_ISSUER:
                decode_kwargs['issuer'] = issuer
            claims = jwt.decode(token, **decode_kwargs)
        except (jwt.PyJWTError, AuthenticationFailed) as exc:
            raise AuthenticationFailed(
                'Invalid or expired Supabase access token.') from exc

        subject = claims.get('sub')
        if not subject:
            raise AuthenticationFailed('Supabase token has no subject.')
        role = self.get_role(claims)
        user = self.get_or_create_user(subject, claims)
        user.supabase_role = role
        user.supabase_claims = claims
        self.sync_local_role(user, role)
        self.sync_local_name(user, claims)
        return user, token

    @staticmethod
    def get_role(claims):
        app_metadata = claims.get('app_metadata') or {}
        role = app_metadata.get('role', 'customer')
        return role if role in {'customer', 'staff', 'admin'} else 'customer'

    @staticmethod
    def sync_local_role(user, role):
        should_be_staff = role in {'staff', 'admin'}
        updates = []
        if user.is_staff != should_be_staff:
            user.is_staff = should_be_staff
            updates.append('is_staff')
        if user.is_superuser and role != 'admin':
            user.is_superuser = False
            updates.append('is_superuser')
        if updates:
            user.save(update_fields=updates)

    @staticmethod
    def sync_local_name(user, claims):
        metadata = claims.get('user_metadata') or claims.get(
            'raw_user_meta_data') or {}
        full_name = str(metadata.get('full_name')
                        or metadata.get('name') or '').strip()
        if not full_name:
            return

        name_parts = full_name.split()
        first_name = name_parts[0]
        last_name = ' '.join(name_parts[1:])
        updates = []
        if user.first_name != first_name:
            user.first_name = first_name
            updates.append('first_name')
        if user.last_name != last_name:
            user.last_name = last_name
            updates.append('last_name')
        if updates:
            user.save(update_fields=updates)

    @staticmethod
    def get_or_create_user(subject, claims):
        User = get_user_model()
        username = f'supabase_{subject}'
        email = claims.get('email', '')
        user, created = User.objects.get_or_create(
            username=username,
            defaults={'email': email, 'is_active': True},
        )
        if created:
            AuditLogService.log(
                'signup',
                actor=user,
                category='account',
                result='success',
                description=f'Account created for a new Supabase identity.',
            )
        if not created and email and user.email != email:
            user.email = email
            user.save(update_fields=['email'])
        return user
