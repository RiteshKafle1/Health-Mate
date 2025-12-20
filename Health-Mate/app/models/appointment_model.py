from pydantic import BaseModel, Field
from typing import Dict, Any


class AppointmentBase(BaseModel):
    userId: str
    docId: str
    slotDate: str
    slotTime: str
    userData: Dict[str, Any]
    docData: Dict[str, Any]
    amount: float
    date: int
    cancelled: bool = False
    payment: bool = False
    isCompleted: bool = False


class AppointmentCreate(BaseModel):
    docId: str
    slotDate: str
    slotTime: str


class AppointmentInDB(AppointmentBase):
    id: str = Field(alias="_id")
    
    class Config:
        populate_by_name = True


class AppointmentResponse(BaseModel):
    id: str = Field(alias="_id")
    userId: str
    docId: str
    slotDate: str
    slotTime: str
    userData: Dict[str, Any]
    docData: Dict[str, Any]
    amount: float
    date: int
    cancelled: bool
    payment: bool
    isCompleted: bool
    
    class Config:
        populate_by_name = True


class AppointmentCancel(BaseModel):
    appointmentId: str


class PaymentRequest(BaseModel):
    appointmentId: str


class RazorpayVerify(BaseModel):
    razorpay_order_id: str
