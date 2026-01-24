import api from '../core';

// Chatbot types (same as user chatbot)
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    source?: string;
    timestamp?: string;
}

export interface ChatResponse {
    response: string;
    source: string;
    timestamp: string;
    success: boolean;
    session_id: string;
}

export interface ChatSession {
    session_id: string;
    created_at?: string;
    last_active?: string;
    preview?: string;
}

export interface SessionListResponse {
    sessions: ChatSession[];
    success: boolean;
}

export interface HistoryResponse {
    messages: ChatMessage[];
    success: boolean;
}

// Doctor Chatbot API (uses /api/doctor/chatbot endpoints)

// Send a message to the chatbot
export const sendChatMessage = async (message: string, sessionId?: string): Promise<ChatResponse> => {
    const response = await api.post('/api/doctor/chatbot/chat', {
        message,
        session_id: sessionId
    });
    return response.data;
};

// Get chat history for current session
export const getChatHistory = async (sessionId?: string): Promise<HistoryResponse> => {
    const params = sessionId ? { session_id: sessionId } : {};
    const response = await api.get('/api/doctor/chatbot/history', { params });
    return response.data;
};

// Get all doctor's chat sessions
export const getChatSessions = async (): Promise<SessionListResponse> => {
    const response = await api.get('/api/doctor/chatbot/sessions');
    return response.data;
};

// Load a specific session
export const loadSession = async (sessionId: string): Promise<HistoryResponse & { session_id: string }> => {
    const response = await api.get(`/api/doctor/chatbot/sessions/${sessionId}`);
    return response.data;
};

// Delete a session
export const deleteSession = async (sessionId: string): Promise<{ message: string; success: boolean }> => {
    const response = await api.delete(`/api/doctor/chatbot/sessions/${sessionId}`);
    return response.data;
};

// Create a new chat session
export const createNewSession = async (): Promise<{ message: string; session_id: string; success: boolean }> => {
    const response = await api.post('/api/doctor/chatbot/new');
    return response.data;
};

// Clear conversation memory
export const clearConversation = async (): Promise<{ message: string; success: boolean }> => {
    const response = await api.post('/api/doctor/chatbot/clear');
    return response.data;
};

// Check chatbot health
export const getChatbotHealth = async (): Promise<{ status: string; service: string }> => {
    const response = await api.get('/api/doctor/chatbot/health');
    return response.data;
};
