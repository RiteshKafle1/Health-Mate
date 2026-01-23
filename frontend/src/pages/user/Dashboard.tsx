import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, getUserAppointments } from '../../api/user';
import {
    getPendingAccessRequests,
    approveAccessRequest,
    denyAccessRequest
} from '../../api/accessRequests';
import { getMyReports, type Report } from '../../api/reports';
import type { AccessRequest } from '../../api/accessRequests';
import type { User, Appointment } from '../../types';
import {
    Calendar, Stethoscope, Loader2, Pill, CheckCircle2, ChevronRight, Zap,
    Shield, Check, X, FileText, Plus, Upload, MessageCircle, Activity,
    ArrowRight, FlaskConical, Sun, Moon, CloudSun
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getMedications, getAdherenceStats, getStreak, type Medication } from '../../api/medication';
import moment from 'moment';

// Upcoming dose item type (derived from medication data)
interface UpcomingDose {
    medication_id: string;
    medication_name: string;
    scheduled_time: string;
    status: 'pending' | 'available' | 'late';
    time_until: number | null;
}

// Quick Action Item config
interface QuickAction {
    icon: React.ReactNode;
    label: string;
    description: string;
    to: string;
    color: string;
    bgColor: string;
}

// Time period helpers
type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';
const getTimePeriod = (time: string): TimePeriod => {
    const hour = parseInt(time.split(':')[0], 10);
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
};

const periodIcons = {
    morning: Sun,
    afternoon: CloudSun,
    evening: CloudSun,
    night: Moon
};

const periodColors = {
    morning: 'text-amber-500 bg-amber-50',
    afternoon: 'text-orange-500 bg-orange-50',
    evening: 'text-purple-500 bg-purple-50',
    night: 'text-indigo-500 bg-indigo-50'
};

