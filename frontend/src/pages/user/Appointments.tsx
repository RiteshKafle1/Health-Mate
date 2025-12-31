import { useEffect, useState } from 'react';
import { getUserAppointments, cancelUserAppointment } from '../../api/user';
import type { Appointment } from '../../types';
import { Calendar, Clock, User, X, Check, Loader2, AlertCircle, Stethoscope } from 'lucide-react';
import toast from 'react-hot-toast';

export function UserAppointments() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchAppointments = async () => {
        try {
            const response = await getUserAppointments();
            if (response.success && response.appointments) {
                // Sort by date, newest first
                const sorted = response.appointments.sort((a: Appointment, b: Appointment) => b.date - a.date);
                setAppointments(sorted);
            }
        } catch (error) {
            toast.error('Failed to load appointments');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAppointments();
    }, []);

    const handleCancel = async (appointmentId: string) => {
        if (!confirm('Are you sure you want to cancel this appointment?')) return;

        setProcessingId(appointmentId);

        try {
            const response = await cancelUserAppointment(appointmentId);
            if (response.success) {
                toast.success('Appointment cancelled successfully');
                fetchAppointments();
            } else {
                toast.error(response.message || 'Failed to cancel appointment');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail?.message || 'Failed to cancel appointment');
        } finally {
            setProcessingId(null);
        }
    };

    // Calculate previous completed visits with a specific doctor
    const getPreviousVisitCount = (docId: string, currentAptId: string): number => {
        return appointments.filter(apt =>
            apt.docId === docId &&
            apt.isCompleted &&
            apt._id !== currentAptId
        ).length;
    };

    const getVisitBadge = (count: number) => {
        if (count === 0) return 'First Visit';
        if (count === 1) return '2nd Visit';
        if (count === 2) return '3rd Visit';
        return `${count + 1}th Visit`;
    };

    const getStatusBadge = (apt: Appointment) => {
        if (apt.cancelled) {
            return <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200">Cancelled</span>;
        }
        if (apt.isCompleted) {
            return <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">Completed</span>;
        }
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200">Scheduled</span>;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-emerald-600" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            <div>
                <h1 className="text-2xl font-bold text-dark-50">My Appointments</h1>
                <p className="text-dark-400 mt-1">View and manage your appointments</p>
            </div>

            {appointments.length === 0 ? (
                <div className="bg-white dark:bg-dark-800 rounded-3xl p-16 text-center shadow-lg">
                    <Calendar className="mx-auto text-dark-300 mb-4" size={64} />
                    <h3 className="text-xl font-semibold text-dark-100 mb-2">No appointments yet</h3>
                    <p className="text-dark-400">Book your first free appointment with a doctor</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {appointments.map((apt) => {
                        const visitCount = getPreviousVisitCount(apt.docId, apt._id);

                        return (
                            <div key={apt._id} className="bg-white dark:bg-dark-800 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
                                <div className="flex flex-col md:flex-row gap-6">
                                    {/* Doctor Image */}
                                    <div className="w-full md:w-28 h-28 rounded-2xl overflow-hidden bg-emerald-50 dark:bg-dark-700 flex-shrink-0 shadow-md">
                                        {apt.docData?.image ? (
                                            <img src={apt.docData.image} alt={apt.docData.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-100 to-teal-100">
                                                <Stethoscope className="text-emerald-400" size={32} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Appointment Details */}
                                    <div className="flex-1">
                                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="text-xl font-bold text-dark-50">Dr. {apt.docData?.name}</h3>
                                                    {/* Visit Counter Badge */}
                                                    <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-50 text-purple-600 border border-purple-200">
                                                        {getVisitBadge(visitCount)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-emerald-600 font-medium mb-4">{apt.docData?.speciality}</p>

                                                <div className="flex flex-wrap gap-4 text-sm text-dark-300">
                                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-dark-700 px-3 py-1.5 rounded-lg">
                                                        <Calendar size={16} className="text-emerald-500" />
                                                        <span className="font-medium">{apt.slotDate}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-dark-700 px-3 py-1.5 rounded-lg">
                                                        <Clock size={16} className="text-emerald-500" />
                                                        <span className="font-medium">{apt.slotTime}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-start md:items-end gap-3">
                                                {getStatusBadge(apt)}
                                                {/* Free Consultation Badge */}
                                                <div className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">Free Consultation</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        {!apt.cancelled && !apt.isCompleted && (
                                            <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-dashed border-gray-200 dark:border-dark-700">
                                                <button
                                                    onClick={() => handleCancel(apt._id)}
                                                    disabled={processingId === apt._id}
                                                    className="bg-red-50 text-red-600 border-2 border-red-500 hover:bg-red-500 hover:text-white px-5 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 text-sm font-semibold shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {processingId === apt._id ? (
                                                        <Loader2 className="animate-spin" size={16} />
                                                    ) : (
                                                        <X size={16} />
                                                    )}
                                                    Cancel Appointment
                                                </button>
                                            </div>
                                        )}

                                        {apt.isCompleted && (
                                            <div className="flex items-center gap-2 mt-5 pt-5 border-t border-dashed border-gray-200 dark:border-dark-700 text-emerald-500">
                                                <Check size={18} className="flex-shrink-0" />
                                                <span className="text-sm font-medium">This appointment has been completed</span>
                                            </div>
                                        )}

                                        {apt.cancelled && (
                                            <div className="flex items-center gap-2 mt-5 pt-5 border-t border-dashed border-gray-200 dark:border-dark-700 text-red-500">
                                                <AlertCircle size={18} className="flex-shrink-0" />
                                                <span className="text-sm font-medium">This appointment was cancelled</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
