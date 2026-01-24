import redis.asyncio as redis
from .config import settings

# Redis client
redis_client: redis.Redis = None


async def connect_to_redis():
    """Connect to Redis on startup."""
    global redis_client
    try:
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        # Verify connection
        await redis_client.ping()
        print("Redis Connected")
    except Exception as e:
        print(f"Redis connection error: {e}")
        # Don't raise - Redis is optional for basic functionality
        redis_client = None


async def close_redis_connection():
    """Close Redis connection on shutdown."""
    global redis_client
    if redis_client:
        await redis_client.close()
        print("Redis connection closed")


def get_redis():
    """Get the Redis client instance."""
    return redis_client


async def store_session(user_id: str, token: str, expires: int = 86400):
    """Store a user session in Redis."""
    if redis_client:
        await redis_client.setex(f"session:{user_id}", expires, token)


async def get_session(user_id: str) -> str | None:
    """Get a user session from Redis."""
    if redis_client:
        return await redis_client.get(f"session:{user_id}")
    return None


async def delete_session(user_id: str):
    """Delete a user session from Redis."""
    if redis_client:
        await redis_client.delete(f"session:{user_id}")


async def is_token_valid(user_id: str, token: str) -> bool:
    """Check if a token is valid in Redis."""
    if redis_client:
        stored_token = await get_session(user_id)
        return stored_token == token
    return True  # If Redis is not available, assume valid
