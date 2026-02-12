/**
 * Notification Context & Provider
 * 
 * Provides global notification system that:
 * - Connects socket when user is authenticated
 * - Requests browser notification permission
 * - Exposes notification state and actions
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { connectSocket, disconnectSocket, isSocketConnected } from '../services/socket';
import { useNotifications, type NotificationData } from '../hooks/useNotifications';
import { requestNotificationPermission, getNotificationPermission } from '../utils/browserNotification';
import { preloadNotificationSound } from '../utils/sound';

// Context type
interface NotificationContextType {
    notifications: NotificationData[];
    unreadCount: number;
    isSocketConnected: boolean;
    notificationPermission: NotificationPermission | 'unsupported';
    markAsRead: (id: string) => void;
    clearNotifications: () => void;
    requestPermission: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
    children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
    const { isAuthenticated, token, role } = useAuth();
    const [socketConnected, setSocketConnected] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');

    // Use the notifications hook
    const { notifications, unreadCount, markAsRead, clearNotifications } = useNotifications();

    const getUserIdFromToken = useCallback((): string | null => {
        // Special case for admin - use "ADMIN" ID to join admin room
        if (role === 'admin') {
            return 'ADMIN';
        }

        if (!token) return null;

        try {
            // JWT tokens are base64 encoded, split by '.'
            const payload = token.split('.')[1];
            const decoded = JSON.parse(atob(payload));
            return decoded.id || decoded.sub || null;
        } catch {
            console.error('Failed to decode token');
            return null;
        }
    }, [token, role]);

    // Connect socket when authenticated
    useEffect(() => {
        if (isAuthenticated && token) {
            const userId = getUserIdFromToken();

            if (userId) {
                console.log('🔌 Connecting socket for user:', userId);
                connectSocket(userId);
                setSocketConnected(true);

                // Preload notification sound
                preloadNotificationSound();
            }
        } else {
            // Disconnect when logged out
            disconnectSocket();
            setSocketConnected(false);
        }

        // Cleanup on unmount
        return () => {
            disconnectSocket();
        };
    }, [isAuthenticated, token, getUserIdFromToken]);

    // Update socket connection status
    useEffect(() => {
        const interval = setInterval(() => {
            setSocketConnected(isSocketConnected());
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    // Check notification permission on mount
    useEffect(() => {
        const currentPermission = getNotificationPermission();
        setPermission(currentPermission);
    }, []);

    // Request notification permission
    const requestPermission = useCallback(async () => {
        const result = await requestNotificationPermission();
        setPermission(result);
    }, []);

    const value: NotificationContextType = {
        notifications,
        unreadCount,
        isSocketConnected: socketConnected,
        notificationPermission: permission,
        markAsRead,
        clearNotifications,
        requestPermission,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotificationContext() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotificationContext must be used within a NotificationProvider');
    }
    return context;
}

export type { NotificationData };
