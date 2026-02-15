/**
 * Browser Notification Utility
 * 
 * Handles browser push notifications using the Notification API.
 * Only shows when tab is hidden/inactive.
 */

/**
 * Check if browser notifications are supported
 */
export function isNotificationSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
    if (!isNotificationSupported()) {
        return 'unsupported';
    }
    return Notification.permission;
}

/**
 * Request permission to show browser notifications
 * Returns the permission status
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (!isNotificationSupported()) {
        console.warn('Browser notifications not supported');
        return 'unsupported';
    }

    // Already granted or denied
    if (Notification.permission !== 'default') {
        return Notification.permission;
    }

    try {
        const permission = await Notification.requestPermission();
        console.log('🔔 Notification permission:', permission);
        return permission;
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        return 'denied';
    }
}

/**
 * Check if the current tab is hidden/inactive
 */
export function isTabHidden(): boolean {
    if (typeof document === 'undefined') return false;
    return document.visibilityState === 'hidden';
}

/**
 * Show a browser notification
 * Only shows if permission is granted and tab is hidden
 * 
 * @param title - Notification title
 * @param options - Notification options
 * @returns The notification instance or null if not shown
 */
export function showBrowserNotification(
    title: string,
    options?: { body?: string; tag?: string; icon?: string }
): Notification | null {
    // Check if supported and permitted
    if (!isNotificationSupported()) {
        return null;
    }

    if (Notification.permission !== 'granted') {
        console.log('🔔 Browser notification permission not granted');
        return null;
    }

    // Only show if tab is hidden (user is not actively viewing the page)
    if (!isTabHidden()) {
        console.log('🔔 Tab is visible, skipping browser notification');
        return null;
    }

    try {
        const notification = new Notification(title, {
            icon: options?.icon || '/vite.svg',
            body: options?.body,
            tag: options?.tag || 'healthmate-notification',
        });

        // Auto-close after 5 seconds
        setTimeout(() => {
            notification.close();
        }, 5000);

        // Handle click - focus the window
        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        console.log('🔔 Browser notification shown:', title);
        return notification;
    } catch (error) {
        console.error('Error showing browser notification:', error);
        return null;
    }
}

/**
 * Subscribe to visibility change events
 * Returns unsubscribe function
 */
export function onVisibilityChange(
    callback: (isHidden: boolean) => void
): () => void {
    if (typeof document === 'undefined') {
        return () => { };
    }

    const handler = () => {
        callback(document.visibilityState === 'hidden');
    };

    document.addEventListener('visibilitychange', handler);

    return () => {
        document.removeEventListener('visibilitychange', handler);
    };
}
