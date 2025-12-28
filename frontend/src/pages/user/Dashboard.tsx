import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, getUserAppointments } from '../../api/user';
import type { User, Appointment } from '../../types';
import {
    Calendar, Clock, Stethoscope, Loader2, Pill, CheckCircle2, ChevronRight, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getDoseHistory, getTodayDoses, markDoseTaken, type TodayDoseItem } from '../../api/doses';
import moment from 'moment';

export function UserDashboard() {
    const { setUser } = useAuth();
    const [profile, setProfile] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [nextMedication, setNextMedication] = useState<TodayDoseItem | null>(null);
    const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
    const [adherenceScore, setAdherenceScore] = useState(0);
    const [streak, setStreak] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Parallel data fetching
                const today = new Date();
                const last7Days = new Date(today);
                last7Days.setDate(today.getDate() - 7);

                const [profileRes, appointmentsRes, dosesRes, historyRes] = await Promise.all([
                    getUserProfile(),
                    getUserAppointments(),
                    getTodayDoses(),
                    getDoseHistory(last7Days.toISOString().split('T')[0], today.toISOString().split('T')[0])
                ]);

                if (profileRes.success && profileRes.userData) {
                    setProfile(profileRes.userData);
                    setUser(profileRes.userData);
                }

                // 1. Next Appointment Logic
                if (appointmentsRes.success && appointmentsRes.appointments) {
                    const upcoming = appointmentsRes.appointments
                        .filter(apt => !apt.cancelled && !apt.isCompleted)
                        .sort((a, b) => new Date(`${a.slotDate}T${a.slotTime}`).getTime() - new Date(`${b.slotDate}T${b.slotTime}`).getTime());
                    setNextAppointment(upcoming[0] || null);
                }

                // 2. Next Medication Logic
                if (dosesRes.success && dosesRes.doses) {
                    const pending = dosesRes.doses
                        .filter(d => d.status === 'pending' || d.status === 'available' || d.status === 'late')
                        .sort((a, b) => a.time_until !== null && b.time_until !== null ? a.time_until - b.time_until : 0);

                    // Filter out future doses that are too far? No, just taking the next one.
                    // Actually, if time_until is negative (late), it should be prioritized?
                    // Let's trust the sort, assuming time_until is roughly minutes from now.
                    // Ideally we want the one that is closest to NOW (absolute value?) 
                    // No, usually "Next" implies future or "Actionable now".

                    // Find first available/late dose
                    const actionable = pending.find(d => d.status === 'available' || d.status === 'late') || pending[0];
                    setNextMedication(actionable || null);
                }

                // 3. Adherence Score
                if (historyRes.success) {
                    setAdherenceScore(historyRes.adherence_rate || 0);

                    // 4. Calculate Streak (Simple approximation from history logs)
                    // This is rough. Ideally backend provides this.
                    // We'll calculate consecutive days with 100% adherence from the logs.
                    // Group logs by date
                    const logsByDate = historyRes.logs.reduce((acc: any, log) => {
                        const date = log.date.split('T')[0];
                        if (!acc[date]) acc[date] = [];
                        acc[date].push(log);
                        return acc;
                    }, {});

                    let currentStreak = 0;
                    // Iterate backwards from yesterday
                    for (let i = 1; i <= 30; i++) { // Check last 30 days max
                        const d = new Date();
                        d.setDate(d.getDate() - i);
                        const dateStr = d.toISOString().split('T')[0];
                        const dayLogs = logsByDate[dateStr];

                        if (!dayLogs || dayLogs.length === 0) break; // No data, break streak? Or maybe they didn't have meds? 

                        const allTaken = dayLogs.every((l: any) => l.status === 'taken');
                        if (allTaken) currentStreak++;
                        else break;
                    }
                    // Add today if all taken so far? No, streak usually implies completed days.
                    setStreak(currentStreak);
                }

            } catch {
                toast.error('Failed to load dashboard data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [setUser]);

    const handleMarkNextTaken = async () => {
        if (!nextMedication) return;
        try {
            const res = await markDoseTaken(nextMedication.medication_id, nextMedication.scheduled_time);
            if (res.success) {
                toast.success('Dose marked as taken');
                setNextMedication(null); // Clear momentarily, should refresh or let it be null until reload
                // Ideally refresh data here
            }
        } catch {
            toast.error('Could not mark as taken');
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

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-text tracking-tight">Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {profile?.name || 'User'}</h1>
                    <p className="text-text-muted mt-1">{todayDate}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link to="/user/medications">
                        <Button variant="outline" className="gap-2">
                            <Pill size={18} /> Medication List
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">

                {/* 1. Adherence Score (Hero) - Spans 4 columns */}
                <Card className="lg:col-span-4 p-8 flex flex-col items-center justify-center relative overflow-hidden bg-white border-none shadow-card hover:shadow-hover transition-shadow duration-300 min-h-[300px]">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-primary-hover"></div>
                    <div className="relative z-10 text-center">
                        <h3 className="text-text-muted text-sm font-semibold uppercase tracking-wider mb-6">Weekly Adherence</h3>

                        {/* Radial Progress Placeholder - visual only using border hacks for now or SVG */}
                        <div className="relative w-40 h-40 mx-auto mb-6 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    className="text-surface/30"
                                    strokeWidth="12"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r="70"
                                    cx="80"
                                    cy="80"
                                />
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
                    {/* Decor elements */}
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
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className={`h-2 flex-1 rounded-full ${i < (streak % 5 === 0 && streak > 0 ? 5 : streak % 5) ? 'bg-warning' : 'bg-surface/30'}`}></div>
                        ))}
                    </div>
                </Card>

                {/* 3. Next Medication - Spans 5 columns */}
                <Card className="lg:col-span-5 p-0 overflow-hidden bg-white border-none shadow-card hover:shadow-hover transition-shadow duration-300 flex flex-col">
                    <div className="p-6 pb-4 border-b border-surface/30 bg-primary/5 flex justify-between items-center">
                        <h3 className="text-primary font-semibold flex items-center gap-2">
                            <Pill size={18} />
                            Up Next
                        </h3>
                        {nextMedication?.time_until && (
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${nextMedication.time_until < 0 ? 'bg-red-100 text-red-600' : 'bg-white text-primary'}`}>
                                {nextMedication.time_until < 0 ? 'Overdue' : `In ${nextMedication.time_until} min`}
                            </span>
                        )}
                    </div>

                    <div className="p-6 flex-1 flex flex-col justify-center">
                        {nextMedication ? (
                            <>
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-text mb-1">{nextMedication.medication_name}</h2>
                                        <p className="text-text-muted">Scheduled for {nextMedication.scheduled_time}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-surface/30 flex items-center justify-center text-text-muted">
                                        <Clock size={24} />
                                    </div>
                                </div>
                                <Button
                                    className="w-full gap-2 shadow-sm"
                                    onClick={handleMarkNextTaken}
                                >
                                    <CheckCircle2 size={18} /> Mark as Taken
                                </Button>
                            </>
                        ) : (
                            <div className="text-center py-4">
                                <CheckCircle2 className="mx-auto text-success mb-3" size={40} />
                                <h3 className="text-lg font-medium text-text">All caught up!</h3>
                                <p className="text-text-muted text-sm">No pending medications for now.</p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* 4. Next Appointment - Spans 12 columns (Full Width lower section) or maybe split? 
                    User asked for "Next Appointment" as a key section. 
                    Let's make it sit nicely next to something or alone. 
                    Actually, let's put it in a grid below if there is space, or maybe strictly limited.
                */}
                <div className="lg:col-span-12">
                    <h3 className="text-text-muted text-sm font-semibold uppercase tracking-wider mb-4">Coming Up</h3>

                    <Card className="p-0 overflow-hidden bg-white border-none shadow-card hover:shadow-hover transition-all group">
                        {nextAppointment ? (
                            <div className="flex flex-col md:flex-row">
                                <div className="p-6 md:w-64 bg-surface/10 flex flex-col items-center justify-center text-center border-r border-surface/20">
                                    <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-3 text-primary">
                                        <Calendar size={32} />
                                    </div>
                                    <span className="text-lg font-bold text-text">{moment(nextAppointment.slotDate).format('MMM D')}</span>
                                    <span className="text-text-muted text-sm">{moment(`${nextAppointment.slotDate} ${nextAppointment.slotTime}`).format('dddd, h:mm A')}</span>
                                </div>
                                <div className="p-6 flex-1 flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full overflow-hidden bg-surface">
                                            {nextAppointment.docData?.image ? (
                                                <img src={nextAppointment.docData.image} alt="Doctor" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-surface text-text-muted">
                                                    <Stethoscope size={20} />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-bold text-text">Dr. {nextAppointment.docData?.name}</h4>
                                            <p className="text-text-muted">{nextAppointment.docData?.speciality} • General Checkup</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="px-3 py-1 bg-surface/20 rounded-full text-sm font-medium text-text-muted">
                                            in person
                                        </span>
                                        <Link to={`/user/appointments`}>
                                            <Button variant="ghost" className="gap-2 group-hover:translate-x-1 transition-transform">
                                                Details <ChevronRight size={18} />
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 text-center flex flex-col items-center justify-center">
                                <div className="w-12 h-12 rounded-full bg-surface/20 flex items-center justify-center mb-3">
                                    <Calendar size={24} className="text-text-muted" />
                                </div>
                                <h3 className="text-text font-medium">No upcoming appointments</h3>
                                <Link to="/user/doctors" className="mt-4">
                                    <Button variant="secondary" size="sm">Book Now</Button>
                                </Link>
                            </div>
                        )}
                    </Card>
                </div>

            </div>
        </div>
    );
}

