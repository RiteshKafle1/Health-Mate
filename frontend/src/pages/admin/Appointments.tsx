import { useEffect, useState } from 'react';
import { getAllAppointmentsAdmin, cancelAppointmentAdmin } from '../../api/admin';
import type { Appointment } from '../../types';
import { Calendar, Clock, User, Stethoscope, X, Loader2, AlertCircle, Filter, Check } from 'lucide-react';
import toast from 'react-hot-toast';

type FilterType = 'all' | 'pending' | 'completed' | 'cancelled';

export function AdminAppointments() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterType>('all');

    const fetchAppointments = async () => {
        try {
            const response = await getAllAppointmentsAdmin();
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
                result = appointments.filter((a) => !a.cancelled && !a.isCompleted);
                break;
            case 'completed':
                result = appointments.filter((a) => a.isCompleted);
                break;
            case 'cancelled':
                result = appointments.filter((a) => a.cancelled);
                break;
        }

        setFilteredAppointments(result);
    }, [appointments, filter]);

    const handleCancel = async (appointmentId: string) => {
        if (!confirm('Are you sure you want to cancel this appointment?')) return;

        setProcessingId(appointmentId);

        try {
            const response = await cancelAppointmentAdmin(appointmentId);
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
                    <h1 className="text-2xl font-bold text-dark-50">All Appointments</h1>
                    <p className="text-dark-400 mt-1">{appointments.length} total appointments</p>
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
                        {appointments.filter((a) => !a.cancelled && !a.isCompleted).length}
                    </p>
                    <p className="text-sm text-dark-400">Pending</p>
                </div>
                <div className="glass-card p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-400">
                        {appointments.filter((a) => a.isCompleted).length}
                    </p>
                    <p className="text-sm text-dark-400">Completed</p>
                </div>
                <div className="glass-card p-4 text-center">
                    <p className="text-2xl font-bold text-red-400">
                        {appointments.filter((a) => a.cancelled).length}
                    </p>
                    <p className="text-sm text-dark-400">Cancelled</p>
                </div>
            </div>

            {/* Appointments Table */}
            {filteredAppointments.length === 0 ? (
                <div className="glass-card p-16 text-center">
                    <Calendar className="mx-auto text-dark-500 mb-4" size={64} />
                    <h3 className="text-xl font-semibold text-dark-200 mb-2">No appointments found</h3>
                    <p className="text-dark-400">
                        {filter === 'all' ? 'No appointments in the system' : `No ${filter} appointments`}
                    </p>
                </div>
            ) : (
                <div className="table-container overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                        <thead>
                            <tr>
                                <th className="table-header">Patient</th>
                                <th className="table-header">Doctor</th>
                                <th className="table-header">Date & Time</th>
                                <th className="table-header">Amount</th>
                                <th className="table-header">Status</th>
                                <th className="table-header">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAppointments.map((apt) => (
                                <tr key={apt._id} className="table-row">
                                    <td className="table-cell">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-dark-700 flex-shrink-0">
                                                {apt.userData?.image ? (
                                                    <img src={apt.userData.image} alt={apt.userData.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <User className="text-dark-400" size={16} />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-dark-100">{apt.userData?.name}</p>
                                                <p className="text-xs text-dark-400">{apt.userData?.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-dark-700 flex-shrink-0">
                                                {apt.docData?.image ? (
                                                    <img src={apt.docData.image} alt={apt.docData.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Stethoscope className="text-dark-400" size={16} />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-dark-100">Dr. {apt.docData?.name}</p>
                                                <p className="text-xs text-primary-400">{apt.docData?.speciality}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1 text-dark-300">
                                                <Calendar size={14} />
                                                <span>{apt.slotDate}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-dark-300">
                                                <Clock size={14} />
                                                <span>{apt.slotTime}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="table-cell font-medium">₹{apt.amount}</td>
                                    <td className="table-cell">{getStatusBadge(apt)}</td>
                                    <td className="table-cell">
                                        {!apt.cancelled && !apt.isCompleted ? (
                                            <button
                                                onClick={() => handleCancel(apt._id)}
                                                disabled={processingId === apt._id}
                                                className="btn-danger text-xs py-1 px-3 flex items-center gap-1"
                                            >
                                                {processingId === apt._id ? (
                                                    <Loader2 className="animate-spin" size={14} />
                                                ) : (
                                                    <X size={14} />
                                                )}
                                                Cancel
                                            </button>
                                        ) : apt.isCompleted ? (
                                            <span className="flex items-center gap-1 text-emerald-400 text-xs">
                                                <Check size={14} />
                                                Done
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-dark-400 text-xs">
                                                <AlertCircle size={14} />
                                                Cancelled
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
