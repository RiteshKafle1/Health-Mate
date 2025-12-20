 from typing import Optional
from bson import ObjectId
from app.core.database import db

user_collection = db.get_collection("users")

def user_serializer(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "name": user.get("name"),
        "email": user.get("email"),
        "image": user.get("image"),
        "phone": user.get("phone"),
        "address": user.get("address"),
        "dob": user.get("dob"),
        "gender": user.get("gender"),
    }

def user_db_serializer(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "name": user.get("name"),
        "email": user.get("email"),
        "password": user.get("password"),
        "image": user.get("image"),
        "phone": user.get("phone"),
        "address": user.get("address"),
        "dob": user.get("dob"),
        "gender": user.get("gender"),
    }
    
def get_object_id(id: str) -> ObjectId:
    return ObjectId(id)

# Model = “How we interact with the database”