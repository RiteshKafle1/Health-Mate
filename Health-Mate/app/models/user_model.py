from pydantic import BaseModel, Field, EmailStr
from typing import Optional

class RegisterUser(BaseModel):
    name: str = Field(..., min_length=3, max_length=20)
    email: EmailStr
    password: str = Field(..., min_length=8)

class LoginUser(BaseModel):
    email: EmailStr
    password: str

class UpdateProfile(BaseModel):
    name: str
    phone: str
    address: Optional[str]
    dob: str
    gender: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    image: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    dob: Optional[str]
