from django.contrib import admin

from .models import Booking, BookingEvent


class BookingEventInline(admin.TabularInline):
    model = BookingEvent
    extra = 0
    readonly_fields = ["status", "label", "actor", "created_at"]
    can_delete = False


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ["id", "title", "customer", "provider", "status", "scheduled_date", "estimated_price", "final_price"]
    list_filter = ["status", "scheduled_date", "category"]
    search_fields = ["title", "customer__email", "provider__user__email", "provider__user__first_name"]
    list_select_related = ["customer", "provider__user"]
    date_hierarchy = "scheduled_date"
    inlines = [BookingEventInline]
