"""
Socket.IO Server for Real-Time Notifications

This module implements the Socket.IO server that enables real-time
communication between the backend and frontend for instant notifications.

Features:
- User room management (each user joins their own room)
- Async event handling
- JWT token validation ready (for future enhancement)
- Reconnection handling
"""
import socketio
from typing import Dict, Set
import logging

# Configure logging
logger = logging.getLogger(__name__)

# Create async Socket.IO server
# cors_allowed_origins="*" allows all origins in development
# In production, restrict this to your frontend domain
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,  # Set to True for debugging
    engineio_logger=False
)

# Create ASGI app wrapper for mounting to FastAPI
socket_app = socketio.ASGIApp(
    sio,
    socketio_path='socket.io'
)

# Track connected users: {sid: user_id}
connected_users: Dict[str, str] = {}
# Track user sessions: {user_id: set of sids}
user_sessions: Dict[str, Set[str]] = {}


@sio.event
async def connect(sid: str, environ: dict, auth: dict = None):
    """
    Handle new socket connection.
    
    The client should send auth data with their token for identification.
    For now, we allow connections and wait for join_room event.
    """
    logger.info(f"Socket connected: {sid}")
    print(f"🔌 Socket connected: {sid}")
    return True


@sio.event
async def disconnect(sid: str):
    """
    Handle socket disconnection.
    Clean up user tracking data.
    """
    user_id = connected_users.pop(sid, None)
    
    if user_id and user_id in user_sessions:
        user_sessions[user_id].discard(sid)
        if not user_sessions[user_id]:
            del user_sessions[user_id]
    
    logger.info(f"Socket disconnected: {sid} (user: {user_id})")
    print(f"🔌 Socket disconnected: {sid}")


@sio.event
async def join_room(sid: str, data: dict):
    """
    Handle user joining their notification room.
    
    Expected data format:
    {
        "user_id": "string",
        "token": "jwt_token" (optional, for future validation)
    }
    """
    user_id = data.get('user_id')
    
    if not user_id:
        await sio.emit('error', {'message': 'user_id required'}, to=sid)
        return
    
    # Track user connection
    connected_users[sid] = user_id
    
    if user_id not in user_sessions:
        user_sessions[user_id] = set()
    user_sessions[user_id].add(sid)
    
    # Join user-specific room
    await sio.enter_room(sid, f"user_{user_id}")
    
    # Send confirmation
    await sio.emit('room_joined', {
        'success': True,
        'room': f"user_{user_id}",
        'message': 'Connected to notification service'
    }, to=sid)
    
    logger.info(f"User {user_id} joined room via {sid}")
    print(f"👤 User {user_id} joined notification room")


@sio.event
async def leave_room(sid: str, data: dict):
    """Handle user leaving their notification room."""
    user_id = data.get('user_id')
    
    if user_id:
        await sio.leave_room(sid, f"user_{user_id}")
        logger.info(f"User {user_id} left room")


async def emit_to_user(user_id: str, event: str, data: dict) -> bool:
    """
    Emit an event to a specific user's room.
    
    This is the main function used by notification_service to send
    real-time notifications to users.
    
    Args:
        user_id: Target user's ID
        event: Event name (e.g., 'new_notification')
        data: Event data payload
        
    Returns:
        bool: True if user has active connections, False otherwise
    """
    room = f"user_{user_id}"
    
    # Check if user has any active connections
    has_connections = user_id in user_sessions and len(user_sessions[user_id]) > 0
    
    # Emit to the room (works even if empty - no error)
    await sio.emit(event, data, room=room)
    
    if has_connections:
        logger.info(f"Emitted '{event}' to user {user_id}")
        print(f"📤 Notification sent to user {user_id}")
    else:
        logger.debug(f"User {user_id} not connected, notification queued in Redis")
    
    return has_connections


def get_connected_users() -> Dict[str, int]:
    """
    Get a dictionary of connected users and their session counts.
    Useful for debugging and monitoring.
    """
    return {uid: len(sids) for uid, sids in user_sessions.items()}


@sio.event
async def ping_server(sid: str, data: dict = None):
    """
    Simple ping handler for connection health checks.
    """
    await sio.emit('pong_server', {'status': 'ok'}, to=sid)
