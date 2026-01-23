import { useEffect, useState } from 'react';

interface InterpretLoadingOverlayProps {
    isOpen: boolean;
    reportName?: string;
    onCancel?: () => void;
}

const progressMessages = [
    "Scanning lab report...",
    "Extracting biomarker values...",
    "Converting units...",
    "Comparing against reference ranges...",
    "Generating clinical interpretation...",
    "Finalizing analysis..."
];

export function InterpretLoadingOverlay({
    isOpen,
    reportName = "Lab Report",
    onCancel
}: InterpretLoadingOverlayProps) {
    const [messageIndex, setMessageIndex] = useState(0);
    const [dots, setDots] = useState("");

    // Cycle through progress messages
    useEffect(() => {
        if (!isOpen) {
            setMessageIndex(0);
            return;
        }

        const interval = setInterval(() => {
            setMessageIndex((prev) =>
                prev < progressMessages.length - 1 ? prev + 1 : prev
            );
        }, 2000);

        return () => clearInterval(interval);
    }, [isOpen]);

    // Animate dots
    useEffect(() => {
        if (!isOpen) return;

        const interval = setInterval(() => {
            setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
        }, 500);

        return () => clearInterval(interval);
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with blur */}
            <div className="absolute inset-0 bg-[#2D336B]/80 backdrop-blur-md" />

            {/* Content */}
            <div className="relative flex flex-col items-center text-center">
                {/* DNA Helix Animation */}
                <div className="relative w-32 h-32 mb-8">
                    {/* Outer rotating ring */}
                    <div className="absolute inset-0 rounded-full border-4 border-[#A9B5DF]/30 animate-spin" style={{ animationDuration: '3s' }}>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-[#7886C7] rounded-full" />
                    </div>

                    {/* Middle rotating ring (opposite direction) */}
                    <div className="absolute inset-4 rounded-full border-4 border-[#7886C7]/40 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}>
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-[#A9B5DF] rounded-full" />
                    </div>

                    {/* Inner pulsing circle */}
                    <div className="absolute inset-8 rounded-full bg-gradient-to-br from-[#7886C7] to-[#A9B5DF] animate-pulse flex items-center justify-center">
                        <svg
                            className="w-10 h-10 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                            />
                        </svg>
                    </div>

                    {/* Floating particles */}
                    <div className="absolute -inset-4">
                        {[...Array(6)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute w-2 h-2 bg-[#7886C7] rounded-full opacity-60"
                                style={{
                                    top: `${20 + Math.sin(i * 60 * Math.PI / 180) * 50}%`,
                                    left: `${50 + Math.cos(i * 60 * Math.PI / 180) * 50}%`,
                                    animation: `float-${i % 3} ${2 + i * 0.3}s ease-in-out infinite`,
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-white mb-2">
                    Analyzing Lab Report
                </h2>

                {/* Report name */}
                <p className="text-[#A9B5DF] mb-6 max-w-sm truncate">
                    "{reportName}"
                </p>

                {/* Progress message */}
                <div className="h-8 flex items-center">
                    <p className="text-white/90 text-lg font-medium">
                        {progressMessages[messageIndex]}
                        <span className="inline-block w-8 text-left">{dots}</span>
                    </p>
                </div>

                {/* Progress bar */}
                <div className="w-64 h-2 bg-white/20 rounded-full mt-6 overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-[#7886C7] to-[#A9B5DF] rounded-full transition-all duration-1000 ease-out"
                        style={{
                            width: `${((messageIndex + 1) / progressMessages.length) * 100}%`
                        }}
                    />
                </div>

                {/* Progress percentage */}
                <p className="text-white/60 text-sm mt-2">
                    {Math.round(((messageIndex + 1) / progressMessages.length) * 100)}%
                </p>

                {/* Cancel button */}
                {onCancel && (
                    <button
                        onClick={onCancel}
                        className="mt-8 px-6 py-2 text-white/70 hover:text-white border border-white/30 hover:border-white/50 rounded-lg transition-colors text-sm"
                    >
                        Cancel
                    </button>
                )}

                {/* Estimated time */}
                <p className="text-white/40 text-xs mt-4">
                    This usually takes 2-5 seconds
                </p>
            </div>

            {/* CSS for custom animations */}
            <style>{`
                @keyframes float-0 {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-10px) rotate(180deg); }
                }
                @keyframes float-1 {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(8px) rotate(-180deg); }
                }
                @keyframes float-2 {
                    0%, 100% { transform: translateY(0) scale(1); }
                    50% { transform: translateY(-6px) scale(1.2); }
                }
            `}</style>
        </div>
    );
}
