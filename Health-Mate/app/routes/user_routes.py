from fastapi import APIRouter
from app.models.user_model import User
from app.services.user_service import register_user
router=APIRouter()

@router.post('/register')
async def createUser(user:User):
  return await register_user(user.dict())