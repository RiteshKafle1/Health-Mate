import React from 'react';
import { Lock, Clock, AlertTriangle, ShieldX } from 'lucide-react';

interface AccountLockoutMessageProps {
    lockedUntil: number; // timestamp in milliseconds
    onRetry?: () => void;
}

export function AccountLockoutMessage({ lockedUntil, onRetry }: AccountLockoutMessageProps) {
    const [timeRemaining, setTimeRemaining] = React.useState('');

    React.useEffect(() => {
        const updateTime = () => {
            const now = Date.now();
            const remaining = lockedUntil - now;

            if (remaining <= 0) {
                setTimeRemaining('');
                return;
            }

            const seconds = Math.floor((remaining / 1000) % 60);
            const minutes = Math.floor((remaining / (1000 * 60)) % 60);
            const hours = Math.floor(remaining / (1000 * 60 * 60));

            if (hours > 0) {
                setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
            } else if (minutes > 0) {
                setTimeRemaining(`${minutes}m ${seconds}s`);
            } else {
                setTimeRemaining(`${seconds}s`);
            }
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [lockedUntil]);

    if (!timeRemaining) {
        return (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl animate-fadeIn">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Lock className="text-green-600" size={20} />
                    </div>
                    <div>
                        <h4 className="font-semibold text-green-800">Account Unlocked</h4>
                        <p className="text-sm text-green-600">You can try logging in again</p>
                    </div>
                </div>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="mt-3 w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        Try Again
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl animate-pulse-soft">
            <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <ShieldX className="text-red-600" size={24} />
                </div>
                <div className="flex-1">
                    <h4 className="font-semibold text-red-800 mb-1">🔒 Account Locked</h4>
                    <p className="text-sm text-red-600 mb-3">
                        Too many failed login attempts. Try again after:
                    </p>

                    {/* Countdown Timer */}
                    <div className="flex items-center gap-2 p-3 bg-red-100 rounded-lg">
                        <Clock className="text-red-600 animate-pulse" size={18} />
                        <span className="font-mono font-bold text-red-700 text-xl">
                            {timeRemaining}
                        </span>
                    </div>

                    <p className="text-xs text-red-500 mt-2">
                        Please wait for the timer to expire before attempting to login again.
                    </p>

                    {/* Try Different Account Button */}
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="mt-4 w-full py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                        >
                            🔄 Try Different Role
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

interface LoginWarningProps {
    remainingAttempts: number;
}

export function LoginWarning({ remainingAttempts }: LoginWarningProps) {
    return (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl animate-shake">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <AlertTriangle className="text-amber-600" size={18} />
                </div>
                <div>
                    <h4 className="font-medium text-amber-800 text-sm">Invalid Credentials</h4>
                    <p className="text-xs text-amber-600">
                        {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining before account lockout
                    </p>
                </div>
            </div>
        </div>
    );
}

export default AccountLockoutMessage;
