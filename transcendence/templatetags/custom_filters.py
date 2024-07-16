from django import template

register = template.Library()


@register.filter
def all_finished(games):
    return all(game.status == 'finished' for game in games)
