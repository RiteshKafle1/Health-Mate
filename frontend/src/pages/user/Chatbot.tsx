import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Plus, Trash2, History, X, Bot, User, Loader2 } from 'lucide-react';
import {
    sendChatMessage,
    getChatSessions,
    createNewSession,
    deleteSession,
    loadSession,
    type ChatMessage,
    type ChatSession
} from '../../api/chatbot';
import toast from 'react-hot-toast';

export function Chatbot() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [showSidebar, setShowSidebar] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        // Load sessions on mount
        loadSessions();
    }, []);

    const loadSessions = async () => {
        try {
            const response = await getChatSessions();
            if (response.success) {
                setSessions(response.sessions);
            }
        } catch (error) {
            console.error('Failed to load sessions:', error);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputMessage.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            role: 'user',
            content: inputMessage.trim(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true);

        try {
            const response = await sendChatMessage(userMessage.content, sessionId || undefined);

            if (response.success) {
                const assistantMessage: ChatMessage = {
                    role: 'assistant',
                    content: response.response,
                    source: response.source,
                    timestamp: response.timestamp
                };
                setMessages(prev => [...prev, assistantMessage]);

                if (response.session_id && !sessionId) {
                    setSessionId(response.session_id);
                }

                // Refresh sessions list
                loadSessions();
            } else {
                toast.error('Failed to get response');
            }
        } catch (error) {
            console.error('Chat error:', error);
            toast.error('Failed to send message. Please try again.');
            // Remove the user message if failed
            setMessages(prev => prev.slice(0, -1));
        } finally {
            setIsLoading(false);
        }
    };

    const handleNewChat = async () => {
        try {
            const response = await createNewSession();
            if (response.success) {
                setSessionId(response.session_id);
                setMessages([]);
                toast.success('New chat started');
                loadSessions();
            }
        } catch (error) {
            toast.error('Failed to create new chat');
        }
    };

    const handleLoadSession = async (session: ChatSession) => {
        try {
            const response = await loadSession(session.session_id);
            if (response.success) {
                setSessionId(session.session_id);
                setMessages(response.messages);
                setShowSidebar(false);
                toast.success('Session loaded');
            }
        } catch (error) {
            toast.error('Failed to load session');
        }
    };

    const handleDeleteSession = async (sessionIdToDelete: string) => {
        try {
            const response = await deleteSession(sessionIdToDelete);
            if (response.success) {
                if (sessionId === sessionIdToDelete) {
                    setSessionId(null);
                    setMessages([]);
                }
                loadSessions();
                toast.success('Session deleted');
            }
        } catch (error) {
            toast.error('Failed to delete session');
        }
    };

    return (
        <div className="h-[calc(100vh-120px)] flex bg-slate-900 rounded-xl overflow-hidden border border-slate-700/50">
            {/* Sidebar for sessions */}
            <div className={`${showSidebar ? 'w-72' : 'w-0'} transition-all duration-300 bg-slate-800/50 border-r border-slate-700/50 overflow-hidden`}>
                <div className="p-4 border-b border-slate-700/50">
                    <div className="flex items-center justify-between">
                        <h3 className="text-white font-semibold flex items-center gap-2">
                            <History className="w-4 h-4" />
                            Chat History
                        </h3>
                        <button onClick={() => setShowSidebar(false)} className="text-slate-400 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="p-2 space-y-2 overflow-y-auto h-[calc(100%-60px)]">
                    {sessions.map((session) => (
                        <div
                            key={session.session_id}
                            className={`p-3 rounded-lg cursor-pointer group transition-colors ${sessionId === session.session_id
                                ? 'bg-emerald-500/20 border border-emerald-500/30'
                                : 'bg-slate-700/30 hover:bg-slate-700/50'
                                }`}
                        >
                            <div className="flex justify-between items-start">
                                <div
                                    className="flex-1 min-w-0"
                                    onClick={() => handleLoadSession(session)}
                                >
                                    <p className="text-sm text-white truncate">
                                        {session.preview || 'New conversation'}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {session.last_active ? new Date(session.last_active).toLocaleDateString() : ''}
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSession(session.session_id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition-opacity"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {sessions.length === 0 && (
                        <p className="text-slate-500 text-sm text-center py-4">No chat history yet</p>
                    )}
                </div>
            </div>

            {/* Main chat area */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-700/50 bg-slate-800/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowSidebar(!showSidebar)}
                                className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            >
                                <History className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-white font-semibold">HealthMate Clinician</h2>
                                    <p className="text-xs text-slate-400">AI Medical Assistant</p>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleNewChat}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            New Chat
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <div className="p-4 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-600/20 mb-4">
                                <MessageCircle className="w-12 h-12 text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">Welcome to HealthMate Clinician</h3>
                            <p className="text-slate-400 max-w-md">
                                Your AI-powered medical assistant. Ask me anything about health, symptoms,
                                medications, or general wellness advice.
                            </p>
                            <div className="mt-6 grid grid-cols-2 gap-3 max-w-lg">
                                {[
                                    'What are symptoms of flu?',
                                    'How to reduce fever naturally?',
                                    'Tips for better sleep',
                                    'Common cold remedies'
                                ].map((suggestion, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setInputMessage(suggestion)}
                                        className="p-3 text-sm text-left rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((message, index) => (
                        <div
                            key={index}
                            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {message.role === 'assistant' && (
                                <div className="p-2 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 h-fit">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                            )}
                            <div
                                className={`max-w-[70%] rounded-2xl p-4 ${message.role === 'user'
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-slate-800 text-slate-200 border border-slate-700/50'
                                    }`}
                            >
                                <p className="whitespace-pre-wrap">{message.content}</p>
                                <div className={`flex items-center gap-2 mt-2 text-xs ${message.role === 'user' ? 'text-emerald-200' : 'text-slate-500'
                                    }`}>
                                    {message.timestamp && <span>{message.timestamp}</span>}
                                    {message.source && message.role === 'assistant' && (
                                        <>
                                            <span>•</span>
                                            <span>{message.source}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            {message.role === 'user' && (
                                <div className="p-2 rounded-full bg-slate-700 h-fit">
                                    <User className="w-4 h-4 text-slate-300" />
                                </div>
                            )}
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex gap-3 justify-start">
                            <div className="p-2 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 h-fit">
                                <Bot className="w-4 h-4 text-white" />
                            </div>
                            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700/50">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Thinking...</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-700/50 bg-slate-800/30">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            placeholder="Ask about health, symptoms, medications..."
                            className="flex-1 px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={!inputMessage.trim() || isLoading}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 text-center">
                        HealthMate Clinician provides general health information only. Please consult a healthcare professional for medical advice.
                    </p>
                </form>
            </div>
        </div>
    );
}
