import { useEffect, useState } from 'react';
import {
    getDoctorAppointments,
    cancelDoctorAppointment,
    completeDoctorAppointment,
    acceptDoctorAppointment,
    rejectDoctorAppointment
} from '../../api/doctor';
import { requestReportAccess } from '../../api/accessRequests';
import type { Appointment, AppointmentStatus } from '../../types';
import { Calendar, Clock, User, X, Check, Loader2, AlertCircle, Filter, FileText, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

type FilterType = 'all' | 'pending' | 'accepted' | 'completed' | 'cancelled' | 'rejected';

export function DoctorAppointments() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterType>('all');
    const [requestedPatientIds, setRequestedPatientIds] = useState<Set<string>>(new Set());
    const [requestingId, setRequestingId] = useState<string | null>(null);
    const [rejectModalOpen, setRejectModalOpen] = useState<string | null>(null);
    const [cancelModalOpen, setCancelModalOpen] = useState<string | null>(null);
    const [completeModalOpen, setCompleteModalOpen] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const fetchAppointments = async () => {
        try {
            const response = await getDoctorAppointments();
            if (response.success && response.appointments) {
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

    useEffect(() => {
        let result = appointments;

        switch (filter) {
            case 'pending':
                result = appointments.filter(a => getAppointmentStatus(a) === 'pending');
                break;
            case 'accepted':
                result = appointments.filter(a => getAppointmentStatus(a) === 'accepted');
                break;
            case 'completed':
                result = appointments.filter(a => getAppointmentStatus(a) === 'completed');
                break;
            case 'cancelled':
                result = appointments.filter(a => getAppointmentStatus(a) === 'cancelled');
                break;
            case 'rejected':
                result = appointments.filter(a => getAppointmentStatus(a) === 'rejected');
                break;
        }

        setFilteredAppointments(result);
    }, [appointments, filter]);

    // Helper to get normalized status (handles legacy data without status field)
    const getAppointmentStatus = (apt: Appointment): AppointmentStatus => {
        if (apt.status) return apt.status;
        // Legacy fallback
        if (apt.cancelled) return 'cancelled';
        if (apt.isCompleted) return 'completed';
        return 'pending'; // Old appointments default to pending
    };

    const handleAccept = async (appointmentId: string) => {
        setProcessingId(appointmentId);

        try {
            const response = await acceptDoctorAppointment(appointmentId);
            if (response.success) {
                toast.success('Appointment accepted!');
                fetchAppointments();
            } else {
                toast.error(response.message || 'Failed to accept appointment');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail?.message || 'Failed to accept appointment');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (appointmentId: string) => {
        setProcessingId(appointmentId);

        try {
            const response = await rejectDoctorAppointment(appointmentId, rejectReason || undefined);
            if (response.success) {
                toast.success('Appointment declined');
                setRejectModalOpen(null);
                setRejectReason('');
                fetchAppointments();
            } else {
                toast.error(response.message || 'Failed to decline appointment');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail?.message || 'Failed to decline appointment');
        } finally {
            setProcessingId(null);
        }
    };

    const handleCompleteClick = (appointmentId: string) => {
        setCompleteModalOpen(appointmentId);
    };

    const confirmComplete = async () => {
        if (!completeModalOpen) return;
        const appointmentId = completeModalOpen;

        setProcessingId(appointmentId);

        try {
            const response = await completeDoctorAppointment(appointmentId);
            if (response.success) {
                toast.success('Appointment marked as completed');
                setCompleteModalOpen(null);
                fetchAppointments();
            } else {
                toast.error(response.message || 'Failed to complete appointment');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail?.message || 'Failed to complete appointment');
        } finally {
            setProcessingId(null);
        }
    };

    const handleCancelClick = (appointmentId: string) => {
        setCancelModalOpen(appointmentId);
    };

    const confirmCancel = async () => {
        if (!cancelModalOpen) return;
        const appointmentId = cancelModalOpen;

        setProcessingId(appointmentId);

        try {
            const response = await cancelDoctorAppointment(appointmentId);
            if (response.success) {
                toast.success('Appointment cancelled');
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

    const handleRequestAccess = async (appointmentId: string, userId: string) => {
        setRequestingId(appointmentId);

        try {
            const response = await requestReportAccess(userId, appointmentId);
            if (response.success) {
                toast.success('Access request sent to patient');
                setRequestedPatientIds(prev => new Set([...prev, userId]));
            } else {
                toast.error(response.message || 'Failed to send request');
            }
        } catch (error: any) {
            const message = error.response?.data?.detail || 'Failed to send request';
            toast.error(typeof message === 'string' ? message : 'Failed to send request');
        } finally {
            setRequestingId(null);
        }
    };

    const getStatusBadge = (apt: Appointment) => {
        const status = getAppointmentStatus(apt);

        switch (status) {
            case 'pending':
                return <span className="px-3 py-1 text-xs font-medium rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Awaiting Acceptance</span>;
            case 'accepted':
                return <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">Accepted</span>;
            case 'completed':
                return <span className="px-3 py-1 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Completed</span>;
            case 'cancelled':
                return <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Cancelled</span>;
            case 'rejected':
                return <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">Declined</span>;
            default:
                return <span className="badge-warning">Unknown</span>;
        }
    };

    const getStatusCounts = () => {
        const counts = { pending: 0, accepted: 0, completed: 0, cancelled: 0, rejected: 0 };
        appointments.forEach(apt => {
            const status = getAppointmentStatus(apt);
            if (status in counts) counts[status as keyof typeof counts]++;
        });
        return counts;
    };

    const counts = getStatusCounts();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="animate-spin text-primary-500" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-dark-50">Appointments</h1>
                    <p className="text-dark-400 mt-1">Manage your patient appointments</p>
                </div>

                {/* Filter */}
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-dark-400" />
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as FilterType)}
                        className="input-field py-2 pr-8"
                    >
                        <option value="all">All Appointments</option>
                        <option value="pending">Pending Acceptance ({counts.pending})</option>
                        <option value="accepted">Accepted ({counts.accepted})</option>
                        <option value="completed">Completed ({counts.completed})</option>
                        <option value="cancelled">Cancelled ({counts.cancelled})</option>
                        <option value="rejected">Declined ({counts.rejected})</option>
                    </select>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="glass-card p-4 text-center">
                    <p className="text-2xl font-bold text-dark-50">{appointments.length}</p>
                    <p className="text-sm text-dark-400">Total</p>
                </div>
                <div className="glass-card p-4 text-center border-l-4 border-amber-400">
                    <p className="text-2xl font-bold text-amber-400">{counts.pending}</p>
                    <p className="text-sm text-dark-400">Pending</p>
                </div>
                <div className="glass-card p-4 text-center border-l-4 border-blue-400">
                    <p className="text-2xl font-bold text-blue-400">{counts.accepted}</p>
                    <p className="text-sm text-dark-400">Accepted</p>
                </div>
                <div className="glass-card p-4 text-center border-l-4 border-emerald-400">
                    <p className="text-2xl font-bold text-emerald-400">{counts.completed}</p>
                    <p className="text-sm text-dark-400">Completed</p>
                </div>
                <div className="glass-card p-4 text-center border-l-4 border-red-400">
                    <p className="text-2xl font-bold text-red-400">{counts.cancelled + counts.rejected}</p>
                    <p className="text-sm text-dark-400">Cancelled/Declined</p>
                </div>
            </div>

            {/* Appointments List */}
            {filteredAppointments.length === 0 ? (
                <div className="glass-card p-16 text-center">
                    <Calendar className="mx-auto text-dark-500 mb-4" size={64} />
                    <h3 className="text-xl font-semibold text-dark-200 mb-2">No appointments found</h3>
                    <p className="text-dark-400">
                        {filter === 'all' ? 'You have no appointments yet' : `No ${filter} appointments`}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredAppointments.map((apt) => {
                        const status = getAppointmentStatus(apt);

                        return (
                            <div key={apt._id} className="glass-card p-6">
                                <div className="flex flex-col md:flex-row gap-6">
                                    {/* Patient Image */}
                                    <div className="w-full md:w-20 h-20 rounded-xl overflow-hidden bg-dark-700 flex-shrink-0">
                                        {apt.userData?.image ? (
                                            <img src={apt.userData.image} alt={apt.userData.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-500">
                                                <User className="text-white" size={32} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Appointment Details */}
                                    <div className="flex-1">
                                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                            <div>
                                                <h3 className="text-lg font-semibold text-dark-100">{apt.userData?.name}</h3>
                                                <p className="text-sm text-dark-400">{apt.userData?.email}</p>

                                                <div className="flex flex-wrap gap-4 mt-3 text-sm text-dark-300">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={16} className="text-dark-400" />
                                                        <span>{apt.slotDate}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={16} className="text-dark-400" />
                                                        <span>{apt.slotTime}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-start md:items-end gap-2">
                                                {getStatusBadge(apt)}
                                            </div>
                                        </div>

                                        {/* PENDING - Accept/Reject Buttons */}
                                        {status === 'pending' && (
                                            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-dark-700">
                                                <button
                                                    onClick={() => handleAccept(apt._id)}
                                                    disabled={processingId === apt._id}
                                                    className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-emerald-500/30 transition-colors"
                                                >
                                                    {processingId === apt._id ? (
                                                        <Loader2 className="animate-spin" size={16} />
                                                    ) : (
                                                        <CheckCircle size={16} />
                                                    )}
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={() => setRejectModalOpen(apt._id)}
                                                    disabled={processingId === apt._id}
                                                    className="bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-red-500/30 transition-colors"
                                                >
                                                    <XCircle size={16} />
                                                    Decline
                                                </button>
                                            </div>
                                        )}

                                        {/* ACCEPTED - Complete, Cancel, Request Reports */}
                                        {status === 'accepted' && (
                                            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-dark-700">
                                                <button
                                                    onClick={() => handleCompleteClick(apt._id)}
                                                    disabled={processingId === apt._id}
                                                    className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-emerald-500 hover:text-white transition-all duration-300"
                                                >
                                                    {processingId === apt._id ? (
                                                        <Loader2 className="animate-spin" size={16} />
                                                    ) : (
                                                        <Check size={16} />
                                                    )}
                                                    Complete
                                                </button>
                                                <button
                                                    onClick={() => handleCancelClick(apt._id)}
                                                    disabled={processingId === apt._id}
                                                    className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-red-500 hover:text-white transition-all duration-300"
                                                >
                                                    <X size={16} />
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => handleRequestAccess(apt._id, apt.userId)}
                                                    disabled={requestingId === apt._id || requestedPatientIds.has(apt.userId)}
                                                    className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm transition-colors ${requestedPatientIds.has(apt.userId)
                                                        ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30 cursor-not-allowed'
                                                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30'
                                                        }`}
                                                    title={requestedPatientIds.has(apt.userId) ? 'Request already sent' : 'Request access to patient lab reports'}
                                                >
                                                    {requestingId === apt._id ? (
                                                        <Loader2 className="animate-spin" size={16} />
                                                    ) : (
                                                        <FileText size={16} />
                                                    )}
                                                    {requestedPatientIds.has(apt.userId) ? 'Access Requested' : 'Request Reports'}
                                                </button>
                                            </div>
                                        )}

                                        {/* COMPLETED */}
                                        {status === 'completed' && (
                                            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-dark-700 text-emerald-400">
                                                <Check size={16} />
                                                <span className="text-sm">Appointment completed</span>
                                            </div>
                                        )}

                                        {/* CANCELLED */}
                                        {status === 'cancelled' && (
                                            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-dark-700 text-red-400">
                                                <AlertCircle size={16} />
                                                <span className="text-sm">Appointment cancelled</span>
                                            </div>
                                        )}

                                        {/* REJECTED */}
                                        {status === 'rejected' && (
                                            <div className="mt-4 pt-4 border-t border-dark-700">
                                                <div className="flex items-center gap-2 text-gray-400">
                                                    <XCircle size={16} />
                                                    <span className="text-sm">Appointment declined</span>
                                                </div>
                                                {apt.rejection_reason && (
                                                    <p className="text-xs text-dark-500 mt-1 ml-6">Reason: {apt.rejection_reason}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Reject Modal */}
            {rejectModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-dark-700 shadow-2xl transform transition-all scale-100 opacity-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-red-500/10 rounded-xl text-red-500">
                                <XCircle size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-dark-50">Decline Appointment</h3>
                        </div>
                        <p className="text-dark-400 mb-4 text-sm leading-relaxed">
                            Are you sure you want to decline this appointment? You can optionally provide a reason for the patient.
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason for declining (optional)..."
                            className="w-full p-3 rounded-xl bg-dark-900/50 border border-dark-600 text-dark-100 text-sm resize-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 outline-none transition-all placeholder:text-dark-500 mb-6"
                            rows={3}
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setRejectModalOpen(null);
                                    setRejectReason('');
                                }}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-dark-300 hover:text-dark-100 bg-dark-700 hover:bg-dark-600 rounded-xl transition-all"
                            >
                                Keep Appointment
                            </button>
                            <button
                                onClick={() => handleReject(rejectModalOpen)}
                                disabled={processingId === rejectModalOpen}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                            >
                                {processingId === rejectModalOpen ? (
                                    <Loader2 className="animate-spin" size={16} />
                                ) : (
                                    <XCircle size={16} />
                                )}
                                Decline
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Confirmation Modal */}
            {cancelModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-dark-700 shadow-2xl animation-fade-in text-center">
                        <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                            <AlertCircle size={32} className="text-red-500" />
                        </div>

                        <h3 className="text-xl font-bold text-dark-50 mb-2">Cancel Appointment?</h3>
                        <p className="text-dark-400 text-sm mb-6 leading-relaxed">
                            Are you sure you want to cancel this appointment? This action cannot be undone and the patient will be notified.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setCancelModalOpen(null)}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-dark-300 hover:text-dark-100 bg-dark-700 hover:bg-dark-600 rounded-xl transition-all"
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
            )}

            {/* Complete Confirmation Modal */}
            {completeModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-dark-700 shadow-2xl animation-fade-in text-center">
                        <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle size={32} className="text-emerald-500" />
                        </div>

                        <h3 className="text-xl font-bold text-dark-50 mb-2">Complete Appointment?</h3>
                        <p className="text-dark-400 text-sm mb-6 leading-relaxed">
                            Have you finished the consultation? This will mark the appointment as completed and update the patient's history.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setCompleteModalOpen(null)}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-dark-300 hover:text-dark-100 bg-dark-700 hover:bg-dark-600 rounded-xl transition-all"
                            >
                                Not Yet
                            </button>
                            <button
                                onClick={confirmComplete}
                                disabled={processingId === completeModalOpen}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                            >
                                {processingId === completeModalOpen ? (
                                    <Loader2 className="animate-spin" size={16} />
                                ) : (
                                    <Check size={16} />
                                )}
                                Complete It
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
