from app.core.database import db
from app.core.security import hash_password, verify_password, create_access_token
from fastapi import HTTPException,UploadFile, File, Form
from app.core.config import cloudinary

async def register_user(data: RegisterUser):

    existing_user = await db.find_one({"email": data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")

    hashed_password = hash_password(data.password)

    user_data = {
        "name": data.name,
        "email": data.email,
        "password": hashed_password
    }

    result = await db.insert_one(user_data)
    token = create_access_token(str(result.inserted_id))

    return {"success": True, "token": token}




async def login_user(data: LoginUser):

    user = await db.find_one({"email": data.email})
    if not user:
        raise HTTPException(status_code=400, detail="User does not exist")

    if not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    token = create_access_token(str(user["_id"]))
    return {"success": True, "token": token}


async def get_profile(user_id: str):

    user = await db.find_one(
        {"_id": ObjectId(user_id)},
        {"password": 0}
    )

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user["id"] = str(user["_id"])
    del user["_id"]

    return {"success": True, "userData": user}



async def update_profile(
    user_id: str = Form(...),
    name: str = Form(...),
    phone: str = Form(...),
    address: str = Form(None),
    dob: str = Form(...),
    gender: str = Form(...),
    image: UploadFile = File(None)
):

    update_data = {
        "name": name,
        "phone": phone,
        "dob": dob,
        "gender": gender,
        "address": json.loads(address) if address else None
    }

    await user_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )

    if image:
        upload = cloudinary.uploader.upload(image.file, resource_type="image")
        await user_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"image": upload["secure_url"]}}
        )

    return {"success": True, "message": "Profile Updated"}

