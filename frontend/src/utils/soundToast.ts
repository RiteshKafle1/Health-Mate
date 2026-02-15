/**
 * Sound Toast Utility
 * 
 * Wrapper around react-hot-toast that plays notification sound on success toasts.
 */

import hotToast from 'react-hot-toast';
import type { ToastOptions, Renderable, ValueOrFunction, Toast } from 'react-hot-toast';
import { playNotificationSound } from './sound';

/**
 * Base toast function with all methods attached
 */
const toast = Object.assign(
    // Base callable function (for custom toasts)
    (message: Renderable, options?: ToastOptions): string => {
        return hotToast(message, options);
    },
    {
        /**
         * Success toast with notification sound
         */
        success: (message: Renderable, options?: ToastOptions): string => {
            playNotificationSound();
            return hotToast.success(message, options);
        },

        /**
         * Error toast (no sound)
         */
        error: (message: Renderable, options?: ToastOptions): string => {
            return hotToast.error(message, options);
        },

        /**
         * Loading toast (no sound, returns ID)
         */
        loading: (message: Renderable, options?: ToastOptions): string => {
            return hotToast.loading(message, options);
        },

        /**
         * Custom toast
         */
        custom: (message: Renderable | ((t: Toast) => Renderable), options?: ToastOptions): string => {
            return hotToast.custom(message, options);
        },

        /**
         * Promise toast - plays success sound when promise resolves
         */
        promise: <T>(
            promise: Promise<T>,
            msgs: {
                loading: Renderable;
                success: ValueOrFunction<Renderable, T>;
                error: ValueOrFunction<Renderable, unknown>;
            },
            options?: ToastOptions
        ): Promise<T> => {
            promise.then(() => playNotificationSound()).catch(() => { });
            return hotToast.promise(promise, msgs, options);
        },

        /**
         * Dismiss toast
         */
        dismiss: (toastId?: string): void => {
            hotToast.dismiss(toastId);
        },

        /**
         * Remove toast
         */
        remove: (toastId?: string): void => {
            hotToast.remove(toastId);
        }
    }
);

export { toast as soundToast };
export default toast;
