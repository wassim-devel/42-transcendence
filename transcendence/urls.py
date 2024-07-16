from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from . import views

app_name = 'transcendence'
urlpatterns = ([
    path('', views.main, name='main'),
    path("game_local/", views.game_local, name="game_local"),
    path("online_game/", views.online_game, name="online_game"),
    path("game/<uuid:room_number>/", views.game_room, name="game_room"),
    path("register/", views.register, name="register"),
    path("login/", views.login, name="login"),
    path("leaderboard/", views.leaderboard, name="leaderboard"),
    path("tournaments/", views.tournaments, name="tournaments"),
    path("tournaments/create/", views.create_tournament, name="create_tournament"),
    path("tournaments/join/<int:pk>/", views.join_tournament, name="join_tournament"),
    path("tournaments/quit/<int:pk>/", views.quit_tournament, name="quit_tournament"),
    path("tournaments/delete/<int:pk>/", views.delete_tournament, name="delete_tournament"),
    path("profile/", views.profile, name="profile"),
    path("profile/logout/", views.logout_user, name="logout"),
    path("profile/edit/", views.edit_profile, name="edit_profile"),
    path("profile/delete/", views.delete_user, name="delete_user"),
    path("profile/<str:search_query>/", views.view_profile, name="view_profile"),
    path("search/", views.search, name="search"),
    path("uploadpdp/", views.uploadpdp, name="uploadpdp"),
    path("friends/", views.handle_friends, name="handle_friends"),
    path("friends/send_friend_request/<str:username>/", views.send_friend_request, name="send_friend_request"),
    path("friends/accept_friend_request/<int:request_id>/", views.accept_friend_request, name="accept_friend_request"),
    path("friends/decline_friend_request/<int:request_id>/", views.decline_friend_request, name="decline_friend_request"),
    path("friends/remove_friend/<int:friendship_id>/", views.remove_friend, name="remove_friend"),
    path('oauth2/authorize/', views.oauth2_authorize, name='oauth2_authorize'),
    path('oauth2/callback/', views.oauth2_callback, name='oauth2_callback'),
    path("ifoauth/<str:oauth_id>", views.ifoauth, name="ifoauth"),
    path("privacy-policy/", views.privacy_policy, name="privacy_policy"),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT))
