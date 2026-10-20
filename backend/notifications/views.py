from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        qs = Notification.objects.filter(recipient=self.request.user)  # only own notifications
        if self.request.query_params.get("unread") in ("1", "true"):
            qs = qs.filter(is_read=False)
        return qs

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response.data["unread_count"] = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return response

    def delete(self, request):
        """Clear all of the caller's notifications."""
        n, _ = Notification.objects.filter(recipient=request.user).delete()
        return Response({"deleted": n})


class NotificationReadView(APIView):
    def patch(self, request, pk):
        try:
            n = Notification.objects.get(pk=pk, recipient=request.user)
        except Notification.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        n.is_read = True
        n.save(update_fields=["is_read", "updated_at"])
        return Response(NotificationSerializer(n).data)


class NotificationReadAllView(APIView):
    def post(self, request):
        n = Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({"updated": n})
