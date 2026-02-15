import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
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
    Sun, Moon, CloudSun, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getMedications, getAdherenceStats, getStreak, type Medication } from '../../api/medication';
import moment from 'moment';
import clsx from 'clsx';

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
    gradient: string;
    iconColor: string;
    border: string;
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
    morning: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    afternoon: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
    evening: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    night: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20'
};

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
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
        {
            icon: <Stethoscope size={24} />,
            label: 'Book Appointment',
            description: 'Find a doctor near you',
            to: '/user/doctors',
            gradient: 'from-blue-500/20 to-cyan-500/20',
            iconColor: 'text-blue-600',
            border: 'border-blue-200'
        },
        {
            icon: <Plus size={24} />,
            label: 'Add Medication',
            description: 'Track a new prescription',
            to: '/user/medications',
            gradient: 'from-emerald-500/20 to-green-500/20',
            iconColor: 'text-emerald-600',
            border: 'border-emerald-200'
        },
        {
            icon: <Upload size={24} />,
            label: 'Upload Report',
            description: 'Analyze lab results',
            to: '/user/reports',
            gradient: 'from-violet-500/20 to-purple-500/20',
            iconColor: 'text-violet-600',
            border: 'border-violet-200'
        },
        {
            icon: <MessageCircle size={24} />,
            label: 'Chat with AI',
            description: 'Medical assistant',
            to: '/user/chatbot',
            gradient: 'from-rose-500/20 to-pink-500/20',
            iconColor: 'text-rose-600',
            border: 'border-rose-200'
        },
        {
            icon: <Activity size={24} />,
            label: 'View Analytics',
            description: 'Check your progress',
            to: '/user/analytics',
            gradient: 'from-amber-500/20 to-orange-500/20',
            iconColor: 'text-amber-600',
            border: 'border-amber-200'
        },
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
    const firstName = profile?.name?.split(' ')[0] || 'User';

    return (
        <motion.div
            className="space-y-8 max-w-[1600px] mx-auto pb-10"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Header with decorative elements */}
            <motion.div variants={itemVariants} className="relative">
                <div className="absolute -top-10 -left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight text-[#2D336B]">
                            Good {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-violet-500">{firstName}</span>
                        </h1>
                        <p className="text-lg text-slate-500 mt-2 font-medium">{todayDate}</p>
                    </div>
                    {/* Add visual flair or secondary action here if needed */}
                </div>
            </motion.div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">

                {/* 1. Adherence Score (Hero) */}
                <motion.div variants={itemVariants} className="lg:col-span-4">
                    <Card className="h-full p-8 flex flex-col items-center justify-center relative overflow-hidden bg-white/80 backdrop-blur-sm shadow-xl shadow-indigo-100/50 border border-white/40 ring-1 ring-black/5">
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-400 to-primary" />

                        <div className="relative z-10 w-full text-center">
                            <div className="flex items-center justify-between w-full mb-6">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Values</h3>
                                <div className="p-1.5 bg-cyan-50 text-cyan-500 rounded-lg">
                                    <Activity size={16} />
                                </div>
                            </div>

                            <div className="relative w-48 h-48 mx-auto mb-6 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90 drop-shadow-lg">
                                    <defs>
                                        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#22d3ee" />
                                            <stop offset="100%" stopColor="#4f46e5" />
                                        </linearGradient>
                                    </defs>
                                    <circle className="text-slate-100" strokeWidth="10" stroke="currentColor" fill="transparent" r="80" cx="96" cy="96" />
                                    <motion.circle
                                        className="text-primary transition-all duration-1000 ease-out"
                                        strokeWidth="10"
                                        stroke="url(#progressGradient)"
                                        strokeLinecap="round"
                                        fill="transparent"
                                        r="80"
                                        cx="96"
                                        cy="96"
                                        initial={{ strokeDasharray: 502, strokeDashoffset: 502 }}
                                        animate={{ strokeDashoffset: 502 - (502 * adherenceScore) / 100 }}
                                        transition={{ duration: 1.5, ease: "easeOut" }}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center flex-col">
                                    <span className="text-5xl font-black text-[#2D336B]">{Math.round(adherenceScore)}%</span>
                                    <span className="text-sm font-medium text-slate-400 mt-1">Weekly</span>
                                </div>
                            </div>

                            <p className="font-medium text-slate-600 bg-slate-50 py-2.5 px-4 rounded-xl inline-block">
                                {adherenceScore >= 90 ? "Excellent consistency! 🌟" :
                                    adherenceScore >= 75 ? "Good job, keep it up! 👍" :
                                        "Let's try to improve this week. 💪"}
                            </p>
                        </div>
                    </Card>
                </motion.div>

                {/* 2. Daily Streak */}
                <motion.div variants={itemVariants} className="lg:col-span-3">
                    <Card className="h-full p-6 flex flex-col justify-between bg-white/80 backdrop-blur-sm shadow-xl shadow-orange-100/50 border border-white/40 ring-1 ring-black/5 group hover:-translate-y-1 transition-transform duration-300">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Current Streak</h3>
                            <div className="p-2 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl group-hover:scale-110 transition-transform">
                                <Zap size={22} className="text-orange-500 fill-orange-500 animate-pulse" />
                            </div>
                        </div>

                        <div className="mt-6 flex-1 flex flex-col justify-center">
                            <div className="flex items-baseline gap-2">
                                <span className="text-6xl font-black text-[#2D336B] tracking-tight">{streak}</span>
                                <span className="text-xl font-medium text-slate-400">days</span>
                            </div>
                            <p className="text-sm font-medium text-slate-500 mt-2">Consistent intake</p>
                        </div>

                        <div className="mt-8">
                            <div className="flex justify-between items-end h-8 gap-1">
                                {[...Array(7)].map((_, i) => (
                                    <div
                                        key={i}
                                        className={clsx(
                                            "flex-1 rounded-t-sm transition-all duration-500",
                                            i < streak % 7 || (streak >= 7 && i < 7)
                                                ? "bg-gradient-to-t from-orange-500 to-amber-400 h-full opacity-100"
                                                : "bg-slate-100 h-1/3 opacity-50"
                                        )}
                                    />
                                ))}
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-300 mt-2 font-medium uppercase tracking-wider">
                                <span>Mon</span><span>Sum</span>
                            </div>
                        </div>
                    </Card>
                </motion.div>

                {/* 3. Quick Actions Grid */}
                <motion.div variants={itemVariants} className="lg:col-span-5">
                    <Card className="h-full p-6 bg-white/60 backdrop-blur-sm border-none shadow-none">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-5 pl-1">Quick Actions</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-[calc(100%-2rem)]">
                            {quickActions.slice(0, 4).map((action, idx) => (
                                <Link
                                    key={idx}
                                    to={action.to}
                                    className={clsx(
                                        "group relative flex flex-col p-5 rounded-2xl border transition-all duration-300 bg-white shadow-sm hover:shadow-lg hover:-translate-y-1 overflow-hidden",
                                        action.border
                                    )}
                                >
                                    <div className={clsx(
                                        "absolute top-0 right-0 w-24 h-24 -mr-6 -mt-6 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br",
                                        action.gradient
                                    )} />

                                    <div className={clsx(
                                        "w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110",
                                        `bg-gradient-to-br ${action.gradient}`
                                    )}>
                                        <span className={action.iconColor}>{action.icon}</span>
                                    </div>
                                    <span className="text-lg font-bold text-[#2D336B] mb-1 relative z-10">{action.label}</span>
                                    <span className="text-xs font-medium text-slate-400 relative z-10">{action.description}</span>
                                </Link>
                            ))}
                        </div>
                    </Card>
                </motion.div>

                {/* 4. Upcoming Medications (Wide) */}
                <motion.div variants={itemVariants} className="lg:col-span-8">
                    <Card className="h-full overflow-hidden bg-white shadow-xl shadow-slate-100 border border-slate-100 ring-1 ring-black/5 flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <Pill size={20} />
                                </div>
                                <h3 className="font-bold text-[#2D336B] text-lg">Upcoming Medications</h3>
                            </div>
                            <Link to="/user/medications" className="text-sm font-medium text-primary hover:text-primary-hover flex items-center gap-1 transition-colors">
                                View Full Schedule <ChevronRight size={16} />
                            </Link>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto">
                            {upcomingDoses.length > 0 ? (
                                <div className="space-y-4">
                                    {upcomingDoses.slice(0, 5).map((dose, idx) => {
                                        const period = getTimePeriod(dose.scheduled_time);
                                        const PeriodIcon = periodIcons[period];
                                        return (
                                            <div
                                                key={idx}
                                                className={clsx(
                                                    "flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 hover:shadow-md",
                                                    dose.status === 'late' ? 'bg-red-50/50 border-red-100' :
                                                        dose.status === 'available' ? 'bg-amber-50/50 border-amber-100' :
                                                            'bg-white border-slate-100 hover:border-slate-200'
                                                )}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center border", periodColors[period])}>
                                                        <PeriodIcon size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-[#2D336B] text-lg">{dose.medication_name}</p>
                                                        <p className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                                            Scheduled: {dose.scheduled_time}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end gap-2">
                                                    {dose.status === 'late' && (
                                                        <span className="px-3 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-full uppercase tracking-wider">
                                                            Overdue
                                                        </span>
                                                    )}
                                                    {dose.status === 'available' && (
                                                        <span className="px-3 py-1 bg-amber-100 text-amber-600 text-xs font-bold rounded-full uppercase tracking-wider animate-pulse">
                                                            Due Now
                                                        </span>
                                                    )}
                                                    {dose.time_until !== null && dose.time_until > 0 && (
                                                        <div className="text-right">
                                                            <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">in</span>
                                                            <span className="text-sm font-bold text-[#2D336B]">
                                                                {dose.time_until < 60 ? `${dose.time_until} min` : `${(dose.time_until / 60).toFixed(1)} hr`}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                                        <CheckCircle2 className="text-green-500" size={32} />
                                    </div>
                                    <h4 className="font-bold text-[#2D336B] text-lg">All Caught Up!</h4>
                                    <p className="text-slate-400 text-sm mt-1">No pending medications for now.</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </motion.div>

                {/* 5. Upcoming Appointment (Side) */}
                <motion.div variants={itemVariants} className="lg:col-span-4">
                    <Card className="h-full bg-gradient-to-br from-[#2D336B] to-[#1e234d] text-white border-none shadow-2xl overflow-hidden relative">
                        {/* Abstract Background Shapes */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

                        <div className="p-6 h-full flex flex-col relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/10">
                                    <Calendar size={24} className="text-white" />
                                </div>
                                {nextAppointment && (
                                    <Link to="/user/appointments">
                                        <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 border border-white/20">
                                            Manage
                                        </Button>
                                    </Link>
                                )}
                            </div>

                            {nextAppointment ? (
                                <div className="flex-1 flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-white/60 font-medium text-sm uppercase tracking-wider mb-1">Next Appointment</h3>
                                        <h2 className="text-3xl font-bold mb-1">{moment(nextAppointment.slotDate).format('D MMM')}</h2>
                                        <p className="text-xl text-primary-light font-medium">{moment(`${nextAppointment.slotDate} ${nextAppointment.slotTime}`).format('h:mm A')}</p>
                                    </div>

                                    <div className="mt-8 pt-6 border-t border-white/10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 border-2 border-white/20">
                                                {nextAppointment.docData?.image ? (
                                                    <img src={nextAppointment.docData.image} alt="Doctor" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Stethoscope size={18} />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-bold text-lg">Dr. {nextAppointment.docData?.name}</p>
                                                <p className="text-white/60 text-sm">{nextAppointment.docData?.speciality}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center">
                                    <Calendar size={48} className="text-white/20 mb-4" />
                                    <p className="font-medium text-white/80 text-lg mb-2">No Upcoming Visits</p>
                                    <p className="text-white/50 text-sm mb-6 max-w-[200px]">Schedule a checkup with one of our specialists.</p>
                                    <Link to="/user/doctors" className="w-full">
                                        <Button className="w-full bg-white text-[#2D336B] hover:bg-white/90 font-bold border-none">
                                            Book Appointment
                                        </Button>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </Card>
                </motion.div>

                {/* 6. Recent Reports & Access Requests (Full Width) */}
                <motion.div variants={itemVariants} className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Recent Reports */}
                    {recentReports.length > 0 && (
                        <Card className="p-6 bg-white border border-slate-100 shadow-lg shadow-slate-100/50">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-[#2D336B] flex items-center gap-2">
                                    <FileText size={18} className="text-primary" />
                                    Recent Reports
                                </h3>
                                <Link to="/user/reports" className="text-sm font-medium text-primary hover:underline">View All</Link>
                            </div>
                            <div className="space-y-3">
                                {recentReports.map(report => (
                                    <div key={report.id} className="group flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                                                <FileText size={18} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-[#2D336B] truncate max-w-[150px] sm:max-w-[200px]">{report.original_name}</p>
                                                <p className="text-xs text-slate-400 font-medium">{moment(report.uploaded_at).fromNow()}</p>
                                            </div>
                                        </div>
                                        {report.report_type === 'lab_report' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => navigate(`/user/reports/analysis/${report.id}`)}
                                                className="gap-1 border-primary/20 text-primary hover:bg-primary hover:text-white transition-colors text-xs"
                                            >
                                                <Sparkles size={12} /> Analyze
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {/* Access Requests */}
                    {accessRequests.length > 0 && (
                        <Card className="p-6 bg-white border border-slate-100 shadow-lg shadow-slate-100/50">
                            <h3 className="font-bold text-[#2D336B] flex items-center gap-2 mb-6">
                                <Shield size={18} className="text-primary" />
                                Access Requests
                                <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">{accessRequests.length}</span>
                            </h3>
                            <div className="space-y-4">
                                {accessRequests.map((request) => (
                                    <div key={request.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-white border border-slate-200">
                                                {request.doctor_image ? (
                                                    <img src={request.doctor_image} alt={request.doctor_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                                                        <Stethoscope size={16} />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-bold text-[#2D336B] text-sm">Dr. {request.doctor_name}</p>
                                                <p className="text-xs text-slate-500">{request.doctor_speciality || 'General'}</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleApproveRequest(request.id)}
                                                disabled={processingRequestId === request.id}
                                                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                            >
                                                {processingRequestId === request.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleDenyRequest(request.id)}
                                                disabled={processingRequestId === request.id}
                                                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                            >
                                                <X size={12} />
                                                Deny
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </motion.div>

            </div>
        </motion.div>
    );
}

