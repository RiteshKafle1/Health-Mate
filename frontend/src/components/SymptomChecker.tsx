import { useState, useRef, useEffect } from 'react';
import { Activity, Send, Bot, User, Loader2, ArrowLeft, ChevronRight, Stethoscope } from 'lucide-react';
import { OptionChip } from './OptionChip';
import { sendChatMessage, type ChatMessage } from '../api/chatbot';
import toast from 'react-hot-toast';

interface SymptomCheckerProps {
    sessionId: string | null;
    onSessionUpdate: (sessionId: string) => void;
    onClose: () => void;
}

interface SymptomMessage extends ChatMessage {
    isFollowUp?: boolean;
    options?: string[];
}

export function SymptomChecker({ sessionId, onSessionUpdate, onClose }: SymptomCheckerProps) {
    const [messages, setMessages] = useState<SymptomMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [totalSteps, setTotalSteps] = useState(5);
    const [currentOptions, setCurrentOptions] = useState<string[]>([]);
    const [hasStarted, setHasStarted] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const startSymptomChecker = async () => {
        setHasStarted(true);
        setIsLoading(true);

        try {
            // Send initial request to start symptom checker
            const response = await sendChatMessage(
                'Start symptom assessment',
                sessionId || undefined,
                true, // symptomCheckerMode
                undefined
            );

            if (response.success) {
                if (response.session_id && !sessionId) {
                    onSessionUpdate(response.session_id);
                }

                const assistantMessage: SymptomMessage = {
                    role: 'assistant',
                    content: response.response,
                    source: response.source,
                    timestamp: response.timestamp,
                    isFollowUp: response.is_follow_up,
                    options: response.options
                };

                setMessages([assistantMessage]);
                setCurrentOptions(response.options || []);
                setCurrentStep(response.symptom_step || 1);
                setTotalSteps(response.total_steps || 5);
            }
        } catch (error) {
            console.error('Failed to start symptom checker:', error);
            toast.error('Failed to start symptom checker');
            setHasStarted(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOptionSelect = async (option: string) => {
        if (isLoading) return;

        // Add user message
        const userMessage: SymptomMessage = {
            role: 'user',
            content: option,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        setCurrentOptions([]);

        try {
            const response = await sendChatMessage(
                option,
                sessionId || undefined,
                true, // symptomCheckerMode
                option // selectedOption
            );

            if (response.success) {
                if (response.session_id && !sessionId) {
                    onSessionUpdate(response.session_id);
                }

                const assistantMessage: SymptomMessage = {
                    role: 'assistant',
                    content: response.response,
                    source: response.source,
                    timestamp: response.timestamp,
                    isFollowUp: response.is_follow_up,
                    options: response.options
                };

                setMessages(prev => [...prev, assistantMessage]);

                if (response.is_follow_up) {
                    setCurrentOptions(response.options || []);
                    setCurrentStep(response.symptom_step || currentStep + 1);
                    setTotalSteps(response.total_steps || 5);
                } else {
                    // Symptom collection complete - show final response
                    setCurrentOptions([]);
                    setCurrentStep(totalSteps);
                }
            }
        } catch (error) {
            console.error('Failed to send option:', error);
            toast.error('Failed to process selection');
            setMessages(prev => prev.slice(0, -1));
        } finally {
            setIsLoading(false);
        }
    };

    const handleCustomInput = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputMessage.trim() || isLoading) return;

        await handleOptionSelect(inputMessage.trim());
        setInputMessage('');
    };

    const progressPercentage = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

    // Welcome screen before starting
    if (!hasStarted) {
        return (
            <div className="h-full flex flex-col bg-white/50 backdrop-blur-sm">
                {/* Header */}
                <div className="p-5 border-b border-purple-100 bg-white/80 z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClose}
                                className="p-2 rounded-xl bg-surface hover:bg-white hover:text-primary transition-all shadow-sm"
                            >
                                <ArrowLeft className="w-5 h-5 text-text-muted" />
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-purple-100 text-purple-600">
                                    <Activity className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-text font-bold text-lg">Symptom Checker</h2>
                                    <p className="text-xs text-text-muted font-medium">Guided Health Assessment</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Welcome Content */}
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
                    <div className="p-6 rounded-full bg-purple-50 text-purple-500 mb-6 shadow-soft ring-4 ring-purple-50/50">
                        <Stethoscope className="w-16 h-16" />
                    </div>
                    <h3 className="text-2xl font-bold text-text mb-3">
                        Let's Assess Your Symptoms
                    </h3>
                    <p className="text-text-muted max-w-md mb-8 leading-relaxed">
                        Answer a few quick questions about how you're feeling.
                        We'll guide you through 5 simple steps to understand your symptoms better.
                    </p>

                    <div className="grid grid-cols-5 gap-3 mb-10 max-w-md w-full">
                        {[1, 2, 3, 4, 5].map((step) => (
                            <div key={step} className="flex flex-col items-center group">
                                <div className="w-10 h-10 rounded-full bg-whitetext-text-muted border-2 border-surface flex items-center justify-center text-sm font-semibold shadow-sm group-hover:border-purple-200 group-hover:text-purple-600 transition-colors bg-white">
                                    {step}
                                </div>
                                <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted mt-2 group-hover:text-purple-600 transition-colors">
                                    {['Area', 'Scale', 'Time', 'Link', 'Ctx'][step - 1]}
                                </span>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={startSymptomChecker}
                        className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-purple-600 text-white font-semibold hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all"
                    >
                        <Activity className="w-5 h-5" />
                        Start Assessment
                        <ChevronRight className="w-5 h-5" />
                    </button>

                    <p className="text-xs text-text-muted/60 mt-8 max-w-sm font-medium">
                        This tool provides general health information only.
                        Please consult a healthcare professional for medical advice.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-50/50">
            {/* Header with Progress */}
            <div className="p-5 border-b border-purple-100 bg-white/80 backdrop-blur-md z-10 transition-all">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-surface hover:bg-white hover:text-purple-600 text-text-muted transition-all shadow-sm"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-purple-100 text-purple-600">
                                <Activity className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-text font-bold text-lg leading-tight">Symptom Checker</h2>
                                <p className="text-xs text-text-muted font-medium">
                                    Step <span className="text-purple-600 font-bold">{currentStep}</span> of {totalSteps}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-purple-50 text-xs font-bold text-purple-600 border border-purple-100">
                        {Math.round(progressPercentage)}% Complete
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-purple-50 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-purple-500 to-purple-600 shadow-sm transition-all duration-500 ease-out rounded-full"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((message, index) => (
                    <div
                        key={index}
                        className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start max-w-4xl'}`}
                    >
                        {message.role === 'assistant' && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shadow-sm mt-1 text-purple-600 border border-purple-200">
                                <Bot className="w-4 h-4" />
                            </div>
                        )}
                        <div
                            className={`rounded-2xl p-5 shadow-sm leading-relaxed text-sm md:text-base ${message.role === 'user'
                                ? 'bg-purple-600 text-white rounded-tr-none shadow-md'
                                : message.isFollowUp
                                    ? 'bg-purple-50/80 text-text border-2 border-purple-200 rounded-tl-none'
                                    : 'bg-white text-text border border-surface/50 rounded-tl-none shadow-card'
                                }`}
                        >
                            {message.isFollowUp && (
                                <div className="flex items-center gap-2 text-purple-600 text-xs font-bold uppercase tracking-wider mb-2">
                                    <Activity className="w-3 h-3" />
                                    FOLLOW-UP QUESTION
                                </div>
                            )}
                            <p className="whitespace-pre-wrap">{message.content}</p>
                            <div className={`flex items-center gap-2 mt-2.5 text-xs font-medium ${message.role === 'user' ? 'text-purple-200' : 'text-text-muted/60'
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
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shadow-sm mt-1 text-purple-600 border border-purple-200">
                            <Bot className="w-4 h-4" />
                        </div>
                        <div className="bg-white rounded-2xl rounded-tl-none p-4 border border-surface/50 shadow-card">
                            <div className="flex items-center gap-3 text-text-muted">
                                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                                <span className="text-sm font-medium">Analyzing symptoms...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Options or Input */}
            <div className="p-5 border-t border-purple-100 bg-white/80 backdrop-blur-md z-10">
                <div className="max-w-4xl mx-auto">
                    {currentOptions.length > 0 ? (
                        <div className="space-y-4">
                            <p className="text-sm font-medium text-text-muted">Select an option or type your own:</p>
                            <div className="grid grid-cols-2 gap-3">
                                {currentOptions.map((option, index) => (
                                    <OptionChip
                                        key={index}
                                        label={option}
                                        onClick={() => handleOptionSelect(option)}
                                        disabled={isLoading}
                                    />
                                ))}
                            </div>
                            <form onSubmit={handleCustomInput} className="flex gap-3 mt-4 pt-4 border-t border-dashed border-surface">
                                <input
                                    type="text"
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    placeholder="Or type your own response..."
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-surface/50 border border-surface text-text placeholder-text-muted/60 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 shadow-inner text-sm transition-all"
                                    disabled={isLoading}
                                />
                                <button
                                    type="submit"
                                    disabled={!inputMessage.trim() || isLoading}
                                    className="px-4 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </form>
                        </div>
                    ) : !isLoading && currentStep >= totalSteps ? (
                        <div className="text-center py-6">
                            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Activity className="w-6 h-6 text-green-600" />
                            </div>
                            <p className="text-text font-medium mb-4">Assessment complete!</p>
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 rounded-xl bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
                            >
                                Back to Chat
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleCustomInput} className="flex gap-3">
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                placeholder="Describe your symptoms..."
                                className="flex-1 px-5 py-3.5 rounded-xl bg-surface/30 border border-surface text-text placeholder-text-muted/60 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 shadow-inner transition-all"
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                disabled={!inputMessage.trim() || isLoading}
                                className="px-6 py-3.5 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
