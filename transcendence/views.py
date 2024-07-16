from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, Http404, HttpResponseRedirect, HttpResponseNotAllowed, HttpResponseForbidden, \
    JsonResponse
# from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import authenticate, login as login_p, logout, update_session_auth_hash
from django.db.models import Q
from django.contrib.auth.models import User
from .models import Account, Friendship, Tournament, Game
from django.contrib import messages
from oauth2_provider.views import ProtectedResourceView
from .forms import ChangePDPForm, PseudoIfOauthForm, CreateTournamentForm, UserProfileForm, PasswordChangeCustomForm
from django.contrib.auth.decorators import login_required
from oauth2_provider.views import AuthorizationView, TokenView
from django.contrib.auth.views import LoginView
from django.conf import settings
from django.shortcuts import redirect
import requests
import random
import re


# Create your views here.

@login_required(login_url='transcendence:login')
def main(request):
    return render(request, 'transcendence/main.html')


@login_required(login_url='transcendence:login')
def index(request):
    context = {"accounts": User.objects.all()}
    return render(request, "transcendence/index.html", context)


@login_required(login_url='transcendence:login')
def game_local(request):
    context = {"accounts": User.objects.all()}
    return render(request, "transcendence/game_local.html", context)


@login_required(login_url='transcendence:login')
def online_game(request):
    acc = Account.objects.get(user=request.user)
    game = Game.objects.filter(Q(player1=acc) | Q(player2=acc), status="started").first()
    latest_game = Game.objects.filter(created_for_queue=True, status="wait").order_by('-id').first()
    game_id = None
    if game:
        game_id = game.id
    elif latest_game:
        latest_game.player2 = acc
        latest_game.save()
        game_id = latest_game.id
    else:
        acc = Account.objects.get(user=request.user)
        game = Game(created_for_queue=True, player1=acc)
        game.save()
        game_id = game.id
    return HttpResponse(game_id)


@login_required(login_url='transcendence:login')
def game_room(request, room_number):
    acc = Account.objects.get(user=request.user)
    try:
        game = Game.objects.get(pk=room_number)
    except Game.DoesNotExist:
        raise Http404("Game does not exist")
    if game.player1 != acc and game.player2 != acc:
        return HttpResponseForbidden("you are not allowed here")
    return render(request, "transcendence/game_room.html")


def register(request):
    if request.method == "POST":
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            account = Account(user=user)
            account.save()
            login_p(request, user)
            return redirect("transcendence:main")
    else:
        form = UserCreationForm()
    return render(request, "transcendence/register.html", {"form": form})


def login(request):
    if request.method == "POST":
        username = request.POST["username"]
        password = request.POST["password"]
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login_p(request, user)
            return redirect("transcendence:main")
        else:
            messages.info(request, "Wrong login or password")

    form = AuthenticationForm()
    return render(request, "transcendence/login.html", {"form": form})


@login_required(login_url='transcendence:login')
def leaderboard(request):
    context = {"accounts": Account.objects.all().order_by("-score")}
    return render(request, "transcendence/leaderboard.html", context)


@login_required(login_url='transcendence:login')
def profile(request):
    try:
        acc = Account.objects.get(user=request.user)
    except Account.DoesNotExist:
        return HttpResponse("an error that shouldn't happen, happened")
    return render(request, "transcendence/profile.html", {"account": acc})


@login_required(login_url='transcendence:login')
def logout_user(request):
    logout(request)
    return redirect("transcendence:main")


@login_required(login_url='transcendence:login')
def search(request):
    search_query = request.GET.get('search_query')
    if search_query:
        context = {"accounts": User.objects.filter(username__icontains=search_query)}
        return render(request, "transcendence/search.html", context)
    else:
        context = {"accounts": User.objects.all()}
        return render(request, "transcendence/search.html", context)


@login_required(login_url='transcendence:login')
def tournaments(request):
    tournamentss = Tournament.objects.all()
    acc = Account.objects.get(user=request.user)
    return render(request, "transcendence/tournaments.html", {"tournaments": tournamentss, "account": acc})


