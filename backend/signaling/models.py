import secrets
from django.db import models
from django.contrib.auth.models import User

class Project(models.Model):
    name = models.CharField(max_length=255)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='projects')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class APIKey(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='api_keys')
    key = models.CharField(max_length=64, unique=True, editable=False)
    name = models.CharField(max_length=100, default='Default Key')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.key:
            self.key = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.project.name} - {self.name}"

class Room(models.Model):
    name = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class CallLog(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='logs')
    caller = models.ForeignKey(User, on_delete=models.CASCADE, related_name='calls_made')
    receiver = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='calls_received')
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    duration = models.IntegerField(default=0) # in seconds
    
    # AI Enhancement Fields
    recording = models.FileField(upload_to='recordings/', null=True, blank=True)
    transcript = models.TextField(null=True, blank=True)
    summary = models.CharField(max_length=500, null=True, blank=True)
    status = models.CharField(max_length=50, default='Completed', choices=[
        ('Completed', 'Completed'),
        ('Processing', 'Processing AI...'),
        ('Failed', 'AI Processing Failed')
    ])

    def __str__(self):
        return f"Call in {self.room.name} by {self.caller.username}"
