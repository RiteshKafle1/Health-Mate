"""
Rate Limiting Middleware

Redis-based rate limiting to prevent brute force attacks and abuse.

Rate limits:
- Login: 5 attempts per 15 minutes per IP
- Registration: 3 attempts per hour per IP
- Password validation: 20 requests per minute per IP
- Email validation: 20 requests per minute per IP
"""

import time
from typing import Optional
from fastapi import Request, HTTPException, status
from ..core import redis as redis_module


class RateLimiter:
    """Redis-based rate limiter for authentication endpoints."""
    
    @staticmethod
    async def check_rate_limit(
        key: str,
        max_attempts: int,
        window_seconds: int
    ) -> bool:
        """
        Check if request is within rate limit.
        
        Args:
            key: Redis key for this rate limit
            max_attempts: Maximum number of attempts allowed
            window_seconds: Time window in seconds
            
        Returns:
            True if within limit, False if rate limit exceeded
        """
        if not redis_module.redis_client:
            # If Redis is not available, allow the request
            return True
        
        try:
            # Get current count
            current_count = await redis_module.redis_client.get(key)
            
            if current_count is None:
                # First request in this window
                await redis_module.redis_client.setex(
                    key,
                    window_seconds,
                    1
                )
                return True
            
            current_count = int(current_count)
            
            if current_count >= max_attempts:
                return False
            
            # Increment counter
            await redis_module.redis_client.incr(key)
            return True
            
        except Exception as e:
            print(f"Rate limiter error: {e}")
            # If Redis fails, allow the request
            return True
    
    @staticmethod
    async def get_remaining_time(key: str) -> int:
        """Get remaining time until rate limit resets."""
        if not redis_module.redis_client:
            return 0
        
        try:
            ttl = await redis_module.redis_client.ttl(key)
            return max(ttl, 0)
        except Exception:
            return 0


async def rate_limit_login(request: Request) -> None:
    """
    Rate limiter for login endpoint.
    5 attempts per 15 minutes per IP.
    """
    client_ip = request.client.host if request.client else "unknown"
    key = f"rate_limit:login:{client_ip}"
    
    is_allowed = await RateLimiter.check_rate_limit(
        key=key,
        max_attempts=5,
        window_seconds=900  # 15 minutes
    )
    
    if not is_allowed:
        remaining_time = await RateLimiter.get_remaining_time(key)
        minutes = remaining_time // 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "success": False,
                "message": f"Too many login attempts. Please try again in {minutes} minutes."
            }
        )


async def rate_limit_registration(request: Request) -> None:
    """
    Rate limiter for registration endpoint.
    3 attempts per hour per IP.
    """
    client_ip = request.client.host if request.client else "unknown"
    key = f"rate_limit:register:{client_ip}"
    
    is_allowed = await RateLimiter.check_rate_limit(
        key=key,
        max_attempts=3,
        window_seconds=3600  # 1 hour
    )
    
    if not is_allowed:
        remaining_time = await RateLimiter.get_remaining_time(key)
        minutes = remaining_time // 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "success": False,
                "message": f"Too many registration attempts. Please try again in {minutes} minutes."
            }
        )


async def rate_limit_validation(request: Request) -> None:
    """
    Rate limiter for validation endpoints.
    20 attempts per minute per IP.
    """
    client_ip = request.client.host if request.client else "unknown"
    key = f"rate_limit:validate:{client_ip}"
    
    is_allowed = await RateLimiter.check_rate_limit(
        key=key,
        max_attempts=20,
        window_seconds=60  # 1 minute
    )
    
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "success": False,
                "message": "Too many validation requests. Please slow down."
            }
        )


class AccountLockout:
    """Manage account lockout after failed login attempts."""
    
    @staticmethod
    async def record_failed_login(user_id: str) -> Optional[int]:
        """
        Record a failed login attempt and return lockout seconds if locked.
        
        Returns:
            None if not locked, lockout duration in seconds if locked
        """
        from ..core.database import get_users_collection
        from bson import ObjectId
        
        users = get_users_collection()
        
        try:
            user = await users.find_one({"_id": ObjectId(user_id)})
            if not user:
                return None
            
            failed_attempts = user.get("failed_login_attempts", 0) + 1
            
            # Progressive lockout duration
            if failed_attempts >= 10:
                lockout_seconds = 86400  # 24 hours
            elif failed_attempts >= 7:
                lockout_seconds = 3600  # 1 hour
            elif failed_attempts >= 5:
                lockout_seconds = 900  # 15 minutes
            else:
                lockout_seconds = None
            
            # Update user record
            update_data = {"failed_login_attempts": failed_attempts}
            
            if lockout_seconds:
                locked_until = int(time.time() * 1000) + (lockout_seconds * 1000)
                update_data["locked_until"] = locked_until
            
            await users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": update_data}
            )
            
            return lockout_seconds
            
        except Exception as e:
            print(f"Account lockout error: {e}")
            return None
    
    @staticmethod
    async def reset_failed_attempts(user_id: str) -> None:
        """Reset failed login attempts after successful login."""
        from ..core.database import get_users_collection
        from bson import ObjectId
        
        users = get_users_collection()
        
        try:
            await users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {
                    "failed_login_attempts": 0,
                    "locked_until": None
                }}
            )
        except Exception as e:
            print(f"Reset failed attempts error: {e}")
    
    @staticmethod
    async def is_account_locked(user_id: str) -> tuple[bool, Optional[int]]:
        """
        Check if account is locked.
        
        Returns:
            (is_locked, remaining_seconds)
        """
        from ..core.database import get_users_collection
        from bson import ObjectId
        
        users = get_users_collection()
        
        try:
            user = await users.find_one({"_id": ObjectId(user_id)})
            if not user:
                return False, None
            
            locked_until = user.get("locked_until")
            if not locked_until:
                return False, None
            
            current_time = int(time.time() * 1000)
            
            if locked_until > current_time:
                remaining_ms = locked_until - current_time
                remaining_seconds = remaining_ms // 1000
                return True, remaining_seconds
            else:
                # Lock expired, reset it
                await AccountLockout.reset_failed_attempts(user_id)
                return False, None
                
        except Exception as e:
            print(f"Account lock check error: {e}")
            return False, None
