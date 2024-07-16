import math
import pygame
import json
import threading

from channels.consumer import async_to_sync, get_channel_layer
from . import constants
from . import controllers
from .models import Account, Game
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


def float_or_zero(str):
    try:
        nb = float(str)
        if math.isnan(nb):
            return 0
        return nb
    except:
        return 0
    

def game_loop(game_id, p1, p2, ball):
    def get_linked_tournament(agame):
        return agame.linked_tournament

    def are_stage1games_finished(alinked_tournament):
        return not alinked_tournament.stage1games.exclude(status='finished').exists()

    def get_stage1games(alinked_tournament):
        return list(alinked_tournament.stage1games.all())

    def create_stage2game(tournament, player1, player2):
        new_stage2game = Game(player1=player1, player2=player2)
        new_stage2game.save()
        tournament.stage2game = new_stage2game
        tournament.save()

    def get_winner(agame):
        print(agame.winner)
        return agame.winner

    channel_layer = get_channel_layer()
    clock = pygame.time.Clock()
    fps = constants.SERVER_FPS
    while True:
        clock.tick(fps)
        p1.doMove()
        p2.doMove()
        ball.doMove(p1, p2)
        async_to_sync(channel_layer.group_send)(
            f"{game_id}",
            {'type': 'update',
             'p1': {'x': p1.x, 'y': p1.y, 'input_id': p1.input_id, 'score': p1.score},
             'p2': {'x': p2.x, 'y': p2.y, 'input_id': p2.input_id, 'score': p2.score},
             'ball': {'x': ball.x, 'y': ball.y},
             })
        if p1.score >= constants.WIN_SCORE or p2.score >= constants.WIN_SCORE:
            break
    try:
        game = Game.objects.get(id=game_id)
        if p1.score >= constants.WIN_SCORE:
            game.winner = game.player1
            game.winner.score += 10
            game.winner.save()
        if p2.score >= constants.WIN_SCORE:
            game.winner = game.player2
            game.winner.score += 10
            game.winner.save()
        game.status = 'finished'
        game.save()
        linked_tournament = get_linked_tournament(game)
        if linked_tournament and are_stage1games_finished(linked_tournament):
            linked_tournament_games = get_stage1games(linked_tournament)
            print(linked_tournament_games)
            create_stage2game(linked_tournament, get_winner(linked_tournament_games[0]),
                              get_winner(linked_tournament_games[1]))
    except:
        return


class GamesPool:
    games = {}

    @classmethod
    def new_game(cls, game_id):
        p1 = controllers.PaddleController()
        p1.x = constants.FIELD_LENGTH - constants.PADDLE_OFFSET
        p2 = controllers.PaddleController()
        p2.x = -constants.FIELD_LENGTH + constants.PADDLE_OFFSET
        ball = controllers.BallController()
        cls.games[game_id] = {
            "thread": threading.Thread(target=game_loop, args=(game_id, p1, p2, ball,), daemon=True),
            "p1": p1,
            "p2": p2,
            "ball": ball,
            "running": False,
        }


class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.play = True
        self.p1 = None
        self.p2 = None
        self.game_id = self.scope["url_route"]["kwargs"]["game_id"]
        self.game_starting = False
        user = await database_sync_to_async(Account.objects.get)(user=self.scope["user"])
        game = await Game.objects.prefetch_related("player1", "player2").aget(id=self.game_id)
        if game.player1 == user:
            self.p1 = self.scope["user"]
            game.player1_ready = True
            if game.player2_ready == True and game.status == 'wait':
                game.status = 'starting'
            await database_sync_to_async(game.save)()
            player = 1
        elif game.player2 == user:
            self.p2 = self.scope["user"]
            game.player2_ready = True
            if game.player1_ready == True and game.status == 'wait':
                game.status = 'starting'
            await database_sync_to_async(game.save)()
            player = 2
        else:
            player = 3
        await self.accept()
        await self.channel_layer.group_add(
            f"{self.game_id}", self.channel_name
        )
        if self.game_id not in GamesPool.games:
            GamesPool.new_game(self.game_id)
        self.thread = GamesPool.games[self.game_id]
        await self.send(json.dumps({
            'type': 'init',
            'paddle_speed': constants.PADDLE_SPEED,
            'paddle_length': constants.PADDLE_LENGTH,
            'paddle_width': constants.PADDLE_WIDTH,
            'paddle_offset': constants.PADDLE_OFFSET,
            'ball_radius': constants.BALL_RADIUS,
            'field_width': constants.FIELD_WIDTH,
            'field_length': constants.FIELD_LENGTH,
            'client_fps': constants.CLIENT_FPS,
            'win_score': constants.WIN_SCORE,
            'player': player,
            'p1_score': self.thread["p1"].score,
            'p2_score': self.thread["p2"].score,
            'status': game.status,
        }))
        if game.status == 'starting':
            game.status = 'started'
            await database_sync_to_async(game.save)()
            self.thread["thread"].start()

    async def disconnect(self, code):
        self.channel_layer.group_discard(
            f"{self.game_id}", self.channel_name
        )

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        try:
            if self.scope["user"] == self.p1:
                self.thread["p1"].addDt(float_or_zero(text_data_json['input']))
                self.thread["p1"].input_id = text_data_json['input_id']
            if self.scope["user"] == self.p2:
                self.thread["p2"].addDt(float_or_zero(text_data_json['input']))
                self.thread["p2"].input_id = text_data_json['input_id']
        except:
            pass

    async def update(self, event):
        await self.send(json.dumps(
            {
                'type': 'update',
                'p1': event['p1'],
                'p2': event['p2'],
                'ball': event['ball'],
            }
        ))


class UserStatusConsumer(AsyncWebsocketConsumer):
    @database_sync_to_async
    def mark_online(self, user):
        account = Account.objects.get(user=user)
        account.status = "online"
        account.save()

    @database_sync_to_async
    def mark_offline(self, user):
        try:
            account = Account.objects.get(user=user)
            account.status = "offline"
            account.save()
        except:
            return

    async def connect(self):
        if self.scope["user"].is_authenticated:
            await self.accept()
            await self.mark_online(self.scope["user"])
        else:
            await self.close()

    async def disconnect(self, close_code):
        if self.scope["user"].is_authenticated:
            await self.mark_offline(self.scope["user"])
