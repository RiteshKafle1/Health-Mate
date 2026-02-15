/**
 * Socket.IO Client Service
 * 
 * Singleton socket instance for real-time communication with the backend.
 * Handles connection, authentication, and reconnection automatically.
 */
import { io, Socket } from 'socket.io-client';

// Socket configuration
const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Singleton socket instance
let socket: Socket | null = null;

/**
 * Get or create the socket instance
 */
export function getSocket(): Socket | null {
    return socket;
}

/**
 * Connect to the Socket.IO server
 * Should be called after user authentication
 */
export function connectSocket(userId: string): Socket {
    // If already connected with same user, return existing socket
    if (socket?.connected) {
        console.log('🔌 Socket already connected');
        return socket;
    }

    // Disconnect existing socket if any
    if (socket) {
        socket.disconnect();
    }

    // Get auth token based on role
    const role = localStorage.getItem('role');
    let token: string | null = null;

    if (role === 'user') {
        token = localStorage.getItem('token');
    } else if (role === 'doctor') {
        token = localStorage.getItem('dtoken');
    } else if (role === 'admin') {
        token = localStorage.getItem('atoken');
    }

    // Create new socket connection
    socket = io(SOCKET_URL, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        auth: {
            token,
            userId,
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
    });

    // Connection event handlers
    socket.on('connect', () => {
        console.log('🔌 Socket connected:', socket?.id);

        // Join user's notification room
        socket?.emit('join_room', { user_id: userId, token });
    });

    socket.on('disconnect', (reason) => {
        console.log('🔌 Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
        console.error('🔌 Socket connection error:', error.message);
    });

    socket.on('room_joined', (data) => {
        console.log('👤 Joined notification room:', data);
    });

    socket.on('error', (error) => {
        console.error('🔌 Socket error:', error);
    });

    // Reconnection handlers
    socket.io.on('reconnect', (attempt) => {
        console.log('🔌 Socket reconnected after', attempt, 'attempts');
        socket?.emit('join_room', { user_id: userId, token });
    });

    socket.io.on('reconnect_attempt', (attempt) => {
        console.log('🔌 Socket reconnection attempt:', attempt);
    });

    socket.io.on('reconnect_failed', () => {
        console.error('🔌 Socket reconnection failed');
    });

    return socket;
}

/**
 * Disconnect from the Socket.IO server
 * Should be called on user logout
 */
export function disconnectSocket(): void {
    if (socket) {
        console.log('🔌 Disconnecting socket...');
        socket.disconnect();
        socket = null;
    }
}

/**
 * Check if socket is currently connected
 */
export function isSocketConnected(): boolean {
    return socket?.connected ?? false;
}

/**
 * Subscribe to a socket event
 * Returns unsubscribe function
 */
export function onSocketEvent<T = unknown>(
    event: string,
    callback: (data: T) => void
): () => void {
    if (!socket) {
        console.warn('Socket not initialized, cannot subscribe to event:', event);
        return () => { };
    }

    socket.on(event, callback);

    // Return unsubscribe function
    return () => {
        socket?.off(event, callback);
    };
}

/**
 * Emit an event to the server
 */
export function emitSocketEvent(event: string, data: unknown): void {
    if (!socket?.connected) {
        console.warn('Socket not connected, cannot emit event:', event);
        return;
    }

    socket.emit(event, data);
}

export default socket;
