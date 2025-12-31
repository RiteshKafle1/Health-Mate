import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAllDoctors } from '../../api/doctor';
import { bookAppointment } from '../../api/user';
import type { Doctor } from '../../types';
import { Clock, MapPin, Award, Info, Loader2, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export function BookAppointment() {
    const { doctorId } = useParams<{ doctorId: string }>();
    const navigate = useNavigate();
    const [doctor, setDoctor] = useState<Doctor | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isBooking, setIsBooking] = useState(false);

    // Booking state
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);

    // Time of day grouping
    type TimeGroup = { morning: string[], afternoon: string[], evening: string[] };
    const [groupedSlots, setGroupedSlots] = useState<TimeGroup>({ morning: [], afternoon: [], evening: [] });


    // Generate available dates (next 60 days - 2 months)
    useEffect(() => {
        const dates: string[] = [];
        for (let i = 1; i <= 60; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            dates.push(date.toISOString().split('T')[0]);
        }
        setAvailableDates(dates);
        if (dates.length > 0) {
            setSelectedDate(dates[0]);
        }
    }, []);

    // Fetch doctor
    useEffect(() => {
        const fetchDoctor = async () => {
            try {
                const response = await getAllDoctors();
                if (response.success && response.doctors) {
                    const doc = response.doctors.find((d: Doctor) => d._id === doctorId);
                    if (doc) {
                        setDoctor(doc);
                    } else {
                        toast.error('Doctor not found');
                        navigate('/user/doctors');
                    }
                }
            } catch (error) {
                toast.error('Failed to load doctor details');
            } finally {
                setIsLoading(false);
            }
        };

        if (doctorId) {
            fetchDoctor();
        }
    }, [doctorId, navigate]);

    // Generate time slots based on selected date and group them
    useEffect(() => {
        if (!doctor) return;

        if (!selectedDate) {
            setAvailableSlots([]);
            setGroupedSlots({ morning: [], afternoon: [], evening: [] });
            return;
        }

        const allSlots: string[] = [];
        const bookedSlots = doctor.slots_booked?.[selectedDate] || [];

        // Grouping
        const groups: TimeGroup = { morning: [], afternoon: [], evening: [] };

        // Generate time slots from 9 AM to 8 PM
        for (let hour = 9; hour <= 20; hour++) {
            const time12 = hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? '12:00 PM' : `${hour}:00 AM`;
            const time12_30 = hour > 12 ? `${hour - 12}:30 PM` : hour === 12 ? '12:30 PM' : `${hour}:30 AM`;

            // Function to add slot if not booked
            const addSlot = (time: string) => {
                if (!bookedSlots.includes(time)) {
                    allSlots.push(time);
                    if (hour < 12) groups.morning.push(time);
                    else if (hour < 17) groups.afternoon.push(time);
                    else groups.evening.push(time);
                }
            };

            addSlot(time12);
            if (hour < 20) addSlot(time12_30); // Don't add 8:30 PM if closing is 8
        }

        setAvailableSlots(allSlots);
        setGroupedSlots(groups);
        setSelectedTime('');
    }, [selectedDate, doctor]);

    const handleBooking = async () => {
        if (!selectedDate || !selectedTime || !doctorId) {
            toast.error('Please select date and time');
            return;
        }

        setIsBooking(true);

        try {
            const response = await bookAppointment({
                docId: doctorId,
                slotDate: selectedDate,
                slotTime: selectedTime,
            });

            if (response.success) {
                toast.success('Appointment booked successfully!');
                navigate('/user/appointments');
            } else {
                toast.error(response.message || 'Failed to book appointment');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail?.message || 'Failed to book appointment');
        } finally {
            setIsBooking(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return {
            day: date.toLocaleDateString('en-US', { weekday: 'short' }),
            date: date.getDate(),
            month: date.toLocaleDateString('en-US', { month: 'short' }),
            full: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        };
    };

    // Toggle Date Selection
    const handleDateSelect = (date: string) => {
        setSelectedDate(prev => prev === date ? '' : date);
    };

    // Toggle Time Selection
    const handleTimeSelect = (time: string) => {
        setSelectedTime(prev => prev === time ? '' : time);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-primary-500" size={48} />
            </div>
        );
    }

    if (!doctor) return null;

    return (
        <div className="max-w-6xl mx-auto pb-12">
            {/* Header / Nav */}
            <button
                onClick={() => navigate('/user/doctors')}
                className="flex items-center gap-2 text-dark-400 hover:text-dark-100 transition-colors mb-6 group px-4 md:px-0"
            >
                <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                <span className="font-medium">Back to Specialists</span>
            </button>

            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 px-4 md:px-0">

                {/* LEFT COLUMN: Doctor Profile - Compact Design */}
                <div className="lg:w-1/3">
                    <div className="bg-white dark:bg-dark-800 rounded-3xl p-5 shadow-xl shadow-dark-200/50 dark:shadow-none hover:shadow-2xl transition-shadow duration-300 lg:sticky lg:top-24">
                        {/* Smaller Image Area */}
                        <div className="relative h-48 rounded-2xl overflow-hidden bg-dark-100 dark:bg-dark-700 mb-4 group">
                            {doctor.image ? (
                                <img src={doctor.image} alt={doctor.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-500 to-teal-500">
                                    <span className="text-5xl font-bold text-white">{doctor.name.charAt(0)}</span>
                                </div>
                            )}
                            <div className="absolute inset-0 border-4 border-white/10 rounded-2xl pointer-events-none"></div>
                        </div>

                        <div className="text-center mb-4">
                            <h2 className="text-xl font-bold text-dark-50 mb-1">Dr. {doctor.name}</h2>
                            <p className="text-primary-500 font-medium bg-primary-50 dark:bg-primary-900/10 inline-block px-3 py-0.5 rounded-full text-xs">
                                {doctor.speciality}
                            </p>
                        </div>

                        <div className="space-y-3 mb-6">
                            <div className="flex items-center gap-3 text-dark-300">
                                <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/10 flex items-center justify-center text-amber-500">
                                    <Award size={16} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] text-dark-400 uppercase font-semibold tracking-wider">Education</p>
                                    <p className="text-dark-100 font-medium text-sm">{doctor.degree}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-dark-300">
                                <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/10 flex items-center justify-center text-blue-500">
                                    <Clock size={16} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] text-dark-400 uppercase font-semibold tracking-wider">Experience</p>
                                    <p className="text-dark-100 font-medium text-sm">{doctor.experience}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-dark-300">
                                <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/10 flex items-center justify-center text-emerald-500">
                                    <MapPin size={16} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] text-dark-400 uppercase font-semibold tracking-wider">Location</p>
                                    <p className="text-dark-100 font-medium text-sm truncate">{doctor.address?.line1 || 'Clinic'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-dark-50 dark:bg-dark-700/50 p-3 rounded-xl group hover:shadow-lg hover:bg-white dark:hover:bg-dark-700 transition-all duration-300 relative z-10">
                            <h4 className="font-semibold text-dark-100 mb-1 flex items-center gap-2 text-sm">
                                <Info size={14} className="text-primary-500" />
                                About
                            </h4>
                            <p className="text-xs text-dark-400 leading-relaxed max-h-24 overflow-hidden group-hover:max-h-[500px] group-hover:overflow-visible transition-all duration-500 ease-in-out pr-2">
                                {doctor.about}
                            </p>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Booking Flow */}
                <div className="lg:w-2/3">
                    <div className="bg-white dark:bg-dark-800 rounded-3xl p-6 border-none shadow-xl shadow-dark-200/50 dark:shadow-none transition-shadow duration-300 hover:shadow-2xl">
                        <div className="mb-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-dark-700 dark:to-dark-700 rounded-2xl flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-400">Consultation Fee</h3>
                                <p className="text-xs text-emerald-600 dark:text-emerald-300">Professional service charges waived</p>
                            </div>
                            <div className="bg-white dark:bg-dark-800 px-4 py-2 rounded-xl shadow-sm">
                                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">Free</span>
                            </div>
                        </div>

                        {/* Step 1: Date */}
                        <div className="mb-8">
                            <h3 className="text-lg font-bold text-dark-100 mb-3 flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">1</span>
                                Select Date
                            </h3>

                            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-thin -mx-2 px-2">
                                {availableDates.map((date) => {
                                    const formatted = formatDate(date);
                                    const isSelected = selectedDate === date;
                                    return (
                                        <button
                                            key={date}
                                            onClick={() => handleDateSelect(date)}
                                            className={`
                                                flex-shrink-0 w-[72px] h-[84px] rounded-xl transition-all duration-300 flex flex-col items-center justify-center gap-0.5 relative overflow-hidden group
                                                ${isSelected
                                                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 transform scale-105'
                                                    : 'bg-white dark:bg-dark-700 text-dark-500 shadow-sm hover:shadow-emerald-500/20 hover:-translate-y-1'
                                                }
                                            `}
                                        >
                                            <span className={`text-[10px] font-semibold uppercase tracking-wide ${isSelected ? 'text-emerald-100' : 'text-dark-400'}`}>{formatted.day}</span>
                                            <span className={`text-xl font-bold ${isSelected ? 'text-white' : 'text-dark-100'}`}>{formatted.date}</span>
                                            <span className={`text-[10px] ${isSelected ? 'text-emerald-100' : 'text-dark-400'}`}>{formatted.month}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Step 2: Time */}
                        <div className="mb-8">
                            <h3 className="text-lg font-bold text-dark-100 mb-3 flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">2</span>
                                Select Time
                            </h3>

                            {!selectedDate ? (
                                <div className="text-center py-8 bg-dark-50 dark:bg-dark-700/30 rounded-2xl border border-dashed border-dark-200">
                                    <Clock className="mx-auto text-dark-300 mb-2" size={24} />
                                    <p className="text-dark-400 font-medium text-sm">Please select a date first</p>
                                </div>
                            ) : availableSlots.length === 0 ? (
                                <div className="text-center py-8 bg-dark-50 dark:bg-dark-700/30 rounded-2xl border border-dashed border-dark-200">
                                    <Clock className="mx-auto text-dark-300 mb-2" size={24} />
                                    <p className="text-dark-400 font-medium text-sm">No available slots for {formatDate(selectedDate).full}</p>
                                    <p className="text-xs text-dark-300 mt-1">Please try selecting another date.</p>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    {/* Morning Slots */}
                                    {groupedSlots.morning.length > 0 && (
                                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                            <h4 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                                Morning
                                            </h4>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                                {groupedSlots.morning.map(time => (
                                                    <TimeSlotBtn key={time} time={time} selected={selectedTime === time} onClick={() => handleTimeSelect(time)} />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Afternoon Slots */}
                                    {groupedSlots.afternoon.length > 0 && (
                                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
                                            <h4 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                                                Afternoon
                                            </h4>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                                {groupedSlots.afternoon.map(time => (
                                                    <TimeSlotBtn key={time} time={time} selected={selectedTime === time} onClick={() => handleTimeSelect(time)} />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Evening Slots */}
                                    {groupedSlots.evening.length > 0 && (
                                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
                                            <h4 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                                                Evening
                                            </h4>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                                {groupedSlots.evening.map(time => (
                                                    <TimeSlotBtn key={time} time={time} selected={selectedTime === time} onClick={() => handleTimeSelect(time)} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Step 3: Action */}
                        <div className="pt-4 border-t border-dark-100 dark:border-dark-700 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="hidden md:block">
                                {selectedDate && selectedTime ? (
                                    <div className="text-sm">
                                        <p className="text-dark-400 text-xs">Booking for:</p>
                                        <p className="font-semibold text-dark-100">
                                            {formatDate(selectedDate).full} at {selectedTime}
                                        </p>
                                    </div>
                                ) : (
                                    <span className="text-dark-400 text-xs">Please select a date and time</span>
                                )}
                            </div>

                            <button
                                onClick={handleBooking}
                                disabled={!selectedDate || !selectedTime || isBooking || !doctor.available}
                                className={`
                                    w-full md:w-auto px-6 py-3 rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-all duration-300 shadow-md
                                    ${!selectedDate || !selectedTime || isBooking || !doctor.available
                                        ? 'bg-dark-200 text-dark-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:shadow-emerald-500/30 hover:-translate-y-1'
                                    }
                                `}
                            >
                                {isBooking ? (
                                    <>
                                        <Loader2 className="animate-spin" size={18} />
                                        Scheduling...
                                    </>
                                ) : (
                                    <>
                                        Confirm Free Appointment
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TimeSlotBtn({ time, selected, onClick }: { time: string, selected: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`
                py-2 px-1 rounded-lg text-xs font-medium transition-all duration-200
                ${selected
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 scale-105'
                    : 'bg-white dark:bg-dark-700 text-dark-500 shadow-sm hover:shadow hover:bg-emerald-50/50 hover:-translate-y-0.5'
                }
            `}
        >
            {time}
        </button>
    );
}
