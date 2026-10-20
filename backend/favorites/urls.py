from django.urls import path

from .views import FavoriteDeleteView, FavoriteListCreateView

urlpatterns = [
    path("", FavoriteListCreateView.as_view(), name="favorite-list"),
    path("<int:provider_id>/", FavoriteDeleteView.as_view(), name="favorite-delete"),
]
