"""
Authentication Request/Response Schemas

Pydantic schemas for all authentication-related API endpoints.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import List, Dict, Optional


class PasswordValidationRequest(BaseModel):
    """Request schema for password validation."""
    password: str = Field(..., description="Password to validate")
    check_breach: bool = Field(default=True, description="Check against breached passwords")


class PasswordFeedback(BaseModel):
    """Detailed password validation feedback."""
    hasMinLength: bool
    hasUppercase: bool
    hasLowercase: bool
    hasNumeric: bool
    hasSpecial: bool
    isNotCommon: bool
    isNotBreached: bool
    noSequential: bool


class PasswordValidationResponse(BaseModel):
    """Response schema for password validation."""
    valid: bool
    score: int = Field(..., ge=0, le=100, description="Password strength score (0-100)")
    strength: str = Field(..., description="Strength level: Weak, Fair, Good, or Strong")
    feedback: PasswordFeedback
    suggestions: List[str] = Field(default_factory=list)
    message: str


class EmailValidationRequest(BaseModel):
    """Request schema for email validation."""
    email: EmailStr


class EmailValidationResponse(BaseModel):
    """Response schema for email validation."""
    valid: bool
    message: str
    is_disposable: Optional[bool] = None
    is_available: Optional[bool] = None


class CheckEmailExistsRequest(BaseModel):
    """Request schema for checking email existence."""
    email: EmailStr


class CheckEmailExistsResponse(BaseModel):
    """Response schema for email existence check."""
    exists: bool
    message: str


class UserRegistrationEnhanced(BaseModel):
    """Enhanced user registration with validated fields."""
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)


class LoginAttemptResponse(BaseModel):
    """Enhanced login response with security info."""
    success: bool
    message: str
    token: Optional[str] = None
    user_id: Optional[str] = None
    requires_email_verification: Optional[bool] = None
    account_locked_until: Optional[str] = None
