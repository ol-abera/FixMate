from django.urls import path

from .views import MeView

# /api/users/me/ mirrors /api/auth/me/. Users can only ever see/modify themselves;
# there is intentionally no public user listing (providers are exposed via /api/providers/).
urlpatterns = [
    path("me/", MeView.as_view(), name="users-me"),
]
