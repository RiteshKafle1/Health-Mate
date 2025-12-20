from fastapi import APIRouter
from app.models.user_model import User

from app.services.user_service import register_user,login_user,get_profile,book_appointment
router=APIRouter()

@router.post('/register')
async def createUser(user:User):
  return await register_user(user.dict())

@router.post('/login')
async def loginUser(user:User):
  return await register_user(user.dict())

@router.get("/profile/{user_id}")
async def getProfile():
  return await get_profile(user_id)

@router.put("/update-profile")
async def updateProfile():
  return await update_profile()

@router.post("/book-appointment")
async def bookAppointment():
  return await update_profile()

@router.post("/cancel-appointment")
async def cancelAppointment():
  return await update_profile()

@router.get("/appointments/{user_id}")
async def listAppointment():
  return await update_profile()