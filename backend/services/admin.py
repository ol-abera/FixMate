from django.contrib import admin

from .models import Service, ServiceCategory


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "icon", "is_active"]
    search_fields = ["name", "slug"]
    list_filter = ["is_active"]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ["title", "provider", "category", "starting_price", "is_active", "created_at"]
    list_filter = ["is_active", "category"]
    search_fields = ["title", "description", "provider__user__email", "provider__user__first_name"]
    list_select_related = ["provider__user", "category"]
    actions = ["activate", "deactivate"]

    @admin.action(description="Approve / activate selected services")
    def activate(self, request, queryset):
        self.message_user(request, f"{queryset.update(is_active=True)} service(s) activated.")

    @admin.action(description="Hide / deactivate selected services (moderation)")
    def deactivate(self, request, queryset):
        self.message_user(request, f"{queryset.update(is_active=False)} service(s) deactivated.")
