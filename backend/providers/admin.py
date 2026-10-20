from django.contrib import admin

from .models import PortfolioImage, ProviderProfile, VerificationStatus
from .services import set_verification


class PortfolioInline(admin.TabularInline):
    model = PortfolioImage
    extra = 0


@admin.register(ProviderProfile)
class ProviderProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "profession", "location", "verification_status", "rating", "total_reviews", "created_at"]
    list_filter = ["verification_status", "availability", "categories"]
    search_fields = ["user__email", "user__first_name", "user__last_name", "profession", "location"]
    list_select_related = ["user"]
    readonly_fields = ["rating", "total_reviews", "created_at", "updated_at"]
    filter_horizontal = ["categories"]
    inlines = [PortfolioInline]
    actions = ["verify_providers", "reject_providers"]

    @admin.action(description="Verify selected providers")
    def verify_providers(self, request, queryset):
        for p in queryset:
            set_verification(p, VerificationStatus.VERIFIED)
        self.message_user(request, f"{queryset.count()} provider(s) verified.")

    @admin.action(description="Reject selected providers")
    def reject_providers(self, request, queryset):
        for p in queryset:
            set_verification(p, VerificationStatus.REJECTED)
        self.message_user(request, f"{queryset.count()} provider(s) rejected.")
