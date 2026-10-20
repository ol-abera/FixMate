from rest_framework import serializers, status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsCustomer
from providers.models import ProviderProfile
from providers.serializers import ProviderListSerializer

from .models import Favorite


class FavoriteInput(serializers.Serializer):
    provider = serializers.PrimaryKeyRelatedField(
        queryset=ProviderProfile.objects.filter(verification_status="VERIFIED")
    )


class FavoriteListCreateView(ListAPIView):
    permission_classes = [IsCustomer]
    serializer_class = ProviderListSerializer
    pagination_class = None

    def get_queryset(self):
        ids = Favorite.objects.filter(customer=self.request.user).values_list("provider_id", flat=True)
        return ProviderProfile.objects.filter(pk__in=ids).select_related("user").prefetch_related("categories")

    def post(self, request):
        ser = FavoriteInput(data=request.data)
        ser.is_valid(raise_exception=True)
        provider = ser.validated_data["provider"]
        fav, created = Favorite.objects.get_or_create(customer=request.user, provider=provider)  # no duplicates
        return Response({"provider": provider.id, "created": created},
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class FavoriteDeleteView(APIView):
    permission_classes = [IsCustomer]

    def delete(self, request, provider_id):
        n, _ = Favorite.objects.filter(customer=request.user, provider_id=provider_id).delete()
        if not n:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)
