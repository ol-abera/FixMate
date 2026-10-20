from django.contrib import admin

from .models import Favorite


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ["customer", "provider", "created_at"]
    search_fields = ["customer__email", "provider__user__email"]
    list_select_related = ["customer", "provider__user"]
