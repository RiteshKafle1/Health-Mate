import cloudinary
import cloudinary.uploader
import cloudinary.api
import os
import re
from .config import settings

# ANSI color codes for terminal output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"
BOLD = "\033[1m"


def configure_cloudinary() -> bool:
    """
    Configure Cloudinary with credentials and verify connection.
    Supports both individual settings and CLOUDINARY_URL format.
    
    Returns:
        bool: True if connected successfully, False otherwise
    """
    try:
        cloud_name = None
        api_key = None
        api_secret = None
        
        # First try individual settings (more reliable)
        if settings.CLOUDINARY_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_SECRET_KEY:
            cloud_name = settings.CLOUDINARY_NAME
            api_key = settings.CLOUDINARY_API_KEY
            api_secret = settings.CLOUDINARY_SECRET_KEY
        else:
            # Try to parse CLOUDINARY_URL
            cloudinary_url = os.environ.get("CLOUDINARY_URL", "")
            if cloudinary_url:
                # Parse: cloudinary://api_key:api_secret@cloud_name
                match = re.match(r'cloudinary://([^:]+):([^@]+)@(.+)', cloudinary_url)
                if match:
                    api_key, api_secret, cloud_name = match.groups()
                else:
                    print(f"{RED}✗ Cloudinary: Invalid CLOUDINARY_URL format{RESET}")
                    return False
        
        if not all([cloud_name, api_key, api_secret]):
            print(f"{RED}✗ Cloudinary: Not configured - missing credentials{RESET}")
            print(f"  Set CLOUDINARY_NAME, CLOUDINARY_API_KEY, CLOUDINARY_SECRET_KEY in .env")
            return False
        
        # Configure cloudinary
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True
        )
        
        # Verify connection by pinging the API
        result = cloudinary.api.ping()
        
        if result.get("status") == "ok":
            print(f"{GREEN}✓ Cloudinary: Connected{RESET} (cloud: {BOLD}{cloud_name}{RESET})")
            return True
        else:
            print(f"{YELLOW}⚠ Cloudinary: Configured but ping returned unexpected result{RESET}")
            return False
            
    except Exception as e:
        print(f"{RED}✗ Cloudinary: Connection failed{RESET}")
        print(f"  Error: {e}")
        return False


async def upload_image(file_path: str) -> str:
    """Upload an image to Cloudinary and return the secure URL."""
    try:
        result = cloudinary.uploader.upload(file_path, resource_type="image")
        return result.get("secure_url", "")
    except Exception as e:
        print(f"Cloudinary upload error: {e}")
        raise e


async def upload_image_from_bytes(
    file_bytes: bytes, 
    folder: str = "uploads",
    resource_type: str = "auto"
) -> dict:
    """
    Upload file bytes to Cloudinary.
    
    Args:
        file_bytes: The file content as bytes
        folder: Cloudinary folder path (e.g., 'reports/user_id')
        resource_type: 'image', 'video', 'raw' (for PDFs), or 'auto'
    
    Returns:
        dict with upload result including 'secure_url'
    """
    try:
        result = cloudinary.uploader.upload(
            file_bytes,
            resource_type=resource_type,
            folder=folder
        )
        return result
    except Exception as e:
        print(f"Cloudinary upload error: {e}")
        raise e
