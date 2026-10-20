from rest_framework import serializers

from common.utils import abs_url

from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.full_name", read_only=True)
    is_mine = serializers.SerializerMethodField()
    attachment = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ["id", "conversation", "sender", "sender_name", "is_mine", "text", "attachment", "is_read", "created_at"]
        read_only_fields = fields

    def get_is_mine(self, obj):
        req = self.context.get("request")
        return bool(req and obj.sender_id == req.user.id)

    def get_attachment(self, obj):
        return abs_url(self.context.get("request"), obj.attachment)


class ConversationSerializer(serializers.ModelSerializer):
    other = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ["id", "other", "last_message", "last_message_at", "unread_count", "created_at"]

    def _other_user(self, obj):
        me = self.context["request"].user
        for u in obj.participants.all():
            if u.id != me.id:
                return u
        return None

    def get_other(self, obj):
        u = self._other_user(obj)
        if not u:
            return None
        profile = getattr(u, "provider_profile", None)
        return {
            "id": u.id, "name": u.full_name, "role": u.role,
            "avatar": abs_url(self.context.get("request"), u.profile_image),
            "provider_id": profile.id if profile else None,
            "available_now": bool(profile and profile.availability == "AVAILABLE"),
        }

    def get_last_message(self, obj):
        m = obj.messages.order_by("-created_at", "-id").first()
        if not m:
            return None
        return {"text": m.text, "has_attachment": bool(m.attachment), "created_at": m.created_at,
                "is_mine": m.sender_id == self.context["request"].user.id}

    def get_unread_count(self, obj):
        return obj.messages.exclude(sender=self.context["request"].user).filter(is_read=False).count()


class ConversationDetailSerializer(ConversationSerializer):
    messages = serializers.SerializerMethodField()

    class Meta(ConversationSerializer.Meta):
        fields = ConversationSerializer.Meta.fields + ["messages"]

    def get_messages(self, obj):
        qs = obj.messages.select_related("sender").order_by("-created_at", "-id")[:200]
        return MessageSerializer(list(reversed(list(qs))), many=True, context=self.context).data
