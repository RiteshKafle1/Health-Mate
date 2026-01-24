"""Services module - Domain-based organization.

This module provides backward compatibility by re-exporting services
from the new domain-based structure.

New structure:
    - services/admin/     - Admin-related services
    - services/doctor/    - Doctor-related services  
    - services/user/      - User-related services
    - services/shared/    - Shared services (chatbot, payment)
"""

# Re-export from new domain-based structure for backward compatibility
from .admin import admin_service
from .admin import analytics_service
from .doctor import doctor_service
from .user import user_service, medication_service, medication_info_service
from .user import dose_service, dose_history_service, ai_insights_service, report_service
from .shared import chatbot_service, payment_service

__all__ = [
    # Admin services
    "admin_service",
    "analytics_service",
    # Doctor services
    "doctor_service",
    # User services
    "user_service",
    "medication_service",
    "medication_info_service",
    "dose_service",
    "dose_history_service",
    "ai_insights_service",
    "report_service",
    # Shared services
    "chatbot_service",
    "payment_service",
]
