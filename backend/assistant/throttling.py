from rest_framework.throttling import SimpleRateThrottle


class AssistantRateThrottle(SimpleRateThrottle):
    """Assistant-specific budget layered onto the existing DRF throttle
    architecture (``THROTTLE_RATES`` in settings).

    Guests get a tighter per-IP budget than signed-in customers because every
    message spends real Gemini quota. The scope is picked per request:
    ``assistant_anon`` or ``assistant_user``.
    """

    scope = 'assistant_anon'

    def allow_request(self, request, view):
        authenticated = bool(
            getattr(request, 'user', None)
            and request.user.is_authenticated)
        self.scope = 'assistant_user' if authenticated else 'assistant_anon'
        self.rate = self.get_rate()
        self.num_requests, self.duration = self.parse_rate(self.rate)
        return super().allow_request(request, view)

    def get_cache_key(self, request, view):
        user = getattr(request, 'user', None)
        if user and user.is_authenticated:
            ident = user.pk
        else:
            ident = self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}
