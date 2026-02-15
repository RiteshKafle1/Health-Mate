import { useState, useEffect, useRef } from 'react';
import {
    Bell, Check, X, Loader2, Trash2, Calendar, Pill,
    FileText, Activity, Info, AlertTriangle, CheckCircle2
} from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import toast from 'react-hot-toast';
import {
    getNotifications,
    getPendingAccessRequests,
    approveAccessRequest,
    denyAccessRequest,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification
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
    const dropdownRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter(n => !n.read).length + requests.length;

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
        } catch {
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
        } catch {
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
        } catch {
            toast.error('Failed to deny');
        } finally {
            setProcessingId(null);
        }
    };

    const handleMarkRead = async (notifId: string) => {
        // Optimistic update
        setNotifications(notifications.map(n =>
            n.id === notifId ? { ...n, read: true } : n
        ));
        try {
            await markNotificationRead(notifId);
        } catch {
            console.error('Failed to mark as read');
        }
    };

    const handleMarkAllRead = async () => {
        // Optimistic update
        const previousNotifications = [...notifications];
        setNotifications(notifications.map(n => ({ ...n, read: true })));

        try {
            await markAllNotificationsRead();
            toast.success('All marked as read');
        } catch {
            setNotifications(previousNotifications); // Revert on error
            console.error('Failed to mark all read');
        }
    };

    const handleDelete = async (e: React.MouseEvent, notifId: string) => {
        e.stopPropagation();
        // Optimistic update
        const previousNotifications = [...notifications];
        setNotifications(notifications.filter(n => n.id !== notifId));

        try {
            await deleteNotification(notifId);
            toast.success('Notification removed');
        } catch {
            setNotifications(previousNotifications); // Revert on error
            console.error('Failed to delete notification');
        }
    };

    const formatTime = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';

        if (mins < 60) return `${mins}m ago`;

        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;

        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;

        return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'medication_reminder':
            case 'medication_low_stock':
                return <Pill size={16} className="text-orange-500" />;
            case 'appointment_reminder':
            case 'appointment_confirmed':
                return <Calendar size={16} className="text-primary" />;
            case 'lab_report_ready':
                return <FileText size={16} className="text-purple-500" />;
            case 'health_checkin':
                return <Activity size={16} className="text-green-500" />;
            case 'welcome':
                return <Info size={16} className="text-blue-500" />;
            case 'medication_out_of_stock':
                return <AlertTriangle size={16} className="text-red-500" />;
            default:
                return <Bell size={16} className="text-gray-500" />;
        }
    };

    // Animation variants
    const dropdownVariants: Variants = {
        hidden: { opacity: 0, y: -10, scale: 0.95 },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: { type: 'spring', stiffness: 300, damping: 25 }
        },
        exit: { opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.15 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, x: -10 },
        visible: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 20, height: 0, marginBottom: 0, transition: { duration: 0.2 } }
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Bell Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2.5 rounded-xl transition-all duration-200 ${isOpen
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-muted hover:text-text hover:bg-surface/50'
                    }`}
            >
                <Bell size={22} className={unreadCount > 0 ? "animate-pulse-slow" : ""} />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[10px] items-center justify-center text-white border-2 border-white font-bold">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    </span>
                )}
            </motion.button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        variants={dropdownVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="absolute right-0 mt-4 w-80 sm:w-96 bg-white/80 backdrop-blur-2xl rounded-3xl shadow-card border border-white/50 z-50 overflow-hidden ring-1 ring-white/50"
                    >
                        {/* Header */}
                        <div className="p-5 border-b border-surface/20 bg-gradient-to-r from-primary/5 to-transparent flex justify-between items-center sticky top-0 backdrop-blur-xl z-20">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-xl shadow-soft text-primary">
                                    <Bell size={18} className="fill-current" />
                                </div>
                                <h3 className="font-bold text-text text-lg tracking-tight">Activity</h3>
                                {unreadCount > 0 && (
                                    <span className="px-2.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded-full shadow-lg shadow-primary/30">
                                        {unreadCount} NEW
                                    </span>
                                )}
                            </div>
                            {(notifications.length > 0 || requests.length > 0) && (
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleMarkAllRead}
                                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary-hover font-bold px-3 py-1.5 hover:bg-white rounded-lg transition-all shadow-sm hover:shadow-md"
                                >
                                    <CheckCircle2 size={14} />
                                    Mark all read
                                </motion.button>
                            )}
                        </div>

                        {/* List */}
                        <div className="max-h-[32rem] overflow-y-auto scrollbar-thin scrollbar-thumb-surface scrollbar-track-transparent p-3 space-y-2">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-16 text-text-muted">
                                    <Loader2 className="animate-spin mb-3 text-primary" size={32} />
                                    <span className="text-sm font-semibold tracking-wide">Updating...</span>
                                </div>
                            ) : requests.length === 0 && notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-text-muted/50">
                                    <div className="p-6 bg-surface/10 rounded-full mb-4 animate-pulse-soft">
                                        <Bell size={40} className="text-surface" />
                                    </div>
                                    <p className="text-base font-bold text-text">All caught up!</p>
                                    <p className="text-xs font-medium mt-1">No new notifications to show</p>
                                </div>
                            ) : (
                                <AnimatePresence initial={false}>
                                    {/* Access Requests */}
                                    {requests.map((req) => (
                                        <motion.div
                                            key={`req-${req.id}`}
                                            variants={itemVariants}
                                            initial="hidden"
                                            animate="visible"
                                            exit="exit"
                                            layout
                                            className="p-4 bg-gradient-to-br from-white to-blue-50/50 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden"
                                        >
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12" />

                                            <div className="flex items-start gap-3 relative z-10">
                                                <div className="relative">
                                                    <img
                                                        src={req.doctor_image || '/default-avatar.png'}
                                                        alt={req.doctor_name}
                                                        className="w-12 h-12 rounded-2xl object-cover shadow-soft border-2 border-white"
                                                    />
                                                    <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-lg p-1 shadow-sm ring-2 ring-white">
                                                        <Activity size={10} />
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-text font-medium leading-snug">
                                                        <span className="font-bold text-text">Dr. {req.doctor_name}</span>
                                                        <span className="text-text-muted"> requested access</span>
                                                    </p>
                                                    <p className="text-xs text-primary font-semibold mt-1 flex items-center gap-1.5">
                                                        <span className="bg-primary/10 px-2 py-0.5 rounded-md">{req.doctor_speciality}</span>
                                                        <span className="text-text-muted/60">• {formatTime(req.requested_at)}</span>
                                                    </p>

                                                    <div className="flex gap-2 mt-4">
                                                        <button
                                                            onClick={() => handleApprove(req.id)}
                                                            disabled={processingId === req.id}
                                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-success text-white text-xs font-bold rounded-xl hover:bg-success-hover shadow-lg shadow-success/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {processingId === req.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeny(req.id)}
                                                            disabled={processingId === req.id}
                                                            className="px-3 py-2 bg-white text-error border border-error/20 text-xs font-bold rounded-xl hover:bg-error-bg hover:border-error/30 shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <X size={14} strokeWidth={3} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}

                                    {/* Other Notifications */}
                                    {notifications.map((notif) => (
                                        <motion.div
                                            key={notif.id}
                                            variants={itemVariants}
                                            initial="hidden"
                                            animate="visible"
                                            exit="exit"
                                            layout
                                            className={`group relative p-4 rounded-2xl transition-all duration-300 border ${!notif.read
                                                ? 'bg-white shadow-soft border-primary/20'
                                                : 'bg-transparent hover:bg-white/60 border-transparent hover:border-white/50 hover:shadow-sm'
                                                }`}
                                            onClick={() => handleMarkRead(notif.id)}
                                        >
                                            <div className="flex items-start gap-4">
                                                {/* Icon Container */}
                                                <div className={`p-3 rounded-2xl shrink-0 transition-colors duration-300 ${!notif.read
                                                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                                    : 'bg-surface/20 text-text-muted group-hover:bg-white group-hover:text-primary group-hover:shadow-soft'
                                                    }`}>
                                                    {getIcon(notif.type)}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0 pr-6">
                                                    <p className={`text-sm leading-relaxed ${!notif.read ? 'font-bold text-text' : 'font-medium text-text-muted'
                                                        }`}>
                                                        {notif.message}
                                                    </p>
                                                    <p className="text-xs text-text-muted/60 mt-2 font-semibold tracking-wide uppercase">
                                                        {formatTime(notif.created_at)}
                                                    </p>
                                                </div>

                                                {/* Delete Button (Hover) */}
                                                <button
                                                    onClick={(e) => handleDelete(e, notif.id)}
                                                    className="absolute right-2 top-2 p-2 text-text-muted/40 opacity-0 group-hover:opacity-100 hover:text-error hover:bg-error-bg rounded-xl transition-all transform hover:scale-105 active:scale-90"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>

                                                {/* Unread Indicator Dot */}
                                                {!notif.read && (
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full shadow-md shadow-primary/40" />
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>


                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
