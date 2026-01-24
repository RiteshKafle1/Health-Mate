"""Conversation flow - Handles medication CRUD conversation states."""
from typing import Dict, Any, Optional, Tuple
from enum import Enum


class ConversationIntent(Enum):
    """Detected user intent."""
    ADD_MEDICATION = "add_medication"
    UPDATE_MEDICATION = "update_medication"
    DELETE_MEDICATION = "delete_medication"
    LIST_MEDICATIONS = "list_medications"
    GENERAL_QUERY = "general_query"
    UNKNOWN = "unknown"


class MedicationFlowState(Enum):
    """States in the medication addition flow."""
    IDLE = "idle"
    AWAITING_NAME = "awaiting_name"
    AWAITING_FREQUENCY = "awaiting_frequency"
    AWAITING_DURATION = "awaiting_duration"
    AWAITING_TIMING = "awaiting_timing"
    AWAITING_DESCRIPTION = "awaiting_description"
    CONFIRMING = "confirming"
    # Update flow states
    AWAITING_MED_SELECTION = "awaiting_med_selection"
    AWAITING_UPDATE_FIELD = "awaiting_update_field"
    AWAITING_UPDATE_VALUE = "awaiting_update_value"
    # Delete flow states
    AWAITING_DELETE_CONFIRMATION = "awaiting_delete_confirmation"


