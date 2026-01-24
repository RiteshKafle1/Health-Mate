import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAllAppointmentsAdmin, cancelAppointmentAdmin } from '../../api/admin';
import type { Appointment } from '../../types';
import { Calendar, Clock, User, Stethoscope, X, Loader2, AlertCircle, Filter, Check, LayoutGrid, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

type FilterType = 'all' | 'pending' | 'completed' | 'cancelled' | 'today';

export function AdminAppointments() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const filter = (searchParams.get('filter') as FilterType) || 'all';

    const setFilter = (newFilter: FilterType) => {
        setSearchParams({ filter: newFilter });
    };

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
            case 'today':
                const today = new Date();
                const day = today.getDate();
                const month = today.getMonth() + 1;
                const year = today.getFullYear();

                const dateString = `${day}_${month}_${year}`; // 24_1_2025
                const dateStringPad = `${day < 10 ? '0' + day : day}_${month < 10 ? '0' + month : month}_${year}`; // 24_01_2025

                result = appointments.filter((a) => a.slotDate === dateString || a.slotDate === dateStringPad);
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
        if (apt.cancelled) {
            return (
                <div className="flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20 w-fit">
                    <X size={12} />
                    Cancelled
                </div>
            );
        }
        if (apt.isCompleted) {
            return (
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 w-fit">
                    <Check size={12} />
                    Completed
                </div>
            );
        }

        // Pending State - Using Amber/Reddish standard as requested
        return (
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 w-fit">
                <Clock size={12} />
                Pending
            </div>
        );
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
                    <p className="text-dark-400 mt-1">Manage and track all patient appointments</p>
                </div>

                {/* Filter */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-dark-800 px-3 py-2 rounded-xl border border-dark-700/50">
                        <Filter size={16} className="text-dark-400" />
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as FilterType)}
                            className="bg-transparent text-sm text-dark-200 outline-none cursor-pointer"
                        >
                            <option value="all">All Status</option>
                            <option value="today">Today</option>
                            <option value="pending">Pending</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Expandable Overview Stats */}
            <div className="group bg-dark-800/30 border border-dark-700/50 hover:bg-dark-800 hover:border-dark-600 rounded-xl overflow-hidden transition-all duration-500 hover:shadow-xl w-full">
                <div className="p-2.5 px-3 flex items-center gap-3 cursor-default">
                    <div className="p-1.5 rounded-lg bg-primary-500/10 text-primary-400 group-hover:bg-primary-500/20 transition-colors">
                        <LayoutGrid size={16} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm text-dark-50">Overview</h3>
                        <p className="text-[10px] text-dark-400 group-hover:text-dark-300 transition-colors leading-tight">Hover for detailed stats</p>
                    </div>
                    <ChevronDown className="ml-auto text-dark-400 group-hover:text-dark-200 group-hover:rotate-180 transition-transform duration-500" size={16} />
                </div>

                <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-500 ease-in-out">
                    <div className="overflow-hidden">
                        <div className="p-4 pt-0 grid grid-cols-2 md:grid-cols-4 gap-4">
                            {/* Total */}
                            <div className="bg-dark-900/50 rounded-xl p-3 text-center border border-dark-700/50">
                                <p className="text-2xl font-bold text-dark-50">{appointments.length}</p>
                                <p className="text-xs text-dark-400 mt-1">Total</p>
                            </div>
                            {/* Pending */}
                            <div className="bg-dark-900/50 rounded-xl p-3 text-center border border-dark-700/50">
                                <p className="text-2xl font-bold text-amber-400">
                                    {appointments.filter((a) => !a.cancelled && !a.isCompleted).length}
                                </p>
                                <p className="text-xs text-dark-400 mt-1">Pending</p>
                            </div>
                            {/* Completed */}
                            <div className="bg-dark-900/50 rounded-xl p-3 text-center border border-dark-700/50">
                                <p className="text-2xl font-bold text-emerald-400">
                                    {appointments.filter((a) => a.isCompleted).length}
                                </p>
                                <p className="text-xs text-dark-400 mt-1">Completed</p>
                            </div>
                            {/* Cancelled */}
                            <div className="bg-dark-900/50 rounded-xl p-3 text-center border border-dark-700/50">
                                <p className="text-2xl font-bold text-red-400">
                                    {appointments.filter((a) => a.cancelled).length}
                                </p>
                                <p className="text-xs text-dark-400 mt-1">Cancelled</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Appointments Table */}
            {filteredAppointments.length === 0 ? (
                <div className="glass-card p-16 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-dark-700/50 rounded-full flex items-center justify-center mb-4">
                        <Calendar className="text-dark-400" size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-dark-200">No appointments found</h3>
                    <p className="text-dark-400 mt-1 max-w-sm">
                        {filter === 'all' ? 'No appointments in the system yet.' : `No ${filter} appointments found.`}
                    </p>
                </div>
            ) : (
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px]">
                            <thead className="bg-dark-800">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Patient</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Doctor</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Schedule</th>

                                    <th className="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-dark-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-700/50">
                                {filteredAppointments.map((apt) => (
                                    <tr key={apt._id} className="hover:bg-dark-700/20 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-dark-700 flex-shrink-0 ring-1 ring-dark-600">
                                                    {apt.userData?.image ? (
                                                        <img src={apt.userData.image} alt={apt.userData.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                                                            <User className="text-blue-400" size={16} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm text-dark-100">{apt.userData?.name || 'Unknown'}</p>
                                                    <p className="text-xs text-dark-400 font-mono">{apt.userData?.email || 'No email'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-dark-700 flex-shrink-0 ring-1 ring-dark-600">
                                                    {apt.docData?.image ? (
                                                        <img src={apt.docData.image} alt={apt.docData.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-500/20 to-secondary-500/20">
                                                            <Stethoscope className="text-primary-400" size={16} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm text-dark-100">Dr. {apt.docData?.name || 'Unknown'}</p>
                                                    <p className="text-xs text-primary-400">{apt.docData?.speciality || 'General'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 text-sm text-dark-200">
                                                    <Calendar size={14} className="text-dark-400" />
                                                    <span className="font-medium">{apt.slotDate}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-dark-400">
                                                    <Clock size={12} />
                                                    <span>{apt.slotTime}</span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4">
                                            {getStatusBadge(apt)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {!apt.cancelled && !apt.isCompleted ? (
                                                <div className="relative group inline-block">
                                                    {/* Tooltip */}
                                                    <div className="absolute right-0 bottom-full mb-3 hidden group-hover:block w-72 p-3 bg-red-950/95 backdrop-blur border border-red-500/30 text-red-200 text-xs rounded-xl shadow-xl z-20 pointer-events-none transform transition-all duration-300 origin-bottom-right">
                                                        <div className="flex gap-2 items-start">
                                                            <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                                                            <p className="text-left leading-relaxed">
                                                                <span className="font-bold text-red-400 block mb-0.5">Warning</span>
                                                                If you cancel this appointment, it will be removed for both patient and doctor.
                                                            </p>
                                                        </div>
                                                        {/* Arrow */}
                                                        <div className="absolute -bottom-1 right-4 w-2 h-2 bg-red-950/95 border-r border-b border-red-500/30 transform rotate-45"></div>
                                                    </div>

                                                    <button
                                                        onClick={() => handleCancel(apt._id)}
                                                        disabled={processingId === apt._id}
                                                        className=" text-red-400 hover:text-white hover:bg-red-500 p-2 rounded-lg transition-all duration-200 border border-red-500/20 hover:border-red-500"
                                                    >
                                                        {processingId === apt._id ? (
                                                            <Loader2 className="animate-spin" size={18} />
                                                        ) : (
                                                            <X size={18} />
                                                        )}
                                                    </button>
                                                </div>
                                            ) : apt.isCompleted ? (
                                                <span className="inline-flex items-center justify-center p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-emerald-500">
                                                    <Check size={18} />
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center justify-center p-2 rounded-lg bg-dark-700/50 border border-dark-600 text-dark-400">
                                                    <X size={18} />
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
