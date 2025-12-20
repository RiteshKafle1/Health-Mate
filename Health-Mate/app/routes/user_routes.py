from fastapi import APIRouter, UploadFile, File, Depends
from app.schemas.user_schema import (
    UserRegister,
    UserLogin,
    UserUpdate
)
from app.services.user_service import (
    register_user,
    login_user,
    get_profile,
    update_profile,
    upload_user_file,
    book_appointment,
    cancel_appointment,
    list_appointments
)

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/register")
async def register(user: UserRegister):
    return await register_user(user)

@router.post("/login")
async def login(user: UserLogin):
    return await login_user(user)

@router.get("/profile/{user_id}")
async def profile(user_id: str):
    return await get_profile(user_id)

@router.put("/update-profile/{user_id}")
async def update(
    user_id: str,
    data: UserUpdate = Depends(),
    image: UploadFile = File(None)
):
    return await update_profile(user_id, data, image)

@router.post("/upload-file/{user_id}")
async def upload_file(
    user_id: str,
    file: UploadFile = File(...)
):
    return await upload_user_file(user_id, file)
    
@router.post("/book-appointment")
async def book(data: dict):
    return await book_appointment(**data)


@router.post("/cancel-appointment")
async def cancel(data: dict):
    return await cancel_appointment(**data)


@router.get("/appointments/{user_id}")
async def appointments(user_id: str):
    return await list_appointments(user_id)