@login_required(login_url='transcendence:login')
def create_tournament(request):
    if request.method == "POST":
        form = CreateTournamentForm(request.POST)
        if form.is_valid():
            acc = Account.objects.get(user=request.user)
            tournament = form.save(commit=False)
            tournament.admin = acc
            tournament.save()
            tournament.users.add(acc)
            return JsonResponse({'success': True, 'message': "Tournament created", 'id': tournament.id})
        else:
            return JsonResponse({'success': False, 'message': "form isnt valid"})
    form = CreateTournamentForm()
    return render(request, "transcendence/create_tournament.html", {"form": form})


@login_required(login_url='transcendence:login')
def join_tournament(request, pk):
    if request.method == "POST":
        tournament = get_object_or_404(Tournament, pk=pk)
        account = get_object_or_404(Account, user=request.user)

        if tournament.users.count() >= 4:
            return JsonResponse(
                {"success": False, "message": "This tournament already has the maximum number of participants."})
        tournament.users.add(account)
        if tournament.users.count() == 4:
            tournament.islaunched = True
            users = list(tournament.users.all())
            random.shuffle(users)
            pair1 = (users[0], users[1])
            pair2 = (users[2], users[3])
            game1 = Game.objects.create(player1=pair1[0], player2=pair1[1], status="wait",
                                        linked_tournament=tournament)
            game2 = Game.objects.create(player1=pair2[0], player2=pair2[1], status="wait",
                                        linked_tournament=tournament)
            tournament.stage1games.add(game1, game2)
            tournament.save()
        return JsonResponse({"success": True, "message": "successfully joined tournament"})
    else:
        return HttpResponseNotAllowed(['POST'])


@login_required(login_url='transcendence:login')
def quit_tournament(request, pk):
    if request.method == "POST":
        tournament = get_object_or_404(Tournament, pk=pk)
        account = get_object_or_404(Account, user=request.user)
        if not tournament.islaunched:
            tournament.users.remove(account)
            return JsonResponse({'success': True})
        return JsonResponse({'success': False, "message": "failed to quit tournament"})
    else:
        return HttpResponseNotAllowed(['POST'])


@login_required(login_url='transcendence:login')
def delete_tournament(request, pk):
    if request.method == "POST":
        tournament = get_object_or_404(Tournament, pk=pk)
        if tournament.admin.user == request.user and not tournament.islaunched:
            tournament.delete()
            return JsonResponse({"success": True, "message": "tournament deleted"})
        return JsonResponse({"success": False, "message": "tournament could not be deleted"})
    else:
        return HttpResponseNotAllowed(['POST'])


@login_required(login_url='transcendence:login')
def view_profile(request, search_query):
    user = get_object_or_404(User, username=search_query)
    try:
        acc = Account.objects.get(user=user)
    except Account.DoesNotExist:
        return HttpResponse("an error that shouldn't happen, happened")
    ranking = Account.objects.filter(score__gt=acc.score).count() + 1
    victories_count = Game.objects.filter(winner=acc).count()
    defeat_count = Game.objects.filter(
        (Q(player1=acc) | Q(player2=acc)) & ~Q(winner=acc) & Q(status="finished")
    ).count()
    games = Game.objects.filter((Q(player1=acc) | Q(player2=acc)) & Q(status="finished"))
    is_in_game = Game.objects.filter(
        (Q(player1=acc) | Q(player2=acc)) & Q(status="started")
    ).exists()
    return render(request, "transcendence/view_profile.html",
                  {"account": acc, "ranking": ranking, "victories": victories_count, "defeats": defeat_count,
                   "games": games, "isingame": is_in_game})


