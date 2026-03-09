import json
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from .models import APIKey, Project, Room, CallLog
from django.contrib.auth.models import User

def api_key_info(request):
    # For MVP: Get or create a system user to "own" the project
    user, _ = User.objects.get_or_create(
        username='system_admin',
        defaults={'is_staff': True, 'is_superuser': True}
    )

    # Ensure the user has at least one project
    project, _ = Project.objects.get_or_create(
        owner=user, 
        defaults={'name': "Default Project"}
    )
    
    # Get or create an API Key for this project
    api_key, _ = APIKey.objects.get_or_create(
        project=project,
        defaults={'name': 'Production Key'}
    )
    
    return JsonResponse({
        'project_name': project.name,
        'api_key': api_key.key,
        'is_active': api_key.is_active
    })

@csrf_exempt
def upload_recording(request):
    if request.method == 'POST':
        audio_file = request.FILES.get('audio')
        room_name = request.POST.get('room')
        
        # Get room and logs
        room, _ = Room.objects.get_or_create(name=room_name)
        # For MVP: using the first user as caller
        caller = User.objects.first() 
        
        log = CallLog.objects.create(
            room=room,
            caller=caller,
            recording=audio_file,
            status='Processing'
        )

        # Mock AI Processing (In a real app, this would be a Celery task)
        log.transcript = "Mock Transcript: Hello, this is a test of the Vocalis VoIP AI transcription system. The audio has been successfully captured and processed."
        log.summary = "A test call was made to verify AI transcription and backend recording storage."
        log.status = 'Completed'
        log.save()

        return JsonResponse({
            'status': 'success',
            'id': log.id,
            'transcript': log.transcript,
            'summary': log.summary
        })
    return JsonResponse({'error': 'Method not allowed'}, status=405)

def call_history(request):
    logs = CallLog.objects.all().order_by('-start_time')[:10]
    data = [{
        'id': log.id,
        'room': log.room.name,
        'start_time': log.start_time.isoformat(),
        'transcript': log.transcript,
        'summary': log.summary,
        'status': log.status
    } for log in logs]
    return JsonResponse(data, safe=False)
