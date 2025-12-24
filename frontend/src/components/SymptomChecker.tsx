import { useState, useRef, useEffect } from 'react';
import { Activity, Send, Bot, User, Loader2, ArrowLeft, ChevronRight } from 'lucide-react';
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
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-700/50 bg-gradient-to-r from-purple-900/30 to-slate-800/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700">
                                    <Activity className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-white font-semibold">Symptom Checker</h2>
                                    <p className="text-xs text-slate-400">Guided Health Assessment</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Welcome Content */}
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <div className="p-6 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-700/20 mb-6">
                        <Activity className="w-16 h-16 text-purple-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">
                        Let's Assess Your Symptoms
                    </h3>
                    <p className="text-slate-400 max-w-md mb-8">
                        Answer a few quick questions about how you're feeling.
                        We'll guide you through 5 simple steps to understand your symptoms better.
                    </p>

                    <div className="grid grid-cols-5 gap-2 mb-8 max-w-sm w-full">
                        {[1, 2, 3, 4, 5].map((step) => (
                            <div key={step} className="flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-slate-700/50 border border-slate-600 flex items-center justify-center text-slate-400 text-sm font-medium">
                                    {step}
                                </div>
                                <span className="text-xs text-slate-500 mt-1">
                                    {['Area', 'Severity', 'Duration', 'Related', 'Context'][step - 1]}
                                </span>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={startSymptomChecker}
                        className="flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-purple-700 text-white font-semibold hover:from-purple-600 hover:to-purple-800 transition-all shadow-lg shadow-purple-500/30"
                    >
                        <Activity className="w-5 h-5" />
                        Start Assessment
                        <ChevronRight className="w-5 h-5" />
                    </button>

                    <p className="text-xs text-slate-500 mt-6 max-w-sm">
                        This tool provides general health information only.
                        Please consult a healthcare professional for medical advice.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header with Progress */}
            <div className="p-4 border-b border-slate-700/50 bg-gradient-to-r from-purple-900/30 to-slate-800/30">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700">
                                <Activity className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-white font-semibold">Symptom Checker</h2>
                                <p className="text-xs text-slate-400">
                                    Step {currentStep} of {totalSteps}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="text-sm text-purple-400 font-medium">
                        {Math.round(progressPercentage)}% Complete
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-500 ease-out"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message, index) => (
                    <div
                        key={index}
                        className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        {message.role === 'assistant' && (
                            <div className="p-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 h-fit">
                                <Bot className="w-4 h-4 text-white" />
                            </div>
                        )}
                        <div
                            className={`max-w-[80%] rounded-2xl p-4 ${message.role === 'user'
                                ? 'bg-purple-500 text-white'
                                : message.isFollowUp
                                    ? 'bg-gradient-to-br from-purple-900/50 to-slate-800 text-slate-200 border-2 border-purple-500/50'
                                    : 'bg-slate-800 text-slate-200 border border-slate-700/50'
                                }`}
                        >
                            {message.isFollowUp && (
                                <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold mb-2">
                                    <Activity className="w-3 h-3" />
                                    FOLLOW-UP QUESTION
                                </div>
                            )}
                            <p className="whitespace-pre-wrap">{message.content}</p>
                            <div className={`flex items-center gap-2 mt-2 text-xs ${message.role === 'user' ? 'text-purple-200' : 'text-slate-500'
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
                        <div className="p-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 h-fit">
                            <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700/50">
                            <div className="flex items-center gap-2 text-slate-400">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Analyzing...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Options or Input */}
            <div className="p-4 border-t border-slate-700/50 bg-slate-800/30">
                {currentOptions.length > 0 ? (
                    <div className="space-y-3">
                        <p className="text-sm text-slate-400 mb-3">Select an option or type your own:</p>
                        <div className="grid grid-cols-2 gap-2">
                            {currentOptions.map((option, index) => (
                                <OptionChip
                                    key={index}
                                    label={option}
                                    onClick={() => handleOptionSelect(option)}
                                    disabled={isLoading}
                                />
                            ))}
                        </div>
                        <form onSubmit={handleCustomInput} className="flex gap-2 mt-4">
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                placeholder="Or type your own response..."
                                className="flex-1 px-4 py-2 rounded-xl bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-sm"
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                disabled={!inputMessage.trim() || isLoading}
                                className="px-4 py-2 rounded-xl bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                ) : !isLoading && currentStep >= totalSteps ? (
                    <div className="text-center py-4">
                        <p className="text-slate-400 text-sm mb-3">Assessment complete!</p>
                        <button
                            onClick={onClose}
                            className="px-6 py-2 rounded-xl bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
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
                            placeholder="Or type your response..."
                            className="flex-1 px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={!inputMessage.trim() || isLoading}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
