/**
 * Sound Utility
 * 
 * Handles notification sound playback with browser autoplay restrictions handling.
 */

// Sound file path (relative to public folder)
const NOTIFICATION_SOUND_PATH = '/sounds/notification.mp3';

// Audio element singleton
let audioElement: HTMLAudioElement | null = null;

/**
 * Initialize and preload the notification sound
 * Should be called early in the app lifecycle
 */
export function preloadNotificationSound(): void {
    if (typeof window === 'undefined') return;

    if (!audioElement) {
        audioElement = new Audio(NOTIFICATION_SOUND_PATH);
        audioElement.preload = 'auto';
        audioElement.volume = 0.5; // 50% volume by default

        // Try to load the audio
        audioElement.load();

        console.log('🔊 Notification sound preloaded');
    }
}

/**
 * Play the notification sound
 * Handles browser autoplay restrictions gracefully
 */
export async function playNotificationSound(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // Ensure audio element exists
    if (!audioElement) {
        preloadNotificationSound();
    }

    if (!audioElement) return false;

    try {
        // Reset to beginning if already playing
        audioElement.currentTime = 0;

        // Attempt to play
        await audioElement.play();
        console.log('🔊 Notification sound played');
        return true;
    } catch (error) {
        // Autoplay blocked - common in modern browsers
        // User needs to interact with page first
        console.warn('🔊 Could not play notification sound:', error);
        return false;
    }
}

/**
 * Set notification sound volume
 * @param volume - Volume level between 0 and 1
 */
export function setNotificationVolume(volume: number): void {
    if (audioElement) {
        audioElement.volume = Math.max(0, Math.min(1, volume));
    }
}

/**
 * Mute/unmute notification sound
 */
export function muteNotificationSound(mute: boolean): void {
    if (audioElement) {
        audioElement.muted = mute;
    }
}

/**
 * Check if sound can be played (user has interacted with page)
 * After first successful play, subsequent plays should work
 */
export async function canPlaySound(): Promise<boolean> {
    if (!audioElement) {
        preloadNotificationSound();
    }

    if (!audioElement) return false;

    try {
        // Try playing at 0 volume as a test
        const wasVolume = audioElement.volume;
        audioElement.volume = 0;
        await audioElement.play();
        audioElement.pause();
        audioElement.currentTime = 0;
        audioElement.volume = wasVolume;
        return true;
    } catch {
        return false;
    }
}
