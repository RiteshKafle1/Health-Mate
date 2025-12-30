import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    getPlatformStats,
    getDoctorPerformance,
    getAppointmentAnalytics,
    getRecentActivity,
    getRegistrationStats,
    changeDoctorAvailabilityAdmin
} from '../../api/admin';
import type {
    PlatformStats,
    DoctorPerformance,
    AppointmentAnalytics,
    ActivityItem,
    RegistrationStats
} from '../../types';
import {
    Users,
    Stethoscope,
    Loader2,
    TrendingUp,
    UserPlus,
    Clock,
    CheckCircle2,
    XCircle,
    Pill,
    Activity,
    UserCheck,
    CalendarDays,
    Plus,
    ClipboardList,
    User
} from 'lucide-react';
import {
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    Legend
} from 'recharts';
import toast from 'react-hot-toast';

const COLORS = {
    completed: '#10b981',
    pending: '#f59e0b',
    cancelled: '#ef4444',
    primary: '#6366f1',
    secondary: '#8b5cf6'
};

export function AdminDashboard() {
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [doctors, setDoctors] = useState<DoctorPerformance[]>([]);
    const [analytics, setAnalytics] = useState<AppointmentAnalytics | null>(null);
    const [activity, setActivity] = useState<ActivityItem[]>([]);
    const [regStats, setRegStats] = useState<RegistrationStats | null>(null);
    const [regPeriod, setRegPeriod] = useState<'today' | 'week' | 'month'>('week');
    const [isLoading, setIsLoading] = useState(true);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    useEffect(() => {
        const loadInitial = async () => {
            try {
                const [statsRes, doctorsRes, analyticsRes, activityRes, regRes] = await Promise.all([
                    getPlatformStats(),
                    getDoctorPerformance(),
                    getAppointmentAnalytics(),
                    getRecentActivity(),
                    getRegistrationStats(regPeriod)
                ]);

                if (statsRes.success && (statsRes as any).stats) setStats((statsRes as any).stats);
                if (doctorsRes.success && (doctorsRes as any).doctors) setDoctors((doctorsRes as any).doctors);
                if (analyticsRes.success && (analyticsRes as any).analytics) setAnalytics((analyticsRes as any).analytics);
                if (activityRes.success && (activityRes as any).activity) setActivity((activityRes as any).activity);
                if (regRes.success && (regRes as any).stats) setRegStats((regRes as any).stats);

            } catch (error) {
                toast.error('Failed to load dashboard data');
            } finally {
                setIsLoading(false);
            }
        };
        loadInitial();
    }, []);

    // Effect for changing registration period independently
    useEffect(() => {
        if (!isLoading) {
            getRegistrationStats(regPeriod).then(res => {
                if (res.success && (res as any).stats) {
                    setRegStats((res as any).stats);
                }
            });
        }
    }, [regPeriod]);

    const handleToggleAvailability = async (docId: string) => {
        setTogglingId(docId);
        try {
            const response = await changeDoctorAvailabilityAdmin(docId);
            if (response.success) {
                toast.success('Availability updated');
                // Refresh doctors list manually
                getDoctorPerformance().then(res => {
                    if (res.success && (res as any).doctors) setDoctors((res as any).doctors);
                });
            }
        } catch {
            toast.error('Failed to update availability');
        } finally {
            setTogglingId(null);
        }
    };

    const formatTimeAgo = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const todayDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-dark-50">Admin Dashboard</h1>
                    <p className="text-dark-400 mt-1">{todayDate}</p>
                </div>
                <Link to="/admin/add-doctor">
                    <button className="btn-primary flex items-center gap-2">
                        <Plus size={18} />
                        Add Doctor
                    </button>
                </Link>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Doctors */}
                <Link to="/admin/doctors" className="relative group overflow-hidden rounded-2xl border border-dark-700/50 bg-dark-800/40 p-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary-500/10 hover:border-primary-500/20 hover:bg-dark-800/60 text-left">
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-transparent transition-colors">
                        <div className="p-3 rounded-xl bg-primary-500/10 text-primary-400 group-hover:bg-primary-500/20 group-hover:scale-110 transition-all duration-300">
                            <Stethoscope size={22} />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-dark-50 tracking-tight">{stats?.totalDoctors || 0}</p>
                            <p className="text-sm text-dark-400 font-medium">Total Doctors</p>
                            <p className="text-xs text-emerald-400 font-medium mt-1">{stats?.availableDoctors || 0} available right now</p>
                        </div>
                    </div>
                </Link>

                {/* Patients */}
                <Link to="/admin/patients" className="relative group overflow-hidden rounded-2xl border border-dark-700/50 bg-dark-800/40 p-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-500/20 hover:bg-dark-800/60 text-left">
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-transparent transition-colors">
                        <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 group-hover:scale-110 transition-all duration-300">
                            <Users size={22} />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-dark-50 tracking-tight">{stats?.totalPatients || 0}</p>
                            <p className="text-sm text-dark-400 font-medium">Total Patients</p>
                            {stats?.newPatientsThisWeek ? (
                                <p className="text-xs text-emerald-400 flex items-center gap-1 font-medium mt-1">
                                    <TrendingUp size={12} />+{stats.newPatientsThisWeek} this week
                                </p>
                            ) : null}
                        </div>
                    </div>
                </Link>

                {/* Today's Appointments */}
                <Link to="/admin/appointments?filter=today" className="relative group overflow-hidden rounded-2xl border border-dark-700/50 bg-dark-800/40 p-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10 hover:border-purple-500/20 hover:bg-dark-800/60 text-left">
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-transparent transition-colors">
                        <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 group-hover:scale-110 transition-all duration-300">
                            <CalendarDays size={22} />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-dark-50 tracking-tight">{stats?.todaysAppointments || 0}</p>
                            <p className="text-sm text-dark-400 font-medium">Due Today</p>
                            <p className="text-xs text-dark-500 mt-1">{stats?.totalAppointments || 0} total appts</p>
                        </div>
                    </div>
                </Link>

                {/* Pending */}
                <Link to="/admin/appointments?filter=pending" className="relative group overflow-hidden rounded-2xl border border-dark-700/50 bg-dark-800/40 p-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/10 hover:border-amber-500/20 hover:bg-dark-800/60 text-left">
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-transparent transition-colors">
                        <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 group-hover:scale-110 transition-all duration-300">
                            <Clock size={22} />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-dark-50 tracking-tight">{stats?.pendingAppointments || 0}</p>
                            <p className="text-sm text-dark-400 font-medium">Pending</p>
                            <p className="text-xs text-amber-500/70 mt-1">Requires action</p>
                        </div>
                    </div>
                </Link>

                {/* Completion Rate */}
                <Link to="/admin/appointments?filter=completed" className="relative group overflow-hidden rounded-2xl border border-dark-700/50 bg-dark-800/40 p-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10 hover:border-emerald-500/20 hover:bg-dark-800/60 text-left">
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-transparent transition-colors">
                        <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 group-hover:scale-110 transition-all duration-300">
                            <CheckCircle2 size={22} />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-dark-50 tracking-tight">{stats?.completionRate || 0}%</p>
                            <p className="text-sm text-dark-400 font-medium">Success Rate</p>
                            <p className="text-xs text-emerald-500/70 mt-1">Completion rate</p>
                        </div>
                    </div>
                </Link>

                {/* Active Med Users */}
                <Link to="/admin/patients?filter=med_users" className="relative group overflow-hidden rounded-2xl border border-dark-700/50 bg-dark-800/40 p-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-pink-500/10 hover:border-pink-500/20 hover:bg-dark-800/60 text-left">
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-transparent transition-colors">
                        <div className="p-3 rounded-xl bg-pink-500/10 text-pink-400 group-hover:bg-pink-500/20 group-hover:scale-110 transition-all duration-300">
                            <Pill size={22} />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-dark-50 tracking-tight">{stats?.activeMedicationUsers || 0}</p>
                            <p className="text-sm text-dark-400 font-medium">Med Users</p>
                            <p className="text-xs text-pink-500/70 mt-1">Active adherence</p>
                        </div>
                    </div>
                </Link>
            </div>

            {/* Main Content: Registration Analytics + Appt Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Registration Trends Section */}
                <div className="lg:col-span-2 glass-card p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-dark-100">User Growth</h2>
                            <p className="text-sm text-dark-400">Registration trends over time</p>
                        </div>

                        <div className="flex bg-dark-700/50 p-1 rounded-lg self-start md:self-auto">
                            <button
                                onClick={() => setRegPeriod('today')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${regPeriod === 'today' ? 'bg-emerald-500 text-white shadow-sm' : 'text-dark-400 hover:text-dark-200'}`}
                            >
                                Today
                            </button>
                            <button
                                onClick={() => setRegPeriod('week')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${regPeriod === 'week' ? 'bg-emerald-500 text-white shadow-sm' : 'text-dark-400 hover:text-dark-200'}`}
                            >
                                7 Days
                            </button>
                            <button
                                onClick={() => setRegPeriod('month')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${regPeriod === 'month' ? 'bg-emerald-500 text-white shadow-sm' : 'text-dark-400 hover:text-dark-200'}`}
                            >
                                30 Days
                            </button>
                        </div>
                    </div>

                    <div className="mb-6 flex gap-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/20">
                                <Users className="text-blue-400" size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-dark-400">New Patients</p>
                                <p className="text-xl font-bold text-dark-50">{regStats?.summary?.users || 0}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary-500/20">
                                <Stethoscope className="text-primary-400" size={20} />
                            </div>
                            <div>
                                <p className="text-xs text-dark-400">New Doctors</p>
                                <p className="text-xl font-bold text-dark-50">{regStats?.summary?.doctors || 0}</p>
                            </div>
                        </div>
                    </div>

                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={regStats?.chartData || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#94a3b8"
                                    tick={{ fontSize: 11 }}
                                    tickMargin={10}
                                />
                                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{
                                        background: '#1e293b',
                                        border: '1px solid #334155',
                                        borderRadius: '8px'
                                    }}
                                    itemStyle={{ fontSize: 12 }}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="users"
                                    name="New Patients"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                                    activeDot={{ r: 6 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="doctors"
                                    name="New Doctors"
                                    stroke="#8b5cf6"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 0 }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Appointments by Status - Pie Chart */}
                <div className="glass-card p-6 flex flex-col">
                    <h2 className="text-lg font-semibold text-dark-100 mb-4">Appointment Status</h2>
                    <div className="flex-1 min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={(analytics?.byStatus as any[]) || []}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={85}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {analytics?.byStatus?.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color || COLORS.primary} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        background: '#1e293b',
                                        border: '1px solid #334155',
                                        borderRadius: '8px'
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
                        {analytics?.byStatus?.map((item, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: item.color || COLORS.primary }}
                                />
                                <span className="text-dark-300">{item.name}: {item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Doctor Performance + Quick Actions Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Doctor Performance Table */}
                <div className="lg:col-span-2 glass-card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-dark-100">Doctor Performance</h2>
                        <Link to="/admin/doctors" className="text-primary-400 text-sm hover:underline">
                            View All
                        </Link>
                    </div>
                    <div className="overflow-x-auto max-h-80 scrollbar-thin">
                        <table className="w-full min-w-[600px]">
                            <thead className="sticky top-0 bg-dark-800 z-10">
                                <tr>
                                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-dark-400 py-3 px-4">Doctor</th>
                                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-dark-400 py-3 px-4">Specialty</th>
                                    <th className="text-center text-xs font-semibold uppercase tracking-wider text-dark-400 py-3 px-4">Appts</th>
                                    <th className="text-center text-xs font-semibold uppercase tracking-wider text-dark-400 py-3 px-4">Rate</th>
                                    <th className="text-center text-xs font-semibold uppercase tracking-wider text-dark-400 py-3 px-4">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {doctors.slice(0, 6).map((doc) => (
                                    <tr key={doc._id} className="border-b border-dark-700/50 hover:bg-dark-700/20 transition-colors group">
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-dark-700 flex-shrink-0 ring-2 ring-dark-700 group-hover:ring-dark-600 transition-all">
                                                    {doc.image ? (
                                                        <img src={doc.image} alt={doc.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-500">
                                                            <span className="text-white text-sm font-medium">{doc.name?.charAt(0)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-sm font-medium text-dark-200 group-hover:text-dark-100 transition-colors">Dr. {doc.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className="text-sm text-primary-400 font-medium bg-primary-500/10 px-2 py-1 rounded-full">{doc.speciality}</span>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className="text-sm font-bold text-dark-200">{doc.totalAppointments}</span>
                                            <span className="text-xs text-dark-500 block mt-0.5">
                                                {doc.completed}✓ {doc.cancelled}✗
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className={`text-sm font-bold px-2 py-1 rounded-md ${doc.completionRate >= 70 ? 'bg-emerald-500/10 text-emerald-400' : doc.completionRate >= 50 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                                                {doc.completionRate}%
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <button
                                                onClick={() => handleToggleAvailability(doc._id)}
                                                disabled={togglingId === doc._id}
                                                className={`relative w-11 h-6 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-900 border border-transparent ${doc.available ? 'bg-emerald-500 focus:ring-emerald-500' : 'bg-slate-600 focus:ring-slate-500 border-slate-500/30'} ${togglingId === doc._id ? 'opacity-70 cursor-wait' : 'cursor-pointer'}`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${doc.available ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {doctors.length === 0 && (
                            <p className="text-center text-dark-400 py-8">No doctors registered yet</p>
                        )}
                    </div>
                </div>

                {/* Quick Actions & Activity Feed */}
                <div className="glass-card p-6">
                    <h2 className="text-lg font-semibold text-dark-100 mb-4">Quick Actions</h2>
                    <div className="space-y-3 mb-6">
                        <Link to="/admin/add-doctor" className="flex items-center gap-3 p-3 rounded-lg bg-dark-700/50 hover:bg-dark-700 transition-colors">
                            <div className="p-2 rounded-lg bg-primary-500/20">
                                <UserPlus className="text-primary-400" size={18} />
                            </div>
                            <span className="text-sm text-dark-200">Add New Doctor</span>
                        </Link>
                        <Link to="/admin/appointments" className="flex items-center gap-3 p-3 rounded-lg bg-dark-700/50 hover:bg-dark-700 transition-colors">
                            <div className="p-2 rounded-lg bg-amber-500/20">
                                <ClipboardList className="text-amber-400" size={18} />
                            </div>
                            <div className="flex-1">
                                <span className="text-sm text-dark-200">Pending Appointments</span>
                                <span className="text-xs text-amber-400 ml-2">({stats?.pendingAppointments || 0})</span>
                            </div>
                        </Link>
                        <Link to="/admin/doctors" className="flex items-center gap-3 p-3 rounded-lg bg-dark-700/50 hover:bg-dark-700 transition-colors">
                            <div className="p-2 rounded-lg bg-blue-500/20">
                                <UserCheck className="text-blue-400" size={18} />
                            </div>
                            <span className="text-sm text-dark-200">Manage Doctors</span>
                        </Link>
                    </div>

                    <h3 className="text-sm font-medium text-dark-300 mb-3 flex items-center gap-2">
                        <Activity size={14} />
                        Recent Activity
                    </h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin">
                        {activity.slice(0, 5).map((item, index) => (
                            <div key={index} className="flex items-start gap-2 py-2 border-b border-dark-700/30 last:border-0">
                                <div className={`p-1 rounded ${item.type === 'appointment_completed' ? 'bg-emerald-500/20' : 'bg-blue-500/20'}`}>
                                    {item.type === 'appointment_completed' ? (
                                        <CheckCircle2 size={12} className="text-emerald-400" />
                                    ) : (
                                        <User size={12} className="text-blue-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-dark-300 truncate">{item.message}</p>
                                    <p className="text-xs text-dark-500">{formatTimeAgo(item.timestamp)}</p>
                                </div>
                            </div>
                        ))}
                        {activity.length === 0 && (
                            <p className="text-xs text-dark-500 text-center py-4">No recent activity</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
