import { useState } from 'react';
import { X, User, Calendar, Coffee } from 'lucide-react';
import type { PatientContext } from '../api/labInterpret';

interface PatientContextModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (context: PatientContext) => void;
    initialContext?: PatientContext;
}

export function PatientContextModal({
    isOpen,
    onClose,
    onSubmit,
    initialContext
}: PatientContextModalProps) {
    const [sex, setSex] = useState<PatientContext['sex']>(initialContext?.sex || 'unknown');
    const [age, setAge] = useState<string>(initialContext?.age?.toString() || '');
    const [isFasting, setIsFasting] = useState(initialContext?.is_fasting || false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            sex,
            age: age ? parseInt(age, 10) : undefined,
            is_fasting: isFasting,
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[#A9B5DF]/30">
                    <div>
                        <h2 className="text-xl font-bold text-[#2D336B]">
                            Patient Information
                        </h2>
                        <p className="text-sm text-[#2D336B]/60 mt-1">
                            Provide context for accurate interpretation
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-[#FFF2F2] rounded-lg transition-colors"
                    >
                        <X size={20} className="text-[#2D336B]/50" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Sex Selection */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-[#2D336B] mb-3">
                            <User size={16} />
                            Biological Sex
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {(['male', 'female', 'unknown'] as const).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setSex(option)}
                                    className={`
                                        py-3 px-4 rounded-xl border-2 font-medium capitalize transition-all
                                        ${sex === option
                                            ? 'border-[#7886C7] bg-[#7886C7]/10 text-[#2D336B]'
                                            : 'border-[#A9B5DF]/30 hover:border-[#7886C7]/50 text-[#2D336B]/70'
                                        }
                                    `}
                                >
                                    {option === 'unknown' ? 'Not Sure' : option}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Age Input */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-[#2D336B] mb-3">
                            <Calendar size={16} />
                            Age (Optional)
                        </label>
                        <input
                            type="number"
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                            placeholder="Enter age in years"
                            min="0"
                            max="120"
                            className="w-full h-12 rounded-xl border-2 border-[#A9B5DF]/30 bg-white/50 px-4 text-[#2D336B] placeholder-[#2D336B]/30 focus:border-[#7886C7] focus:ring-4 focus:ring-[#7886C7]/10 outline-none transition-all font-medium"
                        />
                    </div>

                    {/* Fasting Toggle */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-[#2D336B] mb-3">
                            <Coffee size={16} />
                            Fasting Status
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setIsFasting(true)}
                                className={`
                                    py-3 px-4 rounded-xl border-2 font-medium transition-all
                                    ${isFasting
                                        ? 'border-[#7886C7] bg-[#7886C7]/10 text-[#2D336B]'
                                        : 'border-[#A9B5DF]/30 hover:border-[#7886C7]/50 text-[#2D336B]/70'
                                    }
                                `}
                            >
                                Fasting (8+ hrs)
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsFasting(false)}
                                className={`
                                    py-3 px-4 rounded-xl border-2 font-medium transition-all
                                    ${!isFasting
                                        ? 'border-[#7886C7] bg-[#7886C7]/10 text-[#2D336B]'
                                        : 'border-[#A9B5DF]/30 hover:border-[#7886C7]/50 text-[#2D336B]/70'
                                    }
                                `}
                            >
                                Not Fasting
                            </button>
                        </div>
                    </div>

                    {/* Info Note */}
                    <div className="p-4 bg-[#FFF2F2] rounded-xl text-sm text-[#2D336B]/70">
                        <p>
                            <strong>Why we ask:</strong> Reference ranges vary by sex, age, and fasting status.
                            Providing accurate information ensures more precise interpretation.
                        </p>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="w-full h-12 bg-gradient-to-r from-[#7886C7] to-[#A9B5DF] text-white rounded-xl shadow-lg shadow-[#7886C7]/25 hover:shadow-[#7886C7]/40 hover:-translate-y-0.5 transition-all font-semibold"
                    >
                        Start Analysis
                    </button>
                </form>
            </div>
        </div>
    );
}
