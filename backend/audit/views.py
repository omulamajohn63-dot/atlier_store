import logging

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import constants
from .serializers import ClientEventSerializer
from .services import AuditLogService

logger = logging.getLogger("audit")


class ClientEventView(APIView):
    """Accept authenticated, whitelisted, throttled audit reports from the
    storefront browser.

    The storefront authenticates against Supabase entirely client-side, so
    events like signup/login/checkout are only observable in the browser. This
    endpoint lets the client annex those events into the shared audit trail.
    Events are sanitized before persistence and unknown actions are coerced to
    ``security_event``.
    """

    permission_classes = [IsAuthenticated]
    throttle_scope = "audit"

    def post(self, request):
        serializer = ClientEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        raw_action = payload.get("event") or ""
        action = constants.coerce_action(raw_action)
        if action != raw_action or raw_action not in constants.CLIENT_EVENT_WHITELIST:
            logger.warning(
                "Client event %r rejected/coerced to %r for user %s.",
                raw_action,
                action,
                request.user,
            )
        if action not in constants.CLIENT_EVENT_WHITELIST:
            action = "security_event"

        metadata = dict(payload.get("context") or {})
        metadata.update(payload.get("data") or {})
        AuditLogService.log(
            action,
            actor=request.user,
            category=payload.get("category") or "api_client",
            description=payload.get("description"),
            metadata=metadata,
            path=request.path,
            status_code=202,
        )
        return Response(
            {"received": True, "action": action,
             "request_id": AuditLogService.current_request_id()},
            status=202,
        )