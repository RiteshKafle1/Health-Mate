"""
Authentication Router

Provides endpoints for:
- Real-time password validation
- Real-time email validation
- Email availability checking
"""

from fastapi import APIRouter, HTTPException, status, Depends
from ..schemas.auth_schemas import (
    PasswordValidationRequest,
    PasswordValidationResponse,
    EmailValidationRequest,
    EmailValidationResponse,
    CheckEmailExistsRequest,
    CheckEmailExistsResponse
)
from ..utils.password_validator import validate_password_strength
from ..utils.email_validator import validate_email_address
from ..core.database import get_users_collection
from ..middleware.rate_limiter import rate_limit_validation


router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/validate-password", response_model=PasswordValidationResponse, dependencies=[Depends(rate_limit_validation)])
async def validate_password(request: PasswordValidationRequest):
    """
    Real-time password strength validation.
    
    Validates password against:
    - Minimum length (8 characters)
    - Uppercase letter requirement
    - Lowercase letter requirement
    - Numeric digit requirement
    - Special character requirement
    - Common password check
    - Breach database check (optional)
    - Sequential character detection
    
    Returns detailed feedback for real-time UI updates.
    
    Rate limited to 20 requests per minute per IP.
    """
    result = validate_password_strength(request.password, request.check_breach)
    return PasswordValidationResponse(**result)


@router.post("/validate-email", response_model=EmailValidationResponse, dependencies=[Depends(rate_limit_validation)])
async def validate_email(request: EmailValidationRequest):
    """
    Real-time email validation.
    
    Validates email against:
    - Format validation (RFC 5322)
    - Disposable email domain detection
    
    Returns validation result for real-time UI updates.
    
    Rate limited to 20 requests per minute per IP.
    """
    result = validate_email_address(request.email)
    
    return EmailValidationResponse(
        valid=result["valid"],
        message=result["message"],
        is_disposable=result["is_disposable"]
    )


@router.post("/check-email-exists", response_model=CheckEmailExistsResponse, dependencies=[Depends(rate_limit_validation)])
async def check_email_exists(request: CheckEmailExistsRequest):
    """
    Check if email is already registered.
    
    Used during registration to provide real-time feedback
    on email availability.
    
    Rate limited to 20 requests per minute per IP.
    """
    users = get_users_collection()
    
    # First validate email format
    email_validation = validate_email_address(request.email)
    if not email_validation["valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=email_validation["message"]
        )
    
    # Check if email exists
    existing = await users.find_one({"email": email_validation["normalized_email"]})
    
    if existing:
        return CheckEmailExistsResponse(
            exists=True,
            message="Email is already registered"
        )
    
    return CheckEmailExistsResponse(
        exists=False,
        message="Email is available"
    )
