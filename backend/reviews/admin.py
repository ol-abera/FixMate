from django.contrib import admin

from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ["id", "provider", "customer", "rating", "is_published", "created_at"]
    list_filter = ["is_published", "rating"]
    search_fields = ["comment", "customer__email", "provider__user__email"]
    list_select_related = ["customer", "provider__user"]
    actions = ["publish", "hide"]

    @admin.action(description="Publish selected reviews")
    def publish(self, request, queryset):
        for r in queryset:
            r.is_published = True
            r.save()  # triggers rating recalculation
        self.message_user(request, f"{queryset.count()} review(s) published.")

    @admin.action(description="Hide selected reviews (moderation)")
    def hide(self, request, queryset):
        for r in queryset:
            r.is_published = False
            r.save()
        self.message_user(request, f"{queryset.count()} review(s) hidden.")
