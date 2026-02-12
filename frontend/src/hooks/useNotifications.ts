/**
 * useNotifications Hook
 * 
 * React hook for handling real-time notifications.
 * Listens to Socket.IO events and triggers toast, sound, and browser notifications.
 */
import { useEffect, useCallback, useState } from 'react';
import toast from '../utils/soundToast';
import { onSocketEvent } from '../services/socket';
import { playNotificationSound, preloadNotificationSound } from '../utils/sound';
import { showBrowserNotification, isTabHidden } from '../utils/browserNotification';

// Notification data structure from backend
export interface NotificationData {
    id: string;
    type: string;
    title: string;
    message: string;
    user_id: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    read: boolean;
    created_at: number;
    action_url?: string;
    data?: Record<string, unknown>;
}

// Hook return type
interface UseNotificationsReturn {
    notifications: NotificationData[];
    unreadCount: number;
    markAsRead: (id: string) => void;
    clearNotifications: () => void;
}

/**
 * Get toast icon based on notification type
 */
function getNotificationIcon(type: string): string {
    const icons: Record<string, string> = {
        'medication_reminder': '💊',
        'medication_low_stock': '⚠️',
        'appointment_confirmed': '✅',
        'appointment_reminder': '📅',
        'appointment_completed': '✓',
        'appointment_cancelled': '❌',
        'profile_incomplete': '👤',
        'health_checkin': '💚',
        'report_access_request': '📄',
    };
    return icons[type] || '🔔';
}

/**
 * useNotifications Hook
 */
export function useNotifications(): UseNotificationsReturn {
    const [notifications, setNotifications] = useState<NotificationData[]>([]);

    // Handle new notification
    const handleNewNotification = useCallback((data: NotificationData) => {
        console.log('📬 New notification received:', data);

        // Add to notifications list
        setNotifications((prev) => [data, ...prev].slice(0, 50));

        // Get icon based on notification type
        const icon = getNotificationIcon(data.type);

        // Determine toast duration based on priority
        let duration = 5000;
        if (data.priority === 'urgent') duration = 8000;
        else if (data.priority === 'high') duration = 6000;
        else if (data.priority === 'low') duration = 3000;

        // Show toast notification with custom styling
        toast.success(
            `${icon} ${data.title || 'Notification'}\n${data.message}`,
            {
                duration,
                position: 'top-right',
                style: {
                    background: data.priority === 'urgent'
                        ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
                        : data.priority === 'high'
                            ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)'
                            : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                    color: '#fff',
                    borderRadius: '12px',
                    padding: '16px',
                    fontSize: '14px',
                    maxWidth: '400px',
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
                },
            }
        );

        // Play notification sound
        playNotificationSound();

        // Show browser notification if tab is hidden
        if (isTabHidden()) {
            showBrowserNotification(data.title || 'HealthMate', {
                body: data.message,
                tag: `notification-${data.id}`,
            });
        }
    }, []);

    // Subscribe to socket events
    useEffect(() => {
        // Preload notification sound
        preloadNotificationSound();

        // Subscribe to new_notification event
        const unsubscribe = onSocketEvent<NotificationData>(
            'new_notification',
            handleNewNotification
        );

        return () => {
            unsubscribe();
        };
    }, [handleNewNotification]);

    // Mark notification as read
    const markAsRead = useCallback((id: string) => {
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
    }, []);

    // Clear all notifications
    const clearNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    // Calculate unread count
    const unreadCount = notifications.filter((n) => !n.read).length;

    return {
        notifications,
        unreadCount,
        markAsRead,
        clearNotifications,
    };
}

export default useNotifications;
