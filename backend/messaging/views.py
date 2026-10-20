from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from bookings.models import Booking
from providers.models import ProviderProfile
from users.models import User

from .models import Conversation
from .serializers import ConversationDetailSerializer, ConversationSerializer, MessageSerializer
from .services import get_or_create_conversation, mark_read, send_message


class ConversationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    serializer_class = ConversationSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        # The ONLY way conversations are loaded: filtered to the caller's own.
        return (
            Conversation.objects.filter(participants=self.request.user)
            .prefetch_related("participants__provider_profile")
        )

    def get_serializer_class(self):
        return ConversationDetailSerializer if self.action == "retrieve" else ConversationSerializer

    def create(self, request, *args, **kwargs):
        me = request.user
        provider_id, customer_id = request.data.get("provider"), request.data.get("customer")
        if me.role == "CUSTOMER" and provider_id:
            profile = ProviderProfile.objects.filter(pk=provider_id, verification_status="VERIFIED").select_related("user").first() \
                if str(provider_id).isdigit() else None
            if not profile:
                raise ValidationError({"provider": "Provider not found."})
            other = profile.user
        elif me.role == "PROVIDER" and customer_id:
            other = User.objects.filter(pk=customer_id, role="CUSTOMER", is_active=True).first() if str(customer_id).isdigit() else None
            # providers may only reply to customers they have a booking with (anti-spam)
            if not other or not Booking.objects.filter(customer=other, provider__user=me).exists():
                raise ValidationError({"customer": "You can only message customers you have a booking with."})
        else:
            raise ValidationError({"detail": "Customers must supply 'provider'; providers must supply 'customer'."})

        conv, created = get_or_create_conversation(me, other)
        text = request.data.get("text")
        if text:
            send_message(conv, me, text=text)
        conv = self.get_queryset().get(pk=conv.pk)
        return Response(ConversationSerializer(conv, context={"request": request}).data,
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def retrieve(self, request, *args, **kwargs):
        conv = self.get_object()  # 404 for conversations the user is not part of
        mark_read(conv, request.user)
        return Response(ConversationDetailSerializer(conv, context={"request": request}).data)

    @action(detail=True, methods=["get", "post"], url_path="messages")
    def messages(self, request, pk=None):
        conv = self.get_object()
        if request.method == "POST":
            msg = send_message(conv, request.user, text=request.data.get("text", ""),
                               attachment=request.FILES.get("attachment"))
            return Response(MessageSerializer(msg, context={"request": request}).data, status=status.HTTP_201_CREATED)
        qs = conv.messages.select_related("sender")
        after = request.query_params.get("after")  # lightweight polling: ?after=<last message id>
        if after and after.isdigit():
            qs = qs.filter(id__gt=int(after))
        mark_read(conv, request.user)
        return Response(MessageSerializer(qs, many=True, context={"request": request}).data)
