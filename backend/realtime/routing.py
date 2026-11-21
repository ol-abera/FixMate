from django.urls import path

from .consumers import UserEventsConsumer

websocket_urlpatterns = [
    path("ws/", UserEventsConsumer.as_asgi()),
]
