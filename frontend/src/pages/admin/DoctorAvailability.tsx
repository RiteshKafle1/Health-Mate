import { useEffect, useState } from 'react';
import { getAllDoctorsAdmin, updateDoctorAvailabilityAdmin } from '../../api/admin';
import { Loader2, Clock, Calendar, Save, Search, User, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface Doctor {
    _id: string;
    name: string;
    email?: string;
    speciality: string;
    image: string;
    available: boolean;
    availability_schedule: Record<string, string[]>;
}

const DAYS_OF_WEEK = [
    { key: 'monday', label: 'Mon' },
    { key: 'tuesday', label: 'Tue' },
    { key: 'wednesday', label: 'Wed' },
    { key: 'thursday', label: 'Thu' },
    { key: 'friday', label: 'Fri' },
    { key: 'saturday', label: 'Sat' },
    { key: 'sunday', label: 'Sun' }
];

const TIME_SLOTS = [
    '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
    '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM',
    '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM'
];

export function DoctorAvailability() {
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [hasChanges, setHasChanges] = useState(false);
    const [availabilitySchedule, setAvailabilitySchedule] = useState<Record<string, string[]>>({});
    const [originalSchedule, setOriginalSchedule] = useState<Record<string, string[]>>({});
    const [showDropdown, setShowDropdown] = useState(false);

    useEffect(() => {
        fetchDoctors();
    }, []);

    const fetchDoctors = async () => {
        try {
            const response = await getAllDoctorsAdmin();
            if (response.success && response.doctors) {
                setDoctors(response.doctors);
            }
        } catch (error) {
            toast.error('Failed to load doctors');
        } finally {
            setIsLoading(false);
        }
    };

    const selectDoctor = (doctor: Doctor) => {
        setSelectedDoctor(doctor);
        const schedule = doctor.availability_schedule || {};
        setAvailabilitySchedule(JSON.parse(JSON.stringify(schedule)));
        setOriginalSchedule(JSON.parse(JSON.stringify(schedule)));
        setHasChanges(false);
        setShowDropdown(false);
    };

    useEffect(() => {
        if (selectedDoctor) {
            setHasChanges(JSON.stringify(availabilitySchedule) !== JSON.stringify(originalSchedule));
        }
    }, [availabilitySchedule, originalSchedule, selectedDoctor]);

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
        toast.success('Applied to all days');
    };

    const handleSave = async () => {
        if (!selectedDoctor) return;

        setIsSaving(true);
        try {
            const response = await updateDoctorAvailabilityAdmin(
                selectedDoctor._id,
                availabilitySchedule
            );

            if (response.success) {
                toast.success(`Updated ${selectedDoctor.name}'s availability`);
                setOriginalSchedule(JSON.parse(JSON.stringify(availabilitySchedule)));
                setHasChanges(false);

                // Update local doctor data
                setDoctors(prev => prev.map(d =>
                    d._id === selectedDoctor._id
                        ? { ...d, availability_schedule: availabilitySchedule }
                        : d
                ));
                setSelectedDoctor(prev => prev ? { ...prev, availability_schedule: availabilitySchedule } : null);
            } else {
                toast.error(response.message || 'Failed to update availability');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail?.message || 'Failed to update');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setAvailabilitySchedule(JSON.parse(JSON.stringify(originalSchedule)));
        toast.success('Reset to saved state');
    };

    const filteredDoctors = doctors.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.speciality.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                        Doctor Availability
                    </h1>
                    <p className="text-text-muted mt-1">
                        Manage doctors' weekly availability schedules
                    </p>
                </div>
            </div>

            {/* Doctor Selector */}
            <div className="bg-surface rounded-2xl p-6 mb-6">
                <label className="block text-sm font-medium text-text-muted mb-2">
                    Select Doctor
                </label>
                <div className="relative">
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-surface-alt rounded-xl border border-border hover:border-primary/50 transition-colors"
                    >
                        {selectedDoctor ? (
                            <div className="flex items-center gap-3">
                                <img
                                    src={selectedDoctor.image || '/default-doctor.png'}
                                    alt={selectedDoctor.name}
                                    className="w-10 h-10 rounded-full object-cover"
                                />
                                <div className="text-left">
                                    <p className="font-medium text-text">{selectedDoctor.name}</p>
                                    <p className="text-xs text-text-muted">{selectedDoctor.speciality}</p>
                                </div>
                            </div>
                        ) : (
                            <span className="text-text-muted">Choose a doctor to manage...</span>
                        )}
                        <ChevronDown className={`text-text-muted transition-transform ${showDropdown ? 'rotate-180' : ''}`} size={20} />
                    </button>

                    {showDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-xl shadow-xl z-50 max-h-80 overflow-hidden">
                            {/* Search */}
                            <div className="p-3 border-b border-border">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search doctors..."
                                        className="w-full pl-10 pr-4 py-2 bg-surface-alt rounded-lg text-sm border border-transparent focus:border-primary/50 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Doctor List */}
                            <div className="max-h-60 overflow-y-auto">
                                {filteredDoctors.length === 0 ? (
                                    <div className="p-4 text-center text-text-muted text-sm">
                                        No doctors found
                                    </div>
                                ) : (
                                    filteredDoctors.map(doctor => (
                                        <button
                                            key={doctor._id}
                                            onClick={() => selectDoctor(doctor)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-alt transition-colors ${selectedDoctor?._id === doctor._id ? 'bg-primary/10' : ''
                                                }`}
                                        >
                                            <img
                                                src={doctor.image || '/default-doctor.png'}
                                                alt={doctor.name}
                                                className="w-10 h-10 rounded-full object-cover"
                                            />
                                            <div className="flex-1 text-left">
                                                <p className="font-medium text-text">{doctor.name}</p>
                                                <p className="text-xs text-text-muted">{doctor.speciality}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-xs px-2 py-1 rounded-full ${Object.values(doctor.availability_schedule || {}).flat().length > 0
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {Object.values(doctor.availability_schedule || {}).flat().length} slots
                                                </span>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Schedule Editor */}
            {selectedDoctor ? (
                <>
                    {/* Stats & Actions Bar */}
                    <div className="flex items-center justify-between mb-6 p-4 bg-surface rounded-xl">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3">
                                <img
                                    src={selectedDoctor.image || '/default-doctor.png'}
                                    alt={selectedDoctor.name}
                                    className="w-12 h-12 rounded-full object-cover border-2 border-primary/30"
                                />
                                <div>
                                    <p className="font-semibold text-text">{selectedDoctor.name}</p>
                                    <p className="text-xs text-text-muted">{selectedDoctor.speciality}</p>
                                </div>
                            </div>
                            <div className="w-px h-10 bg-border"></div>
                            <div className="text-center">
                                <p className="text-xl font-bold text-primary">{getWorkingDays()}</p>
                                <p className="text-xs text-text-muted">Days</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xl font-bold text-primary">{getTotalSlots()}</p>
                                <p className="text-xs text-text-muted">Slots</p>
                            </div>
                        </div>

                        {hasChanges && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleReset}
                                    className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text bg-surface-alt rounded-lg transition-colors"
                                >
                                    Reset
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                    Save Changes
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Schedule Grid */}
                    <div className="space-y-3">
                        {DAYS_OF_WEEK.map(({ key, label }) => {
                            const daySlots = availabilitySchedule[key] || [];
                            const isWorkDay = daySlots.length > 0;

                            return (
                                <div
                                    key={key}
                                    className={`bg-surface rounded-xl overflow-hidden border ${isWorkDay ? 'border-primary/30' : 'border-border'}`}
                                >
                                    <div className={`flex items-center justify-between px-4 py-3 ${isWorkDay ? 'bg-primary/5' : 'bg-surface-alt/50'}`}>
                                        <div className="flex items-center gap-3">
                                            <Calendar className={isWorkDay ? 'text-primary' : 'text-text-muted'} size={18} />
                                            <span className="font-medium text-text w-24">{label}</span>
                                            <span className="text-xs text-text-muted">
                                                {daySlots.length} slots
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => selectWorkingHours(key)} className="px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded transition-colors">9-5</button>
                                            <button onClick={() => selectAllForDay(key)} className="px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded transition-colors">All</button>
                                            <button onClick={() => clearDay(key)} className="px-2 py-1 text-xs text-error hover:bg-error/10 rounded transition-colors">Clear</button>
                                            <button onClick={() => applyToAllDays(key)} className="px-2 py-1 text-xs text-text-muted hover:bg-surface-alt rounded transition-colors">→ All</button>
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <div className="flex flex-wrap gap-1.5">
                                            {TIME_SLOTS.map(time => {
                                                const isSelected = daySlots.includes(time);
                                                return (
                                                    <button
                                                        key={time}
                                                        onClick={() => toggleTimeSlot(key, time)}
                                                        className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${isSelected
                                                            ? 'bg-primary text-white'
                                                            : 'bg-surface-alt text-text-muted hover:bg-surface-alt/70'
                                                            }`}
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
                </>
            ) : (
                <div className="bg-surface rounded-2xl p-12 text-center">
                    <User className="mx-auto text-text-muted mb-4" size={48} />
                    <h3 className="text-lg font-semibold text-text mb-2">No Doctor Selected</h3>
                    <p className="text-text-muted">
                        Select a doctor from the dropdown above to view and edit their availability schedule.
                    </p>
                </div>
            )}
        </div>
    );
}
