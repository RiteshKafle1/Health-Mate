import { useState, useEffect, useRef } from 'react';
import {
    Pill, Plus, Edit3, Trash2, Clock, Calendar, MessageCircle,
    Send, X, Bot, User, Loader2, AlertTriangle, Package, RefreshCw,
    Activity, TrendingUp, CheckCircle2, ChevronDown
} from 'lucide-react';
import {
    getMedications,
    createMedication,
    updateMedication,
    deleteMedication,
    refillStock,
    type Medication,
    type MedicationCreate,
    type MedicationSummary
} from '../../api/medication';
import * as healthmateAssist from '../../api/healthmate_assist';
import toast from 'react-hot-toast';

// Progress Bar Component
function ProgressBar({
    value,
    max = 100,
    color = 'primary',
    showLabel = true,
    size = 'md'
}: {
    value: number;
    max?: number;
    color?: 'primary' | 'green' | 'amber' | 'red' | 'gray';
    showLabel?: boolean;
    size?: 'sm' | 'md';
}) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    const colorClasses = {
        primary: 'bg-primary-500',
        green: 'bg-emerald-500',
        amber: 'bg-amber-500',
        red: 'bg-red-500',
        gray: 'bg-dark-500'
    };

    const bgClasses = {
        primary: 'bg-primary-500/20',
        green: 'bg-emerald-500/20',
        amber: 'bg-amber-500/20',
        red: 'bg-red-500/20',
        gray: 'bg-dark-500/20'
    };

    return (
        <div className="flex items-center gap-2">
            <div className={`flex-1 ${bgClasses[color]} rounded-full overflow-hidden ${size === 'sm' ? 'h-1.5' : 'h-2'}`}>
                <div
                    className={`h-full ${colorClasses[color]} transition-all duration-500 rounded-full`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            {showLabel && (
                <span className={`text-dark-300 ${size === 'sm' ? 'text-xs' : 'text-sm'} min-w-[40px] text-right`}>
                    {Math.round(percentage)}%
                </span>
            )}
        </div>
    );
}

// Stock Status Badge
function StockBadge({ status, daysRemaining }: { status?: string; daysRemaining?: number }) {
    const configs: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
        healthy: {
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            icon: <CheckCircle2 size={12} />,
            label: 'Good'
        },
        medium: {
            color: 'text-amber-400',
            bg: 'bg-amber-500/10',
            icon: <TrendingUp size={12} />,
            label: 'Getting Low'
        },
        low: {
            color: 'text-orange-400',
            bg: 'bg-orange-500/10',
            icon: <AlertTriangle size={12} />,
            label: 'Low Stock'
        },
        critical: {
            color: 'text-red-400',
            bg: 'bg-red-500/10',
            icon: <AlertTriangle size={12} />,
            label: 'Urgent!'
        },
        out: {
            color: 'text-dark-400',
            bg: 'bg-dark-500/10',
            icon: <X size={12} />,
            label: 'Out'
        },
        unknown: {
            color: 'text-dark-400',
            bg: 'bg-dark-500/10',
            icon: null,
            label: ''
        }
    };

    const config = configs[status || 'unknown'] || configs.unknown;

    if (!status || status === 'unknown') return null;

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
            {config.icon}
            {config.label}
            {daysRemaining !== undefined && daysRemaining > 0 && ` • ${daysRemaining}d`}
        </span>
    );
}

