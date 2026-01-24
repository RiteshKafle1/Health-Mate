import { useState, useEffect, useRef } from 'react';
import {
    Pill, Plus, Edit3, Trash2, MessageCircle,
    Send, X, Bot, Loader2, Package,
    Activity, CheckCircle2, ChevronDown, Sparkles, FileText,
    AlertCircle
} from 'lucide-react';
import {
    getMedications,
    createMedication,
    updateMedication,
    deleteMedication,
    refillStock,
    markDoseTaken,
    getMedicationInfo,
    type Medication,
    type MedicationCreate,
    type MedicationSummary
} from '../../api/medication';
import * as healthmateAssist from '../../api/healthmate_assist';
import toast from 'react-hot-toast';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

// --- Premium Components ---

function PremiumProgressBar({
    value,
    max = 100,
    color = 'bg-primary',
    showLabel = true,
}: {
    value: number;
    max?: number;
    color?: string;
    showLabel?: boolean;
}) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-1.5">
                {showLabel && <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Progress</span>}
                {showLabel && <span className="text-[10px] font-bold text-text">{Math.round(percentage)}%</span>}
            </div>
            <div className="h-1.5 bg-surface/50 rounded-full overflow-hidden w-full">
                <div
                    className={`h-full ${color} transition-all duration-700 ease-out rounded-full shadow-sm`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

function DosePill({
    time,
    isTaken,
    onToggle,
    isLoading
}: {
    time: string;
    isTaken: boolean;
    onToggle: () => void;
    isLoading: boolean;
}) {
    return (
        <button
            onClick={onToggle}
            disabled={isLoading}
            className={`
                group relative px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 ease-out
                flex items-center gap-2 border shadow-sm
                ${isTaken
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/20'
                    : 'bg-white border-surface text-text hover:border-primary/30 hover:shadow-md'
                }
                ${isLoading ? 'opacity-70 cursor-wait' : 'cursor-pointer active:scale-95'}
            `}
        >
            <div className={`
                w-4 h-4 rounded-full flex items-center justify-center transition-colors
                ${isTaken ? 'bg-white/20' : 'bg-surface/50 group-hover:bg-primary/10'}
            `}>
                {isLoading ? (
                    <Loader2 size={10} className="animate-spin" />
                ) : isTaken ? (
                    <CheckCircle2 size={10} className="text-white" />
                ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-text-muted/40 group-hover:bg-primary" />
                )}
            </div>
            {time}
        </button>
    );
}

function SummaryStatCard({
    icon,
    label,
    value,
    colorClass,
    active,
    onClick
}: {
    icon: any;
    label: string;
    value: number;
    colorClass: string; // e.g., "text-blue-600 bg-blue-50 border-blue-100"
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            disabled={value === 0}
            className={`
                relative flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200
                ${active
                    ? `shadow-md scale-105 ${colorClass.replace('bg-opacity-10', 'bg-opacity-20')} ring-1 ring-offset-1 ring-current`
                    : 'bg-white border-surface hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 hover:scale-105'
                }
                ${value === 0 ? 'opacity-50 grayscale cursor-default' : 'cursor-pointer'}
            `}
        >
            <div className={`p-2 rounded-full mb-2 ${colorClass.split(' ')[1]}`}>
                <icon.type size={20} className={colorClass.split(' ')[0]} />
            </div>
            <span className="text-2xl font-bold text-text mb-0.5">{value}</span>
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">{label}</span>
        </button>
    );
}


export function Medications() {
    // --- State Management ---
    const [medications, setMedications] = useState<Medication[]>([]);
    const [summary, setSummary] = useState<MedicationSummary | undefined>();
    const [isLoading, setIsLoading] = useState(true);
    const [doseLoadingTime, setDoseLoadingTime] = useState<{ medId: string; time: string } | null>(null);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
    const [refillModal, setRefillModal] = useState<Medication | null>(null);
    const [refillAmount, setRefillAmount] = useState(30);

    // Filter
    const [activeFilter, setActiveFilter] = useState<string | null>(null);
    const [showSummary, setShowSummary] = useState(() => sessionStorage.getItem('showMedSummary') === 'true');

    // Chat
    const [showChat, setShowChat] = useState(false);
    const [messages, setMessages] = useState<healthmateAssist.ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Form
    const [formData, setFormData] = useState<MedicationCreate>({
        name: '',
        frequency: 1,
        duration: '',
        timing: '',
        description: '',
        dose_per_intake: 1,
        start_date: new Date().toISOString().split('T')[0],
        schedule_times: ['08:00']  // Default first dose time
    });
    const [isSaving, setIsSaving] = useState(false);

    // --- Helper: Calculate interval based on frequency ---
    const getIntervalHours = (freq: number): number => {
        if (freq === 1) return 24;  // Once daily
        if (freq === 2) return 12;  // BID (twice daily)
        if (freq === 3) return 8;   // TID (three times daily)
        if (freq === 4) return 6;   // QID (four times daily)
        return Math.floor(24 / Math.max(1, freq));
    };

    // --- Helper: Generate times from first dose ---
    const generateScheduleTimes = (firstTime: string, frequency: number): string[] => {
        if (!firstTime || frequency < 1) return [firstTime || '08:00'];

        const interval = getIntervalHours(frequency);
        const [hours, mins] = firstTime.split(':').map(Number);
        const times: string[] = [firstTime];

        for (let i = 1; i < frequency; i++) {
            const newHours = (hours + interval * i) % 24;
            times.push(`${newHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
        }
        return times;
    };

    // --- Effects ---
    useEffect(() => {
        fetchMedications();
    }, []);

    useEffect(() => {
        sessionStorage.setItem('showMedSummary', showSummary ? 'true' : 'false');
    }, [showSummary]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // --- Actions ---
    const fetchMedications = async () => {
        try {
            const response = await getMedications();
            if (response.success) {
                setMedications(response.medications);
                setSummary(response.summary);
            }
        } catch {
            toast.error('Failed to load medications');
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            frequency: 1,
            duration: '',
            timing: '',
            description: '',
            dose_per_intake: 1,
            start_date: new Date().toISOString().split('T')[0],
            schedule_times: ['08:00']
        });
    };

    const handleAddMedication = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await createMedication(formData);
            if (res.success) {
                toast.success('Added successfully');
                setShowAddModal(false);
                resetForm();
                fetchMedications();
            } else toast.error(res.message);
        } catch (e: any) {
            toast.error(e.response?.data?.detail?.message || 'Failed to add');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateMedication = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMedication) return;
        setIsSaving(true);
        try {
            // Clean data: send empty string for cleared fields (backend will convert to null)
            // Note: undefined gets dropped in JSON, so we use empty string which backend handles
            const cleanedData = {
                ...formData,
                purpose: formData.purpose?.trim() ?? '',
                instructions: formData.instructions?.trim() ?? '',
                // Clear source when content is cleared
                purpose_source: formData.purpose?.trim() ? (formData as any).purpose_source : '',
                instructions_source: formData.instructions?.trim() ? (formData as any).instructions_source : ''
            };
            const res = await updateMedication(editingMedication._id, cleanedData);
            if (res.success) {
                toast.success('Updated successfully');
                setEditingMedication(null);
                resetForm();
                fetchMedications();
            } else toast.error(res.message);
        } catch (e: any) {
            toast.error(e.response?.data?.detail?.message || 'Failed to update');
        } finally {
            setIsSaving(false);
        }
    };

    const openEditModal = (med: Medication) => {
        setEditingMedication(med);
        setFormData({
            name: med.name,
            frequency: med.frequency,
            duration: med.duration,
            timing: med.timing,
            description: med.description || '',
            total_stock: med.total_stock,
            current_stock: med.current_stock,
            dose_per_intake: med.dose_per_intake || 1,
            start_date: med.start_date || '',
            schedule_times: med.schedule_times || generateScheduleTimes('08:00', med.frequency),
            purpose: med.purpose || '',
            instructions: med.instructions || ''
        });
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this medication record?')) return;
        try {
            const res = await deleteMedication(id);
            if (res.success) {
                toast.success('Deleted');
                fetchMedications();
            }
        } catch {
            toast.error('Failed to delete');
        }
    };

    const handleDoseToggle = async (medicationId: string, timeSlot: string, taken: boolean) => {
        setDoseLoadingTime({ medId: medicationId, time: timeSlot });
        try {
            const response = await markDoseTaken(medicationId, timeSlot, taken);
            if (response.success && response.medication) {
                setMedications(prev => prev.map(med => med._id === medicationId ? response.medication! : med));
                toast.success(taken ? 'Dose recorded' : 'Dose undone');
            }
        } catch {
            toast.error('Failed to update status');
        } finally {
            setDoseLoadingTime(null);
        }
    };

    const handleRefill = async () => {
        if (!refillModal) return;
        setIsSaving(true);
        try {
            const res = await refillStock(refillModal._id, refillAmount);
            if (res.success) {
                toast.success('Stock updated');
                setRefillModal(null);
                fetchMedications();
            }
        } catch {
            toast.error('Refill failed');
        } finally {
            setIsSaving(false);
        }
    };

    // AI Actions - Separate handlers for purpose and instructions
    const handleGetPurpose = async (medId: string, name: string) => {
        const toastId = toast.loading('Fetching purpose...');
        try {
            const info = await getMedicationInfo(name, 'purpose');
            if (info.success && info.purpose) {
                await updateMedication(medId, { purpose: info.purpose, purpose_source: info.source });
                toast.success(`Purpose found (${info.source})`, { id: toastId });
                fetchMedications();
            } else {
                toast.error('No purpose found', { id: toastId });
            }
        } catch {
            toast.error('Could not fetch purpose', { id: toastId });
        }
    };

    const handleGetInstructions = async (medId: string, name: string) => {
        const toastId = toast.loading('Fetching instructions...');
        try {
            const info = await getMedicationInfo(name, 'instructions');
            if (info.success && info.instructions) {
                await updateMedication(medId, { instructions: info.instructions, instructions_source: info.source });
                toast.success(`Instructions found (${info.source})`, { id: toastId });
                fetchMedications();
            } else {
                toast.error('No instructions found', { id: toastId });
            }
        } catch {
            toast.error('Could not fetch instructions', { id: toastId });
        }
    };

    const handleGetMedicationInfo = async (medId: string, name: string) => {
        const toastId = toast.loading('Consulting sources...');
        try {
            const info = await getMedicationInfo(name, 'both');
            if (info.success) {
                await updateMedication(medId, {
                    purpose: info.purpose || undefined,
                    instructions: info.instructions || undefined
                });
                toast.success(`Info enriched (${info.source})`, { id: toastId });
                fetchMedications();
            } else toast.dismiss(toastId);
        } catch {
            toast.error('Could not fetch info', { id: toastId });
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputMessage.trim() || isSending) return;
        const msg = inputMessage.trim();
        setInputMessage('');
        setIsSending(true);
        setMessages(p => [...p, { role: 'user', content: msg }]);

        try {
            const res = await healthmateAssist.sendMessage(msg, sessionId || undefined);
            if (res.success) {
                setSessionId(res.session_id);
                setMessages(p => [...p, { role: 'assistant', content: res.response, timestamp: res.timestamp }]);
                if (res.response.includes('Medication Added') || res.response.includes('✅')) fetchMedications();
            }
        } catch {
            toast.error('Message failed');
        } finally {
            setIsSending(false);
        }
    };

    // --- Helpers ---
    const getStockConfig = (status?: string) => {
        switch (status) {
            case 'healthy': return { color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
            case 'medium': return { color: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' };
            case 'low': return { color: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50' };
            case 'critical':
            case 'out': return { color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' };
            default: return { color: 'bg-slate-500', text: 'text-slate-700', bg: 'bg-slate-50' };
        }
    };

    // Filter logic
    const filteredMedications = activeFilter
        ? medications.filter(med => {
            if (activeFilter === 'total') return true;
            if (activeFilter === 'active') return med.is_active !== false;
            return med.stock_status === activeFilter;
        })
        : medications;

    // --- Styles ---
    const premiumInputClass = "bg-[#EFF4FF] border border-[#A9B5DF]/50 shadow-sm hover:border-[#7886C7] hover:bg-white hover:shadow-md focus:bg-white focus:ring-2 focus:ring-[#7886C7]/30 focus:border-[#7886C7] transition-all duration-200 rounded-xl h-12";


    if (isLoading) return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="animate-spin text-primary" size={40} /></div>;

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-text tracking-tight">Medications</h1>
                    <p className="text-text-muted mt-2 text-lg">Manage your schedule and track adherence.</p>
                </div>
                <div className="flex gap-4">
                    <Button
                        variant="secondary"
                        onClick={() => { setShowChat(true); if (messages.length === 0) setMessages([{ role: 'assistant', content: "Hi! How can I help with your meds?" }]); }}
                        className="bg-white border hover:bg-surface text-text shadow-sm"
                    >
                        <MessageCircle size={18} className="mr-2 text-primary" /> Assistant
                    </Button>
                    <Button onClick={() => setShowAddModal(true)} className="shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
                        <Plus size={20} className="mr-2" /> Add New
                    </Button>
                </div>
            </div>

            {/* Today's Progress Section */}
            {medications.length > 0 && (() => {
                // Calculate today's overall progress
                const todayStats = medications
                    .filter(m => m.is_active !== false)
                    .reduce((acc, med) => {
                        const times = med.schedule_times || [];
                        const dosesTaken = med.doses_taken_today || {};
                        const takenCount = Object.values(dosesTaken).filter(Boolean).length;
                        return {
                            totalDoses: acc.totalDoses + times.length,
                            takenDoses: acc.takenDoses + takenCount
                        };
                    }, { totalDoses: 0, takenDoses: 0 });

                const pendingDoses = todayStats.totalDoses - todayStats.takenDoses;
                const progressPercent = todayStats.totalDoses > 0
                    ? Math.round((todayStats.takenDoses / todayStats.totalDoses) * 100)
                    : 0;

                const getProgressColor = () => {
                    if (progressPercent >= 80) return 'bg-emerald-500';
                    if (progressPercent >= 50) return 'bg-amber-500';
                    return 'bg-red-500';
                };

                return todayStats.totalDoses > 0 ? (
                    <div className="bg-gradient-to-br from-primary/5 to-indigo-50 rounded-3xl p-6 border border-primary/20 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg text-text flex items-center gap-2">
                                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                                    🎯
                                </div>
                                Today's Progress
                            </h3>
                            <div className="text-3xl font-bold text-text">
                                {progressPercent}%
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-white/50 rounded-full h-3 overflow-hidden mb-4 shadow-inner">
                            <div
                                className={`h-full rounded-full ${getProgressColor()} transition-all duration-700`}
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>

                        {/* Stats Row */}
                        <div className="flex items-center justify-center gap-8 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                <span className="font-semibold text-text">{todayStats.takenDoses}</span>
                                <span className="text-text-muted">Taken</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-gray-300" />
                                <span className="font-semibold text-text">{pendingDoses}</span>
                                <span className="text-text-muted">Pending</span>
                            </div>
                            <div className="text-text-muted">
                                Total: <span className="font-semibold text-text">{todayStats.totalDoses}</span> doses
                            </div>
                        </div>
                    </div>
                ) : null;
            })()}

            {/* Stats / Filter Bar */}
            {summary && (
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-surface/50">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg text-text flex items-center gap-2">
                            <Activity className="text-primary" size={20} />
                            Overview
                        </h3>
                        <div className="flex gap-2">
                            {activeFilter && (
                                <button onClick={() => setActiveFilter(null)} className="text-sm text-red-500 hover:underline px-3 py-1 bg-red-50 rounded-lg font-medium">Clear Filter</button>
                            )}
                            <button onClick={() => setShowSummary(!showSummary)} className="text-text-muted hover:text-primary">
                                <ChevronDown className={`transition-transform duration-300 ${showSummary ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {showSummary && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-in slide-in-from-top-4 duration-500">
                            <SummaryStatCard
                                icon={<Pill />} label="Total" value={summary.total}
                                colorClass="text-blue-600 bg-blue-50 border-blue-100"
                                active={activeFilter === 'total'} onClick={() => setActiveFilter(activeFilter === 'total' ? null : 'total')}
                            />
                            <SummaryStatCard
                                icon={<CheckCircle2 />} label="Active" value={summary.active}
                                colorClass="text-emerald-600 bg-emerald-50 border-emerald-100"
                                active={activeFilter === 'active'} onClick={() => setActiveFilter(activeFilter === 'active' ? null : 'active')}
                            />
                            <SummaryStatCard
                                icon={<AlertCircle />} label="Urgent" value={summary.critical || 0}
                                colorClass="text-red-600 bg-red-50 border-red-100"
                                active={activeFilter === 'critical'} onClick={() => setActiveFilter(activeFilter === 'critical' ? null : 'critical')}
                            />
                            <SummaryStatCard
                                icon={<Package />} label="Low Stock" value={summary.low || 0}
                                colorClass="text-orange-600 bg-orange-50 border-orange-100"
                                active={activeFilter === 'low'} onClick={() => setActiveFilter(activeFilter === 'low' ? null : 'low')}
                            />
                            <SummaryStatCard
                                icon={<Package />} label="Getting Low" value={summary.medium || 0}
                                colorClass="text-amber-600 bg-amber-50 border-amber-100"
                                active={activeFilter === 'medium'} onClick={() => setActiveFilter(activeFilter === 'medium' ? null : 'medium')}
                            />
                            <SummaryStatCard
                                icon={<Package />} label="Good" value={summary.healthy || 0}
                                colorClass="text-indigo-600 bg-indigo-50 border-indigo-100"
                                active={activeFilter === 'healthy'} onClick={() => setActiveFilter(activeFilter === 'healthy' ? null : 'healthy')}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Masonry Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMedications.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-surface">
                        <div className="w-20 h-20 bg-surface/30 rounded-full flex items-center justify-center mx-auto mb-4 text-text-muted">
                            <Pill size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-text mb-2">No medications found</h3>
                        <p className="text-text-muted mb-6">Add your first medication to get started.</p>
                        <Button onClick={() => setShowAddModal(true)}>Add Medication</Button>
                    </div>
                ) : (
                    filteredMedications.map((med) => {
                        const stock = getStockConfig(med.stock_status);

                        // Calculate today's progress for this medication
                        const scheduleTimes = med.schedule_times || [];
                        const dosesTaken = med.doses_taken_today || {};
                        const takenCount = Object.values(dosesTaken).filter(Boolean).length;
                        const totalDoses = scheduleTimes.length;
                        const pendingCount = totalDoses - takenCount;
                        const medProgress = totalDoses > 0 ? Math.round((takenCount / totalDoses) * 100) : 0;

                        const getProgressColor = () => {
                            if (medProgress >= 80) return 'bg-emerald-500';
                            if (medProgress >= 50) return 'bg-amber-500';
                            return 'bg-red-500';
                        };

                        return (
                            <div key={med._id} className="group relative bg-white rounded-3xl p-6 border border-surface shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                {/* Top Actions */}
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEditModal(med)} className="p-2 bg-surface hover:bg-primary hover:text-white rounded-full transition-colors"><Edit3 size={14} /></button>
                                    <button onClick={() => handleDelete(med._id)} className="p-2 bg-surface hover:bg-red-500 hover:text-white rounded-full transition-colors"><Trash2 size={14} /></button>
                                </div>

                                <div className="flex items-start gap-4 mb-4">
                                    <div className="w-14 h-14 bg-primary/5 rounded-2xl flex items-center justify-center text-primary border border-primary/10">
                                        <Pill size={28} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-bold text-text leading-tight">{med.name}</h3>
                                            {totalDoses > 0 && (
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${medProgress >= 80 ? 'bg-emerald-100 text-emerald-700' :
                                                    medProgress >= 50 ? 'bg-amber-100 text-amber-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                    {medProgress}%
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-text-muted">{med.frequency}x daily • {med.timing}</p>
                                        {totalDoses > 0 && (
                                            <p className="text-xs text-text-muted mt-1">
                                                <span className="text-emerald-600 font-medium">{takenCount}</span>/{totalDoses} taken
                                                {pendingCount > 0 && (
                                                    <span className="text-amber-600 ml-1">• {pendingCount} pending</span>
                                                )}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Schedule with Progress Bar */}
                                {med.schedule_times && med.schedule_times.length > 0 && (
                                    <div className="mb-6">
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {med.schedule_times.map(time => (
                                                <DosePill
                                                    key={time} time={time}
                                                    isTaken={med.doses_taken_today?.[time] || false}
                                                    onToggle={() => handleDoseToggle(med._id, time, !med.doses_taken_today?.[time])}
                                                    isLoading={doseLoadingTime?.medId === med._id && doseLoadingTime.time === time}
                                                />
                                            ))}
                                        </div>
                                        {/* Mini Progress Bar */}
                                        <div className="w-full bg-surface/50 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${getProgressColor()} transition-all duration-500`}
                                                style={{ width: `${medProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Stock & Info */}
                                <div className="space-y-4">
                                    {med.current_stock !== undefined && (
                                        <div className="bg-surface/30 rounded-xl p-3">
                                            <div className="flex justify-between items-end mb-2">
                                                <span className="text-xs font-bold text-text flex items-center gap-1"><Package size={12} /> Stock Level</span>
                                                {med.stock_status === 'low' || med.stock_status === 'critical' ? (
                                                    <button onClick={() => setRefillModal(med)} className="text-[10px] font-bold text-primary hover:underline">REFILL +</button>
                                                ) : (
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stock.bg} ${stock.text}`}>{med.current_stock} left</span>
                                                )}
                                            </div>
                                            <PremiumProgressBar value={med.stock_percentage || 0} color={stock.color} showLabel={false} />
                                        </div>
                                    )}

                                    {/* Purpose & Instructions Section */}
                                    <div className="bg-surface/10 rounded-xl p-4 border border-surface/50 space-y-3">
                                        {/* Purpose */}
                                        <div className="group">
                                            <div className="flex items-center gap-2 mb-1">
                                                <FileText size={12} className="text-primary" />
                                                <span className="text-[10px] font-bold text-text uppercase">Purpose</span>
                                                {med.purpose_source && (
                                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${med.purpose_source === 'knowledge_base' ? 'bg-green-100 text-green-700' :
                                                        med.purpose_source === 'openfda_ai' ? 'bg-blue-100 text-blue-700' :
                                                            med.purpose_source === 'tavily_ai' ? 'bg-purple-100 text-purple-700' :
                                                                'bg-orange-100 text-orange-700'
                                                        }`}>
                                                        {med.purpose_source === 'knowledge_base' ? 'KB' :
                                                            med.purpose_source === 'openfda_ai' ? 'FDA+AI' :
                                                                med.purpose_source === 'tavily_ai' ? 'Web+AI' : 'AI'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <p className="text-xs text-text-muted leading-relaxed line-clamp-1 group-hover:line-clamp-none transition-all duration-300">
                                                    {med.purpose ||
                                                        <span
                                                            onClick={() => handleGetPurpose(med._id, med.name)}
                                                            className="text-primary cursor-pointer hover:underline flex items-center gap-1"
                                                        >
                                                            <Sparkles size={10} /> Tap to get AI purpose
                                                        </span>
                                                    }
                                                </p>
                                            </div>
                                        </div>

                                        {/* Instructions */}
                                        <div className="group border-t border-surface/30 pt-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Pill size={12} className="text-secondary" />
                                                <span className="text-[10px] font-bold text-text uppercase">Instructions</span>
                                                {med.instructions_source && (
                                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${med.instructions_source === 'knowledge_base' ? 'bg-green-100 text-green-700' :
                                                        med.instructions_source === 'openfda_ai' ? 'bg-blue-100 text-blue-700' :
                                                            med.instructions_source === 'tavily_ai' ? 'bg-purple-100 text-purple-700' :
                                                                'bg-orange-100 text-orange-700'
                                                        }`}>
                                                        {med.instructions_source === 'knowledge_base' ? 'KB' :
                                                            med.instructions_source === 'openfda_ai' ? 'FDA+AI' :
                                                                med.instructions_source === 'tavily_ai' ? 'Web+AI' : 'AI'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <p className="text-xs text-text-muted leading-relaxed line-clamp-1 group-hover:line-clamp-none transition-all duration-300">
                                                    {med.instructions ||
                                                        <span
                                                            onClick={() => handleGetInstructions(med._id, med.name)}
                                                            className="text-secondary cursor-pointer hover:underline flex items-center gap-1"
                                                        >
                                                            <Sparkles size={10} /> Tap to get AI instructions
                                                        </span>
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* --- Modals and Chat --- */}

            {/* Add/Edit Modal */}
            {(showAddModal || editingMedication) && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-bold text-text">{editingMedication ? 'Edit Medication' : 'Add New Medication'}</h2>
                            <button onClick={() => { setShowAddModal(false); setEditingMedication(null); resetForm(); }} className="p-2 hover:bg-surface rounded-full"><X size={24} /></button>
                        </div>
                        <form onSubmit={editingMedication ? handleUpdateMedication : handleAddMedication} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input
                                    label="Name"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Paracetamol"
                                    required
                                    className={premiumInputClass}
                                />
                                <Input
                                    label="Frequency (per day)"
                                    type="number"
                                    value={formData.frequency}
                                    onChange={e => {
                                        const newFreq = parseInt(e.target.value) || 1;
                                        const firstTime = formData.schedule_times?.[0] || '08:00';
                                        const newTimes = generateScheduleTimes(firstTime, newFreq);
                                        setFormData({
                                            ...formData,
                                            frequency: newFreq,
                                            schedule_times: newTimes,
                                            timing: `Custom: ${newTimes.join(', ')}`
                                        });
                                    }}
                                    required
                                    className={premiumInputClass}
                                />
                                <Input
                                    label="Duration"
                                    value={formData.duration}
                                    onChange={e => setFormData({ ...formData, duration: e.target.value })}
                                    placeholder="e.g. 7 days"
                                    className={premiumInputClass}
                                />
                            </div>

                            {/* Dynamic Dose Schedule Times */}
                            <div className="p-6 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-3xl border border-primary/20">
                                <h3 className="font-bold text-text mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                                    <Activity size={16} className="text-primary" />
                                    Dose Schedule ({formData.frequency}x daily = every {getIntervalHours(formData.frequency)}h)
                                </h3>
                                <div className={`grid gap-4 ${formData.frequency === 1 ? 'grid-cols-1' : formData.frequency === 2 ? 'grid-cols-2' : formData.frequency <= 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                                    {Array.from({ length: formData.frequency }, (_, i) => {
                                        const currentTimes = formData.schedule_times || ['08:00'];
                                        const currentTime = currentTimes[i] || '';

                                        return (
                                            <div key={i} className="relative">
                                                <label className="text-xs font-semibold text-text-muted block mb-2">
                                                    {i === 0 ? 'First Dose *' : `Dose ${i + 1}`}
                                                </label>
                                                <input
                                                    type="time"
                                                    value={currentTime}
                                                    onChange={e => {
                                                        const newTime = e.target.value;
                                                        if (i === 0) {
                                                            // First dose changed - recalculate all subsequent times
                                                            const newTimes = generateScheduleTimes(newTime, formData.frequency);
                                                            setFormData({ ...formData, schedule_times: newTimes, timing: `Custom: ${newTimes.join(', ')}` });
                                                        } else {
                                                            // Individual time edited
                                                            const newTimes = [...currentTimes];
                                                            newTimes[i] = newTime;
                                                            setFormData({ ...formData, schedule_times: newTimes, timing: `Custom: ${newTimes.join(', ')}` });
                                                        }
                                                    }}
                                                    required={i === 0}
                                                    className="w-full p-3 bg-white border border-surface shadow-sm rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none hover:border-primary/50 transition-all duration-200 text-sm h-12 text-text font-medium"
                                                />
                                                {i === 0 && (
                                                    <span className="text-[10px] text-primary mt-1 block">Changes auto-fill other times</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-text-muted mt-4 italic">
                                    💡 Tip: Set your first dose time, other times will be auto-calculated based on {getIntervalHours(formData.frequency)}-hour intervals.
                                </p>
                            </div>

                            <div className="p-6 bg-[#EFF4FF]/50 rounded-3xl border border-dashed border-[#A9B5DF]/60">
                                <h3 className="font-bold text-text mb-4 text-sm uppercase tracking-wider flex items-center gap-2"><Package size={16} className="text-primary" /> Inventory Tracking (Optional)</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <Input
                                        label="Total Stock"
                                        type="number"
                                        value={formData.total_stock ?? ''}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setFormData({ ...formData, total_stock: val === '' ? undefined : parseInt(val) || 0 });
                                        }}
                                        className={premiumInputClass}
                                    />
                                    <Input
                                        label="Current"
                                        type="number"
                                        value={formData.current_stock ?? ''}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setFormData({ ...formData, current_stock: val === '' ? undefined : parseInt(val) || 0 });
                                        }}
                                        className={premiumInputClass}
                                    />
                                    <Input
                                        label="Pills/Dose"
                                        type="number"
                                        value={formData.dose_per_intake ?? 1}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setFormData({ ...formData, dose_per_intake: val === '' ? 1 : parseInt(val) || 1 });
                                        }}
                                        className={premiumInputClass}
                                    />
                                </div>
                            </div>

                            {/* Purpose & Instructions (Optional) */}
                            <div className="p-6 bg-gradient-to-br from-secondary/5 to-primary/5 rounded-3xl border border-secondary/20">
                                <h3 className="font-bold text-text mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                                    <FileText size={16} className="text-secondary" />
                                    Purpose & Instructions (Optional)
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-semibold text-text-muted block mb-2">Purpose</label>
                                        <textarea
                                            value={formData.purpose || ''}
                                            onChange={e => setFormData({ ...formData, purpose: e.target.value || undefined })}
                                            placeholder="e.g., Pain relief, antibiotics for bacterial infection, blood pressure control..."
                                            rows={2}
                                            className="w-full p-3 bg-white border border-surface shadow-sm rounded-xl focus:ring-2 focus:ring-secondary/30 focus:border-secondary outline-none hover:border-secondary/50 transition-all duration-200 text-sm resize-y min-h-[60px]"
                                        />
                                        <p className="text-[10px] text-text-muted mt-1">Leave blank to use "Tap to get AI purpose" on the card</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-text-muted block mb-2">Instructions</label>
                                        <textarea
                                            value={formData.instructions || ''}
                                            onChange={e => setFormData({ ...formData, instructions: e.target.value || undefined })}
                                            placeholder="e.g., Take with food to avoid stomach upset. Do not take with dairy products. Avoid alcohol while on this medication..."
                                            rows={2}
                                            className="w-full p-3 bg-white border border-surface shadow-sm rounded-xl focus:ring-2 focus:ring-secondary/30 focus:border-secondary outline-none hover:border-secondary/50 transition-all duration-200 text-sm resize-y min-h-[60px]"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <Button type="button" variant="secondary" onClick={() => { setShowAddModal(false); setEditingMedication(null); }}>Cancel</Button>
                                <Button type="submit" isLoading={isSaving}>{editingMedication ? 'Save Changes' : 'Add Medication'}</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* Refill Modal */}
            {refillModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-sm p-6">
                        <h2 className="text-xl font-bold mb-4">Refill Inventory</h2>
                        <Input label="Amount to add" type="number" value={refillAmount} onChange={e => setRefillAmount(parseInt(e.target.value))} className="mb-6" />
                        <div className="flex justify-end gap-3">
                            <Button variant="secondary" onClick={() => setRefillModal(null)}>Cancel</Button>
                            <Button onClick={handleRefill} isLoading={isSaving}>Confirm Refill</Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Chat Overlay */}
            {showChat && (
                <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-3xl shadow-2xl z-50 flex flex-col border border-surface animate-in slide-in-from-bottom-10">
                    <div className="p-4 bg-primary text-white rounded-t-3xl flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-full"><Bot size={20} /></div>
                            <div>
                                <h3 className="font-bold">HealthMate</h3>
                                <p className="text-xs text-blue-100">AI Assistant</p>
                            </div>
                        </div>
                        <button onClick={() => setShowChat(false)} className="text-white/80 hover:text-white"><X size={20} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-white text-text border border-surface rounded-tl-none shadow-sm'}`}>
                                    {m.content}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-surface rounded-b-3xl flex gap-2">
                        <input
                            className="flex-1 bg-surface/30 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder="Ask about medications..."
                            value={inputMessage}
                            onChange={e => setInputMessage(e.target.value)}
                        />
                        <button type="submit" disabled={isSending} className="p-2 bg-primary text-white rounded-xl hover:bg-primary-hover disabled:opacity-50">
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            )}

        </div>
    );
}
