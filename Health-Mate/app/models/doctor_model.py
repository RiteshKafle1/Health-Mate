from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any


class DoctorAddress(BaseModel):
    line1: str = ""
    line2: str = ""


class DoctorBase(BaseModel):
    name: str
    email: EmailStr
    image: str
    speciality: str
    degree: str
    experience: str
    about: str
    available: bool = True
    fees: float
    slots_booked: Dict[str, Any] = Field(default_factory=dict)
    address: Dict[str, str] = Field(default_factory=dict)
    date: int


class DoctorCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    speciality: str
    degree: str
    experience: str
    about: str
    fees: float
    address: str  # JSON string from frontend


class DoctorLogin(BaseModel):
    email: EmailStr
    password: str


class DoctorUpdate(BaseModel):
    fees: Optional[float] = None
    address: Optional[Dict[str, str]] = None
    available: Optional[bool] = None
    about: Optional[str] = None


class DoctorInDB(DoctorBase):
    id: str = Field(alias="_id")
    password: str
    
    class Config:
        populate_by_name = True


class DoctorResponse(BaseModel):
    id: str = Field(alias="_id")
    name: str
    email: Optional[EmailStr] = None
    image: str
    speciality: str
    degree: str
    experience: str
    about: str
    available: bool
    fees: float
    slots_booked: Dict[str, Any] = Field(default_factory=dict)
    address: Dict[str, str]
    date: int
    
    class Config:
        populate_by_name = True


class DoctorPublicResponse(BaseModel):
    """Doctor info without sensitive fields"""
    id: str = Field(alias="_id")
    name: str
    image: str
    speciality: str
    degree: str
    experience: str
    about: str
    available: bool
    fees: float
    address: Dict[str, str]
    
    class Config:
        populate_by_name = True
