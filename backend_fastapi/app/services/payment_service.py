import razorpay
from bson import ObjectId
from ..core.config import settings
from ..core.database import get_appointments_collection

# Initialize Razorpay client
razorpay_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


async def create_razorpay_order(appointment_id: str) -> dict:
    """Create a Razorpay order for an appointment."""
    appointments = get_appointments_collection()
    
    appt = await appointments.find_one({"_id": ObjectId(appointment_id)})
    
    if not appt:
        return {"success": False, "message": "Appointment not found"}
    
    if appt.get("cancelled"):
        return {"success": False, "message": "Appointment Cancelled or not found"}
    
    # Create Razorpay order
    try:
        options = {
            "amount": int(appt["amount"] * 100),  # Amount in paise
            "currency": settings.CURRENCY,
            "receipt": appointment_id
        }
        
        order = razorpay_client.order.create(data=options)
        return {"success": True, "order": order}
    except Exception as e:
        return {"success": False, "message": str(e)}


async def verify_razorpay_payment(razorpay_order_id: str) -> dict:
    """Verify a Razorpay payment."""
    appointments = get_appointments_collection()
    
    try:
        order_info = razorpay_client.order.fetch(razorpay_order_id)
        
        if order_info.get("status") == "paid":
            receipt = order_info.get("receipt")
            await appointments.update_one(
                {"_id": ObjectId(receipt)},
                {"$set": {"payment": True}}
            )
            return {"success": True, "message": "Payment Successful"}
        else:
            return {"success": False, "message": "Payment Failed"}
    except Exception as e:
        return {"success": False, "message": str(e)}
