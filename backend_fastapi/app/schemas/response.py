from pydantic import BaseModel
from typing import Any, Optional


class APIResponse(BaseModel):
    """Standardized API response matching Express.js format."""
    success: bool
    message: Optional[str] = None
    token: Optional[str] = None
    userData: Optional[Any] = None
    profileData: Optional[Any] = None
    doctors: Optional[Any] = None
    appointments: Optional[Any] = None
    dashData: Optional[Any] = None
    order: Optional[Any] = None


class TokenResponse(BaseModel):
    success: bool = True
    token: str


class MessageResponse(BaseModel):
    success: bool
    message: str
