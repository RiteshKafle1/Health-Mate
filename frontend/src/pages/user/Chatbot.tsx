import { useState, useRef, useEffect } from 'react';
import { Send, Plus, Trash2, History, X, Bot, User, Loader2, Activity, Zap, Sparkles } from 'lucide-react';
import {
    sendChatMessage,
    sendChatMessageStream,
    getChatSessions,
    createNewSession,
    deleteSession,
    loadSession,
    type ChatMessage,
    type ChatSession
} from '../../api/chatbot';
import { SymptomChecker } from '../../components/SymptomChecker';
import toast from 'react-hot-toast';

export function Chatbot() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [showSidebar, setShowSidebar] = useState(false);
    const [symptomCheckerMode, setSymptomCheckerMode] = useState(false);
    const [useStreaming, setUseStreaming] = useState(true); // Enable streaming by default
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
        if (!inputMessage.trim() || isLoading || isStreaming) return;

        const userMessage: ChatMessage = {
            role: 'user',
            content: inputMessage.trim(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');

        // Use streaming mode if enabled
        if (useStreaming) {
            setIsStreaming(true);

            // Add empty assistant message that will be filled progressively
            const streamingMessage: ChatMessage = {
                role: 'assistant',
                content: '',
                source: 'Loading...',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, streamingMessage]);

            await sendChatMessageStream(
                userMessage.content,
                {
                    onToken: (token) => {
                        // Append token to the last message (assistant streaming message)
                        setMessages(prev => {
                            const updated = [...prev];
                            const lastIdx = updated.length - 1;
                            if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                                updated[lastIdx] = {
                                    ...updated[lastIdx],
                                    content: updated[lastIdx].content + token
                                };
                            }
                            return updated;
                        });
                    },
                    onSource: (source) => {
                        setMessages(prev => {
                            const updated = [...prev];
                            const lastIdx = updated.length - 1;
                            if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                                updated[lastIdx] = { ...updated[lastIdx], source };
                            }
                            return updated;
                        });
                    },
                    onSessionId: (newSessionId) => {
                        if (!sessionId) {
                            setSessionId(newSessionId);
                        }
                    },
                    onComplete: () => {
                        setIsStreaming(false);
                        loadSessions();
                    },
                    onError: (error) => {
                        console.error('Stream error:', error);
                        toast.error('Streaming failed. Please try again.');
                        setIsStreaming(false);
                        // Remove the incomplete assistant message
                        setMessages(prev => prev.slice(0, -1));
                    }
                },
                sessionId || undefined
            );
        } else {
            // Non-streaming mode (original behavior)
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
        <div className="h-[calc(100vh-120px)] flex bg-white/50 backdrop-blur-sm rounded-2xl overflow-hidden shadow-card border border-surface/50">
            {/* Sidebar for sessions */}
            <div className={`${showSidebar ? 'w-80' : 'w-0'} transition-all duration-300 bg-white/80 border-r border-indigo-50 overflow-hidden flex flex-col`}>
                <div className="p-5 border-b border-indigo-50 bg-white/50">
                    <div className="flex items-center justify-between">
                        <h3 className="text-text font-semibold flex items-center gap-2">
                            <History className="w-4 h-4 text-primary" />
                            Chat History
                        </h3>
                        <button onClick={() => setShowSidebar(false)} className="text-text-muted hover:text-primary transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="p-2 space-y-2 overflow-y-auto h-[calc(100%-60px)]">
                    {sessions.map((session) => (
                        <div
                            key={session.session_id}
                            className={`p-3 rounded-xl cursor-pointer group transition-all duration-200 border ${sessionId === session.session_id
                                ? 'bg-primary/5 border-primary/20 shadow-sm'
                                : 'bg-transparent border-transparent hover:bg-white hover:shadow-sm hover:border-surface'
                                }`}
                        >
                            <div className="flex justify-between items-start">
                                <div
                                    className="flex-1 min-w-0"
                                    onClick={() => handleLoadSession(session)}
                                >
                                    <p className={`text-sm font-medium truncate ${sessionId === session.session_id ? 'text-primary' : 'text-text'}`}>
                                        {session.preview || 'New conversation'}
                                    </p>
                                    <p className="text-xs text-text-muted/70 mt-1">
                                        {session.last_active ? new Date(session.last_active).toLocaleDateString() : ''}
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSession(session.session_id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-error hover:bg-error-bg rounded-lg transition-all"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {sessions.length === 0 && (
                        <div className="text-center py-8">
                            <div className="w-12 h-12 bg-surface/50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <History className="w-5 h-5 text-text-muted/50" />
                            </div>
                            <p className="text-text-muted text-sm">No chat history yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Main chat area */}
            <div className="flex-1 flex flex-col bg-slate-50/50">
                {/* Header */}
                <div className="p-4 border-b border-indigo-50 bg-white/80 backdrop-blur-sm z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowSidebar(!showSidebar)}
                                className="p-2 rounded-xl bg-surface hover:bg-white hover:shadow-soft text-text-muted hover:text-primary transition-all duration-200"
                            >
                                <History className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl shadow-soft ${symptomCheckerMode ? 'bg-gradient-to-br from-purple-500 to-purple-600' : 'bg-gradient-to-br from-primary to-primary-hover'}`}>
                                    {symptomCheckerMode ? <Activity className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                                </div>
                                <div>
                                    <h2 className="text-text font-bold text-lg leading-tight">
                                        {symptomCheckerMode ? 'Symptom Checker' : 'HealthMate'}
                                        <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">Clinician</span>
                                    </h2>
                                    <p className="text-xs text-text-muted font-medium">
                                        {symptomCheckerMode ? 'Guided Assessment' : 'AI Medical Assistant'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Streaming Toggle */}
                            <button
                                onClick={() => setUseStreaming(!useStreaming)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all font-medium text-sm ${useStreaming
                                    ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                    : 'bg-surface text-text-muted hover:bg-white hover:shadow-sm'
                                    }`}
                                title={useStreaming ? 'Streaming enabled - see responses in real-time' : 'Streaming disabled'}
                            >
                                <Zap className="w-4 h-4" />
                            </button>
                            {/* Symptom Checker Toggle */}
                            <button
                                onClick={() => setSymptomCheckerMode(!symptomCheckerMode)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium text-sm shadow-sm ${symptomCheckerMode
                                    ? 'bg-purple-50 text-purple-600 border border-purple-200'
                                    : 'bg-surface text-text-muted hover:bg-white hover:text-primary hover:shadow-md'
                                    }`}
                            >
                                <Activity className="w-4 h-4" />
                                Symptom Checker
                            </button>
                            <button
                                onClick={handleNewChat}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-medium hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/20 transition-all text-sm shadow-md"
                            >
                                <Plus className="w-4 h-4" />
                                New Chat
                            </button>
                        </div>
                    </div>
                </div>

                {/* Conditional Content: Symptom Checker or Normal Chat */}
                {symptomCheckerMode ? (
                    <SymptomChecker
                        sessionId={sessionId}
                        onSessionUpdate={(id) => {
                            setSessionId(id);
                            loadSessions();
                        }}
                        onClose={() => setSymptomCheckerMode(false)}
                    />
                ) : (
                    <>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {messages.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                    <div className="relative mb-6">
                                        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full"></div>
                                        <div className="relative p-5 rounded-2xl bg-white shadow-soft ring-1 ring-primary/10">
                                            <Sparkles className="w-10 h-10 text-primary" />
                                        </div>
                                    </div>
                                    <h3 className="text-2xl font-bold text-text mb-3">Welcome to HealthMate</h3>
                                    <p className="text-text-muted max-w-md leading-relaxed">
                                        Your advanced AI clinician assistant. Ask about symptoms,
                                        medications, or general wellness advice with confidence.
                                    </p>
                                    <div className="mt-8 grid grid-cols-2 gap-3 max-w-lg w-full">
                                        {[
                                            'What are symptoms of flu?',
                                            'How to reduce fever naturally?',
                                            'Tips for better sleep',
                                            'Common cold remedies'
                                        ].map((suggestion, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setInputMessage(suggestion)}
                                                className="p-4 text-sm text-left rounded-xl bg-white border border-surface/50 text-text-muted hover:border-primary/30 hover:text-primary hover:shadow-soft transition-all duration-200 group"
                                            >
                                                <span className="font-medium group-hover:underline decoration-primary/30 underline-offset-4">{suggestion}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {messages.map((message, index) => (
                                <div
                                    key={index}
                                    className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start max-w-4xl'}`}
                                >
                                    {message.role === 'assistant' && (
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center shadow-md mt-1">
                                            <Bot className="w-4 h-4 text-white" />
                                        </div>
                                    )}
                                    <div
                                        className={`rounded-2xl p-5 shadow-sm leading-relaxed text-sm md:text-base ${message.role === 'user'
                                            ? 'bg-primary text-white rounded-tr-none'
                                            : 'bg-white text-text border border-surface/50 rounded-tl-none shadow-card'
                                            }`}
                                    >
                                        <p className="whitespace-pre-wrap">{message.content}</p>
                                        <div className={`flex items-center gap-2 mt-2.5 text-xs font-medium ${message.role === 'user' ? 'text-white/70' : 'text-text-muted/60'
                                            }`}>
                                            {message.timestamp && <span>{message.timestamp}</span>}
                                            {message.source && message.role === 'assistant' && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-current opacity-50"></span>
                                                    <span>{message.source}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {message.role === 'user' && (
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm mt-1">
                                            <User className="w-4 h-4 text-primary" />
                                        </div>
                                    )}
                                </div>
                            ))}

                            {isLoading && (
                                <div className="flex gap-4 justify-start">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center shadow-md">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="bg-white rounded-2xl rounded-tl-none p-4 border border-surface/50 shadow-card">
                                        <div className="flex items-center gap-3 text-text-muted">
                                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                            <span className="text-sm font-medium">Thinking...</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSendMessage} className="p-4 bg-white/80 backdrop-blur-md border-t border-indigo-50 z-10">
                            <div className="max-w-4xl mx-auto">
                                <div className="flex gap-3 items-end">
                                    <div className="flex-1 relative group">
                                        <input
                                            type="text"
                                            value={inputMessage}
                                            onChange={(e) => setInputMessage(e.target.value)}
                                            placeholder="Ask about health, symptoms, medications..."
                                            className="w-full px-5 py-3.5 rounded-2xl bg-surface/30 border border-surface text-text placeholder-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-inner transition-all duration-200"
                                            disabled={isLoading}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!inputMessage.trim() || isLoading}
                                        className="mb-[1px] px-5 py-3.5 rounded-2xl bg-primary text-white font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center gap-2"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                                <p className="text-[11px] text-text-muted/60 mt-3 text-center font-medium">
                                    HealthMate Clinician provides general health information only. Please consult a healthcare professional for medical advice.
                                </p>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
