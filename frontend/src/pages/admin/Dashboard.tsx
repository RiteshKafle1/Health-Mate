import { useEffect, useState } from 'react';
import { getAdminDashboard } from '../../api/admin';
import type { DashboardData, Appointment } from '../../types';
import { Users, Calendar, Stethoscope, DollarSign, Loader2, Clock, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

export function AdminDashboard() {
    const [dashData, setDashData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await getAdminDashboard();
                if (response.success && response.dashData) {
                    setDashData(response.dashData);
                }
            } catch (error) {
                toast.error('Failed to load dashboard data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-primary-500" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-dark-50">Admin Dashboard</h1>
                <p className="text-dark-400 mt-1">Platform overview and statistics</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-primary-500/20">
                            <Stethoscope className="text-primary-400" size={24} />
                        </div>
                        <div>
                            <p className="stat-value">{dashData?.doctors || 0}</p>
                            <p className="stat-label">Doctors</p>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-blue-500/20">
                            <Users className="text-blue-400" size={24} />
                        </div>
                        <div>
                            <p className="stat-value">{dashData?.patients || 0}</p>
                            <p className="stat-label">Patients</p>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-purple-500/20">
                            <Calendar className="text-purple-400" size={24} />
                        </div>
                        <div>
                            <p className="stat-value">{dashData?.appointments || 0}</p>
                            <p className="stat-label">Appointments</p>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-emerald-500/20">
                            <DollarSign className="text-emerald-400" size={24} />
                        </div>
                        <div>
                            <p className="stat-value">₹{dashData?.earnings || 0}</p>
                            <p className="stat-label">Revenue</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Appointments Chart */}
                <div className="glass-card p-6">
                    <h2 className="text-lg font-semibold text-dark-100 mb-4">Appointments Overview</h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={[
                                    { name: 'Total', value: dashData?.appointments || 0 },
                                    { name: 'Completed', value: dashData?.latestAppointments?.filter(a => a.isCompleted).length || 0 },
                                    { name: 'Pending', value: dashData?.latestAppointments?.filter(a => !a.isCompleted && !a.cancelled).length || 0 },
                                    { name: 'Cancelled', value: dashData?.latestAppointments?.filter(a => a.cancelled).length || 0 },
                                ]}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip
                                    contentStyle={{
                                        background: '#1e293b',
                                        border: '1px solid #334155',
                                        borderRadius: '8px',
                                    }}
                                />
                                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="glass-card p-6">
                    <h2 className="text-lg font-semibold text-dark-100 mb-4">Recent Appointments</h2>
                    <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-thin">
                        {dashData?.latestAppointments?.slice(0, 5).map((apt: Appointment) => (
                            <div key={apt._id} className="flex items-center gap-3 p-3 rounded-lg bg-dark-700/50">
                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-dark-600 flex-shrink-0">
                                    {apt.docData?.image ? (
                                        <img src={apt.docData.image} alt={apt.docData.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Stethoscope className="text-dark-400" size={16} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-dark-200 truncate">
                                        {apt.userData?.name} → Dr. {apt.docData?.name}
                                    </p>
                                    <p className="text-xs text-dark-400">{apt.slotDate} • {apt.slotTime}</p>
                                </div>
                                <div>
                                    {apt.isCompleted ? (
                                        <CheckCircle size={16} className="text-emerald-400" />
                                    ) : apt.cancelled ? (
                                        <span className="badge-danger text-xs">Cancelled</span>
                                    ) : (
                                        <Clock size={16} className="text-amber-400" />
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
