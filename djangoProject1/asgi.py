import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mysite.settings')

from transcendence.routing import websocket_urlpatterns as game_websocket_urlpatterns

django_asgi_app = get_asgi_application();

application = ProtocolTypeRouter(
    {
        "http" : django_asgi_app,
        "websocket" : AllowedHostsOriginValidator(AuthMiddlewareStack(URLRouter(game_websocket_urlpatterns))),
    }
)
