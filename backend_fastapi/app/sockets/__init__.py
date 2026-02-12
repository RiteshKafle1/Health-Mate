"""
Socket.IO notification module for real-time communication.
"""
from .notification_socket import sio, socket_app, emit_to_user, get_connected_users

__all__ = ["sio", "socket_app", "emit_to_user", "get_connected_users"]
