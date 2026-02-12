"""
Redis Notification Cache

Stores recent notifications in Redis for quick access and
provides a queue-ready structure for future scalability.

Features:
- Cache notifications per user with TTL
- Retrieve recent notifications quickly
- Optional Pub/Sub support (prepared for future)
"""
import json
from typing import List, Dict, Optional
from datetime import datetime
import logging

from ..core.redis import get_redis

logger = logging.getLogger(__name__)

# Configuration
NOTIFICATION_TTL = 86400 * 7  # 7 days
MAX_CACHED_NOTIFICATIONS = 50  # Per user


async def cache_notification(user_id: str, notification: Dict) -> bool:
    """
    Cache a notification in Redis for a user.
    
    Stores notifications in a Redis list with automatic cleanup
    of old notifications beyond MAX_CACHED_NOTIFICATIONS.
    
    Args:
        user_id: User's ID
        notification: Notification data dict
        
    Returns:
        bool: True if cached successfully, False otherwise
    """
    redis = get_redis()
    if not redis:
        logger.warning("Redis not available, skipping notification cache")
        return False
    
    try:
        key = f"notifications:{user_id}"
        
        # Serialize notification to JSON
        notification_json = json.dumps(notification, default=str)
        
        # Push to the front of the list (most recent first)
        await redis.lpush(key, notification_json)
        
        # Trim to keep only recent notifications
        await redis.ltrim(key, 0, MAX_CACHED_NOTIFICATIONS - 1)
        
        # Set/refresh TTL
        await redis.expire(key, NOTIFICATION_TTL)
        
        logger.debug(f"Cached notification for user {user_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to cache notification: {e}")
        return False


async def get_recent_notifications(
    user_id: str, 
    limit: int = 20
) -> List[Dict]:
    """
    Get recent cached notifications for a user.
    
    Args:
        user_id: User's ID
        limit: Maximum number of notifications to return
        
    Returns:
        List of notification dictionaries
    """
    redis = get_redis()
    if not redis:
        return []
    
    try:
        key = f"notifications:{user_id}"
        
        # Get notifications from list
        notifications_json = await redis.lrange(key, 0, limit - 1)
        
        notifications = []
        for notif_json in notifications_json:
            try:
                notifications.append(json.loads(notif_json))
            except json.JSONDecodeError:
                continue
        
        return notifications
        
    except Exception as e:
        logger.error(f"Failed to get cached notifications: {e}")
        return []


async def clear_user_notifications(user_id: str) -> bool:
    """
    Clear all cached notifications for a user.
    
    Args:
        user_id: User's ID
        
    Returns:
        bool: True if cleared successfully
    """
    redis = get_redis()
    if not redis:
        return False
    
    try:
        key = f"notifications:{user_id}"
        await redis.delete(key)
        logger.info(f"Cleared notification cache for user {user_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to clear notification cache: {e}")
        return False


async def get_notification_count(user_id: str) -> int:
    """
    Get the count of cached notifications for a user.
    
    Args:
        user_id: User's ID
        
    Returns:
        int: Number of cached notifications
    """
    redis = get_redis()
    if not redis:
        return 0
    
    try:
        key = f"notifications:{user_id}"
        return await redis.llen(key)
        
    except Exception as e:
        logger.error(f"Failed to get notification count: {e}")
        return 0


async def publish_notification(channel: str, notification: Dict) -> bool:
    """
    Publish notification to a Redis Pub/Sub channel.
    
    Prepared for future microservice architecture where
    multiple services may need to listen for notifications.
    
    Args:
        channel: Pub/Sub channel name
        notification: Notification data
        
    Returns:
        bool: True if published successfully
    """
    redis = get_redis()
    if not redis:
        return False
    
    try:
        notification_json = json.dumps(notification, default=str)
        await redis.publish(channel, notification_json)
        return True
        
    except Exception as e:
        logger.error(f"Failed to publish notification: {e}")
        return False
