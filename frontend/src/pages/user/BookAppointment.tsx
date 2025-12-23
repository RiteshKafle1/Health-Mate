import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAllDoctors } from '../../api/doctor';
import { bookAppointment } from '../../api/user';
import type { Doctor } from '../../types';
import { Calendar, Clock, MapPin, Award, Info, Loader2, ChevronLeft } from 'lucide-react';
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

    // Generate available dates (next 7 days)
    useEffect(() => {
        const dates: string[] = [];
        for (let i = 1; i <= 7; i++) {
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

    // Generate time slots based on selected date
    useEffect(() => {
        if (!selectedDate || !doctor) return;

        const slots: string[] = [];
        const bookedSlots = doctor.slots_booked?.[selectedDate] || [];

        // Generate time slots from 9 AM to 8 PM
        for (let hour = 9; hour <= 20; hour++) {
            const time12 = hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? '12:00 PM' : `${hour}:00 AM`;
            const time12_30 = hour > 12 ? `${hour - 12}:30 PM` : hour === 12 ? '12:30 PM' : `${hour}:30 AM`;

            if (!bookedSlots.includes(time12)) slots.push(time12);
            if (!bookedSlots.includes(time12_30) && hour < 20) slots.push(time12_30);
        }

        setAvailableSlots(slots);
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
        };
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-primary-500" size={48} />
            </div>
        );
    }

    if (!doctor) {
        return null;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Back Button */}
            <button
                onClick={() => navigate('/user/doctors')}
                className="flex items-center gap-2 text-dark-400 hover:text-dark-200 transition-colors"
            >
                <ChevronLeft size={20} />
                Back to Doctors
            </button>

            {/* Doctor Info Card */}
            <div className="glass-card p-6">
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Doctor Image */}
                    <div className="w-full md:w-48 aspect-square rounded-xl overflow-hidden bg-dark-700 flex-shrink-0">
                        {doctor.image ? (
                            <img src={doctor.image} alt={doctor.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-500">
                                <span className="text-4xl font-bold text-white">{doctor.name.charAt(0)}</span>
                            </div>
                        )}
                    </div>

                    {/* Doctor Details */}
                    <div className="flex-1">
                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-dark-50">Dr. {doctor.name}</h1>
                                <p className="text-primary-400 mt-1">{doctor.speciality}</p>
                            </div>
                            <span className={`badge ${doctor.available ? 'badge-success' : 'badge-danger'}`}>
                                {doctor.available ? 'Available' : 'Unavailable'}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                            <div className="flex items-center gap-2 text-dark-300">
                                <Award size={18} className="text-primary-400" />
                                <span>{doctor.degree}</span>
                            </div>
                            <div className="flex items-center gap-2 text-dark-300">
                                <Clock size={18} className="text-primary-400" />
                                <span>{doctor.experience}</span>
                            </div>
                            <div className="flex items-center gap-2 text-dark-300">
                                <MapPin size={18} className="text-primary-400" />
                                <span>{doctor.address?.line1 || 'N/A'}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-dark-700/50">
                            <Info size={18} className="text-dark-400" />
                            <p className="text-sm text-dark-300 line-clamp-2">{doctor.about}</p>
                        </div>

                        <div className="mt-4">
                            <span className="text-2xl font-bold text-gradient">₹{doctor.fees}</span>
                            <span className="text-dark-400 ml-2">per consultation</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Date Selection */}
            <div className="glass-card p-6">
                <h2 className="text-lg font-semibold text-dark-100 mb-4 flex items-center gap-2">
                    <Calendar size={20} className="text-primary-400" />
                    Select Date
                </h2>

                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                    {availableDates.map((date) => {
                        const formatted = formatDate(date);
                        const isSelected = selectedDate === date;

                        return (
                            <button
                                key={date}
                                onClick={() => setSelectedDate(date)}
                                className={`
                  flex-shrink-0 w-20 py-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center
                  ${isSelected
                                        ? 'bg-gradient-to-br from-primary-500 to-secondary-500 border-transparent text-white'
                                        : 'bg-dark-700/50 border-dark-600 text-dark-300 hover:border-dark-500'
                                    }
                `}
                            >
                                <span className="text-xs uppercase">{formatted.day}</span>
                                <span className="text-2xl font-bold my-1">{formatted.date}</span>
                                <span className="text-xs">{formatted.month}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Time Selection */}
            <div className="glass-card p-6">
                <h2 className="text-lg font-semibold text-dark-100 mb-4 flex items-center gap-2">
                    <Clock size={20} className="text-primary-400" />
                    Select Time
                </h2>

                {availableSlots.length === 0 ? (
                    <p className="text-dark-400 text-center py-4">No available slots for this date</p>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {availableSlots.map((time) => {
                            const isSelected = selectedTime === time;

                            return (
                                <button
                                    key={time}
                                    onClick={() => setSelectedTime(time)}
                                    className={`
                    py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all duration-200
                    ${isSelected
                                            ? 'bg-primary-500 border-primary-500 text-white'
                                            : 'bg-dark-700/50 border-dark-600 text-dark-300 hover:border-primary-500/50'
                                        }
                  `}
                                >
                                    {time}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Book Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleBooking}
                    disabled={!selectedDate || !selectedTime || isBooking || !doctor.available}
                    className="btn-primary flex items-center gap-2 text-lg px-8"
                >
                    {isBooking ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            Booking...
                        </>
                    ) : (
                        <>
                            <Calendar size={20} />
                            Confirm Booking
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
