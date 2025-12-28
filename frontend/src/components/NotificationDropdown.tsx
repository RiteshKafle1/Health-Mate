import { useState, useEffect } from 'react';
import { Bell, Check, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
    getNotifications,
    getPendingAccessRequests,
    approveAccessRequest,
    denyAccessRequest,
    markNotificationRead
} from '../api/accessRequests';
import type { Notification, AccessRequest } from '../api/accessRequests';

interface NotificationDropdownProps {
    className?: string;
}

export function NotificationDropdown({ className = '' }: NotificationDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const unreadCount = notifications.filter(n => !n.read).length + requests.length;

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [notifRes, reqRes] = await Promise.all([
                getNotifications(),
                getPendingAccessRequests()
            ]);

            if (notifRes.success) {
                setNotifications(notifRes.notifications.filter(n => n.type !== 'report_access_request'));
            }
            if (reqRes.success) {
                setRequests(reqRes.requests);
            }
        } catch (error) {
            console.error('Failed to fetch notifications');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    const handleApprove = async (requestId: string) => {
        setProcessingId(requestId);
        try {
            const response = await approveAccessRequest(requestId);
            if (response.success) {
                toast.success('Access approved');
                setRequests(requests.filter(r => r.id !== requestId));
            }
        } catch (error) {
            toast.error('Failed to approve');
        } finally {
            setProcessingId(null);
        }
    };

    const handleDeny = async (requestId: string) => {
        setProcessingId(requestId);
        try {
            const response = await denyAccessRequest(requestId);
            if (response.success) {
                toast.success('Access denied');
                setRequests(requests.filter(r => r.id !== requestId));
            }
        } catch (error) {
            toast.error('Failed to deny');
        } finally {
            setProcessingId(null);
        }
    };

    const handleMarkRead = async (notifId: string) => {
        try {
            await markNotificationRead(notifId);
            setNotifications(notifications.map(n =>
                n.id === notifId ? { ...n, read: true } : n
            ));
        } catch (error) {
            console.error('Failed to mark as read');
        }
    };

    const formatTime = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    return (
        <div className={`relative ${className}`}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-text-muted hover:text-text hover:bg-surface/50 rounded-lg transition-colors"
            >
                <Bell size={22} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Content */}
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-surface z-50 overflow-hidden">
                        <div className="p-3 border-b border-surface bg-surface/30">
                            <h3 className="font-semibold text-text">Notifications</h3>
                        </div>

                        <div className="max-h-96 overflow-y-auto">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="animate-spin text-primary" size={24} />
                                </div>
                            ) : requests.length === 0 && notifications.length === 0 ? (
                                <div className="text-center py-8 text-text-muted">
                                    <Bell size={32} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No notifications</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-surface/50">
                                    {/* Access Requests */}
                                    {requests.map((req) => (
                                        <div key={req.id} className="p-3 bg-primary/5">
                                            <div className="flex items-start gap-3">
                                                <img
                                                    src={req.doctor_image || '/default-avatar.png'}
                                                    alt={req.doctor_name}
                                                    className="w-10 h-10 rounded-full object-cover"
                                                />
                                                <div className="flex-1">
                                                    <p className="text-sm text-text">
                                                        <span className="font-semibold">Dr. {req.doctor_name}</span>
                                                        {' '}wants access to your lab reports
                                                    </p>
                                                    <p className="text-xs text-text-muted mt-0.5">
                                                        {req.doctor_speciality} • {formatTime(req.requested_at)}
                                                    </p>

                                                    <div className="flex gap-2 mt-2">
                                                        <button
                                                            onClick={() => handleApprove(req.id)}
                                                            disabled={processingId === req.id}
                                                            className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                                                        >
                                                            {processingId === req.id ? (
                                                                <Loader2 size={12} className="animate-spin" />
                                                            ) : (
                                                                <Check size={12} />
                                                            )}
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeny(req.id)}
                                                            disabled={processingId === req.id}
                                                            className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                                                        >
                                                            <X size={12} />
                                                            Deny
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Other Notifications */}
                                    {notifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            className={`p-3 cursor-pointer hover:bg-surface/30 transition-colors ${!notif.read ? 'bg-blue-50/50' : ''}`}
                                            onClick={() => handleMarkRead(notif.id)}
                                        >
                                            <p className="text-sm text-text">{notif.message}</p>
                                            <p className="text-xs text-text-muted mt-1">
                                                {formatTime(notif.created_at)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
