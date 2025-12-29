from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Optional
from ..core.config import settings
from ..core.security import verify_token, verify_admin_token
from ..core import redis as redis_module

# Custom header-based auth (to match Express.js headers)
security = HTTPBearer(auto_error=False)


async def get_current_user(request: Request) -> str:
    """
    Dependency to get the current authenticated user.
    Matches Express.js authUser middleware which reads 'token' from headers.
    """
    token = request.headers.get("token")
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"success": False, "message": "Not Authorized Login Again"}
        )
    
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("id")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"success": False, "message": "Not Authorized Login Again"}
            )
        
        # Optional: Check Redis session (non-blocking, graceful fallback)
        try:
            if redis_module.redis_client:
                is_valid = await redis_module.is_token_valid(user_id, token)
                if not is_valid:
                    pass  # For now, allow even if not in Redis
        except Exception as redis_error:
            # Redis connection issues shouldn't block authentication
            # JWT validation already passed, so allow the request
            print(f"Redis session check failed (non-critical): {redis_error}")
        
        return user_id
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"success": False, "message": str(e)}
        )


async def get_current_doctor(request: Request) -> str:
    """
    Dependency to get the current authenticated doctor.
    Matches Express.js authDoctor middleware which reads 'authorization' or 'dtoken' from headers.
    """
    auth_header = request.headers.get("authorization") or request.headers.get("dtoken")
    
    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"success": False, "message": "Authorization token missing"}
        )
    
    # Extract token from 'Bearer <token>' format or use directly
    token = auth_header.split(" ")[1] if auth_header.startswith("Bearer ") else auth_header
    
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        doctor_id: str = payload.get("id")
        if doctor_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"success": False, "message": "Invalid or expired token"}
            )
        return doctor_id
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"success": False, "message": "Invalid or expired token"}
        )


async def get_current_admin(request: Request) -> bool:
    """
    Dependency to verify admin authentication.
    Matches Express.js authAdmin middleware which reads 'atoken' from headers.
    """
    atoken = request.headers.get("atoken")
    
    if not atoken:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"success": False, "message": "Not Authorized Login Again"}
        )
    
    try:
        # Express.js admin auth: jwt.sign(email + password, secret)
        # Then verifies: decoded === email + password
        decoded = jwt.decode(atoken, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        expected = settings.ADMIN_EMAIL + settings.ADMIN_PASSWORD
        
        if decoded != expected:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"success": False, "message": "Not Authorized Login Again"}
            )
        return True
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"success": False, "message": "Not Authorized Login Again"}
        )
