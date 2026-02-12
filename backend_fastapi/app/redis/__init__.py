"""
Redis notification caching module.
"""
from .notification_cache import (
    cache_notification,
    get_recent_notifications,
    clear_user_notifications,
    get_notification_count
)

__all__ = [
    "cache_notification",
    "get_recent_notifications", 
    "clear_user_notifications",
    "get_notification_count"
]
