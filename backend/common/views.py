from django.db import connection
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    """Liveness + database check for container healthchecks and load balancers."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = []

    def get(self, request):
        try:
            connection.ensure_connection()
        except Exception:  # noqa: BLE001
            return Response({"status": "unavailable", "database": False}, status=503)
        return Response({"status": "ok", "database": True})
