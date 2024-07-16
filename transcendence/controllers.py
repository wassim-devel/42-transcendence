import math
import random
import time

from . import constants

paddle_speed = constants.PADDLE_SPEED
paddle_length = constants.PADDLE_LENGTH
paddle_width = constants.PADDLE_WIDTH
paddle_offset = constants.PADDLE_OFFSET
field_length = constants.FIELD_LENGTH
field_width = constants.FIELD_WIDTH
ball_radius = constants.BALL_RADIUS
ball_base_speed = constants.BALL_BASE_SPEED
ball_speed_inc = constants.BALL_SPEED_INCREASE
ball_max_speed = constants.BALL_MAX_SPEED
max_bounce_angle = constants.MAX_BOUNCE_ANGLE
client_fps = constants.CLIENT_FPS
server_fps = constants.SERVER_FPS


class PaddleController:
    x = 0
    y = 0
    z = 0
    player = "void"
    speed = paddle_speed
    score = 0
    cumul_dt = 0
    last_input_id = 0
    input_id = 0

    def addDt(self, dt):
        if (dt > 1 / client_fps):
            dt = 1 / client_fps
        if (dt < -1 / client_fps):
            dt = -1 / client_fps
        self.cumul_dt += dt

    def doMove(self):
        if (self.cumul_dt > 1 / server_fps):
            self.cumul_dt = 1 / server_fps
        if (self.cumul_dt < -1 / server_fps):
            self.cumul_dt = -1 / server_fps
        self.y += self.cumul_dt * self.speed
        self.cumul_dt = 0
        self.last_input_id = self.input_id
        if (self.y > field_width):
            self.y = field_width
        if (self.y < -field_width):
            self.y = -field_width


class BallController:
    x = 0
    y = 0
    z = 0
    speed = ball_base_speed
    start_angle = (random.random() - 0.5) * max_bounce_angle
    dx = math.cos(start_angle)
    dy = math.sin(start_angle)
    hit = 0
    cooldown = 1
    last_move = time.time()

    def doMove(self, p1, p2):
        delta_time = time.time() - self.last_move
        self.last_move = time.time()
        if self.cooldown > 0:
            self.cooldown -= delta_time
            return
        self.x += delta_time * self.speed * self.dx
        self.y += delta_time * self.speed * self.dy
        if (self.x + ball_radius > field_length - (paddle_offset + paddle_width / 2)
                and paddle_length / 2 + ball_radius > self.y - p1.y > -paddle_length / 2 - ball_radius
                and self.dx > 0):
            inter_pos = (self.y - p1.y) / (paddle_length + ball_radius)
            bounce_angle = inter_pos * max_bounce_angle
            self.dx = -math.cos(bounce_angle)
            self.dy = math.sin(bounce_angle)
            self.speed = min(ball_max_speed, self.speed + ball_speed_inc)
            self.hit = 0
        if (self.x - ball_radius < -field_length + (paddle_offset + paddle_width / 2)
                and paddle_length / 2 + ball_radius > self.y - p2.y > -paddle_length / 2 - ball_radius
                and self.dx < 0):
            inter_pos = (self.y - p2.y) / (paddle_length + ball_radius)
            bounce_angle = inter_pos * max_bounce_angle
            self.dx = math.cos(bounce_angle)
            self.dy = math.sin(bounce_angle)
            self.speed = min(ball_max_speed, self.speed + ball_speed_inc)
            self.hit = 0
        if ((self.y > field_width and self.dy > 0)
                or (self.y < -field_width and self.dy < 0)):
            self.dy = -self.dy
        if self.x > field_length:
            self.x = 0
            self.y = 0
            p2.score += 1
            self.speed = ball_base_speed
            self.cooldown = 1
        if self.x < -field_length:
            self.x = 0
            self.y = 0
            p1.score += 1
            self.speed = ball_base_speed
            self.cooldown = 1
