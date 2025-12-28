import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { getDoseHistory, type DoseHistoryResponse } from '../../api/doses';
import { Loader2, Activity, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import toast from 'react-hot-toast';

export function Analytics() {
    const [isLoading, setIsLoading] = useState(true);
    const [history, setHistory] = useState<DoseHistoryResponse | null>(null);
    const [dateRange, setDateRange] = useState<'7' | '30'>('7');

    useEffect(() => {
        fetchHistory();
    }, [dateRange]);

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            // Calculate start date based on range
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - parseInt(dateRange));

            const response = await getDoseHistory(
                start.toISOString().split('T')[0],
                end.toISOString().split('T')[0]
            );

            if (response.success) {
                setHistory(response);
            }
        } catch {
            toast.error('Failed to load analytics');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    if (!history) return null;

    interface DailyStats {
        [key: string]: { date: string; taken: number; missed: number; total: number };
    }

    // Process data for charts
    const dailyStats = history.logs.reduce((acc: DailyStats, log) => {
        const date = log.date.split('T')[0];
        if (!acc[date]) {
            acc[date] = { date, taken: 0, missed: 0, total: 0 };
        }
        acc[date].total++;
        if (log.status === 'taken') acc[date].taken++;
        else if (log.status === 'missed') acc[date].missed++;
        return acc;
    }, {} as DailyStats);

    const chartData = Object.values(dailyStats).sort((a: any, b: any) => a.date.localeCompare(b.date));

    // Calculate overall stats
    const totalDoses = history.logs.length;
    const takenDoses = history.logs.filter(l => l.status === 'taken').length;
    const missedDoses = history.logs.filter(l => l.status === 'missed').length;
    const adherence = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;

    const pieData = [
        { name: 'Taken', value: takenDoses, color: '#10b981' },
        { name: 'Missed', value: missedDoses, color: '#ef4444' },
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text">Health Analytics</h1>
                    <p className="text-text-muted mt-1">Insights into your medication adherence and health trends</p>
                </div>
                <div className="flex p-1 bg-surface/30 rounded-lg">
                    <button
                        onClick={() => setDateRange('7')}
                        className={`px - 4 py - 2 text - sm font - medium rounded - md transition - all ${dateRange === '7' ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-text'
                            } `}
                    >
                        Last 7 Days
                    </button>
                    <button
                        onClick={() => setDateRange('30')}
                        className={`px - 4 py - 2 text - sm font - medium rounded - md transition - all ${dateRange === '30' ? 'bg-white text-primary shadow-sm' : 'text-text-muted hover:text-text'
                            } `}
                    >
                        Last 30 Days
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-6 flex items-center justify-between bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                    <div>
                        <p className="text-text-muted text-sm font-medium">Adherence Score</p>
                        <h3 className="text-3xl font-bold text-primary mt-1">{adherence}%</h3>
                    </div>
                    <div className="p-3 bg-white/50 rounded-xl text-primary">
                        <Activity size={24} />
                    </div>
                </Card>

                <Card className="p-6 flex items-center justify-between">
                    <div>
                        <p className="text-text-muted text-sm font-medium">Doses Taken</p>
                        <h3 className="text-3xl font-bold text-success mt-1">{takenDoses}</h3>
                    </div>
                    <div className="p-3 bg-success-bg rounded-xl text-success">
                        <CheckCircle2 size={24} />
                    </div>
                </Card>

                <Card className="p-6 flex items-center justify-between">
                    <div>
                        <p className="text-text-muted text-sm font-medium">Missed Doses</p>
                        <h3 className="text-3xl font-bold text-error mt-1">{missedDoses}</h3>
                    </div>
                    <div className="p-3 bg-error-bg rounded-xl text-error">
                        <AlertTriangle size={24} />
                    </div>
                </Card>

                <Card className="p-6 flex items-center justify-between">
                    <div>
                        <p className="text-text-muted text-sm font-medium">Trend</p>
                        <h3 className="text-3xl font-bold text-text mt-1">
                            {adherence >= 80 ? 'Excellent' : adherence >= 50 ? 'Improving' : 'Attention'}
                        </h3>
                    </div>
                    <div className="p-3 bg-surface/50 rounded-xl text-text-muted">
                        <TrendingUp size={24} />
                    </div>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Adherence Trend Chart */}
                <Card className="p-6 lg:col-span-2">
                    <h3 className="text-lg font-semibold text-text mb-6">Adherence History</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorTaken" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#7886C7" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#7886C7" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    stroke="#64748b"
                                    fontSize={12}
                                />
                                <YAxis stroke="#64748b" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="taken"
                                    stroke="#7886C7"
                                    fillOpacity={1}
                                    fill="url(#colorTaken)"
                                    strokeWidth={3}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Adherence Distribution */}
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-text mb-6">Adherence Distribution</h3>
                    <div className="h-[300px] w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell - ${index} `} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        </div>
    );
}
