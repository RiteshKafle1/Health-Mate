from fastapi import HTTPException, UploadFile
from bson import ObjectId
from app.models.user_model import user_collection, user_serializer
from app.schemas.user_schema import UserRegister, UserLogin, UserUpdate
from app.core.security import hash_password, verify_password, create_access_token
from app.core.cloudinary import upload_to_cloudinary


async def register_user(data: UserRegister):
    existing = await user_collection.find_one({"email": data.email})
    if existing:
        raise HTTPException(400, "User already exists")

    user = {
        "name": data.name,
        "email": data.email,
        "password": hash_password(data.password),
        "image": None
    }

    result = await user_collection.insert_one(user)
    token = create_access_token(str(result.inserted_id))

    return {"success": True, "token": token}


async def login_user(data: UserLogin):
    user = await user_collection.find_one({"email": data.email})
    if not user:
        raise HTTPException(400, "Invalid credentials")

    if not verify_password(data.password, user["password"]):
        raise HTTPException(400, "Invalid credentials")

    token = create_access_token(str(user["_id"]))
    return {"success": True, "token": token}


async def get_profile(user_id: str):
    user = await user_collection.find_one(
        {"_id": ObjectId(user_id)}, {"password": 0}
    )

    if not user:
        raise HTTPException(404, "User not found")

    return {"success": True, "user": user_serializer(user)}


async def update_profile(
    user_id: str,
    data: UserUpdate,
    image: UploadFile = None
 ):
    update_data = {k: v for k, v in data.dict().items() if v is not None}

    if image:
        upload = upload_to_cloudinary(image.file, f"users/{user_id}")
        update_data["image"] = upload["secure_url"]

    if not update_data:
        raise HTTPException(400, "Nothing to update")

    await user_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )

    return {"success": True, "message": "Profile updated"}

async def upload_user_file(user_id: str, file: UploadFile):
    if not file:
        raise HTTPException(400, "File required")

    upload = upload_to_cloudinary(file.file, f"users/{user_id}")
    url = upload["secure_url"]

    await user_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"file": url}}
    )

    return {"success": True, "file_url": url}



async def book_appointment(
    user_id: str,
    doc_id: str,
    slotDate: str,
    slotTime: str
    ):

    doctor = await doctor_collection.find_one({"_id": ObjectId(doc_id)})
    if not doctor or not doctor["available"]:
        raise HTTPException(status_code=400, detail="Doctor Not Available")

    slots = doctor.get("slots_booked", {})

    if slotDate in slots and slotTime in slots[slotDate]:
        raise HTTPException(status_code=400, detail="Slot Not Available")

    slots.setdefault(slotDate, []).append(slotTime)

    user = await user_collection.find_one(
        {"_id": ObjectId(user_id)}, {"password": 0}
    )

    appointment = {
        "userId": user_id,
        "docId": doc_id,
        "userData": user,
        "docData": {k: v for k, v in doctor.items() if k != "slots_booked"},
        "amount": doctor["fees"],
        "slotTime": slotTime,
        "slotDate": slotDate,
        "date": int(time.time() * 1000),
        "cancelled": False
    }

    await appointment_collection.insert_one(appointment)
    await doctor_collection.update_one(
        {"_id": ObjectId(doc_id)},
        {"$set": {"slots_booked": slots}}
    )

    return {"success": True, "message": "Appointment Booked"}

async def cancel_appointment(user_id: str, appointment_id: str):

    appointment = await appointment_collection.find_one(
        {"_id": ObjectId(appointment_id)}
    )

    if appointment["userId"] != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized action")

    await appointment_collection.update_one(
        {"_id": ObjectId(appointment_id)},
        {"$set": {"cancelled": True}}
    )

    doctor = await doctor_collection.find_one(
        {"_id": ObjectId(appointment["docId"])}
    )

    slots = doctor["slots_booked"]
    slots[appointment["slotDate"]].remove(appointment["slotTime"])

    await doctor_collection.update_one(
        {"_id": ObjectId(doctor["_id"])},
        {"$set": {"slots_booked": slots}}
    )

    return {"success": True, "message": "Appointment Cancelled"}

async def list_appointments(user_id: str):

    appointments = await appointment_collection.find(
        {"userId": user_id}
    ).to_list(length=100)

    return {"success": True, "appointments": appointments}


async def upload_user_file(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user)
    ):
    if not file:
        raise HTTPException(status_code=400, detail="File is required")

    # Upload to Cloudinary
    upload_result = upload_to_cloudinary(
        file.file,
        folder=f"users/{user_id}"
    )

    file_url = upload_result["secure_url"]

    # Save file URL in user document
    await user_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"file": file_url}}
    )

    return {
        "success": True,
        "file_url": file_url
    }