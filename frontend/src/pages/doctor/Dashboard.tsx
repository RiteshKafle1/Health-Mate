import { useEffect, useState } from 'react';
import { getDoctorDashboard, getDoctorProfile } from '../../api/doctor';
import { useAuth } from '../../context/AuthContext';
import type { Doctor, DashboardData, Appointment } from '../../types';
import { Calendar, DollarSign, Users, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';

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
        <div className="space-y-8">
            {/* Welcome Section */}
            <div className="glass-card p-8">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-dark-700 flex-shrink-0">
                        {profile?.image ? (
                            <img src={profile.image} alt={profile.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-500">
                                <span className="text-2xl font-bold text-white">{profile?.name?.charAt(0) || 'D'}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <h1 className="text-2xl md:text-3xl font-bold text-dark-50">
                            Welcome, Dr. {profile?.name || 'Doctor'}!
                        </h1>
                        <p className="text-dark-400 mt-1">
                            {profile?.speciality} • {profile?.experience}
                        </p>
                    </div>
                    <div className={`px-4 py-2 rounded-xl ${profile?.available
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                        {profile?.available ? 'Available' : 'Unavailable'}
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-emerald-500/20">
                            <DollarSign className="text-emerald-400" size={24} />
                        </div>
                        <div>
                            <p className="stat-value">₹{dashData?.earnings || 0}</p>
                            <p className="stat-label">Total Earnings</p>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-blue-500/20">
                            <Calendar className="text-blue-400" size={24} />
                        </div>
                        <div>
                            <p className="stat-value">{dashData?.appointments || 0}</p>
                            <p className="stat-label">Appointments</p>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-purple-500/20">
                            <Users className="text-purple-400" size={24} />
                        </div>
                        <div>
                            <p className="stat-value">{dashData?.patients || 0}</p>
                            <p className="stat-label">Patients</p>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-amber-500/20">
                            <Clock className="text-amber-400" size={24} />
                        </div>
                        <div>
                            <p className="stat-value">
                                {dashData?.latestAppointments?.filter(a => !a.isCompleted && !a.cancelled).length || 0}
                            </p>
                            <p className="stat-label">Pending</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Appointment Status Chart */}
                <div className="glass-card p-6">
                    <h2 className="text-lg font-semibold text-dark-100 mb-4">Appointment Status</h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={appointmentStats}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, value }) => `${name}: ${value}`}
                                >
                                    {appointmentStats.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
                </div>

                {/* Recent Appointments */}
                <div className="glass-card p-6">
                    <h2 className="text-lg font-semibold text-dark-100 mb-4">Recent Appointments</h2>
                    <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-thin">
                        {dashData?.latestAppointments?.slice(0, 5).map((apt: Appointment) => (
                            <div key={apt._id} className="flex items-center gap-3 p-3 rounded-lg bg-dark-700/50">
                                <div className="w-10 h-10 rounded-lg bg-dark-600 flex items-center justify-center flex-shrink-0">
                                    <span className="text-sm font-medium text-dark-300">
                                        {apt.userData?.name?.charAt(0) || 'P'}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-dark-200 truncate">{apt.userData?.name}</p>
                                    <p className="text-xs text-dark-400">{apt.slotDate} • {apt.slotTime}</p>
                                </div>
                                <div>
                                    {apt.isCompleted ? (
                                        <CheckCircle size={16} className="text-emerald-400" />
                                    ) : apt.cancelled ? (
                                        <span className="badge-danger text-xs">Cancelled</span>
                                    ) : (
                                        <span className="badge-warning text-xs">Pending</span>
                                    )}
                                </div>
                            </div>
                        ))}
                        {(!dashData?.latestAppointments || dashData.latestAppointments.length === 0) && (
                            <p className="text-center text-dark-400 py-4">No recent appointments</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
