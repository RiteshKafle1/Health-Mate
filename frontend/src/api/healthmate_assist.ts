import api from './api';

// HealthMate Assist types
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
}

export interface ChatResponse {
    response: string;
    source: string;
    timestamp: string;
    success: boolean;
    session_id: string;
    is_medication_flow?: boolean;
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

// HealthMate Assist API (uses /api/user/healthmate-assist endpoints)

// Send a message to HealthMate Assist
export const sendMessage = async (message: string, sessionId?: string): Promise<ChatResponse> => {
    const response = await api.post('/api/user/healthmate-assist/chat', {
        message,
        session_id: sessionId
    });
    return response.data;
};

// Get chat history for current session
export const getChatHistory = async (sessionId?: string): Promise<HistoryResponse> => {
    const params = sessionId ? { session_id: sessionId } : {};
    const response = await api.get('/api/user/healthmate-assist/history', { params });
    return response.data;
};

// Get all chat sessions
export const getChatSessions = async (): Promise<SessionListResponse> => {
    const response = await api.get('/api/user/healthmate-assist/sessions');
    return response.data;
};

// Load a specific session
export const loadSession = async (sessionId: string): Promise<HistoryResponse & { session_id: string }> => {
    const response = await api.get(`/api/user/healthmate-assist/sessions/${sessionId}`);
    return response.data;
};

// Delete a session
export const deleteSession = async (sessionId: string): Promise<{ message: string; success: boolean }> => {
    const response = await api.delete(`/api/user/healthmate-assist/sessions/${sessionId}`);
    return response.data;
};

// Create a new chat session
export const createNewSession = async (): Promise<{ message: string; session_id: string; success: boolean }> => {
    const response = await api.post('/api/user/healthmate-assist/new');
    return response.data;
};

// Check HealthMate Assist health
export const getHealth = async (): Promise<{ status: string; service: string }> => {
    const response = await api.get('/api/user/healthmate-assist/health');
    return response.data;
};
