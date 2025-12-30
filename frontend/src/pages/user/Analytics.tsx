import { useState, useEffect, useRef } from 'react';
import {
    getAdherenceStats,
    getMissedDoses,
    getStreak,
    getTimeAnalysis,
    getComparison,
    getAIInsights,
    canRefreshInsights,
    type AdherenceStats,
    type MissedDosesResponse,
    type StreakResponse,
    type TimeAnalysisResponse,
    type ComparisonResponse,
    type AIInsightsResponse,
    type CanRefreshResponse
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
    Award,
    Sparkles,
    ChevronDown,
    GripHorizontal
} from 'lucide-react';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, ReferenceLine
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
    const [timeAnalysis, setTimeAnalysis] = useState<TimeAnalysisResponse | null>(null);
    const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
    const [aiInsights, setAiInsights] = useState<AIInsightsResponse | null>(null);
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const [navExpanded, setNavExpanded] = useState(false);
    const [canRefresh, setCanRefresh] = useState<CanRefreshResponse | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Section refs for quick navigation
    const sectionRefs = {
        overview: useRef<HTMLDivElement>(null),
        trend: useRef<HTMLDivElement>(null),
        comparison: useRef<HTMLDivElement>(null),
        timeAnalysis: useRef<HTMLDivElement>(null),
        calendar: useRef<HTMLDivElement>(null),
        aiInsights: useRef<HTMLDivElement>(null),
        missed: useRef<HTMLDivElement>(null)
    };

    // Quick navigation items
    const navItems = [
        { id: 'overview', label: 'Overview', icon: Target, color: 'text-emerald-600' },
        { id: 'trend', label: 'Trend', icon: TrendingUp, color: 'text-blue-600' },
        { id: 'comparison', label: 'Week', icon: Activity, color: 'text-purple-600' },
        { id: 'timeAnalysis', label: 'Time', icon: Clock, color: 'text-amber-600' },
        { id: 'calendar', label: 'Calendar', icon: Calendar, color: 'text-indigo-600' },
        { id: 'aiInsights', label: 'AI Tips', icon: Sparkles, color: 'text-pink-600' },
        { id: 'missed', label: 'Missed', icon: AlertTriangle, color: 'text-red-600' }
    ];

    // Scroll to section
    const scrollToSection = (sectionId: string) => {
        const ref = sectionRefs[sectionId as keyof typeof sectionRefs];
        if (ref?.current) {
            ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setActiveSection(sectionId);
            // Reset active after animation
            setTimeout(() => setActiveSection(null), 1500);
        }
    };

    useEffect(() => {
        fetchData();
    }, [period]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [statsRes, missedRes, streakRes, timeRes, compRes, aiRes] = await Promise.all([
                getAdherenceStats(period),
                getMissedDoses(10),
                getStreak(),
                getTimeAnalysis(period),
                getComparison(),
                getAIInsights()
            ]);

            if (statsRes.success) setAdherenceStats(statsRes);
            if (missedRes.success) setMissedDoses(missedRes);
            if (streakRes.success) setStreak(streakRes);
            if (timeRes.success) setTimeAnalysis(timeRes);
            if (compRes.success) setComparison(compRes);
            if (aiRes.success) setAiInsights(aiRes);

            // Check refresh status
            const refreshStatus = await canRefreshInsights();
            setCanRefresh(refreshStatus);
        } catch {
            toast.error('Failed to load health insights');
        } finally {
            setIsLoading(false);
        }
    };

    // Handler for refreshing AI insights
    const handleRefreshInsights = async () => {
        if (!canRefresh?.can_refresh) {
            toast.error(`You can refresh in ${canRefresh?.hours_until_refresh || 24} hours`);
            return;
        }

        setIsRefreshing(true);
        try {
            const newInsights = await getAIInsights(true); // force refresh
            if (newInsights.success) {
                setAiInsights(newInsights);
                toast.success('AI insights refreshed!');
                // Update refresh status
                const refreshStatus = await canRefreshInsights();
                setCanRefresh(refreshStatus);
            }
        } catch {
            toast.error('Failed to refresh insights');
        } finally {
            setIsRefreshing(false);
        }
    };

    // Helper to format time ago
    const formatTimeAgo = (isoDate: string): string => {
        try {
            const date = new Date(isoDate);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMins = Math.floor(diffMs / (1000 * 60));

            if (diffMins < 1) return 'just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            return `${Math.floor(diffHours / 24)}d ago`;
        } catch {
            return '';
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

    // Prepare chart data from by_date with adherence percentage
    const chartData = Object.entries(by_date)
        .map(([date, stats]) => ({
            date,
            taken: stats.taken,
            missed: stats.missed,
            total: stats.total,
            adherence: stats.total > 0 ? Math.round((stats.taken / stats.total) * 100) : 0
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    // Prepare pie data
    const pieData = [
        { name: 'Taken', value: summary.taken, color: '#10b981' },
        { name: 'Missed', value: summary.missed, color: '#ef4444' },
    ].filter(d => d.value > 0);

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

                {/* Quick Navigation Bar - Collapsible */}
                <div
                    className="sticky top-4 z-20 group"
                    onMouseEnter={() => setNavExpanded(true)}
                    onMouseLeave={() => setNavExpanded(false)}
                >
                    <div className={`bg-white/95 backdrop-blur-xl border border-[#A9B5DF]/40 rounded-2xl shadow-lg shadow-[#2D336B]/10 transition-all duration-300 overflow-hidden ${navExpanded ? 'p-3' : 'p-2'}`}>
                        {/* Drag Handle - Click to toggle */}
                        <button
                            onClick={() => setNavExpanded(!navExpanded)}
                            className="w-full flex items-center justify-center gap-2 mb-2 text-[#2D336B]/40 hover:text-[#7886C7] transition-colors"
                        >
                            <GripHorizontal size={16} />
                            <ChevronDown
                                size={14}
                                className={`transition-transform duration-300 ${navExpanded ? 'rotate-180' : ''}`}
                            />
                        </button>

                        {/* Navigation Icons */}
                        <div className="flex items-center justify-center gap-1 overflow-x-auto">
                            {navItems.map(({ id, label, icon: Icon, color }) => (
                                <button
                                    key={id}
                                    onClick={() => scrollToSection(id)}
                                    title={label}
                                    className={`flex flex-col items-center gap-1 rounded-xl transition-all hover:bg-[#EEF2FF] hover:scale-110 ${navExpanded ? 'px-3 py-2' : 'px-2 py-1.5'} ${activeSection === id ? 'bg-[#EEF2FF] ring-2 ring-[#7886C7]/50' : ''
                                        }`}
                                >
                                    <Icon size={navExpanded ? 20 : 18} className={color} />
                                    <span
                                        className={`text-[10px] font-medium text-[#2D336B]/70 whitespace-nowrap transition-all duration-300 ${navExpanded ? 'opacity-100 max-h-4' : 'opacity-0 max-h-0 overflow-hidden'}`}
                                    >
                                        {label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Hero Section - 3 Main Cards */}
                <div ref={sectionRefs.overview} className="grid grid-cols-1 lg:grid-cols-3 gap-6 scroll-mt-24">

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
                <div ref={sectionRefs.trend} className="grid grid-cols-1 lg:grid-cols-3 gap-6 scroll-mt-24">

                    {/* Trend Chart */}
                    <div className="lg:col-span-2 bg-white/70 backdrop-blur-xl border border-[#A9B5DF]/40 rounded-[1.5rem] p-6 shadow-xl shadow-[#2D336B]/5">
                        <h3 className="text-lg font-bold text-[#2D336B] mb-6 flex items-center gap-2">
                            <TrendingUp size={20} className="text-[#7886C7]" />
                            Adherence Trend
                        </h3>
                        <div className="h-[280px] w-full">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                                            stroke="#64748b"
                                            fontSize={11}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            yAxisId="left"
                                            stroke="#64748b"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                            label={{ value: 'Doses', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#64748b' } }}
                                        />
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            stroke="#7886C7"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                            domain={[0, 100]}
                                            tickFormatter={(val) => `${val}%`}
                                        />

                                        {/* Goal line at 90% */}
                                        <ReferenceLine
                                            yAxisId="right"
                                            y={90}
                                            stroke="#22c55e"
                                            strokeDasharray="5 5"
                                            strokeWidth={2}
                                            label={{ value: 'Goal: 90%', position: 'right', style: { fontSize: 10, fill: '#22c55e' } }}
                                        />

                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#fff',
                                                borderRadius: '12px',
                                                border: 'none',
                                                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
                                                padding: '12px'
                                            }}
                                            labelFormatter={(val) => new Date(val).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                            formatter={(value: number, name: string, props: { payload: { taken: number; total: number; adherence: number } }) => {
                                                if (name === 'Adherence %') {
                                                    return [`${value}%`, name];
                                                }
                                                const { taken, total, adherence } = props.payload;
                                                if (name === 'Taken') {
                                                    return [`${taken}/${total} (${adherence}%)`, 'Taken'];
                                                }
                                                return [value, name];
                                            }}
                                        />

                                        <Legend
                                            verticalAlign="top"
                                            height={36}
                                            iconType="circle"
                                            iconSize={8}
                                            formatter={(value) => <span style={{ color: '#2D336B', fontSize: 12 }}>{value}</span>}
                                        />

                                        {/* Stacked bars */}
                                        <Bar
                                            yAxisId="left"
                                            dataKey="taken"
                                            stackId="a"
                                            fill="#10b981"
                                            radius={[0, 0, 0, 0]}
                                            name="Taken"
                                        />
                                        <Bar
                                            yAxisId="left"
                                            dataKey="missed"
                                            stackId="a"
                                            fill="#ef4444"
                                            radius={[4, 4, 0, 0]}
                                            name="Missed"
                                        />

                                        {/* Adherence percentage line */}
                                        <Line
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="adherence"
                                            stroke="#7886C7"
                                            strokeWidth={3}
                                            dot={{ fill: '#7886C7', strokeWidth: 2, r: 4 }}
                                            activeDot={{ r: 6, fill: '#7886C7' }}
                                            name="Adherence %"
                                        />
                                    </ComposedChart>
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

                {/* Phase 1: Week Comparison & Time Analysis Row */}
                <div ref={sectionRefs.comparison} className="grid grid-cols-1 lg:grid-cols-2 gap-6 scroll-mt-24">

                    {/* Week-over-Week Comparison */}
                    {comparison && (
                        <div className={`bg-white/70 backdrop-blur-xl border rounded-[1.5rem] p-6 shadow-xl shadow-[#2D336B]/5 ${comparison.trend === 'improving' ? 'border-emerald-200' :
                            comparison.trend === 'declining' ? 'border-red-200' : 'border-[#A9B5DF]/40'
                            }`}>
                            <h3 className="text-lg font-bold text-[#2D336B] mb-4 flex items-center gap-2">
                                <TrendingUp size={20} className={
                                    comparison.trend === 'improving' ? 'text-emerald-500' :
                                        comparison.trend === 'declining' ? 'text-red-500 rotate-180' : 'text-[#7886C7]'
                                } />
                                Week-over-Week
                            </h3>

                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-sm text-[#2D336B]/50 mb-1">This Week</p>
                                    <p className="text-3xl font-bold text-[#2D336B]">
                                        {comparison.current_week.adherence_percentage}%
                                    </p>
                                </div>
                                <div className={`px-4 py-2 rounded-xl font-bold text-lg ${comparison.delta > 0 ? 'bg-emerald-100 text-emerald-700' :
                                    comparison.delta < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                    }`}>
                                    {comparison.delta > 0 ? '+' : ''}{comparison.delta}%
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-[#2D336B]/50 mb-1">Last Week</p>
                                    <p className="text-3xl font-bold text-[#2D336B]/50">
                                        {comparison.previous_week.adherence_percentage}%
                                    </p>
                                </div>
                            </div>

                            <p className="text-sm text-[#2D336B]/70 bg-[#EEF2FF] p-3 rounded-xl">
                                💡 {comparison.insight}
                            </p>
                        </div>
                    )}

                    {/* Time-of-Day Analysis */}
                    {timeAnalysis && timeAnalysis.time_analysis.length > 0 && (
                        <div ref={sectionRefs.timeAnalysis} className="bg-white/70 backdrop-blur-xl border border-[#A9B5DF]/40 rounded-[1.5rem] p-6 shadow-xl shadow-[#2D336B]/5 scroll-mt-24">
                            <h3 className="text-lg font-bold text-[#2D336B] mb-4 flex items-center gap-2">
                                <Clock size={20} className="text-[#7886C7]" />
                                When Do You Miss Doses?
                            </h3>

                            <div className="space-y-3">
                                {timeAnalysis.time_analysis.map((item) => {
                                    const isWorst = item.period === timeAnalysis.worst_period && item.miss_percentage > 0;
                                    return (
                                        <div key={item.period} className="relative">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`text-sm font-medium ${isWorst ? 'text-red-600' : 'text-[#2D336B]/70'}`}>
                                                    {item.label}
                                                    {isWorst && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Problem Time</span>}
                                                </span>
                                                <span className={`text-sm font-bold ${item.miss_percentage > 30 ? 'text-red-600' :
                                                    item.miss_percentage > 10 ? 'text-amber-600' : 'text-emerald-600'
                                                    }`}>
                                                    {item.miss_percentage}% missed
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${item.miss_percentage > 30 ? 'bg-red-500' :
                                                        item.miss_percentage > 10 ? 'bg-amber-500' : 'bg-emerald-500'
                                                        }`}
                                                    style={{ width: `${100 - item.miss_percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {timeAnalysis.insight && (
                                <p className="mt-4 text-sm text-[#2D336B]/70 bg-amber-50 p-3 rounded-xl border border-amber-200/50">
                                    ⚠️ {timeAnalysis.insight}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Calendar Heatmap */}
                {adherenceStats && Object.keys(adherenceStats.by_date).length > 0 && (
                    <div ref={sectionRefs.calendar} className="bg-white/70 backdrop-blur-xl border border-[#A9B5DF]/40 rounded-[1.5rem] p-6 shadow-xl shadow-[#2D336B]/5 scroll-mt-24">
                        <h3 className="text-lg font-bold text-[#2D336B] mb-4 flex items-center gap-2">
                            <Calendar size={20} className="text-[#7886C7]" />
                            Daily Adherence Calendar
                        </h3>

                        <div className="flex flex-wrap gap-2">
                            {Object.entries(adherenceStats.by_date)
                                .sort((a, b) => a[0].localeCompare(b[0]))
                                .map(([date, stats]) => {
                                    const adherence = stats.total > 0 ? (stats.taken / stats.total) * 100 : 100;
                                    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
                                    const dayNum = new Date(date).getDate();

                                    return (
                                        <div
                                            key={date}
                                            className={`w-12 h-14 rounded-xl flex flex-col items-center justify-center text-xs font-medium transition-all hover:scale-110 cursor-default ${adherence === 100 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                                adherence >= 50 ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                                    'bg-red-100 text-red-700 border border-red-200'
                                                }`}
                                            title={`${date}: ${Math.round(adherence)}% adherence (${stats.taken}/${stats.total})`}
                                        >
                                            <span className="text-[10px] opacity-70">{dayName}</span>
                                            <span className="text-lg font-bold">{dayNum}</span>
                                        </div>
                                    );
                                })}
                        </div>

                        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-[#2D336B]/60">
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-200" />
                                <span>100%</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-4 rounded bg-amber-100 border border-amber-200" />
                                <span>50-99%</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-4 rounded bg-red-100 border border-red-200" />
                                <span>&lt;50%</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Phase 3: AI-Powered Insights */}
                {aiInsights && aiInsights.insights.length > 0 && (
                    <div ref={sectionRefs.aiInsights} className="bg-gradient-to-br from-[#7886C7]/10 to-purple-50/50 backdrop-blur-xl border border-[#7886C7]/30 rounded-[1.5rem] p-6 shadow-xl shadow-[#2D336B]/5 scroll-mt-24">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Sparkles size={20} className="text-[#7886C7]" />
                                <h3 className="text-lg font-bold text-[#2D336B]">
                                    AI-Powered Insights
                                </h3>
                                {aiInsights.from_cache && (
                                    <span className="text-xs text-[#2D336B]/40">
                                        · Updated {formatTimeAgo(aiInsights.generated_at)}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={handleRefreshInsights}
                                disabled={isRefreshing || !canRefresh?.can_refresh}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${canRefresh?.can_refresh && !isRefreshing
                                    ? 'bg-[#7886C7]/20 text-[#7886C7] hover:bg-[#7886C7]/30 cursor-pointer'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    }`}
                                title={canRefresh?.can_refresh ? 'Refresh insights' : `Refresh available in ${canRefresh?.hours_until_refresh || 0}h`}
                            >
                                {isRefreshing ? (
                                    <Loader2 size={12} className="animate-spin" />
                                ) : (
                                    <Activity size={12} />
                                )}
                                {isRefreshing ? 'Refreshing...' : 'Refresh'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {aiInsights.insights.map((insight, index) => (
                                <div
                                    key={index}
                                    className="bg-white/80 rounded-xl p-4 border border-[#A9B5DF]/30 hover:shadow-md transition-all"
                                >
                                    <p className="text-[#2D336B] text-sm leading-relaxed">
                                        {insight}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {aiInsights.fallback && (
                            <p className="text-xs text-[#2D336B]/40 mt-4 text-center">
                                Generic insights shown. Track more doses for personalized recommendations.
                            </p>
                        )}

                        {!canRefresh?.can_refresh && canRefresh?.hours_until_refresh && (
                            <p className="text-xs text-[#2D336B]/30 mt-3 text-center">
                                Next refresh available in {canRefresh.hours_until_refresh}h
                            </p>
                        )}
                    </div>
                )}

                {/* Missed Doses History */}
                {missedDoses && missedDoses.missed_doses.length > 0 && (
                    <div ref={sectionRefs.missed} className="bg-white/70 backdrop-blur-xl border border-[#A9B5DF]/40 rounded-[1.5rem] p-6 shadow-xl shadow-[#2D336B]/5 scroll-mt-24">
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
