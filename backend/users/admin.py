from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ["-created_at"]
    list_display = ["email", "full_name", "role", "is_verified", "is_active", "created_at"]
    list_filter = ["role", "is_verified", "is_active", "is_staff"]
    search_fields = ["email", "first_name", "last_name", "phone"]
    readonly_fields = ["created_at", "updated_at", "last_login"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("first_name", "last_name", "phone", "profile_image", "location", "bio")}),
        ("Account", {"fields": ("role", "is_verified", "is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "first_name", "last_name", "role", "password1", "password2")}),
    )
    actions = ["disable_users", "enable_users"]

    @admin.action(description="Disable selected users")
    def disable_users(self, request, queryset):
        n = queryset.exclude(pk=request.user.pk).update(is_active=False)
        self.message_user(request, f"{n} user(s) disabled.")

    @admin.action(description="Enable selected users")
    def enable_users(self, request, queryset):
        self.message_user(request, f"{queryset.update(is_active=True)} user(s) enabled.")
