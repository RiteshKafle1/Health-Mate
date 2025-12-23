import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, getUserAppointments } from '../../api/user';
import type { User, Appointment } from '../../types';
import { Calendar, Clock, Stethoscope, ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function UserDashboard() {
    const { setUser } = useAuth();
    const [profile, setProfile] = useState<User | null>(null);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [profileRes, appointmentsRes] = await Promise.all([
                    getUserProfile(),
                    getUserAppointments()
                ]);

                if (profileRes.success && profileRes.userData) {
                    setProfile(profileRes.userData);
                    setUser(profileRes.userData);
                }

                if (appointmentsRes.success && appointmentsRes.appointments) {
                    setAppointments(appointmentsRes.appointments);
                }
            } catch (error: any) {
                toast.error('Failed to load dashboard data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [setUser]);

    const upcomingAppointments = appointments
        .filter(apt => !apt.cancelled && !apt.isCompleted)
        .slice(0, 3);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-primary-500" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <div className="glass-card p-8">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-dark-700 flex-shrink-0">
                        {profile?.image ? (
                            <img src={profile.image} alt={profile.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-500">
                                <span className="text-2xl font-bold text-white">
                                    {profile?.name?.charAt(0) || 'U'}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <h1 className="text-2xl md:text-3xl font-bold text-dark-50">
                            Welcome back, {profile?.name || 'User'}!
                        </h1>
                        <p className="text-dark-400 mt-1">
                            Manage your appointments and health records from your dashboard.
                        </p>
                    </div>
                    <Link to="/user/doctors" className="btn-primary flex items-center gap-2">
                        <Stethoscope size={20} />
                        Find a Doctor
                    </Link>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-blue-500/20">
                            <Calendar className="text-blue-400" size={24} />
                        </div>
                        <div>
                            <p className="stat-value">{appointments.length}</p>
                            <p className="stat-label">Total Appointments</p>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-emerald-500/20">
                            <Clock className="text-emerald-400" size={24} />
                        </div>
                        <div>
                            <p className="stat-value">{upcomingAppointments.length}</p>
                            <p className="stat-label">Upcoming</p>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-purple-500/20">
                            <Stethoscope className="text-purple-400" size={24} />
                        </div>
                        <div>
                            <p className="stat-value">
                                {appointments.filter(a => a.isCompleted).length}
                            </p>
                            <p className="stat-label">Completed</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Upcoming Appointments */}
            <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-dark-50">Upcoming Appointments</h2>
                    <Link
                        to="/user/appointments"
                        className="text-primary-400 hover:text-primary-300 flex items-center gap-1 text-sm"
                    >
                        View all <ArrowRight size={16} />
                    </Link>
                </div>

                {upcomingAppointments.length === 0 ? (
                    <div className="text-center py-12">
                        <Calendar className="mx-auto text-dark-500 mb-4" size={48} />
                        <p className="text-dark-400">No upcoming appointments</p>
                        <Link to="/user/doctors" className="btn-primary mt-4 inline-flex items-center gap-2">
                            Book an Appointment
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {upcomingAppointments.map((apt) => (
                            <div key={apt._id} className="flex items-center gap-4 p-4 rounded-xl bg-dark-700/50 hover:bg-dark-700/70 transition-colors">
                                <div className="w-14 h-14 rounded-xl overflow-hidden bg-dark-600 flex-shrink-0">
                                    {apt.docData?.image ? (
                                        <img src={apt.docData.image} alt={apt.docData.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Stethoscope className="text-dark-400" size={24} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-dark-100 truncate">Dr. {apt.docData?.name}</p>
                                    <p className="text-sm text-dark-400">{apt.docData?.speciality}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-dark-200">{apt.slotDate}</p>
                                    <p className="text-sm text-dark-400">{apt.slotTime}</p>
                                </div>
                                <div>
                                    {apt.payment ? (
                                        <span className="badge-success">Paid</span>
                                    ) : (
                                        <span className="badge-warning">Pending</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