@login_required(login_url='transcendence:login')
def edit_profile(request):
    try:
        acc = Account.objects.get(user=request.user, oauth2_id=None)
    except Account.DoesNotExist:
        acc = None
    print("here acc ", acc)
    if request.method == 'POST':
        user_form = UserProfileForm(request.POST, instance=request.user)
        password_form = PasswordChangeCustomForm(request.user, request.POST)

        if user_form.is_valid():
            user_form.save()
            if user_form.has_changed():
                print("hey")
                return JsonResponse(
                    {"success": True, "message": 'Pseudo successfully edited'})

        if password_form.is_valid():
            user = password_form.save()
            update_session_auth_hash(request, user)
            messages.success(request, 'Password successfully edited')

        if user_form.errors:
            messages.error(request, 'Pseudo déjà utilisé.')
            return JsonResponse({"success": False, "message": 'Pseudo already in use'})

        if acc and password_form.errors:
            messages.error(request, 'Mot de passe erreur.')
            return JsonResponse({"success": False, "message": 'Wrong password or incorrect new password'})

        return JsonResponse({"success": True, "message": 'Profile succesfully edited'})

    else:
        user_form = UserProfileForm(instance=request.user)
        password_form = PasswordChangeCustomForm(request.user)

    return render(request, "transcendence/edit_profile.html", {"user_form": user_form, "password_form": password_form, "account": acc})


@login_required(login_url='transcendence:login')
def delete_user(request):
    if request.method == "POST":
        try:
            account = Account.objects.get(user=request.user)
            tournaments = Tournament.objects.filter(users=account)
            for tournament in tournaments:
                tournament.delete()
            if account.avatar and account.avatar.url != "/media/avatars/default.png":
                account.avatar.delete()
            account.delete()
            request.user.delete()
            return JsonResponse({'success': True})
        except:
            return JsonResponse({'success': False})
    else:
        return HttpResponseNotAllowed(['POST'])


@login_required(login_url='transcendence:login')
def uploadpdp(request):
    if request.method == "POST":
        form = ChangePDPForm(request.POST, request.FILES)
        if form.is_valid():
            if request.user.account.avatar and request.user.account.avatar.url != "/media/avatars/default.png":
                request.user.account.avatar.delete()
            request.user.account.avatar = form.cleaned_data['avatar']
            request.user.account.save()
            return JsonResponse({'success': True})
        else:
            return JsonResponse({'success': False, 'message': 'Please use a JPEG, PNG or GIF.'})
    else:
        form = ChangePDPForm()
    return render(request, "transcendence/uploadpdp.html", {"form": form})


@login_required(login_url='transcendence:login')
def handle_friends(request):
    try:
        account = Account.objects.get(user=request.user)
        pending_requests = Friendship.objects.filter(
            Q(to_user=account, status='pending') | Q(from_user=account, status='pending')
        )
        accepted_requests = Friendship.objects.filter(
            Q(to_user=account, status='accepted') | Q(from_user=account, status='accepted')
        )
        pending_friends_list = [
            (fr.from_user if fr.to_user == account else fr.to_user, fr.id)
            for fr in pending_requests
        ]
        friends_list = [
            (fr.from_user if fr.to_user == account else fr.to_user, fr.id)
            for fr in accepted_requests
        ]
    except Account.DoesNotExist:
        pending_requests = []
        accepted_requests = []
        pending_friends_list = []
        friends_list = []

    return render(request, "transcendence/friends.html",
                  {"pending_requests": pending_requests, "accepted_requests": accepted_requests,
                   "pending_friends_list": pending_friends_list, "friends_list": friends_list})


@login_required(login_url='transcendence:login')
def send_friend_request(request, username):
    if request.method == 'POST':
        try:
            from_user = Account.objects.get(user=request.user)
            user = User.objects.get(username=username)
            to_user = Account.objects.get(user=user)
            if Friendship.objects.filter(from_user=to_user, to_user=from_user).exists():
                friendship = Friendship.objects.get(from_user=to_user, to_user=from_user)
                friendship.status = 'accepted'
                friendship.save()
                return JsonResponse({'success': True, 'message': 'You are now friends'})
            if Friendship.objects.filter(from_user=from_user, to_user=to_user, status='accepted').exists():
                return JsonResponse({'success': False, "message": "Your are already friends"})
            if from_user == to_user:
                return JsonResponse({'success': False, "message": "You can't send a friend request to yourself"})
        except:
            raise Http404("L'utilisateur n'existe pas")
        if not Friendship.objects.filter(from_user=from_user, to_user=to_user).exists():
            friend_request = Friendship(from_user=from_user, to_user=to_user, status='pending')
            friend_request.save()
            return JsonResponse({'success': True})
        else:
            return JsonResponse({"success": False, "message": "You already asked that user as a friend"})
    else:
        return HttpResponseNotAllowed(['POST'])


