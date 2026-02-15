import { useEffect, useState } from 'react';
import { getDoctorDashboard, getDoctorProfile } from '../../api/doctor';
import { useAuth } from '../../context/AuthContext';
import type { Doctor, DashboardData, Appointment } from '../../types';
import { Calendar, Users, Clock, Loader2, ArrowUpRight, Activity } from 'lucide-react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import toast from '../../utils/soundToast';

const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export function DoctorDashboard() {
    const { setUser } = useAuth();
    const [profile, setProfile] = useState<Doctor | null>(null);
    const [dashData, setDashData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [profileRes, dashRes] = await Promise.all([
                    getDoctorProfile(),
                    getDoctorDashboard()
                ]);

                if (profileRes.success && profileRes.profileData) {
                    setProfile(profileRes.profileData);
                    setUser(profileRes.profileData);
                }

                if (dashRes.success && dashRes.dashData) {
                    setDashData(dashRes.dashData);
                }
            } catch (error) {
                toast.error('Failed to load dashboard data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [setUser]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-primary-500" size={48} />
            </div>
        );
    }

    // Prepare chart data
    const appointmentStats = [
        { name: 'Completed', value: dashData?.appointments || 0 },
        { name: 'Pending', value: dashData?.latestAppointments?.filter(a => !a.isCompleted && !a.cancelled).length || 0 },
        { name: 'Cancelled', value: dashData?.latestAppointments?.filter(a => a.cancelled).length || 0 },
    ];

    return (
        <div className="space-y-6">
            {/* Premium Welcome Section */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-dark-800 to-dark-900 shadow-2xl">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                <div className="relative z-10 p-6 md:p-8">
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                        {/* Profile Image with Glow */}
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                            <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-dark-800 ring-2 ring-dark-700/50 flex-shrink-0">
                                {profile?.image ? (
                                    <img src={profile.image} alt={profile.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-500 text-white text-2xl font-bold">
                                        {profile?.name?.charAt(0) || 'D'}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 space-y-1">
                            <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-dark-300">
                                Welcome back, Dr. {profile?.name || 'Doctor'}
                            </h1>
                            <div className="flex items-center gap-2 text-dark-400">
                                <span className="bg-dark-700/50 px-2.5 py-0.5 rounded-lg text-xs border border-dark-600/50 backdrop-blur-sm">
                                    {profile?.speciality || 'General Practitioner'}
                                </span>
                                <span className="text-dark-500">•</span>
                                <span className="text-xs">{profile?.experience || '0 Years'} Experience</span>
                            </div>
                        </div>

                        {/* Status Toggle Visual */}
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl backdrop-blur-md border transition-all duration-300 ${profile?.available
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10'
                            : 'bg-red-500/10 border-red-500/20 text-red-400 shadow-lg shadow-red-500/10'
                            }`}>
                            <div className={`w-2.5 h-2.5 rounded-full ${profile?.available ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className="font-semibold tracking-wide text-xs">
                                {profile?.available ? 'Accepting Patients' : 'Currently Unavailable'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid - 3 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Appointments Card */}
                <div className="group relative overflow-hidden rounded-2xl bg-dark-800/50 p-5 hover:bg-dark-800 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 cursor-default">
                    <div className="flex items-start justify-between relative z-10">
                        <div>
                            <p className="text-dark-400 text-xs font-medium mb-1">Total Appointments</p>
                            <h3 className="text-2xl font-bold text-dark-50">{dashData?.appointments || 0}</h3>
                        </div>
                        <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                            <Calendar size={20} />
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-blue-400/80 bg-blue-500/5 w-fit px-2 py-0.5 rounded-lg">
                        <ArrowUpRight size={12} />
                        <span>Scheduled Consultations</span>
                    </div>
                    {/* Glow Effect */}
                    <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-500" />
                </div>

                {/* Patients Card */}
                <div className="group relative overflow-hidden rounded-2xl bg-dark-800/50 p-5 hover:bg-dark-800 transition-all duration-500 hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-1 cursor-default">
                    <div className="flex items-start justify-between relative z-10">
                        <div>
                            <p className="text-dark-400 text-xs font-medium mb-1">Unique Patients</p>
                            <h3 className="text-2xl font-bold text-dark-50">{dashData?.patients || 0}</h3>
                        </div>
                        <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all duration-300">
                            <Users size={20} />
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-purple-400/80 bg-purple-500/5 w-fit px-2 py-0.5 rounded-lg">
                        <Activity size={12} />
                        <span>Active Patient Base</span>
                    </div>
                    <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all duration-500" />
                </div>

                {/* Pending Card */}
                <div className="group relative overflow-hidden rounded-2xl bg-dark-800/50 p-5 hover:bg-dark-800 transition-all duration-500 hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-1 cursor-default">
                    <div className="flex items-start justify-between relative z-10">
                        <div>
                            <p className="text-dark-400 text-xs font-medium mb-1">Pending Requests</p>
                            <h3 className="text-2xl font-bold text-amber-500">
                                {dashData?.latestAppointments?.filter(a => !a.isCompleted && !a.cancelled).length || 0}
                            </h3>
                        </div>
                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                            <Clock size={20} />
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-amber-400/80 bg-amber-500/5 w-fit px-2 py-0.5 rounded-lg">
                        <Clock size={12} />
                        <span>Action Required</span>
                    </div>
                    <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-all duration-500" />
                </div>
            </div>

            {/* Charts & Lists Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Appointment Status Chart */}
                <div className="glass-card p-4 shadow-xl hover:shadow-2xl transition-shadow duration-500 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-dark-100 flex items-center gap-2">
                            <div className="w-1 h-4 bg-primary-500 rounded-full" />
                            Status Overview
                        </h2>
                    </div>
                    <div className="flex-1 min-h-[220px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={appointmentStats}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {appointmentStats.map((_entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={COLORS[index % COLORS.length]}
                                            strokeWidth={0}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(15, 23, 42, 0.9)',
                                        border: '1px solid rgba(51, 65, 85, 0.5)',
                                        borderRadius: '12px',
                                        padding: '8px 12px',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
                                    }}
                                    itemStyle={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500 }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Text Overlay */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-2xl font-bold text-dark-50">{dashData?.appointments || 0}</span>
                            <span className="text-[10px] text-dark-400 uppercase tracking-wider">Total</span>
                        </div>
                    </div>
                    {/* Legend */}
                    <div className="flex justify-center gap-4 mt-2">
                        {appointmentStats.map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                <span className="text-[10px] text-dark-300 font-medium">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Appointments */}
                <div className="glass-card p-0 shadow-xl hover:shadow-2xl transition-shadow duration-500 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-dark-700/30">
                        <h2 className="text-base font-bold text-dark-100 flex items-center gap-2">
                            <div className="w-1 h-4 bg-secondary-500 rounded-full" />
                            Recent Activity
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2 max-h-[280px]">
                        {dashData?.latestAppointments?.slice(0, 5).map((apt: Appointment) => (
                            <div
                                key={apt._id}
                                className="group flex items-center gap-4 p-4 rounded-xl bg-dark-800/30 hover:bg-dark-700/50 transition-all duration-300 cursor-default hover:shadow-lg"
                            >
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-xl bg-dark-700 flex items-center justify-center flex-shrink-0 text-dark-300 font-semibold group-hover:bg-dark-600 transition-colors">
                                        {apt.userData?.name?.charAt(0) || 'P'}
                                    </div>
                                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-dark-800 ${apt.isCompleted ? 'bg-emerald-500' : apt.cancelled ? 'bg-red-500' : 'bg-amber-500'
                                        }`} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-dark-200 group-hover:text-dark-100 transition-colors truncate text-sm">
                                        {apt.userData?.name}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1 text-[10px] text-dark-400">
                                        <div className="flex items-center gap-1">
                                            <Calendar size={12} />
                                            <span>{apt.slotDate}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock size={12} />
                                            <span>{apt.slotTime}</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    {apt.isCompleted ? (
                                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                            Done
                                        </span>
                                    ) : apt.cancelled ? (
                                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                                            Cancelled
                                        </span>
                                    ) : (
                                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                            <Clock size={10} /> Pending
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}

                        {(!dashData?.latestAppointments || dashData.latestAppointments.length === 0) && (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Calendar className="text-dark-600 mb-3" size={48} />
                                <p className="text-dark-400">No recent appointments</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
