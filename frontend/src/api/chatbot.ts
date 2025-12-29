import api from './api';

// Chatbot types
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
    // Symptom Checker Mode fields
    is_follow_up?: boolean;
    options?: string[];
    symptom_step?: number;
    total_steps?: number;
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

// Send a message to the chatbot
export const sendChatMessage = async (
    message: string,
    sessionId?: string,
    symptomCheckerMode: boolean = false,
    selectedOption?: string
): Promise<ChatResponse> => {
    const response = await api.post('/api/user/chatbot/chat', {
        message,
        session_id: sessionId,
        symptom_checker_mode: symptomCheckerMode,
        selected_option: selectedOption
    });
    return response.data;
};

// Streaming message handler type
export interface StreamCallbacks {
    onToken: (token: string) => void;
    onSource: (source: string) => void;
    onSessionId: (sessionId: string) => void;
    onComplete: (source: string) => void;
    onError: (error: string) => void;
}

// API base URL (same as axios config)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Send a message with streaming response
export const sendChatMessageStream = async (
    message: string,
    callbacks: StreamCallbacks,
    sessionId?: string
): Promise<void> => {
    // Get token based on role (same logic as axios interceptor)
    const role = localStorage.getItem('role');
    let token = '';
    if (role === 'user') {
        token = localStorage.getItem('token') || '';
    } else if (role === 'doctor') {
        token = localStorage.getItem('dtoken') || '';
    } else if (role === 'admin') {
        token = localStorage.getItem('atoken') || '';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/user/chatbot/chat/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': token
            },
            body: JSON.stringify({
                message,
                session_id: sessionId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
            throw new Error('No response body');
        }

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);

                    if (data === '[DONE]') {
                        return;
                    }

                    try {
                        const parsed = JSON.parse(data);

                        if (parsed.type === 'token') {
                            callbacks.onToken(parsed.content);
                        } else if (parsed.type === 'source') {
                            callbacks.onSource(parsed.source);
                        } else if (parsed.type === 'session') {
                            callbacks.onSessionId(parsed.session_id);
                        } else if (parsed.type === 'done') {
                            callbacks.onComplete(parsed.source);
                        } else if (parsed.error) {
                            callbacks.onError(parsed.error);
                        }
                    } catch {
                        // Skip non-JSON lines
                    }
                }
            }
        }
    } catch (error) {
        callbacks.onError(error instanceof Error ? error.message : 'Stream failed');
    }
};


// Get chat history for current session
export const getChatHistory = async (sessionId?: string): Promise<HistoryResponse> => {
    const params = sessionId ? { session_id: sessionId } : {};
    const response = await api.get('/api/user/chatbot/history', { params });
    return response.data;
};

// Get all user's chat sessions
export const getChatSessions = async (): Promise<SessionListResponse> => {
    const response = await api.get('/api/user/chatbot/sessions');
    return response.data;
};

// Load a specific session
export const loadSession = async (sessionId: string): Promise<HistoryResponse & { session_id: string }> => {
    const response = await api.get(`/api/user/chatbot/sessions/${sessionId}`);
    return response.data;
};

// Delete a session
export const deleteSession = async (sessionId: string): Promise<{ message: string; success: boolean }> => {
    const response = await api.delete(`/api/user/chatbot/sessions/${sessionId}`);
    return response.data;
};

// Create a new chat session
export const createNewSession = async (): Promise<{ message: string; session_id: string; success: boolean }> => {
    const response = await api.post('/api/user/chatbot/new');
    return response.data;
};

// Clear conversation memory
export const clearConversation = async (): Promise<{ message: string; success: boolean }> => {
    const response = await api.post('/api/user/chatbot/clear');
    return response.data;
};

// Check chatbot health
export const getChatbotHealth = async (): Promise<{ status: string; service: string }> => {
    const response = await api.get('/api/user/chatbot/health');
    return response.data;
};