// Collapsible Summary Panel with filtering
function CollapsibleSummary({
    summary,
    activeFilter,
    onFilterChange,
    showSummary,
    onToggle
}: {
    summary?: MedicationSummary;
    activeFilter: string | null;
    onFilterChange: (filter: string | null) => void;
    showSummary: boolean;
    onToggle: () => void;
}) {
    if (!summary) return null;

    // Summary card configurations
    const cards = [
        { key: 'total', label: 'Total', value: summary.total, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
        { key: 'active', label: 'Active', value: summary.active, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
        { key: 'critical', label: 'Urgent', value: summary.critical || 0, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
        { key: 'low', label: 'Low Stock', value: summary.low || 0, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
        { key: 'medium', label: 'Getting Low', value: summary.medium || 0, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
        { key: 'healthy', label: 'Good', value: summary.healthy || 0, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
    ];

    return (
        <div className="mb-6">
            {/* Toggle Button */}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-4 py-3 glass-card mb-2 hover:border-primary-500/30 transition-all"
            >
                <span className="flex items-center gap-2 text-dark-200 font-medium">
                    <Activity size={18} className="text-primary-400" />
                    Medication Summary
                </span>
                <span className={`flex items-center gap-1 text-sm text-primary-400 transition-transform duration-300 ${showSummary ? 'rotate-180' : ''}`}>
                    <ChevronDown size={18} />
                </span>
            </button>

            {/* Collapsible Panel */}
            <div
                className={`overflow-hidden transition-all duration-300 ease-out ${showSummary ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
            >
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-1">
                    {cards.map(card => (
                        <button
                            key={card.key}
                            onClick={() => onFilterChange(activeFilter === card.key ? null : card.key)}
                            className={`p-3 rounded-xl border transition-all duration-200 text-center cursor-pointer
                                ${activeFilter === card.key
                                    ? `${card.bg} ${card.border} ring-2 ring-offset-2 ring-offset-dark-900 ring-${card.color.split('-')[1]}-500/50`
                                    : 'bg-dark-800/50 border-dark-700 hover:border-dark-600'
                                }
                                ${card.value === 0 ? 'opacity-50' : 'hover:scale-105'}
                            `}
                            disabled={card.value === 0}
                        >
                            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                            <div className="text-xs text-dark-400 mt-0.5">{card.label}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Active Filter Indicator */}
            {activeFilter && (
                <div className="flex items-center justify-between px-4 py-2 bg-primary-500/10 border border-primary-500/30 rounded-lg mt-2">
                    <span className="text-sm text-primary-300">
                        Filtered by: <strong>{cards.find(c => c.key === activeFilter)?.label}</strong>
                    </span>
                    <button
                        onClick={() => onFilterChange(null)}
                        className="flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300"
                    >
                        <X size={14} />
                        Clear
                    </button>
                </div>
            )}
        </div>
    );
}

export function Medications() {
    // Medication state
    const [medications, setMedications] = useState<Medication[]>([]);
    const [summary, setSummary] = useState<MedicationSummary | undefined>();
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
    const [refillModal, setRefillModal] = useState<Medication | null>(null);
    const [refillAmount, setRefillAmount] = useState(30);

    // Form state
    const [formData, setFormData] = useState<MedicationCreate>({
        name: '',
        frequency: 1,
        duration: '',
        timing: '',
        description: '',
        total_stock: undefined,
        current_stock: undefined,
        dose_per_intake: 1,
        start_date: new Date().toISOString().split('T')[0]
    });
    const [isSaving, setIsSaving] = useState(false);

    // Chat state
    const [showChat, setShowChat] = useState(false);
    const [messages, setMessages] = useState<healthmateAssist.ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Summary panel state (collapsible + filtering)
    const [showSummary, setShowSummary] = useState(() => {
        // Initialize from sessionStorage
        return sessionStorage.getItem('showMedSummary') === 'true';
    });
    const [activeFilter, setActiveFilter] = useState<string | null>(null);

    // Persist summary panel state
    useEffect(() => {
        sessionStorage.setItem('showMedSummary', showSummary ? 'true' : 'false');
    }, [showSummary]);

    // Fetch medications on mount
    useEffect(() => {
        fetchMedications();
    }, []);

    // Scroll chat to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchMedications = async () => {
        try {
            const response = await getMedications();
            if (response.success) {
                setMedications(response.medications);
                setSummary(response.summary);
            }
        } catch (error) {
            toast.error('Failed to load medications');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddMedication = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const response = await createMedication(formData);
            if (response.success) {
                toast.success('Medication added successfully!');
                setShowAddModal(false);
                resetForm();
                fetchMedications();
            } else {
                toast.error(response.message || 'Failed to add medication');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail?.message || 'Failed to add medication');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateMedication = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMedication) return;
        setIsSaving(true);

        try {
            const response = await updateMedication(editingMedication._id, formData);
            if (response.success) {
                toast.success('Medication updated successfully!');
                setEditingMedication(null);
                resetForm();
                fetchMedications();
            } else {
                toast.error(response.message || 'Failed to update medication');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail?.message || 'Failed to update medication');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRefill = async () => {
        if (!refillModal) return;
        setIsSaving(true);

        try {
            const response = await refillStock(refillModal._id, refillAmount);
            if (response.success) {
                toast.success(response.message || 'Stock refilled!');
                setRefillModal(null);
                fetchMedications();
            } else {
                toast.error(response.message || 'Failed to refill');
            }
        } catch (error: any) {
            toast.error('Failed to refill stock');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteMedication = async (id: string) => {
        if (!confirm('Are you sure you want to delete this medication?')) return;

        try {
            const response = await deleteMedication(id);
            if (response.success) {
                toast.success('Medication deleted successfully!');
                fetchMedications();
            } else {
                toast.error(response.message || 'Failed to delete medication');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail?.message || 'Failed to delete medication');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            frequency: 1,
            duration: '',
            timing: '',
            description: '',
            total_stock: undefined,
            current_stock: undefined,
            dose_per_intake: 1,
            start_date: new Date().toISOString().split('T')[0]
        });
    };

    const openEditModal = (medication: Medication) => {
        setEditingMedication(medication);
        setFormData({
            name: medication.name,
            frequency: medication.frequency,
            duration: medication.duration,
            timing: medication.timing,
            description: medication.description || '',
            total_stock: medication.total_stock,
            current_stock: medication.current_stock,
            dose_per_intake: medication.dose_per_intake || 1,
            start_date: medication.start_date || ''
        });
    };

    // Chat functions
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputMessage.trim() || isSending) return;

        const userMessage = inputMessage.trim();
        setInputMessage('');
        setIsSending(true);

        // Add user message immediately
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

        try {
            const response = await healthmateAssist.sendMessage(userMessage, sessionId || undefined);
            if (response.success) {
                setSessionId(response.session_id);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: response.response,
                    timestamp: response.timestamp
                }]);

                // Refresh medications if a medication was added via chat
                if (response.response.includes('Medication Added') || response.response.includes('✅')) {
                    fetchMedications();
                }
            } else {
                toast.error('Failed to get response');
            }
        } catch (error) {
            toast.error('Failed to send message');
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.'
            }]);
        } finally {
            setIsSending(false);
        }
    };

    const openChat = () => {
        setShowChat(true);
        if (messages.length === 0) {
            setMessages([{
                role: 'assistant',
                content: "Hi! I'm **HealthMate Assist** 👋\n\nI can help you manage your medications. Try saying:\n- \"Add a new medication\"\n- \"What medications am I taking?\"\n- \"How much Paracetamol do I have left?\"\n\nHow can I help you today?"
            }]);
        }
    };

    // Get stock color
    const getStockColor = (status?: string): 'green' | 'amber' | 'red' | 'gray' => {
        switch (status) {
            case 'healthy': return 'green';
            case 'medium': return 'amber';
            case 'low': return 'amber';
            case 'critical': return 'red';
            case 'out': return 'gray';
            default: return 'gray';
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-primary-500" size={48} />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-dark-50">My Medications</h1>
                    <p className="text-dark-300 mt-1">Track, manage, and monitor your medications</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={openChat}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <MessageCircle size={18} />
                        HealthMate Assist
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus size={18} />
                        Add Medication
                    </button>
                </div>
            </div>

            {/* Collapsible Summary Panel */}
            <CollapsibleSummary
                summary={summary}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                showSummary={showSummary}
                onToggle={() => setShowSummary(!showSummary)}
            />

            {/* Filtered Medications - compute here */}
            {(() => {
                const filteredMedications = activeFilter
                    ? medications.filter(med => {
                        if (activeFilter === 'total') return true;
                        if (activeFilter === 'active') return med.is_active !== false;
                        return med.stock_status === activeFilter;
                    })
                    : medications;

                return filteredMedications.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                        <Pill className="mx-auto text-dark-400 mb-4" size={48} />
                        <h3 className="text-xl font-semibold text-dark-100 mb-2">No Medications Yet</h3>
                        <p className="text-dark-300 mb-6">
                            Add your first medication manually or chat with HealthMate Assist
                        </p>
                        <div className="flex justify-center gap-4">
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="btn-primary flex items-center gap-2"
                            >
                                <Plus size={18} />
                                Add Manually
                            </button>
                            <button
                                onClick={openChat}
                                className="btn-secondary flex items-center gap-2"
                            >
                                <MessageCircle size={18} />
                                Chat with Assistant
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredMedications.map((med) => (
                            <div key={med._id} className="glass-card p-5 hover:border-primary-500/30 transition-all">
                                {/* Header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-xl ${med.stock_status === 'critical' || med.stock_status === 'out'
                                            ? 'bg-red-500/20'
                                            : 'bg-gradient-to-br from-primary-500/20 to-secondary-500/20'
                                            }`}>
                                            <Pill className={
                                                med.stock_status === 'critical' || med.stock_status === 'out'
                                                    ? 'text-red-400'
                                                    : 'text-primary-400'
                                            } size={22} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-dark-50">{med.name}</h3>
                                            <p className="text-sm text-primary-400">{med.frequency}x daily</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => openEditModal(med)}
                                            className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-300 hover:text-primary-400 transition-colors"
                                            title="Edit"
                                        >
                                            <Edit3 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteMedication(med._id)}
                                            className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-300 hover:text-red-400 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Duration Progress */}
                                {med.duration_progress !== undefined && med.duration_progress > 0 && (
                                    <div className="mb-3">
                                        <div className="flex items-center justify-between text-xs text-dark-400 mb-1">
                                            <span className="flex items-center gap-1">
                                                <Activity size={12} />
                                                Duration
                                            </span>
                                            <span>Day {med.days_elapsed || 0} of {med.total_days || '?'}</span>
                                        </div>
                                        <ProgressBar
                                            value={med.duration_progress}
                                            color="primary"
                                            size="sm"
                                            showLabel={false}
                                        />
                                    </div>
                                )}

                                {/* Stock Level */}
                                {med.total_stock && med.current_stock !== undefined && (
                                    <div className="mb-3">
                                        <div className="flex items-center justify-between text-xs text-dark-400 mb-1">
                                            <span className="flex items-center gap-1">
                                                <Package size={12} />
                                                Stock
                                            </span>
                                            <span>{med.current_stock} of {med.total_stock} pills</span>
                                        </div>
                                        <ProgressBar
                                            value={med.stock_percentage || 0}
                                            color={getStockColor(med.stock_status)}
                                            size="sm"
                                            showLabel={false}
                                        />
                                        <div className="flex items-center justify-between mt-1">
                                            <StockBadge status={med.stock_status} daysRemaining={med.days_remaining} />
                                            {(med.stock_status === 'low' || med.stock_status === 'critical' || med.stock_status === 'out') && (
                                                <button
                                                    onClick={() => setRefillModal(med)}
                                                    className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
                                                >
                                                    <RefreshCw size={12} />
                                                    Refill
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Meta Info */}
                                <div className="space-y-1.5 text-sm border-t border-dark-700 pt-3">
                                    <div className="flex items-center gap-2 text-dark-300">
                                        <Clock size={13} />
                                        <span>{med.timing}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-dark-300">
                                        <Calendar size={13} />
                                        <span>{med.duration}</span>
                                    </div>
                                    {med.description && (
                                        <p className="text-dark-400 text-xs mt-2 pt-2 border-t border-dark-700/50">
                                            {med.description}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )
            })()}

            {/* Add/Edit Modal */}
            {(showAddModal || editingMedication) && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="glass-card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-dark-50">
                                {editingMedication ? 'Edit Medication' : 'Add Medication'}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setEditingMedication(null);
                                    resetForm();
                                }}
                                className="p-2 rounded-lg hover:bg-dark-700 text-dark-300"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={editingMedication ? handleUpdateMedication : handleAddMedication}>
                            <div className="space-y-4">
                                {/* Basic Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="input-label">Medication Name</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="input-field"
                                            placeholder="e.g., Paracetamol 500mg"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="input-label">Frequency (per day)</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={10}
                                            value={formData.frequency}
                                            onChange={(e) => setFormData({ ...formData, frequency: parseInt(e.target.value) })}
                                            className="input-field"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="input-label">Duration</label>
                                        <input
                                            type="text"
                                            value={formData.duration}
                                            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                            className="input-field"
                                            placeholder="e.g., 7 days"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="input-label">Timing</label>
                                    <select
                                        value={formData.timing}
                                        onChange={(e) => setFormData({ ...formData, timing: e.target.value })}
                                        className="input-field"
                                        required
                                    >
                                        <option value="">Select timing</option>
                                        <option value="Before breakfast">Before breakfast</option>
                                        <option value="After breakfast">After breakfast</option>
                                        <option value="Before lunch">Before lunch</option>
                                        <option value="After lunch">After lunch</option>
                                        <option value="Before dinner">Before dinner</option>
                                        <option value="After dinner">After dinner</option>
                                        <option value="Before bed">Before bed</option>
                                        <option value="With meals">With meals</option>
                                        <option value="As needed">As needed</option>
                                    </select>
                                </div>

                                {/* Stock Tracking Section */}
                                <div className="border-t border-dark-700 pt-4">
                                    <h3 className="text-sm font-medium text-dark-200 mb-3 flex items-center gap-2">
                                        <Package size={16} />
                                        Stock Tracking (Optional)
                                    </h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="input-label text-xs">Total Stock</label>
                                            <input
                                                type="number"
                                                min={0}
                                                value={formData.total_stock || ''}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    total_stock: e.target.value ? parseInt(e.target.value) : undefined
                                                })}
                                                className="input-field"
                                                placeholder="30"
                                            />
                                        </div>
                                        <div>
                                            <label className="input-label text-xs">Current Stock</label>
                                            <input
                                                type="number"
                                                min={0}
                                                value={formData.current_stock || ''}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    current_stock: e.target.value ? parseInt(e.target.value) : undefined
                                                })}
                                                className="input-field"
                                                placeholder="30"
                                            />
                                        </div>
                                        <div>
                                            <label className="input-label text-xs">Pills/Dose</label>
                                            <input
                                                type="number"
                                                min={1}
                                                value={formData.dose_per_intake || 1}
                                                onChange={(e) => setFormData({ ...formData, dose_per_intake: parseInt(e.target.value) })}
                                                className="input-field"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Start Date */}
                                <div>
                                    <label className="input-label">Start Date</label>
                                    <input
                                        type="date"
                                        value={formData.start_date || ''}
                                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                        className="input-field"
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="input-label">Notes (Optional)</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="input-field resize-none"
                                        rows={2}
                                        placeholder="e.g., For headache relief"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddModal(false);
                                        setEditingMedication(null);
                                        resetForm();
                                    }}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="animate-spin" size={18} />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            {editingMedication ? 'Update' : 'Add'} Medication
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Refill Modal */}
            {refillModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="glass-card w-full max-w-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-dark-50">Refill {refillModal.name}</h2>
                            <button
                                onClick={() => setRefillModal(null)}
                                className="p-2 rounded-lg hover:bg-dark-700 text-dark-300"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <p className="text-sm text-dark-300 mb-4">
                            Current stock: {refillModal.current_stock || 0} pills
                        </p>

                        <div className="mb-4">
                            <label className="input-label">Refill Amount</label>
                            <input
                                type="number"
                                min={1}
                                value={refillAmount}
                                onChange={(e) => setRefillAmount(parseInt(e.target.value) || 0)}
                                className="input-field"
                            />
                        </div>

                        <div className="flex justify-end gap-3">
                            <button onClick={() => setRefillModal(null)} className="btn-secondary">
                                Cancel
                            </button>
                            <button onClick={handleRefill} disabled={isSaving} className="btn-primary flex items-center gap-2">
                                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                                Refill
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Panel */}
            {showChat && (
                <div className="fixed bottom-6 right-6 w-96 h-[600px] glass-card flex flex-col z-50 shadow-2xl">
                    {/* Chat Header */}
                    <div className="p-4 border-b border-dark-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                                <Bot className="text-emerald-400" size={20} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-dark-50">HealthMate Assist</h3>
                                <p className="text-xs text-dark-400">Your health companion</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowChat(false)}
                            className="p-2 rounded-lg hover:bg-dark-700 text-dark-300"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`flex items-start gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`p-2 rounded-lg ${msg.role === 'user'
                                        ? 'bg-primary-500/20'
                                        : 'bg-emerald-500/20'
                                        }`}>
                                        {msg.role === 'user'
                                            ? <User size={16} className="text-primary-400" />
                                            : <Bot size={16} className="text-emerald-400" />
                                        }
                                    </div>
                                    <div className={`p-3 rounded-2xl ${msg.role === 'user'
                                        ? 'bg-primary-500/20 text-dark-50 rounded-tr-none'
                                        : 'bg-dark-700 text-dark-100 rounded-tl-none'
                                        }`}>
                                        <div className="text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={{
                                            __html: msg.content
                                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                                .replace(/\n/g, '<br/>')
                                        }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isSending && (
                            <div className="flex justify-start">
                                <div className="flex items-center gap-2 p-3 rounded-2xl bg-dark-700 rounded-tl-none">
                                    <Loader2 className="animate-spin text-emerald-400" size={16} />
                                    <span className="text-sm text-dark-300">Thinking...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-dark-700">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                placeholder="Type a message..."
                                className="flex-1 px-4 py-3 rounded-xl bg-dark-700 border border-dark-600 text-dark-50 placeholder-dark-400 focus:outline-none focus:border-emerald-500/50"
                                disabled={isSending}
                            />
                            <button
                                type="submit"
                                disabled={!inputMessage.trim() || isSending}
                                className="p-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                            >
                                <Send size={20} />
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Chat FAB when closed */}
            {!showChat && (
                <button
                    onClick={openChat}
                    className="fixed bottom-6 right-6 p-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all z-40"
                >
                    <MessageCircle size={24} />
                </button>
            )}
        </div>
    );
}
