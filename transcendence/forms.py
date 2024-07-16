from django import forms
from .models import Account, Tournament, Game
from django.contrib.auth.models import User
from django.contrib.auth.forms import PasswordChangeForm


class ChangePDPForm(forms.ModelForm):
    class Meta:
        model = Account
        fields = ['avatar']

    def clean_avatar(self):
        avatar = self.cleaned_data['avatar']
        if not avatar or avatar == 'avatars/default.png':
            raise forms.ValidationError("Veuillez télécharger une image.")

        if avatar.content_type not in ['image/jpeg', 'image/png', 'image/gif']:
            raise forms.ValidationError("Veuillez télécharger une image JPEG, PNG ou GIF.")
        return avatar


class PseudoIfOauthForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ['username']

    def clean_pseudo(self):
        pseudo = self.cleaned_data['username']
        if User.objects.filter(username=pseudo).exists():
            raise forms.ValidationError("Ce pseudo est déjà utilisé.")
        return pseudo


class CreateTournamentForm(forms.ModelForm):
    class Meta:
        model = Tournament
        fields = ['name']


class UserProfileForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ['username']


class PasswordChangeCustomForm(PasswordChangeForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['old_password'].widget.attrs.update({'class': 'form-control', 'placeholder': 'Ancien mot de passe'})
        self.fields['new_password1'].widget.attrs.update(
            {'class': 'form-control', 'placeholder': 'Nouveau mot de passe'})
        self.fields['new_password2'].widget.attrs.update(
            {'class': 'form-control', 'placeholder': 'Confirmer le nouveau mot de passe'})
