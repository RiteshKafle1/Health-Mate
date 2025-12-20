from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import date

class UserRegister(BaseModel):
    name: str = Field(..., min_length=3, max_length=20)
    email: EmailStr
    password: str = Field(..., min_length=8)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[str] = None
    image: Optional[str] = None
    report:Optional[str]=None


class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    image: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[str] = None
    report:Optional[str]=None

# Schema = “shape of data coming IN or OUT of API”

