from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "booking", "customer", "amount", "currency", "gateway", "status", "paid_at", "created_at")
    list_filter = ("status", "gateway")
    search_fields = ("session_id", "payment_intent", "customer__email", "booking__title")
    readonly_fields = [f.name for f in Payment._meta.fields]
    list_select_related = ("booking", "customer")

    def has_add_permission(self, request):
        return False
