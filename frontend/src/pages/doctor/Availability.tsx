import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getDoctorProfile, updateDoctorProfile } from '../../api/doctor';
import { Loader2, Clock, Calendar, Check, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const DAYS_OF_WEEK = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' }
];

const TIME_SLOTS = [
    '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
    '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM',
    '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM'
];

export function Availability() {
    const { setUser } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [availabilitySchedule, setAvailabilitySchedule] = useState<Record<string, string[]>>({});
    const [originalSchedule, setOriginalSchedule] = useState<Record<string, string[]>>({});

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await getDoctorProfile();
                if (response.success && response.profileData) {
                    const profileData = response.profileData;
                    const schedule = profileData.availability_schedule || {};
                    setAvailabilitySchedule(schedule);
                    setOriginalSchedule(JSON.parse(JSON.stringify(schedule)));
                }
            } catch (error) {
                toast.error('Failed to load availability');
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, []);

    // Check for changes
    useEffect(() => {
        setHasChanges(JSON.stringify(availabilitySchedule) !== JSON.stringify(originalSchedule));
    }, [availabilitySchedule, originalSchedule]);

    const toggleTimeSlot = (day: string, time: string) => {
        setAvailabilitySchedule(prev => {
            const daySlots = prev[day] || [];
            if (daySlots.includes(time)) {
                return { ...prev, [day]: daySlots.filter(t => t !== time) };
            } else {
                return {
                    ...prev, [day]: [...daySlots, time].sort((a, b) => {
                        const timeToMinutes = (t: string) => {
                            const [hourMin, period] = t.split(' ');
                            let [hours, mins] = hourMin.split(':').map(Number);
                            if (period === 'PM' && hours !== 12) hours += 12;
                            if (period === 'AM' && hours === 12) hours = 0;
                            return hours * 60 + mins;
                        };
                        return timeToMinutes(a) - timeToMinutes(b);
                    })
                };
            }
        });
    };

    const selectAllForDay = (day: string) => {
        setAvailabilitySchedule(prev => ({ ...prev, [day]: [...TIME_SLOTS] }));
    };

    const clearDay = (day: string) => {
        setAvailabilitySchedule(prev => ({ ...prev, [day]: [] }));
    };

    const selectWorkingHours = (day: string) => {
        // 9 AM to 5 PM (standard working hours)
        const workingSlots = TIME_SLOTS.filter(time => {
            const [hourMin, period] = time.split(' ');
            const [hours] = hourMin.split(':').map(Number);
            const hour24 = period === 'PM' && hours !== 12 ? hours + 12 : (period === 'AM' && hours === 12 ? 0 : hours);
            return hour24 >= 9 && hour24 < 17;
        });
        setAvailabilitySchedule(prev => ({ ...prev, [day]: workingSlots }));
    };

    const applyToAllDays = (sourceDay: string) => {
        const sourceSlots = availabilitySchedule[sourceDay] || [];
        const newSchedule: Record<string, string[]> = {};
        DAYS_OF_WEEK.forEach(({ key }) => {
            newSchedule[key] = [...sourceSlots];
        });
        setAvailabilitySchedule(newSchedule);
        toast.success(`Applied ${DAYS_OF_WEEK.find(d => d.key === sourceDay)?.label}'s schedule to all days`);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await updateDoctorProfile({
                availability_schedule: availabilitySchedule,
            });

            if (response.success) {
                toast.success('Availability schedule saved successfully!');
                setOriginalSchedule(JSON.parse(JSON.stringify(availabilitySchedule)));
                setHasChanges(false);

                // Refresh profile and update user context
                const profileRes = await getDoctorProfile();
                if (profileRes.success && profileRes.profileData) {
                    setUser(profileRes.profileData);
                }
            } else {
                toast.error(response.message || 'Failed to save availability');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail?.message || 'Failed to save availability');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setAvailabilitySchedule(JSON.parse(JSON.stringify(originalSchedule)));
        toast.success('Schedule reset to last saved state');
    };

    const getTotalSlots = () => {
        return Object.values(availabilitySchedule).reduce((total, slots) => total + slots.length, 0);
    };

    const getWorkingDays = () => {
        return Object.entries(availabilitySchedule).filter(([_, slots]) => slots.length > 0).length;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-text flex items-center gap-3">
                        <Clock className="text-primary" size={28} />
                        Availability Schedule
                    </h1>
                    <p className="text-text-muted mt-1">
                        Set your working hours for each day of the week
                    </p>
                </div>

                {/* Stats & Actions */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-6 px-4 py-2 bg-surface rounded-xl">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-primary">{getWorkingDays()}</p>
                            <p className="text-xs text-text-muted">Working Days</p>
                        </div>
                        <div className="w-px h-8 bg-border"></div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-primary">{getTotalSlots()}</p>
                            <p className="text-xs text-text-muted">Total Slots</p>
                        </div>
                    </div>

                    {hasChanges && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleReset}
                                className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text bg-surface hover:bg-surface/80 rounded-lg transition-colors"
                            >
                                Reset
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <Loader2 className="animate-spin" size={16} />
                                ) : (
                                    <Save size={16} />
                                )}
                                Save Changes
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 mb-6 p-4 bg-surface rounded-xl">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                        <Check size={14} className="text-white" />
                    </div>
                    <span className="text-sm text-text-muted">Available</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-surface-alt border border-border"></div>
                    <span className="text-sm text-text-muted">Not Available</span>
                </div>
                <div className="ml-auto text-sm text-text-muted">
                    Click on time slots to toggle availability
                </div>
            </div>

            {/* Schedule Grid */}
            <div className="space-y-4">
                {DAYS_OF_WEEK.map(({ key, label }) => {
                    const daySlots = availabilitySchedule[key] || [];
                    const isWorkDay = daySlots.length > 0;

                    return (
                        <div
                            key={key}
                            className={`bg-surface rounded-2xl overflow-hidden border transition-all ${isWorkDay ? 'border-primary/30' : 'border-border'}`}
                        >
                            {/* Day Header */}
                            <div className={`flex items-center justify-between px-6 py-4 ${isWorkDay ? 'bg-primary/5' : 'bg-surface-alt/50'}`}>
                                <div className="flex items-center gap-4">
                                    <Calendar className={`${isWorkDay ? 'text-primary' : 'text-text-muted'}`} size={20} />
                                    <div>
                                        <h3 className="font-semibold text-text">{label}</h3>
                                        <p className="text-xs text-text-muted">
                                            {daySlots.length === 0
                                                ? 'No slots selected - not available'
                                                : `${daySlots.length} slot${daySlots.length !== 1 ? 's' : ''} selected`}
                                        </p>
                                    </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => selectWorkingHours(key)}
                                        className="px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    >
                                        9-5
                                    </button>
                                    <button
                                        onClick={() => selectAllForDay(key)}
                                        className="px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    >
                                        All Day
                                    </button>
                                    <button
                                        onClick={() => clearDay(key)}
                                        className="px-3 py-1.5 text-xs font-medium text-error hover:bg-error/10 rounded-lg transition-colors"
                                    >
                                        Clear
                                    </button>
                                    <div className="w-px h-6 bg-border mx-1"></div>
                                    <button
                                        onClick={() => applyToAllDays(key)}
                                        className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text hover:bg-surface-alt rounded-lg transition-colors"
                                        title="Apply this day's schedule to all days"
                                    >
                                        Apply to All
                                    </button>
                                </div>
                            </div>

                            {/* Time Slots */}
                            <div className="p-4">
                                <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
                                    {TIME_SLOTS.map(time => {
                                        const isSelected = daySlots.includes(time);
                                        return (
                                            <button
                                                key={time}
                                                onClick={() => toggleTimeSlot(key, time)}
                                                className={`
                                                    px-2 py-2 rounded-lg text-xs font-medium transition-all duration-200
                                                    ${isSelected
                                                        ? 'bg-primary text-white shadow-sm ring-2 ring-primary/30'
                                                        : 'bg-surface-alt text-text-muted hover:bg-surface-alt/70 hover:text-text'}
                                                `}
                                            >
                                                {time}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Floating Save Button (Mobile) */}
            {hasChanges && (
                <div className="fixed bottom-6 right-6 md:hidden">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-3 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-full shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : (
                            <Save size={18} />
                        )}
                        Save
                    </button>
                </div>
            )}
        </div>
    );
}
