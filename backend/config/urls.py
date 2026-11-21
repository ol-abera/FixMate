from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from common import admin_site  # noqa: F401  (customises the admin index with platform stats)
from common.views import HealthView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", HealthView.as_view(), name="health"),
    path("api/auth/", include("users.auth_urls")),
    path("api/users/", include("users.urls")),
    path("api/categories/", include("services.category_urls")),
    path("api/services/", include("services.urls")),
    path("api/providers/", include("providers.urls")),
    path("api/bookings/", include("bookings.urls")),
    path("api/reviews/", include("reviews.urls")),
    path("api/favorites/", include("favorites.urls")),
    path("api/conversations/", include("messaging.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/dashboard/", include("dashboard.urls")),
    path("api/payments/", include("payments.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
