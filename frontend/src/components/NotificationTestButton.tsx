/**
 * Notification Test Button Component
 * 
 * A floating button that allows testing the notification system.
 * Shows connection status and triggers test notifications.
 */
import { useState } from 'react';
import { useNotificationContext } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import toast from '../utils/soundToast';
import { playNotificationSound } from '../utils/sound';

export function NotificationTestButton() {
    const { isSocketConnected, requestPermission, notificationPermission } = useNotificationContext();
    const { token, isAuthenticated } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleTestNotification = async () => {
        if (!isAuthenticated || !token) {
            toast.error('Please login first to test notifications');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('http://localhost:8000/api/test/send-notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': token,
                },
                body: JSON.stringify({
                    title: '🔔 Test Notification',
                    message: 'This is a test notification from HealthMate!',
                    priority: 'high'
                })
            });

            const data = await response.json();

            if (data.success) {
                console.log('✅ Test notification sent:', data);
                // Also play sound directly as fallback
                playNotificationSound();
            } else {
                toast.error('Failed to send notification: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error sending test notification:', error);
            toast.error('Failed to send test notification');
        } finally {
            setLoading(false);
        }
    };

    // Manual test - just show toast and play sound
    const handleManualTest = () => {
        // Show messenger-style toast
        toast(
            '🔔 Test Notification\nThis is how notifications will appear!',
            {
                duration: 5000,
                position: 'top-right',
                style: {
                    background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                    color: '#fff',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 500,
                    boxShadow: '0 10px 40px rgba(14, 165, 233, 0.4)',
                    border: '1px solid rgba(255,255,255,0.2)',
                },
                icon: '💬',
            }
        );

        // Play sound
        playNotificationSound();
    };

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                alignItems: 'flex-end',
            }}
        >
            {/* Connection Status */}
            <div
                style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    background: isSocketConnected ? '#10b981' : '#ef4444',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                }}
            >
                <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#fff',
                    animation: isSocketConnected ? 'pulse 2s infinite' : 'none'
                }} />
                {isSocketConnected ? 'Socket Connected' : 'Socket Disconnected'}
            </div>

            {/* Permission Button */}
            {notificationPermission !== 'granted' && (
                <button
                    onClick={requestPermission}
                    style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#f59e0b',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                    }}
                >
                    🔔 Enable Browser Notifications
                </button>
            )}

            {/* Manual Test Button */}
            <button
                onClick={handleManualTest}
                style={{
                    padding: '12px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
                }}
            >
                🎵 Test Sound & Toast
            </button>

            {/* Socket Test Button */}
            {isAuthenticated && (
                <button
                    onClick={handleTestNotification}
                    disabled={loading}
                    style={{
                        padding: '12px 20px',
                        borderRadius: '10px',
                        border: 'none',
                        background: loading
                            ? '#6b7280'
                            : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                        color: '#fff',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 600,
                        boxShadow: '0 4px 15px rgba(14, 165, 233, 0.4)',
                    }}
                >
                    {loading ? '⏳ Sending...' : '📤 Send Real-Time Notification'}
                </button>
            )}
        </div>
    );
}
