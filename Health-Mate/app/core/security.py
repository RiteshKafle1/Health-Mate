from passlib.context import CryptoContext
from jose import jwt
import os
from datetime import datetime,timedelta
from dotenv import load_env

load_env()

pwd_context=CryptoContext(schemes=['bcrypt'],deprecated="auto")

JWT_SECRET=os.getenv('JWT_SECRET')
JWT_ALGORITHM=os.getenv('JWT_ALGORITHM')

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)

def create_access_token(user_id: str):
    payload = {
        "id": user_id,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)