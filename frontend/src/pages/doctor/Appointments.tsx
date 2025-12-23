import { useEffect, useState } from 'react';
import { getDoctorAppointments, cancelDoctorAppointment, completeDoctorAppointment } from '../../api/doctor';
import type { Appointment } from '../../types';
import { Calendar, Clock, User, X, Check, Loader2, AlertCircle, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

type FilterType = 'all' | 'pending' | 'completed' | 'cancelled';

export function DoctorAppointments() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterType>('all');

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
                result = appointments.filter(a => !a.cancelled && !a.isCompleted);
                break;
            case 'completed':
                result = appointments.filter(a => a.isCompleted);
                break;
            case 'cancelled':
                result = appointments.filter(a => a.cancelled);
                break;
        }

        setFilteredAppointments(result);
    }, [appointments, filter]);

    const handleComplete = async (appointmentId: string) => {
        if (!confirm('Mark this appointment as completed?')) return;

        setProcessingId(appointmentId);

        try {
            const response = await completeDoctorAppointment(appointmentId);
            if (response.success) {
                toast.success('Appointment marked as completed');
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

    const handleCancel = async (appointmentId: string) => {
        if (!confirm('Are you sure you want to cancel this appointment?')) return;

        setProcessingId(appointmentId);

        try {
            const response = await cancelDoctorAppointment(appointmentId);
            if (response.success) {
                toast.success('Appointment cancelled');
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

    const getStatusBadge = (apt: Appointment) => {
        if (apt.cancelled) return <span className="badge-danger">Cancelled</span>;
        if (apt.isCompleted) return <span className="badge-success">Completed</span>;
        if (apt.payment) return <span className="badge-info">Paid</span>;
        return <span className="badge-warning">Pending</span>;
    };

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
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card p-4 text-center">
                    <p className="text-2xl font-bold text-dark-50">{appointments.length}</p>
                    <p className="text-sm text-dark-400">Total</p>
                </div>
                <div className="glass-card p-4 text-center">
                    <p className="text-2xl font-bold text-amber-400">
                        {appointments.filter(a => !a.cancelled && !a.isCompleted).length}
                    </p>
                    <p className="text-sm text-dark-400">Pending</p>
                </div>
                <div className="glass-card p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-400">
                        {appointments.filter(a => a.isCompleted).length}
                    </p>
                    <p className="text-sm text-dark-400">Completed</p>
                </div>
                <div className="glass-card p-4 text-center">
                    <p className="text-2xl font-bold text-red-400">
                        {appointments.filter(a => a.cancelled).length}
                    </p>
                    <p className="text-sm text-dark-400">Cancelled</p>
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
                    {filteredAppointments.map((apt) => (
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

                                        <div className="flex flex-col items-start md:items-end gap-3">
                                            {getStatusBadge(apt)}
                                            <p className="text-lg font-semibold text-dark-100">₹{apt.amount}</p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    {!apt.cancelled && !apt.isCompleted && (
                                        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-dark-700">
                                            <button
                                                onClick={() => handleComplete(apt._id)}
                                                disabled={processingId === apt._id}
                                                className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-emerald-500/30 transition-colors"
                                            >
                                                {processingId === apt._id ? (
                                                    <Loader2 className="animate-spin" size={16} />
                                                ) : (
                                                    <Check size={16} />
                                                )}
                                                Complete
                                            </button>
                                            <button
                                                onClick={() => handleCancel(apt._id)}
                                                disabled={processingId === apt._id}
                                                className="btn-danger flex items-center gap-2 text-sm"
                                            >
                                                {processingId === apt._id ? (
                                                    <Loader2 className="animate-spin" size={16} />
                                                ) : (
                                                    <X size={16} />
                                                )}
                                                Cancel
                                            </button>
                                        </div>
                                    )}

                                    {apt.isCompleted && (
                                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-dark-700 text-emerald-400">
                                            <Check size={16} />
                                            <span className="text-sm">Appointment completed</span>
                                        </div>
                                    )}

                                    {apt.cancelled && (
                                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-dark-700 text-red-400">
                                            <AlertCircle size={16} />
                                            <span className="text-sm">Appointment cancelled</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
