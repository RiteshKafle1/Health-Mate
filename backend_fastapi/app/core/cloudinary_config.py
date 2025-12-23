import cloudinary
import cloudinary.uploader
from .config import settings


def configure_cloudinary():
    """Configure Cloudinary with credentials."""
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_SECRET_KEY
    )


async def upload_image(file_path: str) -> str:
    """Upload an image to Cloudinary and return the secure URL."""
    try:
        result = cloudinary.uploader.upload(file_path, resource_type="image")
        return result.get("secure_url", "")
    except Exception as e:
        print(f"Cloudinary upload error: {e}")
        raise e


async def upload_image_from_bytes(file_bytes: bytes, filename: str) -> str:
    """Upload image bytes to Cloudinary."""
    try:
        result = cloudinary.uploader.upload(file_bytes, resource_type="image")
        return result.get("secure_url", "")
    except Exception as e:
        print(f"Cloudinary upload error: {e}")
        raise e
