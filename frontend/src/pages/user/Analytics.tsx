import { useState, useEffect } from 'react';
import {
    getAdherenceStats,
    getMissedDoses,
    getStreak,
    type AdherenceStats,
    type MissedDosesResponse,
    type StreakResponse
} from '../../api/medication';
import {
    Loader2,
    Activity,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    Flame,
    Calendar,
    Clock,
    Pill,
    ChevronRight,
    Target,
    Award
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import toast from 'react-hot-toast';

// Animated circular progress ring component
const AdherenceRing = ({ percentage, size = 160 }: { percentage: number; size?: number }) => {
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    // Color based on percentage
    const getColor = () => {
        if (percentage >= 80) return '#10b981'; // Green
        if (percentage >= 50) return '#f59e0b'; // Amber
        return '#ef4444'; // Red
    };

    const getLabel = () => {
        if (percentage >= 90) return 'Excellent!';
        if (percentage >= 80) return 'Great job!';
        if (percentage >= 60) return 'Keep going!';
        if (percentage >= 40) return 'Room to improve';
        return 'Needs attention';
    };

    return (
        <div className="relative flex flex-col items-center justify-center">
            <svg width={size} height={size} className="transform -rotate-90">
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#E2E8F0"
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={getColor()}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-[#2D336B]">{percentage}%</span>
                <span className="text-sm font-medium text-[#2D336B]/60 mt-1">{getLabel()}</span>
            </div>
        </div>
    );
};

// Stat Card Component
const StatCard = ({
    icon: Icon,
    label,
    value,
    subValue,
    colorClass
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    subValue?: string;
    colorClass: string;
}) => (
    <div className="bg-white/70 backdrop-blur-xl border border-[#A9B5DF]/40 rounded-2xl p-6 shadow-lg shadow-[#2D336B]/5 hover:shadow-xl hover:shadow-[#7886C7]/10 transition-all duration-300 hover:-translate-y-1">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-[#2D336B]/60 uppercase tracking-wider">{label}</p>
                <h3 className="text-3xl font-bold text-[#2D336B] mt-2">{value}</h3>
                {subValue && <p className="text-sm text-[#2D336B]/50 mt-1">{subValue}</p>}
            </div>
            <div className={`p-4 rounded-2xl ${colorClass}`}>
                <Icon size={28} />
            </div>
        </div>
    </div>
);

// Medication Progress Card
const MedicationCard = ({
    name,
    taken,
    total,
    percentage
}: {
    name: string;
    taken: number;
    total: number;
    percentage: number;
}) => {
    const getColor = () => {
        if (percentage >= 80) return 'bg-emerald-500';
        if (percentage >= 50) return 'bg-amber-500';
        return 'bg-red-500';
    };

    const getBgColor = () => {
        if (percentage >= 80) return 'bg-emerald-50 border-emerald-200/50';
        if (percentage >= 50) return 'bg-amber-50 border-amber-200/50';
        return 'bg-red-50 border-red-200/50';
    };

    return (
        <div className={`${getBgColor()} border rounded-2xl p-5 hover:shadow-lg transition-all duration-300`}>
            <div className="flex items-center gap-3 mb-3">
                <div className={`p-2.5 rounded-xl ${getColor()} bg-opacity-10`}>
                    <Pill size={18} className={getColor().replace('bg-', 'text-')} />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-[#2D336B] truncate">{name}</h4>
                    <p className="text-sm text-[#2D336B]/50">{taken}/{total} doses</p>
                </div>
                <span className="text-lg font-bold text-[#2D336B]">{percentage}%</span>
            </div>
            <div className="w-full bg-white/50 rounded-full h-2.5 overflow-hidden">
                <div
                    className={`h-full rounded-full ${getColor()} transition-all duration-700`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

// Missed Dose Row
const MissedDoseRow = ({
    medicationName,
    date,
    timeSlot
}: {
    medicationName: string;
    date: string;
    timeSlot: string;
}) => {
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    return (
        <div className="flex items-center gap-4 p-4 hover:bg-red-50/50 rounded-xl transition-colors group">
            <div className="w-3 h-3 rounded-full bg-red-500 ring-4 ring-red-100" />
            <div className="flex-1 min-w-0">
                <p className="font-medium text-[#2D336B] truncate">{medicationName}</p>
                <div className="flex items-center gap-2 text-sm text-[#2D336B]/50">
                    <Calendar size={14} />
                    <span>{formattedDate}</span>
                    <Clock size={14} className="ml-2" />
                    <span>{timeSlot}</span>
                </div>
            </div>
            <ChevronRight size={18} className="text-[#2D336B]/30 group-hover:text-[#7886C7] transition-colors" />
        </div>
    );
};

export function Analytics() {
    const [isLoading, setIsLoading] = useState(true);
    const [period, setPeriod] = useState<'week' | 'month'>('week');
    const [adherenceStats, setAdherenceStats] = useState<AdherenceStats | null>(null);
    const [missedDoses, setMissedDoses] = useState<MissedDosesResponse | null>(null);
    const [streak, setStreak] = useState<StreakResponse | null>(null);

    useEffect(() => {
        fetchData();
    }, [period]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [statsRes, missedRes, streakRes] = await Promise.all([
                getAdherenceStats(period),
                getMissedDoses(10),
                getStreak()
            ]);

            if (statsRes.success) setAdherenceStats(statsRes);
            if (missedRes.success) setMissedDoses(missedRes);
            if (streakRes.success) setStreak(streakRes);
        } catch {
            toast.error('Failed to load health insights');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-[#7886C7]" size={48} />
                    <p className="text-[#2D336B]/60 font-medium">Loading your health insights...</p>
                </div>
            </div>
        );
    }

    // Check for empty state
    if (!adherenceStats || adherenceStats.summary.total_doses === 0) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8">
                <div className="w-24 h-24 bg-[#EEF2FF] rounded-full flex items-center justify-center mb-6">
                    <Activity size={48} className="text-[#7886C7]" />
                </div>
                <h2 className="text-2xl font-bold text-[#2D336B] mb-2">No Data Yet</h2>
                <p className="text-[#2D336B]/60 max-w-md mb-6">
                    Start tracking your medications to see your health insights.
                    Mark your doses as taken each day to build your adherence history.
                </p>
                <a
                    href="/user/medications"
                    className="px-6 py-3 bg-[#7886C7] text-white font-semibold rounded-xl hover:bg-[#6876bf] transition-colors shadow-lg shadow-[#7886C7]/30"
                >
                    Go to Medications
                </a>
            </div>
        );
    }

    const { summary, by_medication, by_date } = adherenceStats;

    // Prepare chart data from by_date
    const chartData = Object.entries(by_date)
        .map(([date, stats]) => ({
            date,
            taken: stats.taken,
            missed: stats.missed,
            total: stats.total
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    // Prepare pie data
    const pieData = [
        { name: 'Taken', value: summary.taken, color: '#10b981' },
        { name: 'Missed', value: summary.missed, color: '#ef4444' },
    ].filter(d => d.value > 0);

    // Medication cards data
    const medicationCards = Object.entries(by_medication).map(([name, stats]) => ({
        name,
        taken: stats.taken,
        total: stats.total,
        percentage: stats.adherence_percentage
    }));

    return (
        <div className="min-h-screen bg-[#EEF2FF] p-4 lg:p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
                    <div>
                        <h1 className="text-2xl font-bold text-[#2D336B] flex items-center gap-3">
                            <Activity className="text-[#7886C7]" size={28} />
                            Health Insights
                        </h1>
                        <p className="text-[#2D336B]/60 mt-1 font-medium">
                            Track your medication adherence and health trends
                        </p>
                    </div>

                    {/* Period Toggle */}
                    <div className="flex p-1.5 bg-white/70 backdrop-blur-xl border border-[#A9B5DF]/40 rounded-xl shadow-sm">
                        <button
                            onClick={() => setPeriod('week')}
                            className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${period === 'week'
                                    ? 'bg-[#7886C7] text-white shadow-md'
                                    : 'text-[#2D336B]/70 hover:text-[#2D336B] hover:bg-white/50'
                                }`}
                        >
                            Last 7 Days
                        </button>
                        <button
                            onClick={() => setPeriod('month')}
                            className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${period === 'month'
                                    ? 'bg-[#7886C7] text-white shadow-md'
                                    : 'text-[#2D336B]/70 hover:text-[#2D336B] hover:bg-white/50'
                                }`}
                        >
                            Last 30 Days
                        </button>
                    </div>
                </div>

                {/* Hero Section - 3 Main Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Adherence Score Card */}
                    <div className="bg-white/70 backdrop-blur-xl border border-[#A9B5DF]/40 rounded-[1.5rem] p-8 shadow-xl shadow-[#2D336B]/5 flex flex-col items-center justify-center">
                        <h3 className="text-sm font-semibold text-[#2D336B]/60 uppercase tracking-wider mb-4">
                            Adherence Score
                        </h3>
                        <AdherenceRing percentage={Math.round(summary.adherence_percentage)} />
                        <div className="mt-4 flex items-center gap-2 text-sm text-[#2D336B]/50">
                            <Target size={16} />
                            <span>Goal: 90%+</span>
                        </div>
                    </div>

                    {/* Streak Card */}
                    <div className="bg-gradient-to-br from-[#FF6B35]/10 to-[#FF6B35]/5 border border-[#FF6B35]/20 rounded-[1.5rem] p-8 shadow-xl shadow-[#2D336B]/5 flex flex-col items-center justify-center">
                        <h3 className="text-sm font-semibold text-[#2D336B]/60 uppercase tracking-wider mb-4">
                            Current Streak
                        </h3>
                        <div className="flex items-center gap-3">
                            <Flame size={48} className="text-orange-500" />
                            <span className="text-5xl font-bold text-[#2D336B]">
                                {streak?.current_streak || 0}
                            </span>
                            <span className="text-xl text-[#2D336B]/60">days</span>
                        </div>
                        {streak?.best_streak !== undefined && streak.best_streak > 0 && (
                            <div className="mt-4 flex items-center gap-2 text-sm text-[#2D336B]/50">
                                <Award size={16} className="text-amber-500" />
                                <span>Best: {streak.best_streak} days</span>
                            </div>
                        )}
                    </div>

                    {/* Doses Summary Card */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-emerald-50 border border-emerald-200/50 rounded-2xl p-5 flex flex-col items-center justify-center">
                            <CheckCircle2 size={32} className="text-emerald-500 mb-2" />
                            <span className="text-3xl font-bold text-emerald-700">{summary.taken}</span>
                            <span className="text-sm text-emerald-600/70 font-medium">Taken</span>
                        </div>
                        <div className="bg-red-50 border border-red-200/50 rounded-2xl p-5 flex flex-col items-center justify-center">
                            <AlertTriangle size={32} className="text-red-500 mb-2" />
                            <span className="text-3xl font-bold text-red-700">{summary.missed}</span>
                            <span className="text-sm text-red-600/70 font-medium">Missed</span>
                        </div>
                        <div className="col-span-2 bg-[#7886C7]/10 border border-[#7886C7]/20 rounded-2xl p-4 flex items-center justify-center gap-3">
                            <TrendingUp size={24} className="text-[#7886C7]" />
                            <div className="text-center">
                                <span className="text-xl font-bold text-[#2D336B]">{summary.total_doses}</span>
                                <span className="text-sm text-[#2D336B]/60 ml-1">total doses tracked</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Trend Chart */}
                    <div className="lg:col-span-2 bg-white/70 backdrop-blur-xl border border-[#A9B5DF]/40 rounded-[1.5rem] p-6 shadow-xl shadow-[#2D336B]/5">
                        <h3 className="text-lg font-bold text-[#2D336B] mb-6 flex items-center gap-2">
                            <TrendingUp size={20} className="text-[#7886C7]" />
                            Adherence Trend
                        </h3>
                        <div className="h-[280px] w-full">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorTaken" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorMissed" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            stroke="#64748b"
                                            fontSize={12}
                                            tickLine={false}
                                        />
                                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#fff',
                                                borderRadius: '12px',
                                                border: 'none',
                                                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)'
                                            }}
                                            labelFormatter={(val) => new Date(val).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="taken"
                                            stroke="#10b981"
                                            fillOpacity={1}
                                            fill="url(#colorTaken)"
                                            strokeWidth={3}
                                            name="Taken"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="missed"
                                            stroke="#ef4444"
                                            fillOpacity={1}
                                            fill="url(#colorMissed)"
                                            strokeWidth={3}
                                            name="Missed"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-[#2D336B]/40">
                                    No trend data available yet
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Pie Chart */}
                    <div className="bg-white/70 backdrop-blur-xl border border-[#A9B5DF]/40 rounded-[1.5rem] p-6 shadow-xl shadow-[#2D336B]/5">
                        <h3 className="text-lg font-bold text-[#2D336B] mb-6">Distribution</h3>
                        <div className="h-[280px] w-full flex items-center justify-center">
                            {pieData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={90}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value: number) => [`${value} doses`, '']}
                                            contentStyle={{
                                                backgroundColor: '#fff',
                                                borderRadius: '12px',
                                                border: 'none',
                                                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)'
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-[#2D336B]/40">No data</div>
                            )}
                        </div>
                        <div className="flex justify-center gap-6 mt-2">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                <span className="text-sm text-[#2D336B]/70">Taken</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <span className="text-sm text-[#2D336B]/70">Missed</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* By Medication Section */}
                {medicationCards.length > 0 && (
                    <div className="bg-white/70 backdrop-blur-xl border border-[#A9B5DF]/40 rounded-[1.5rem] p-6 shadow-xl shadow-[#2D336B]/5">
                        <h3 className="text-lg font-bold text-[#2D336B] mb-6 flex items-center gap-2">
                            <Pill size={20} className="text-[#7886C7]" />
                            By Medication
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {medicationCards.map((med, index) => (
                                <MedicationCard
                                    key={index}
                                    name={med.name}
                                    taken={med.taken}
                                    total={med.total}
                                    percentage={med.percentage}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Missed Doses History */}
                {missedDoses && missedDoses.missed_doses.length > 0 && (
                    <div className="bg-white/70 backdrop-blur-xl border border-[#A9B5DF]/40 rounded-[1.5rem] p-6 shadow-xl shadow-[#2D336B]/5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-[#2D336B] flex items-center gap-2">
                                <AlertTriangle size={20} className="text-red-500" />
                                Missed Doses
                            </h3>
                            <span className="text-sm text-[#2D336B]/50">
                                Showing last {missedDoses.count} missed
                            </span>
                        </div>
                        <div className="divide-y divide-[#A9B5DF]/20">
                            {missedDoses.missed_doses.map((dose, index) => (
                                <MissedDoseRow
                                    key={index}
                                    medicationName={dose.medication_name}
                                    date={dose.date}
                                    timeSlot={dose.time_slot}
                                />
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
