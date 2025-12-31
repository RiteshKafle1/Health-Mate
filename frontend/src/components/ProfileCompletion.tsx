
interface ProfileCompletionProps {
    completion: number;
}

export function ProfileCompletion({ completion }: ProfileCompletionProps) {
    // Determine color based on completion percentage
    const getColor = () => {
        if (completion < 50) return '#EF4444'; // Red
        if (completion < 80) return '#F59E0B'; // Yellow/Orange
        return '#10B981'; // Green
    };

    const color = getColor();
    const circumference = 2 * Math.PI * 45; // radius = 45
    const strokeDashoffset = circumference - (completion / 100) * circumference;

    return (
        <div className="flex flex-col items-center py-6 border-t border-[#A9B5DF]/20">
            <p className="text-xs text-[#2D336B]/50 font-semibold uppercase tracking-wider mb-3">
                Profile Completion
            </p>

            {/* Circular Progress */}
            <div className="relative w-24 h-24 mb-2">
                {/* Background circle */}
                <svg className="w-full h-full transform -rotate-90">
                    <circle
                        cx="48"
                        cy="48"
                        r="45"
                        stroke="#EEF2FF"
                        strokeWidth="8"
                        fill="none"
                    />
                    {/* Progress circle */}
                    <circle
                        cx="48"
                        cy="48"
                        r="45"
                        stroke={color}
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="transition-all duration-500 ease-out"
                    />
                </svg>

                {/* Percentage text */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold" style={{ color }}>
                        {completion}%
                    </span>
                </div>
            </div>

            {/* Status message */}
            <p className="text-xs text-[#2D336B]/60 font-medium text-center max-w-[160px]">
                {completion >= 100 ? (
                    <span className="text-green-600 font-semibold">✓ Complete!</span>
                ) : completion >= 80 ? (
                    'Almost there! Just a few more details'
                ) : completion >= 50 ? (
                    'Keep going! You\'re halfway'
                ) : (
                    'Complete your profile for better experience'
                )}
            </p>
        </div>
    );
}
