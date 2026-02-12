from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # MongoDB
    MONGO_URI: str
    
    # JWT
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    
    # Razorpay
    RAZORPAY_KEY_ID: str
    RAZORPAY_KEY_SECRET: str
    
    # Stripe (optional)
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_API_KEY: str = ""
    
    # Currency
    CURRENCY: str = "INR"
    
    # Server
    PORT: int = 8000
    
    # Redis
    REDIS_URL: str
    
    # Admin credentials
    ADMIN_EMAIL: str
    ADMIN_PASSWORD: str
    
    # Cloudinary
    CLOUDINARY_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_SECRET_KEY: str = ""
    
    # MediGenius Chatbot (optional)
    GROQ_API_KEY: str = ""
    MEDIGENIUS_SECRET_KEY: str = ""
    MEDIGENIUS_DB_PATH: str = "./chat_db/medigenius_chats.db"
    MEDIGENIUS_VECTOR_DIR: str = "./medical_db/"
    MEDIGENIUS_PDF_PATH: str = "./data/medical_book.pdf"
    
    # HealthMate Assist (Gemini 2.0 Flash)
    GEMINI_API_KEY: str = ""
    HEALTHMATE_ASSIST_DB_PATH: str = "./chat_db/healthmate_assist.db"
    
    # Lab Interpretation — Llama Parser (extraction)
    LLAMA_API_KEY: str = ""
    
    # Lab Interpretation — Fine-tuned Qwen (local interpretation)
    QWEN_MODEL_PATH: str = ""
    
    class Config:
        env_file = ".env"
        extra = "allow"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
