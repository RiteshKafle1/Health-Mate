import { useEffect, useState } from 'react';
import { getUserAppointments, cancelUserAppointment, deleteUserAppointment } from '../../api/user';
import type { Appointment, AppointmentStatus } from '../../types';
import { Calendar, Clock, X, Check, Loader2, AlertCircle, Stethoscope, HourglassIcon, XCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function UserAppointments() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [cancelModalOpen, setCancelModalOpen] = useState<string | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState<string | null>(null);

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

    const handleCancelClick = (appointmentId: string) => {
        setCancelModalOpen(appointmentId);
    };

    const handleDeleteClick = (appointmentId: string) => {
        setDeleteModalOpen(appointmentId);
    };

    const confirmCancel = async () => {
        if (!cancelModalOpen) return;
        const appointmentId = cancelModalOpen;

        setProcessingId(appointmentId);

        try {
            const response = await cancelUserAppointment(appointmentId);
            if (response.success) {
                toast.success('Appointment cancelled successfully');
                setCancelModalOpen(null);
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

    const confirmDelete = async () => {
        if (!deleteModalOpen) return;
        const appointmentId = deleteModalOpen;

        setProcessingId(appointmentId);

        try {
            const response = await deleteUserAppointment(appointmentId);
            if (response.success) {
                toast.success('Appointment removed from history');
                setDeleteModalOpen(null);
                fetchAppointments();
            } else {
                toast.error(response.message || 'Failed to delete appointment');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail?.message || 'Failed to delete appointment');
        } finally {
            setProcessingId(null);
        }
    };

    // Helper to get normalized status (handles legacy data without status field)
    const getAppointmentStatus = (apt: Appointment): AppointmentStatus => {
        if (apt.status) return apt.status;
        // Legacy fallback
        if (apt.cancelled) return 'cancelled';
        if (apt.isCompleted) return 'completed';
        return 'pending';
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
        const status = getAppointmentStatus(apt);

        switch (status) {
            case 'pending':
                return (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200 flex items-center gap-1">
                        <HourglassIcon size={12} />
                        Awaiting Confirmation
                    </span>
                );
            case 'accepted':
                return (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200 flex items-center gap-1">
                        <Check size={12} />
                        Confirmed
                    </span>
                );
            case 'completed':
                return <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">Completed</span>;
            case 'cancelled':
                return <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200">Cancelled</span>;
            case 'rejected':
                return (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200 flex items-center gap-1">
                        <XCircle size={12} />
                        Declined
                    </span>
                );
            default:
                return <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-600 border border-gray-200">Unknown</span>;
        }
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
                            <div key={apt._id} className="relative group bg-white dark:bg-dark-800 rounded-3xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
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

                                        {/* Actions - Show cancel for pending and accepted */}
                                        {(getAppointmentStatus(apt) === 'pending' || getAppointmentStatus(apt) === 'accepted') && (
                                            <div className="mt-5 pt-5 border-t border-dashed border-gray-200 dark:border-dark-700">
                                                {getAppointmentStatus(apt) === 'pending' && (
                                                    <p className="text-xs text-amber-600 mb-3">
                                                        ⏳ Waiting for the doctor to confirm your appointment
                                                    </p>
                                                )}
                                                <button
                                                    onClick={() => handleCancelClick(apt._id)}
                                                    disabled={processingId === apt._id}
                                                    className="bg-red-50 text-red-600 border-2 border-red-500 hover:bg-red-500 hover:text-white px-5 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 text-sm font-semibold shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <X size={16} />
                                                    Cancel Appointment
                                                </button>
                                            </div>
                                        )}

                                        {getAppointmentStatus(apt) === 'completed' && (
                                            <div className="flex items-center gap-2 mt-5 pt-5 border-t border-dashed border-gray-200 dark:border-dark-700 text-emerald-500">
                                                <Check size={18} className="flex-shrink-0" />
                                                <span className="text-sm font-medium">This appointment has been completed</span>
                                            </div>
                                        )}

                                        {getAppointmentStatus(apt) === 'cancelled' && (
                                            <div className="flex items-center gap-2 mt-5 pt-5 border-t border-dashed border-gray-200 dark:border-dark-700 text-red-500">
                                                <AlertCircle size={18} className="flex-shrink-0" />
                                                <span className="text-sm font-medium">This appointment was cancelled</span>
                                            </div>
                                        )}

                                        {getAppointmentStatus(apt) === 'rejected' && (
                                            <div className="mt-5 pt-5 border-t border-dashed border-gray-200 dark:border-dark-700">
                                                <div className="flex items-center gap-2 text-gray-500">
                                                    <XCircle size={18} className="flex-shrink-0" />
                                                    <span className="text-sm font-medium">The doctor was unable to accept this appointment</span>
                                                </div>
                                                {apt.rejection_reason && (
                                                    <p className="text-xs text-gray-400 mt-1 ml-6">Reason: {apt.rejection_reason}</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Delete Button for inactive appointments */}
                                        {(getAppointmentStatus(apt) === 'completed' || getAppointmentStatus(apt) === 'cancelled' || getAppointmentStatus(apt) === 'rejected') && (
                                            <div className="flex justify-end mt-4 pt-4 border-t border-dashed border-gray-100 dark:border-dark-700/50">
                                                <button
                                                    onClick={() => handleDeleteClick(apt._id)}
                                                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all"
                                                >
                                                    <Trash2 size={14} />
                                                    <span>Remove from History</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}


            {/* Cancel Confirmation Modal */}
            {
                cancelModalOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-gray-200 dark:border-dark-700 shadow-2xl animation-fade-in text-center">
                            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                                <AlertCircle size={32} className="text-red-500" />
                            </div>

                            <h3 className="text-xl font-bold text-dark-800 dark:text-dark-50 mb-2">Cancel Appointment?</h3>
                            <p className="text-gray-500 dark:text-dark-400 text-sm mb-6 leading-relaxed">
                                Are you sure you want to cancel this appointment? This action cannot be undone.
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setCancelModalOpen(null)}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-dark-300 hover:text-dark-900 dark:hover:text-dark-100 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-xl transition-all"
                                >
                                    No, Keep It
                                </button>
                                <button
                                    onClick={confirmCancel}
                                    disabled={processingId === cancelModalOpen}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                                >
                                    {processingId === cancelModalOpen ? (
                                        <Loader2 className="animate-spin" size={16} />
                                    ) : (
                                        <X size={16} />
                                    )}
                                    Yes, Cancel It
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Delete Confirmation Modal */}
            {deleteModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-gray-200 dark:border-dark-700 shadow-2xl animation-fade-in text-center">
                        <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                            <Trash2 size={32} className="text-red-500" />
                        </div>

                        <h3 className="text-xl font-bold text-dark-800 dark:text-dark-50 mb-2">Delete from History?</h3>
                        <p className="text-gray-500 dark:text-dark-400 text-sm mb-6 leading-relaxed">
                            This will hide the appointment from your list. This action cannot be undone.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteModalOpen(null)}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-dark-300 hover:text-dark-900 dark:hover:text-dark-100 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-xl transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={processingId === deleteModalOpen}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                            >
                                {processingId === deleteModalOpen ? (
                                    <Loader2 className="animate-spin" size={16} />
                                ) : (
                                    <Trash2 size={16} />
                                )}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
