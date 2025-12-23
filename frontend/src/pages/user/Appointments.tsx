import { useEffect, useState } from 'react';
import { getUserAppointments, cancelUserAppointment, createRazorpayOrder, verifyRazorpayPayment } from '../../api/user';
import type { Appointment } from '../../types';
import { Calendar, Clock, Stethoscope, X, CreditCard, Check, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

declare global {
    interface Window {
        Razorpay: any;
    }
}

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

    const handlePayment = async (appointmentId: string, _amount: number) => {
        setProcessingId(appointmentId);

        try {
            const orderResponse = await createRazorpayOrder(appointmentId);

            if (!orderResponse.success || !orderResponse.order) {
                toast.error('Failed to create payment order');
                return;
            }

            const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY;

            if (!razorpayKey) {
                // If no Razorpay key, simulate payment success
                toast.success('Payment simulated successfully (Razorpay key not configured)');
                await verifyRazorpayPayment(orderResponse.order.id);
                fetchAppointments();
                return;
            }

            const options = {
                key: razorpayKey,
                amount: orderResponse.order.amount,
                currency: orderResponse.order.currency,
                name: 'HealthMate',
                description: 'Doctor Appointment Payment',
                order_id: orderResponse.order.id,
                handler: async function (response: any) {
                    try {
                        const verifyResponse = await verifyRazorpayPayment(response.razorpay_order_id);
                        if (verifyResponse.success) {
                            toast.success('Payment successful!');
                            fetchAppointments();
                        } else {
                            toast.error('Payment verification failed');
                        }
                    } catch (error) {
                        toast.error('Payment verification failed');
                    }
                },
                theme: {
                    color: '#6366f1',
                },
            };

            const razorpay = new window.Razorpay(options);
            razorpay.open();
        } catch (error: any) {
            toast.error(error.response?.data?.detail?.message || 'Payment failed');
        } finally {
            setProcessingId(null);
        }
    };

    const getStatusBadge = (apt: Appointment) => {
        if (apt.cancelled) {
            return <span className="badge-danger">Cancelled</span>;
        }
        if (apt.isCompleted) {
            return <span className="badge-success">Completed</span>;
        }
        if (apt.payment) {
            return <span className="badge-info">Paid</span>;
        }
        return <span className="badge-warning">Pending Payment</span>;
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
            <div>
                <h1 className="text-2xl font-bold text-dark-50">My Appointments</h1>
                <p className="text-dark-400 mt-1">View and manage your appointments</p>
            </div>

            {appointments.length === 0 ? (
                <div className="glass-card p-16 text-center">
                    <Calendar className="mx-auto text-dark-500 mb-4" size={64} />
                    <h3 className="text-xl font-semibold text-dark-200 mb-2">No appointments yet</h3>
                    <p className="text-dark-400">Book your first appointment with a doctor</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {appointments.map((apt) => (
                        <div key={apt._id} className="glass-card p-6">
                            <div className="flex flex-col md:flex-row gap-6">
                                {/* Doctor Image */}
                                <div className="w-full md:w-28 h-28 rounded-xl overflow-hidden bg-dark-700 flex-shrink-0">
                                    {apt.docData?.image ? (
                                        <img src={apt.docData.image} alt={apt.docData.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Stethoscope className="text-dark-400" size={32} />
                                        </div>
                                    )}
                                </div>

                                {/* Appointment Details */}
                                <div className="flex-1">
                                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-dark-100">Dr. {apt.docData?.name}</h3>
                                            <p className="text-sm text-primary-400">{apt.docData?.speciality}</p>

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
                                            {!apt.payment && (
                                                <button
                                                    onClick={() => handlePayment(apt._id, apt.amount)}
                                                    disabled={processingId === apt._id}
                                                    className="btn-primary flex items-center gap-2 text-sm"
                                                >
                                                    {processingId === apt._id ? (
                                                        <Loader2 className="animate-spin" size={16} />
                                                    ) : (
                                                        <CreditCard size={16} />
                                                    )}
                                                    Pay Now
                                                </button>
                                            )}
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
                                            <span className="text-sm">This appointment has been completed</span>
                                        </div>
                                    )}

                                    {apt.cancelled && (
                                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-dark-700 text-red-400">
                                            <AlertCircle size={16} />
                                            <span className="text-sm">This appointment was cancelled</span>
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