class ConversationFlow:
    """Manages the conversation flow for medication operations."""
    
    # Keywords for intent detection
    ADD_KEYWORDS = ["add", "new", "create", "start", "set", "begin", "taking"]
    UPDATE_KEYWORDS = ["update", "edit", "change", "modify", "correct"]
    DELETE_KEYWORDS = ["delete", "remove", "stop", "cancel", "discontinue"]
    LIST_KEYWORDS = ["list", "show", "what", "medications", "meds", "taking"]
    MEDICATION_KEYWORDS = ["medication", "medicine", "drug", "pill", "tablet", "prescription"]
    
    def __init__(self):
        self.user_states: Dict[str, Dict[str, Any]] = {}
    
    def get_user_state(self, user_id: str) -> Dict[str, Any]:
        """Get or initialize user conversation state."""
        if user_id not in self.user_states:
            self.user_states[user_id] = {
                "flow_state": MedicationFlowState.IDLE,
                "current_medication": {},
                "selected_medication_id": None,
                "update_field": None
            }
        return self.user_states[user_id]
    
    def reset_user_state(self, user_id: str):
        """Reset user state to idle."""
        self.user_states[user_id] = {
            "flow_state": MedicationFlowState.IDLE,
            "current_medication": {},
            "selected_medication_id": None,
            "update_field": None
        }
    
    def detect_intent(self, message: str) -> ConversationIntent:
        """Detect the user's intent from their message."""
        message_lower = message.lower()
        
        has_medication_word = any(kw in message_lower for kw in self.MEDICATION_KEYWORDS)
        
        # Check for add intent
        if any(kw in message_lower for kw in self.ADD_KEYWORDS):
            if has_medication_word or "add" in message_lower:
                return ConversationIntent.ADD_MEDICATION
        
        # Check for update intent
        if any(kw in message_lower for kw in self.UPDATE_KEYWORDS):
            if has_medication_word:
                return ConversationIntent.UPDATE_MEDICATION
        
        # Check for delete intent
        if any(kw in message_lower for kw in self.DELETE_KEYWORDS):
            if has_medication_word:
                return ConversationIntent.DELETE_MEDICATION
        
        # Check for list intent
        if any(kw in message_lower for kw in self.LIST_KEYWORDS):
            if has_medication_word or "taking" in message_lower:
                return ConversationIntent.LIST_MEDICATIONS
        
        return ConversationIntent.GENERAL_QUERY
    
    def get_add_flow_question(self, state: MedicationFlowState) -> Tuple[str, MedicationFlowState]:
        """Get the next question in the add medication flow."""
        questions = {
            MedicationFlowState.IDLE: (
                "I'll help you add a new medication. What's the **name** of the medication?",
                MedicationFlowState.AWAITING_NAME
            ),
            MedicationFlowState.AWAITING_NAME: (
                "How many **times per day** should you take this medication? (e.g., 1, 2, 3)",
                MedicationFlowState.AWAITING_FREQUENCY
            ),
            MedicationFlowState.AWAITING_FREQUENCY: (
                "For how long should you take it? (e.g., '7 days', '2 weeks', '1 month')",
                MedicationFlowState.AWAITING_DURATION
            ),
            MedicationFlowState.AWAITING_DURATION: (
                "When should you take it? (e.g., 'before breakfast', 'after dinner', 'with meals')",
                MedicationFlowState.AWAITING_TIMING
            ),
            MedicationFlowState.AWAITING_TIMING: (
                "Any brief description or notes about this medication? (or type 'skip' to skip)",
                MedicationFlowState.AWAITING_DESCRIPTION
            ),
        }
        return questions.get(state, ("", MedicationFlowState.IDLE))
    
    def process_add_response(
        self,
        user_id: str,
        message: str,
        current_state: Dict[str, Any]
    ) -> Tuple[str, bool, Dict[str, Any]]:
        """
        Process user response in add medication flow.
        Returns: (response_message, is_complete, medication_data)
        """
        flow_state = current_state["flow_state"]
        medication = current_state.get("current_medication", {})
        
        if flow_state == MedicationFlowState.AWAITING_NAME:
            medication["name"] = message.strip()
            question, next_state = self.get_add_flow_question(MedicationFlowState.AWAITING_NAME)
            current_state["flow_state"] = next_state
            current_state["current_medication"] = medication
            return question, False, {}
        
        elif flow_state == MedicationFlowState.AWAITING_FREQUENCY:
            # Try to extract number
            try:
                freq = int(''.join(filter(str.isdigit, message)) or "1")
            except ValueError:
                freq = 1
            medication["frequency"] = freq
            question, next_state = self.get_add_flow_question(MedicationFlowState.AWAITING_FREQUENCY)
            current_state["flow_state"] = next_state
            current_state["current_medication"] = medication
            return question, False, {}
        
        elif flow_state == MedicationFlowState.AWAITING_DURATION:
            medication["duration"] = message.strip()
            question, next_state = self.get_add_flow_question(MedicationFlowState.AWAITING_DURATION)
            current_state["flow_state"] = next_state
            current_state["current_medication"] = medication
            return question, False, {}
        
        elif flow_state == MedicationFlowState.AWAITING_TIMING:
            medication["timing"] = message.strip()
            question, next_state = self.get_add_flow_question(MedicationFlowState.AWAITING_TIMING)
            current_state["flow_state"] = next_state
            current_state["current_medication"] = medication
            return question, False, {}
        
        elif flow_state == MedicationFlowState.AWAITING_DESCRIPTION:
            if message.lower().strip() != "skip":
                medication["description"] = message.strip()
            else:
                medication["description"] = ""
            
            # Flow complete - return medication data
            current_state["flow_state"] = MedicationFlowState.IDLE
            current_state["current_medication"] = {}
            
            return "", True, medication
        
        return "", False, {}
    
    def format_medication_confirmation(self, medication: Dict[str, Any]) -> str:
        """Format a confirmation message for added medication."""
        freq = medication.get('frequency', 1)
        times_word = "time" if freq == 1 else "times"
        
        msg = f"✅ **Medication Added Successfully!**\n\n"
        msg += f"**{medication.get('name', 'Unknown')}**\n"
        msg += f"• Frequency: {freq} {times_word} daily\n"
        msg += f"• Duration: {medication.get('duration', 'Not specified')}\n"
        msg += f"• Timing: {medication.get('timing', 'Not specified')}\n"
        
        if medication.get('description'):
            msg += f"• Notes: {medication.get('description')}\n"
        
        msg += "\nIs there anything else you'd like help with?"
        return msg


# Global flow manager
_flow_manager: Optional[ConversationFlow] = None


def get_flow_manager() -> ConversationFlow:
    """Get or create the global conversation flow manager."""
    global _flow_manager
    if _flow_manager is None:
        _flow_manager = ConversationFlow()
    return _flow_manager
