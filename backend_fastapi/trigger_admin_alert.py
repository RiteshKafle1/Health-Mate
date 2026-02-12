import requests
import time

URL = "http://localhost:8000/api/user/register"

def trigger_user_creation():
    # Unique email to avoid duplicates
    email = f"testuser_{int(time.time())}@example.com"
    payload = {
        "name": "Test User For Admin Alert",
        "email": email,
        "password": "Password123!",
        "confirmPassword": "Password123!"
    }
    
    print(f"🚀 Registering user: {email}...")
    try:
        response = requests.post(URL, json=payload)
        print(f"Response: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    time.sleep(2) # Wait for socket listener to be ready
    trigger_user_creation()
