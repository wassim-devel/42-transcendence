# Generated by Django 5.0.6 on 2024-07-01 15:57

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transcendence', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='account',
            name='tournament_pseudo',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
    ]
