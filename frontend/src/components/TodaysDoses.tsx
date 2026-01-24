import { useState, useEffect } from 'react';
import {
    Pill, Clock, CheckCircle2, XCircle, AlertCircle,
    Sun, Moon, CloudSun, Loader2, RefreshCw, Calendar
} from 'lucide-react';
import { getTodayDoses, markDoseTaken, type TodayDoseItem, type DoseSummary } from '../api/doses';
import toast from 'react-hot-toast';

// Time period grouping
type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';

function getTimePeriod(time: string): TimePeriod {
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
}

const periodConfig = {
    morning: { icon: Sun, label: 'Morning', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    afternoon: { icon: CloudSun, label: 'Afternoon', color: 'text-orange-400', bg: 'bg-orange-500/10' },
    evening: { icon: CloudSun, label: 'Evening', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    night: { icon: Moon, label: 'Night', color: 'text-indigo-400', bg: 'bg-indigo-500/10' }
};

// Status configuration type
type DoseStatusType = 'pending' | 'available' | 'taken' | 'late' | 'missed';

interface StatusConfig {
    bg: string;
    border: string;
    text: string;
    label: string;
    icon: typeof Clock;
    canClick: boolean;
}

// Dose Button Component
function DoseButton({
    dose,
    onMarkTaken
}: {
    dose: TodayDoseItem;
    onMarkTaken: (medicationId: string, scheduledTime: string) => void;
}) {
    const statusConfig: Record<DoseStatusType, StatusConfig> = {
        pending: {
            bg: 'bg-dark-700',
            border: 'border-dark-600',
            text: 'text-dark-400',
            label: 'Scheduled',
            icon: Clock,
            canClick: false
        },
        available: {
            bg: 'bg-primary-500/10',
            border: 'border-primary-500/30',
            text: 'text-primary-400',
            label: 'Take Now',
            icon: Pill,
            canClick: true
        },
        taken: {
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/30',
            text: 'text-emerald-400',
            label: dose.taken_at ? `Taken at ${dose.taken_at}` : 'Taken',
            icon: CheckCircle2,
            canClick: false
        },
        late: {
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/30',
            text: 'text-amber-400',
            label: dose.taken_at ? `Late at ${dose.taken_at}` : 'Late',
            icon: AlertCircle,
            canClick: false
        },
        missed: {
            bg: 'bg-red-500/10',
            border: 'border-red-500/30',
            text: 'text-red-400',
            label: 'Missed',
            icon: XCircle,
            canClick: false
        }
    };

    const config = statusConfig[dose.status as DoseStatusType] || statusConfig.pending;
    const Icon = config.icon;

    const handleClick = () => {
        if (dose.can_take) {
            onMarkTaken(dose.medication_id, dose.scheduled_time);
        }
    };

    // Format time until/since
    let timeLabel = '';
    if (dose.time_until && dose.time_until > 0) {
        if (dose.time_until < 60) {
            timeLabel = `in ${dose.time_until}min`;
        } else {
            timeLabel = `in ${Math.floor(dose.time_until / 60)}h`;
        }
    } else if (dose.time_since && dose.time_since > 0 && dose.status !== 'taken' && dose.status !== 'late') {
        if (dose.time_since < 60) {
            timeLabel = `${dose.time_since}min ago`;
        } else {
            timeLabel = `${Math.floor(dose.time_since / 60)}h ago`;
        }
    }

    return (
        <div
            className={`p-4 rounded-xl border ${config.bg} ${config.border} ${dose.can_take ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}`}
            onClick={handleClick}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-dark-800">
                        <Pill className="text-primary-400" size={16} />
                    </div>
                    <span className="font-medium text-dark-100">{dose.medication_name}</span>
                </div>
                <span className="text-sm text-dark-400">{dose.scheduled_time}</span>
            </div>

            <div className="flex items-center justify-between">
                <div className={`flex items-center gap-1.5 ${config.text}`}>
                    <Icon size={14} />
                    <span className="text-sm font-medium">{config.label}</span>
                </div>
                {timeLabel && (
                    <span className="text-xs text-dark-500">{timeLabel}</span>
                )}
            </div>
        </div>
    );
}

// Summary Header
function DoseSummaryHeader({ summary, date }: { summary: DoseSummary; date: string }) {
    const progressPercent = summary.total > 0
        ? Math.round((summary.taken / summary.total) * 100)
        : 0;

    return (
        <div className="glass-card p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary-500/20 to-secondary-500/20">
                        <Calendar className="text-primary-400" size={22} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-dark-50">Today's Doses</h2>
                        <p className="text-sm text-dark-400">{new Date(date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric'
                        })}</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-dark-50">{summary.taken}/{summary.total}</div>
                    <div className="text-sm text-dark-400">doses taken</div>
                </div>
            </div>

            {/* Progress bar */}
            <div className="relative h-3 bg-dark-700 rounded-full overflow-hidden">
                <div
                    className="absolute h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mt-4">
                <div className="text-center">
                    <div className="text-lg font-semibold text-emerald-400">{summary.taken}</div>
                    <div className="text-xs text-dark-400">Taken</div>
                </div>
                <div className="text-center">
                    <div className="text-lg font-semibold text-primary-400">{summary.pending}</div>
                    <div className="text-xs text-dark-400">Pending</div>
                </div>
                <div className="text-center">
                    <div className="text-lg font-semibold text-red-400">{summary.missed}</div>
                    <div className="text-xs text-dark-400">Missed</div>
                </div>
                <div className="text-center">
                    <div className="text-lg font-semibold text-amber-400">{summary.adherence_rate}%</div>
                    <div className="text-xs text-dark-400">Adherence</div>
                </div>
            </div>
        </div>
    );
}

// Main Component
export function TodaysDoses() {
    const [doses, setDoses] = useState<TodayDoseItem[]>([]);
    const [summary, setSummary] = useState<DoseSummary | null>(null);
    const [date, setDate] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchDoses();

        // Refresh every minute to update time displays
        const interval = setInterval(fetchDoses, 60000);
        return () => clearInterval(interval);
    }, []);

    const fetchDoses = async () => {
        try {
            const response = await getTodayDoses();
            if (response.success) {
                setDoses(response.doses);
                setSummary(response.summary);
                setDate(response.date);
            }
        } catch (error) {
            console.error('Failed to fetch doses:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMarkTaken = async (medicationId: string, scheduledTime: string) => {
        try {
            const response = await markDoseTaken(medicationId, scheduledTime);
            if (response.success) {
                toast.success(response.message);
                fetchDoses();  // Refresh to show updated status
            } else {
                toast.error('Failed to mark dose');
            }
        } catch (error) {
            toast.error('Failed to mark dose');
        }
    };

    // Group doses by time period
    const groupedDoses: Record<TimePeriod, TodayDoseItem[]> = {
        morning: [],
        afternoon: [],
        evening: [],
        night: []
    };

    doses.forEach(dose => {
        const period = getTimePeriod(dose.scheduled_time);
        groupedDoses[period].push(dose);
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-primary-500" size={32} />
            </div>
        );
    }

    if (doses.length === 0) {
        return (
            <div className="glass-card p-8 text-center">
                <Pill className="mx-auto text-dark-400 mb-4" size={48} />
                <h3 className="text-lg font-semibold text-dark-100 mb-2">No Doses Scheduled</h3>
                <p className="text-dark-400">Add medications to see your daily dose schedule.</p>
            </div>
        );
    }

    return (
        <div>
            {summary && <DoseSummaryHeader summary={summary} date={date} />}

            <div className="space-y-6">
                {(['morning', 'afternoon', 'evening', 'night'] as TimePeriod[]).map(period => {
                    const periodDoses = groupedDoses[period];
                    if (periodDoses.length === 0) return null;

                    const { icon: PeriodIcon, label, color, bg } = periodConfig[period];

                    return (
                        <div key={period}>
                            <div className={`flex items-center gap-2 mb-3 ${color}`}>
                                <div className={`p-1.5 rounded-lg ${bg}`}>
                                    <PeriodIcon size={16} />
                                </div>
                                <span className="font-medium">{label}</span>
                                <span className="text-dark-500 text-sm">({periodDoses.length})</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {periodDoses.map((dose, idx) => (
                                    <DoseButton
                                        key={`${dose.medication_id}-${dose.scheduled_time}-${idx}`}
                                        dose={dose}
                                        onMarkTaken={handleMarkTaken}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Refresh button */}
            <div className="flex justify-center mt-6">
                <button
                    onClick={fetchDoses}
                    className="flex items-center gap-2 text-sm text-dark-400 hover:text-primary-400 transition-colors"
                >
                    <RefreshCw size={14} />
                    Refresh
                </button>
            </div>
        </div>
    );
}
