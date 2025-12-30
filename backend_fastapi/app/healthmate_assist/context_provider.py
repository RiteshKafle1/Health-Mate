"""Context provider - Fetches user context for HealthMate Assist."""
from typing import Optional
from ..core.database import get_appointments_collection
from bson import ObjectId
from datetime import datetime


class ContextProvider:
    """Provides context about user's data for the chatbot."""
    
    @staticmethod
    async def get_user_context(user_id: str) -> dict:
        """Get complete user context including profile, medications, and appointments."""
        context = {
            "user_profile": await ContextProvider._get_user_profile(user_id),
            "medications": await ContextProvider._get_medications_context(user_id),
            "appointments": await ContextProvider._get_appointments_context(user_id)
        }
        return context
    
    @staticmethod
    async def _get_user_profile(user_id: str) -> str:
        """Get user profile summary."""
        # Lazy import to avoid circular dependency
        from ..services.user import user_service
        
        result = await user_service.get_user_profile(user_id)
        if not result.get("success"):
            return "User profile not available."
        
        user = result["userData"]
        lines = ["User Profile:"]
        lines.append(f"- Name: {user.get('name', 'Unknown')}")
        lines.append(f"- Email: {user.get('email', 'Unknown')}")
        lines.append(f"- Phone: {user.get('phone', 'Not set')}")
        lines.append(f"- Gender: {user.get('gender', 'Not Selected')}")
        lines.append(f"- Date of Birth: {user.get('dob', 'Not Selected')}")
        
        address = user.get('address', {})
        if isinstance(address, dict) and (address.get('line1') or address.get('line2')):
            addr_str = f"{address.get('line1', '')} {address.get('line2', '')}".strip()
            lines.append(f"- Address: {addr_str}")
        
        return "\n".join(lines)
    
    @staticmethod
    async def _get_medications_context(user_id: str) -> str:
        """Get medications summary."""
        # Lazy import to avoid circular dependency
        from ..services.user import medication_service
        
        return await medication_service.get_medications_summary(user_id)
    
    @staticmethod
    async def _get_appointments_context(user_id: str) -> str:
        """Get upcoming appointments summary."""
        appointments = get_appointments_collection()
        
        cursor = appointments.find({
            "userId": user_id,
            "cancelled": False,
            "isCompleted": False
        })
        
        appts_list = []
        async for appt in cursor:
            appts_list.append(appt)
        
        if not appts_list:
            return "No upcoming appointments."
        
        lines = ["Upcoming Appointments:"]
        for i, appt in enumerate(appts_list, 1):
            doc_data = appt.get("docData", {})
            doc_name = doc_data.get("name", "Unknown Doctor")
            doc_speciality = doc_data.get("speciality", "")
            slot_date = appt.get("slotDate", "Unknown date")
            slot_time = appt.get("slotTime", "Unknown time")
            
            line = f"{i}. Dr. {doc_name}"
            if doc_speciality:
                line += f" ({doc_speciality})"
            line += f" - {slot_date} at {slot_time}"
            lines.append(line)
        
        return "\n".join(lines)
    
    @staticmethod
    async def get_context_summary(user_id: str) -> str:
        """Get a full context summary as a single string."""
        context = await ContextProvider.get_user_context(user_id)
        
        sections = [
            context["user_profile"],
            "",
            context["medications"],
            "",
            context["appointments"]
        ]
        
        return "\n".join(sections)
