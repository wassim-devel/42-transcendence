from django.contrib import admin
from .models import Account, Friendship, Tournament, Game

admin.site.register(Account)
admin.site.register(Friendship)
admin.site.register(Tournament)
admin.site.register(Game)
