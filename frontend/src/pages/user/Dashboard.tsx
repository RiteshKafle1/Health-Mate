import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, getUserAppointments } from '../../api/user';
import type { User, Appointment } from '../../types';
import { Calendar, Clock, Stethoscope, ArrowRight, Loader2, Pill } from 'lucide-react';
import toast from 'react-hot-toast';
import { TodaysDoses } from '../../components/TodaysDoses';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

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
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <Card variant="glass" className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-surface flex-shrink-0 ring-4 ring-white shadow-sm">
                    {profile?.image ? (
                        <img src={profile.image} alt={profile.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10">
                            <span className="text-2xl font-bold text-primary">
                                {profile?.name?.charAt(0) || 'U'}
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-text">
                        Welcome back, {profile?.name || 'User'}!
                    </h1>
                    <p className="text-text-muted mt-1">
                        Manage your appointments and health records from your dashboard.
                    </p>
                </div>
                <Link to="/user/doctors">
                    <Button className="w-full md:w-auto gap-2">
                        <Stethoscope size={20} />
                        Find a Doctor
                    </Button>
                </Link>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-info-bg text-info">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-text">{appointments.length}</p>
                        <p className="text-sm text-text-muted">Total Appointments</p>
                    </div>
                </Card>

                <Card className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-success-bg text-success">
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-text">{upcomingAppointments.length}</p>
                        <p className="text-sm text-text-muted">Upcoming</p>
                    </div>
                </Card>

                <Card className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary">
                        <Stethoscope size={24} />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-text">
                            {appointments.filter(a => a.isCompleted).length}
                        </p>
                        <p className="text-sm text-text-muted">Completed</p>
                    </div>
                </Card>
            </div>

            {/* Two Column Layout for Dashboard Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Today's Doses Widget */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-text flex items-center gap-2">
                            <Pill size={20} className="text-primary" />
                            Medication Schedule
                        </h2>
                        <Link to="/user/medications">
                            <Button variant="ghost" size="sm" className="gap-1">
                                Manage <ArrowRight size={16} />
                            </Button>
                        </Link>
                    </div>
                    {/* Assuming TodaysDoses handles its own styling well enough for now, 
                        or I might need to check it separately. 
                        It likely uses container queries or simple flex. */}
                    <TodaysDoses />
                </div>

                {/* Upcoming Appointments */}
                <Card>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-text">Upcoming Appointments</h2>
                        <Link to="/user/appointments">
                            <Button variant="ghost" size="sm" className="gap-1">
                                View all <ArrowRight size={16} />
                            </Button>
                        </Link>
                    </div>

                    {upcomingAppointments.length === 0 ? (
                        <div className="text-center py-12">
                            <Calendar className="mx-auto text-text-muted mb-4" size={48} />
                            <p className="text-text-muted">No upcoming appointments</p>
                            <Link to="/user/doctors">
                                <Button className="mt-4 gap-2">
                                    Book an Appointment
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {upcomingAppointments.map((apt) => (
                                <div key={apt._id} className="flex items-center gap-4 p-4 rounded-xl bg-surface/30 hover:bg-surface/50 transition-colors border border-transparent hover:border-surface/50">
                                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-surface flex-shrink-0">
                                        {apt.docData?.image ? (
                                            <img src={apt.docData.image} alt={apt.docData.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Stethoscope className="text-text-muted" size={24} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-text truncate">Dr. {apt.docData?.name}</p>
                                        <p className="text-sm text-text-muted">{apt.docData?.speciality}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-medium text-text">{apt.slotDate}</p>
                                        <p className="text-sm text-text-muted">{apt.slotTime}</p>
                                    </div>
                                    <div>
                                        {apt.payment ? (
                                            <Badge variant="success">Paid</Badge>
                                        ) : (
                                            <Badge variant="warning">Pending</Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}

