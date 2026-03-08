import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import APIKey

# In-memory participant tracking for MVP
# In a real production app, use Redis or a database
room_participants = {} 

class SignalingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'signaling_{self.room_name}'
        
        # Extract API Key from query string
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        query_params = dict(qp.split('=') for qp in query_string.split('&') if '=' in qp)
        api_key_val = query_params.get('api_key')

        if not api_key_val or not await self.validate_api_key(api_key_val):
            await self.close()
            return

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        # Track participant
        if self.room_group_name not in room_participants:
            room_participants[self.room_group_name] = set()
        
        # Using a simple "User X" label for MVP since we don't have full auth in the scope yet
        self.user_label = f"User_{self.channel_name[-4:]}"
        room_participants[self.room_group_name].add(self.user_label)

        await self.accept()

        # Broadcast updated participant list
        await self.broadcast_participants()

    async def broadcast_participants(self):
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'participant_update',
                'participants': list(room_participants[self.room_group_name])
            }
        )

    async def participant_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'participant_list',
            'participants': event['participants']
        }))

    @database_sync_to_async
    def validate_api_key(self, api_key_val):
        return APIKey.objects.filter(key=api_key_val, is_active=True).exists()

    async def disconnect(self, close_code):
        # Leave room group
        if hasattr(self, 'room_group_name'):
            if self.room_group_name in room_participants:
                room_participants[self.room_group_name].discard(self.user_label)
                if not room_participants[self.room_group_name]:
                    del room_participants[self.room_group_name]
            
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
            
            # Broadcast update if room still exists
            if self.room_group_name in room_participants:
                await self.broadcast_participants()

    # Receive message from WebSocket
    async def receive(self, text_data):
        data = json.loads(text_data)
        
        # Broadcast the message to the room (excluding the sender)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'signal_message',
                'message': data,
                'sender_channel_name': self.channel_name
            }
        )

    # Receive message from room group
    async def signal_message(self, event):
        message = event['message']
        sender_channel_name = event['sender_channel_name']

        # Send message to WebSocket (but don't send back to the original sender)
        if self.channel_name != sender_channel_name:
            await self.send(text_data=json.dumps(message))
