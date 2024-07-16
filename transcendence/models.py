from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import uuid


class Account(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    score = models.IntegerField(default=0)
    avatar = models.ImageField(upload_to='avatars/', default='avatars/default.png')
    friends = models.ManyToManyField('self', through='Friendship', symmetrical=False, related_name='friends+')
    oauth2_id = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=20,
                              choices=[('offline', 'Disconnected'), ('online', 'Online'), ('ingame', 'In game')],
                              default='offline')

    def __str__(self):
        return self.user.username


class Friendship(models.Model):
    from_user = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='friendship_requests_sent')
    to_user = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='friendship_requests_received')
    status = models.CharField(max_length=10,
                              choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('rejected', 'Rejected')])

    class Meta:
        unique_together = ('from_user', 'to_user')

    def __str__(self):
        return f"{self.from_user.user.username} to {self.to_user.user.username} - {self.status}"


class Game(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creation_date = models.DateTimeField(default=timezone.now)
    player1 = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='player1', blank=True, null=True)
    player1_ready = models.BooleanField(default=False)
    player2 = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='player2', blank=True, null=True)
    player2_ready = models.BooleanField(default=False)
    created_for_queue = models.BooleanField(default=False)
    winner = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='winner', blank=True, null=True)
    linked_tournament = models.ForeignKey('Tournament', on_delete=models.CASCADE, related_name='linked_tournament', blank=True, null=True)
    status = models.CharField(max_length=10,
                              choices=[('wait', 'Waiting for players'), ('starting', 'Starting'),
                                       ('started', 'Started'), ('finished', 'Finished')],
                              default='wait')

    def __str__(self):
        return f"{self.player1} vs {self.player2}"


class Tournament(models.Model):
    name = models.CharField()
    admin = models.ForeignKey(Account, on_delete=models.CASCADE,
                              related_name='admin_tournament')
    users = models.ManyToManyField(Account, related_name="tournament_users")
    islaunched = models.BooleanField(default=False)
    status = models.CharField(
        choices=[('wait', 'Waiting for players'), ('launched', 'Tournament is full and has launched'),
                 ('finished', 'Finished')],
        default='wait')
    stage1games = models.ManyToManyField(Game, related_name='stage1games')
    stage2game = models.ForeignKey(Game, on_delete=models.SET_NULL, related_name='stage2game', blank=True, null=True)

    def __str__(self):
        return self.name