export function UserDashboard() {
    const { setUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [profile, setProfile] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [upcomingDoses, setUpcomingDoses] = useState<UpcomingDose[]>([]);
    const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
    const [adherenceScore, setAdherenceScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
    const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
    const [recentReports, setRecentReports] = useState<Report[]>([]);

    // Quick Actions config
    const quickActions: QuickAction[] = [
        { icon: <Stethoscope size={20} />, label: 'Book Appointment', description: 'Schedule with a doctor', to: '/user/doctors', color: 'text-blue-600', bgColor: 'bg-blue-50' },
        { icon: <Plus size={20} />, label: 'Add Medication', description: 'Add a new medication', to: '/user/medications', color: 'text-green-600', bgColor: 'bg-green-50' },
        { icon: <Upload size={20} />, label: 'Upload Report', description: 'Upload a lab report', to: '/user/reports', color: 'text-purple-600', bgColor: 'bg-purple-50' },
        { icon: <MessageCircle size={20} />, label: 'Chat with AI', description: 'Ask health questions', to: '/user/chatbot', color: 'text-rose-600', bgColor: 'bg-rose-50' },
        { icon: <Activity size={20} />, label: 'View Analytics', description: 'Adherence insights', to: '/user/analytics', color: 'text-amber-600', bgColor: 'bg-amber-50' },
    ];

    // Refetch trigger - increments when page becomes visible or user navigates back
    const [refreshKey, setRefreshKey] = useState(0);

    // Listen for page visibility changes to refetch data when user returns
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                setRefreshKey(prev => prev + 1);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [profileRes, appointmentsRes, medsRes, adherenceRes, streakRes, accessReqRes, reportsRes] = await Promise.all([
                    getUserProfile(),
                    getUserAppointments(),
                    getMedications(),
                    getAdherenceStats('week'),  // Same API as Analytics page
                    getStreak(),                // Same API as Analytics page
                    getPendingAccessRequests(),
                    getMyReports(0, 3) // Get 3 most recent reports
                ]);

                if (profileRes.success && profileRes.userData) {
                    setProfile(profileRes.userData);
                    setUser(profileRes.userData);
                }

                // Next Appointment Logic
                if (appointmentsRes.success && appointmentsRes.appointments) {
                    const upcoming = appointmentsRes.appointments
                        .filter(apt => !apt.cancelled && !apt.isCompleted)
                        .sort((a, b) => new Date(`${a.slotDate}T${a.slotTime}`).getTime() - new Date(`${b.slotDate}T${b.slotTime}`).getTime());
                    setNextAppointment(upcoming[0] || null);
                }

                // Extract upcoming doses from medications (FIX: uses same data source as Medications page)
                if (medsRes.success && medsRes.medications) {
                    const now = new Date();
                    const currentTime = now.getHours() * 60 + now.getMinutes();

                    const doses: UpcomingDose[] = [];

                    medsRes.medications
                        .filter((med: Medication) => med.is_active !== false)
                        .forEach((med: Medication) => {
                            const scheduleTimes = med.schedule_times || [];
                            const dosesTaken = med.doses_taken_today || {};

                            scheduleTimes.forEach(time => {
                                // Skip if already taken
                                if (dosesTaken[time]) return;

                                const [h, m] = time.split(':').map(Number);
                                const scheduledMinutes = h * 60 + m;
                                const timeUntil = scheduledMinutes - currentTime;

                                // Determine status
                                let status: 'pending' | 'available' | 'late' = 'pending';
                                if (timeUntil <= 30 && timeUntil >= -120) {
                                    status = 'available';
                                } else if (timeUntil < -120) {
                                    status = 'late';
                                }

                                doses.push({
                                    medication_id: med._id,
                                    medication_name: med.name,
                                    scheduled_time: time,
                                    status,
                                    time_until: timeUntil > 0 ? timeUntil : null
                                });
                            });
                        });

                    // Sort by scheduled time
                    doses.sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));
                    setUpcomingDoses(doses);
                }

                // Adherence Score - Using same API as Analytics page
                if (adherenceRes.success && adherenceRes.summary) {
                    setAdherenceScore(Math.round(adherenceRes.summary.adherence_percentage));
                }

                // Streak - Using same API as Analytics page
                if (streakRes.success) {
                    setStreak(streakRes.current_streak || 0);
                }

                // Access Requests from Doctors
                if (accessReqRes.success) {
                    setAccessRequests(accessReqRes.requests);
                }

                // Recent Reports
                if (reportsRes.success) {
                    setRecentReports(reportsRes.reports);
                }

            } catch {
                toast.error('Failed to load dashboard data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [setUser, refreshKey, location.key]);

    const handleApproveRequest = async (requestId: string) => {
        setProcessingRequestId(requestId);
        try {
            const response = await approveAccessRequest(requestId);
            if (response.success) {
                toast.success('Access approved! Doctor can now view your reports.');
                setAccessRequests(prev => prev.filter(r => r.id !== requestId));
            }
        } catch {
            toast.error('Failed to approve request');
        } finally {
            setProcessingRequestId(null);
        }
    };

    const handleDenyRequest = async (requestId: string) => {
        setProcessingRequestId(requestId);
        try {
            const response = await denyAccessRequest(requestId);
            if (response.success) {
                toast.success('Access request denied');
                setAccessRequests(prev => prev.filter(r => r.id !== requestId));
            }
        } catch {
            toast.error('Failed to deny request');
        } finally {
            setProcessingRequestId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const greeting = new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening';



    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-text tracking-tight">Good {greeting}, {profile?.name?.split(' ')[0] || 'User'}</h1>
                    <p className="text-text-muted mt-1">{todayDate}</p>
                </div>
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">

                {/* 1. Adherence Score (Hero) - Spans 4 columns */}
                <Card className="lg:col-span-4 p-8 flex flex-col items-center justify-center relative overflow-hidden bg-white border-none shadow-card hover:shadow-hover transition-shadow duration-300 min-h-[300px]">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-primary-hover"></div>
                    <div className="relative z-10 text-center">
                        <h3 className="text-text-muted text-sm font-semibold uppercase tracking-wider mb-6">Weekly Adherence</h3>
                        <div className="relative w-40 h-40 mx-auto mb-6 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle className="text-surface/30" strokeWidth="12" stroke="currentColor" fill="transparent" r="70" cx="80" cy="80" />
                                <circle
                                    className="text-primary transition-all duration-1000 ease-out"
                                    strokeWidth="12"
                                    strokeDasharray={440}
                                    strokeDashoffset={440 - (440 * adherenceScore) / 100}
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r="70"
                                    cx="80"
                                    cy="80"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-4xl font-bold text-text">{Math.round(adherenceScore)}%</span>
                            </div>
                        </div>
                        <p className="text-text-muted text-sm px-4">
                            {adherenceScore >= 90 ? "Excellent consistency!" :
                                adherenceScore >= 75 ? "Good job, keep it up." :
                                    "Let's try to improve this week."}
                        </p>
                    </div>
                    <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl"></div>
                </Card>

                {/* 2. Daily Streak - Spans 3 columns */}
                <Card className="lg:col-span-3 p-6 flex flex-col justify-between bg-white border-none shadow-card hover:shadow-hover transition-shadow duration-300">
                    <div className="flex items-center justify-between">
                        <h3 className="text-text-muted text-sm font-semibold uppercase tracking-wider">Current Streak</h3>
                        <div className="p-2 bg-warning-bg rounded-lg">
                            <Zap size={20} className="text-warning" fill="currentColor" />
                        </div>
                    </div>
                    <div className="mt-8">
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-bold text-text">{streak}</span>
                            <span className="text-text-muted font-medium">days</span>
                        </div>
                        <p className="text-sm text-text-muted mt-2">Consistent intake</p>
                    </div>
                    <div className="mt-8 flex gap-1">
                        {[...Array(7)].map((_, i) => (
                            <div key={i} className={`h-2 flex-1 rounded-full ${i < streak % 7 || (streak >= 7 && i < 7) ? 'bg-warning' : 'bg-surface/30'}`}></div>
                        ))}
                    </div>
                </Card>

                {/* 3. Quick Actions - Spans 5 columns */}
                <Card className="lg:col-span-5 p-6 bg-white border-none shadow-card hover:shadow-hover transition-shadow duration-300">
                    <h3 className="text-text-muted text-sm font-semibold uppercase tracking-wider mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {quickActions.map((action, idx) => (
                            <Link
                                key={idx}
                                to={action.to}
                                className="group flex flex-col items-center text-center p-3 rounded-xl hover:bg-surface/20 transition-all duration-200"
                            >
                                <div className={`w-12 h-12 rounded-xl ${action.bgColor} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                                    <span className={action.color}>{action.icon}</span>
                                </div>
                                <span className="text-sm font-medium text-text">{action.label}</span>
                            </Link>
                        ))}
                    </div>
                </Card>

                {/* 4. Upcoming Medications - Spans 6 columns (50% Width) */}
                <Card className="lg:col-span-6 p-0 overflow-hidden bg-white border-none shadow-card hover:shadow-hover transition-shadow duration-300 h-full">
                    <div className="p-6 pb-4 border-b border-surface/30 flex justify-between items-center">
                        <h3 className="text-primary font-semibold flex items-center gap-2">
                            <Pill size={18} />
                            Upcoming Medications
                        </h3>
                        <Link to="/user/medications" className="text-sm text-primary hover:underline flex items-center gap-1">
                            View All <ChevronRight size={14} />
                        </Link>
                    </div>
                    <div className="p-6">
                        {upcomingDoses.length > 0 ? (
                            <div className="space-y-3">
                                {upcomingDoses.slice(0, 5).map((dose, idx) => {
                                    const period = getTimePeriod(dose.scheduled_time);
                                    const PeriodIcon = periodIcons[period];
                                    return (
                                        <div
                                            key={idx}
                                            className={`flex items-center justify-between p-3 rounded-xl transition-colors ${dose.status === 'late'
                                                ? 'bg-red-50 border border-red-200'
                                                : dose.status === 'available'
                                                    ? 'bg-amber-50 border border-amber-200'
                                                    : 'bg-surface/20 border border-surface/30'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-lg ${periodColors[period]} flex items-center justify-center`}>
                                                    <PeriodIcon size={18} />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-text">{dose.medication_name}</p>
                                                    <p className="text-sm text-text-muted">Scheduled for {dose.scheduled_time}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {dose.status === 'late' && (
                                                    <span className="px-2 py-1 bg-red-100 text-red-600 text-xs font-medium rounded-full">
                                                        Overdue
                                                    </span>
                                                )}
                                                {dose.status === 'available' && (
                                                    <span className="px-2 py-1 bg-amber-100 text-amber-600 text-xs font-medium rounded-full">
                                                        Due Now
                                                    </span>
                                                )}
                                                {dose.time_until !== null && dose.time_until > 0 && (
                                                    <span className="text-sm text-text-muted">
                                                        in {dose.time_until < 60
                                                            ? `${dose.time_until} min`
                                                            : `${(dose.time_until / 60).toFixed(1)} hours`
                                                        }
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <CheckCircle2 className="mx-auto text-success mb-2" size={40} />
                                <h4 className="font-medium text-text">All caught up!</h4>
                                <p className="text-text-muted text-sm">No pending medications for now.</p>
                            </div>
                        )}
                    </div>
                </Card>



                {/* 6. Upcoming Appointment - Spans 6 columns (50% Width) */}
                <Card className="lg:col-span-6 p-0 overflow-hidden bg-white border-none shadow-card hover:shadow-hover transition-all group h-full">
                    <div className="p-6 pb-4 border-b border-surface/30 flex justify-between items-center">
                        <h3 className="text-primary font-semibold flex items-center gap-2">
                            <Calendar size={18} />
                            Upcoming Appointment
                        </h3>
                        <Link to="/user/appointments" className="text-sm text-primary hover:underline flex items-center gap-1">
                            View All <ChevronRight size={14} />
                        </Link>
                    </div>
                    {nextAppointment ? (
                        <div className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="flex flex-col items-center justify-center p-3 bg-surface/10 rounded-xl min-w-[80px] text-center border border-surface/20">
                                    <Calendar size={20} className="text-primary mb-1" />
                                    <span className="text-sm font-bold text-text whitespace-nowrap">{moment(nextAppointment.slotDate).format('MMM D')}</span>
                                    <span className="text-xs text-text-muted whitespace-nowrap">{moment(`${nextAppointment.slotDate} ${nextAppointment.slotTime}`).format('h:mm A')}</span>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-surface flex-shrink-0">
                                            {nextAppointment.docData?.image ? (
                                                <img src={nextAppointment.docData.image} alt="Doctor" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-surface text-text-muted">
                                                    <Stethoscope size={16} />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-text text-sm truncate">Dr. {nextAppointment.docData?.name}</h4>
                                            <p className="text-xs text-text-muted truncate">{nextAppointment.docData?.speciality}</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-end mt-2">
                                        <Link to="/user/appointments">
                                            <Button variant="ghost" size="sm" className="gap-1 h-8 text-xs group-hover:translate-x-1 transition-transform">
                                                Details <ChevronRight size={14} />
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center flex flex-col items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-surface/20 flex items-center justify-center mb-3">
                                <Calendar size={24} className="text-text-muted" />
                            </div>
                            <h3 className="text-text font-medium text-sm">No upcoming appointments</h3>
                            <Link to="/user/doctors" className="mt-4">
                                <Button variant="secondary" size="sm" className="h-8 text-xs">Book Now</Button>
                            </Link>
                        </div>
                    )}
                </Card>

                {/* 7. Recent Reports - Spans 6 columns */}
                {recentReports.length > 0 && (
                    <Card className="lg:col-span-6 p-6 bg-white border-none shadow-card hover:shadow-hover transition-shadow duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-text-muted text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                                <FileText size={16} className="text-primary" />
                                Recent Reports
                            </h3>
                            <Link to="/user/reports" className="text-sm text-primary hover:underline flex items-center gap-1">
                                View All <ArrowRight size={14} />
                            </Link>
                        </div>
                        <div className="space-y-3">
                            {recentReports.map(report => (
                                <div key={report.id} className="flex items-center justify-between p-3 bg-surface/20 rounded-xl hover:bg-surface/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                            <FileText size={18} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-text truncate max-w-[200px]">{report.original_name}</p>
                                            <p className="text-xs text-text-muted">{moment(report.uploaded_at).fromNow()}</p>
                                        </div>
                                    </div>
                                    {report.report_type === 'lab_report' && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => navigate(`/user/reports/analysis/${report.id}`)}
                                            className="gap-1 text-primary"
                                        >
                                            <FlaskConical size={14} /> Analyze
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {/* 8. Access Requests Section - Only show if there are pending requests */}
                {accessRequests.length > 0 && (
                    <div className="lg:col-span-6">
                        <h3 className="text-text-muted text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Shield size={16} className="text-primary" />
                            Report Access Requests ({accessRequests.length})
                        </h3>
                        <Card className="p-0 overflow-hidden bg-white border-none shadow-card">
                            <div className="divide-y divide-surface/30">
                                {accessRequests.map((request) => (
                                    <div key={request.id} className="p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-4">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="w-12 h-12 rounded-full overflow-hidden bg-surface flex-shrink-0">
                                                {request.doctor_image ? (
                                                    <img src={request.doctor_image} alt={request.doctor_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                                                        <Stethoscope size={20} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-text flex items-center gap-2">
                                                    <FileText size={16} className="text-primary flex-shrink-0" />
                                                    Dr. {request.doctor_name}
                                                    <span className="text-xs text-text-muted font-normal">wants to view your reports</span>
                                                </h4>
                                                {request.doctor_speciality && (
                                                    <p className="text-sm text-text-muted">{request.doctor_speciality}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 w-full md:w-auto">
                                            <button
                                                onClick={() => handleApproveRequest(request.id)}
                                                disabled={processingRequestId === request.id}
                                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                                            >
                                                {processingRequestId === request.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleDenyRequest(request.id)}
                                                disabled={processingRequestId === request.id}
                                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                                            >
                                                <X size={16} />
                                                Deny
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