@login_required(login_url='transcendence:login')
def accept_friend_request(request, request_id):
    if request.method == "POST":
        try:
            friend_request = Friendship.objects.get(id=request_id, to_user__user=request.user, status='pending')
        except Friendship.DoesNotExist:
            raise Http404("La demande d'ami n'existe pas")
        friend_request.status = 'accepted'
        friend_request.save()
        return redirect("transcendence:handle_friends")
    else:
        return HttpResponseNotAllowed(['POST'])


@login_required(login_url='transcendence:login')
def decline_friend_request(request, request_id):
    if request.method == "POST":
        try:
            friend_request = Friendship.objects.get(id=request_id, to_user__user=request.user, status='pending')
        except Friendship.DoesNotExist:
            raise Http404("La demande d'ami n'existe pas")
        friend_request.delete()
        return redirect("transcendence:handle_friends")
    else:
        return HttpResponseNotAllowed(['POST'])


@login_required(login_url='transcendence:login')
def remove_friend(request, friendship_id):
    print("friendship id : ", friendship_id)
    try:
        friendship = get_object_or_404(Friendship, id=friendship_id, status='accepted')
    except Friendship.DoesNotExist:
        return JsonResponse({'success': False, "message": "Friendship does not exist"})

    if request.user != friendship.from_user.user and request.user != friendship.to_user.user:
        return HttpResponseForbidden("You're not authorized")

    if request.method == 'POST':
        friendship.delete()
        return JsonResponse({'success': True})
    else:
        return HttpResponseNotAllowed(['POST'])


def oauth2_authorize(request):
    client_id = settings.OAUTH2_CLIENT_ID
    redirect_uri = settings.OAUTH2_REDIRECT_URI

    authorization_url = f"{settings.OAUTH2_AUTHORIZATION_URL}?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code"

    return redirect(authorization_url)


def oauth2_callback(request):
    if 'code' in request.GET:
        authorization_code = request.GET['code']
        access_token = exchange_code_for_token(authorization_code)
        if access_token:
            oauth_id = make_api_request(access_token)['id']
            username = make_api_request(access_token)['login']
            if Account.objects.filter(oauth2_id=oauth_id).exists():
                user = Account.objects.get(oauth2_id=oauth_id).user
                login_p(request, user)
                return redirect("transcendence:main")
            else:
                if User.objects.filter(username=username).exists():
                    return redirect("transcendence:ifoauth", oauth_id=oauth_id)
                user = User(username=username)
                user.save()
                account = Account(user=user, oauth2_id=oauth_id)
                account.save()
                login_p(request, user)
                return redirect("transcendence:main")
        else:
            return HttpResponse("Failed to exchange authorization code for access token")
    else:
        return HttpResponse("Missing authorization code in URL")


def exchange_code_for_token(authorization_code):
    token_url = 'https://api.intra.42.fr/oauth/token'
    client_id = settings.OAUTH2_CLIENT_ID
    client_secret = settings.OAUTH2_CLIENT_SECRET
    redirect_uri = settings.OAUTH2_REDIRECT_URI

    data = {
        'grant_type': 'authorization_code',
        'code': authorization_code,
        'client_id': client_id,
        'client_secret': client_secret,
        'redirect_uri': redirect_uri
    }

    response = requests.post(token_url, data=data)
    if response.status_code == 200:
        token_data = response.json()
        access_token = token_data['access_token']
        return access_token
    else:
        return None


def make_api_request(access_token):
    api_url = 'https://api.intra.42.fr/v2/me'

    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }

    response = requests.get(api_url, headers=headers)
    if response.status_code == 200:
        user_data = response.json()
        return user_data
    else:
        return None


def ifoauth(request, oauth_id):
    if request.method == "POST":
        form = PseudoIfOauthForm(request.POST)
        if form.is_valid():
            user = form.save()
            account = Account(user=user, oauth2_id=oauth_id)
            account.save()
            login_p(request, user)
            return redirect("transcendence:main")
    else:
        form = PseudoIfOauthForm()
    return render(request, "transcendence/ifoauth.html", {"form": form})


def privacy_policy(request):
    return render(request, "transcendence/privacy-policy.html")
