from django.urls import re_path, path

from . import consumers

websocket_urlpatterns = [
    path("ws/game/<uuid:game_id>/", consumers.GameConsumer.as_asgi()),
    path("ws/online/", consumers.UserStatusConsumer.as_asgi()),
]
