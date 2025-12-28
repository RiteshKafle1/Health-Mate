import { useEffect, useState } from 'react';
import { Check, X, AlertCircle, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { validatePassword, type PasswordValidationResponse } from '../../api/auth';

interface PasswordStrengthIndicatorProps {
    password: string;
    onValidation?: (isValid: boolean, response: PasswordValidationResponse | null) => void;
    showRequirements?: boolean;
}

const defaultFeedback: PasswordValidationResponse['feedback'] = {
    hasMinLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumeric: false,
    hasSpecial: false,
    isNotCommon: true,
    isNotBreached: true,
    noSequential: true
};

export function PasswordStrengthIndicator({
    password,
    onValidation,
    showRequirements = true
}: PasswordStrengthIndicatorProps) {
    const [validation, setValidation] = useState<PasswordValidationResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Debounce validation calls
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        if (password.length === 0) {
            setValidation(null);
            onValidation?.(false, null);
            return;
        }

        // Only validate after user stops typing for 300ms
        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                // Don't check breach for real-time (faster), check on submit
                const response = await validatePassword(password, false);
                setValidation(response);
                onValidation?.(response.valid, response);
            } catch (error) {
                console.error('Password validation error:', error);
                // Fallback to local validation if API fails
                const localValidation = getLocalValidation(password);
                setValidation(localValidation);
                onValidation?.(localValidation.valid, localValidation);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        setDebounceTimer(timer);

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [password]);

    // Local validation fallback
    const getLocalValidation = (pwd: string): PasswordValidationResponse => {
        const feedback = {
            hasMinLength: pwd.length >= 8,
            hasUppercase: /[A-Z]/.test(pwd),
            hasLowercase: /[a-z]/.test(pwd),
            hasNumeric: /\d/.test(pwd),
            hasSpecial: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(pwd),
            isNotCommon: true,
            isNotBreached: true,
            noSequential: true
        };

        let score = 0;
        if (feedback.hasMinLength) score += 20;
        if (feedback.hasUppercase) score += 15;
        if (feedback.hasLowercase) score += 15;
        if (feedback.hasNumeric) score += 15;
        if (feedback.hasSpecial) score += 15;
        if (pwd.length >= 12) score += 10;
        if (pwd.length >= 16) score += 10;

        const valid = feedback.hasMinLength && feedback.hasUppercase &&
            feedback.hasLowercase && feedback.hasNumeric && feedback.hasSpecial;

        let strength: 'Weak' | 'Fair' | 'Good' | 'Strong' = 'Weak';
        if (score > 80) strength = 'Strong';
        else if (score > 60) strength = 'Good';
        else if (score > 40) strength = 'Fair';

        return {
            valid,
            score,
            strength,
            feedback,
            suggestions: [],
            message: `Password strength: ${strength}`
        };
    };

    const getStrengthColor = (strength: string) => {
        switch (strength) {
            case 'Strong': return 'bg-emerald-500';
            case 'Good': return 'bg-green-500';
            case 'Fair': return 'bg-yellow-500';
            default: return 'bg-red-500';
        }
    };

    const getStrengthTextColor = (strength: string) => {
        switch (strength) {
            case 'Strong': return 'text-emerald-500';
            case 'Good': return 'text-green-500';
            case 'Fair': return 'text-yellow-500';
            default: return 'text-red-500';
        }
    };

    const getStrengthIcon = (strength: string) => {
        switch (strength) {
            case 'Strong': return <ShieldCheck className="text-emerald-500" size={20} />;
            case 'Good': return <Shield className="text-green-500" size={20} />;
            case 'Fair': return <ShieldAlert className="text-yellow-500" size={20} />;
            default: return <ShieldAlert className="text-red-500" size={20} />;
        }
    };

    const feedback = validation?.feedback || defaultFeedback;
    const score = validation?.score || 0;
    const strength = validation?.strength || 'Weak';

    if (password.length === 0) {
        return null;
    }

    return (
        <div className="mt-3 animate-fadeIn">
            {/* Strength Bar */}
            <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                        {getStrengthIcon(strength)}
                        <span className={`text-sm font-medium ${getStrengthTextColor(strength)}`}>
                            {strength}
                        </span>
                    </div>
                    <span className="text-xs text-gray-500">
                        {score}/100
                    </span>
                </div>

                {/* Animated Progress Bar */}
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ease-out rounded-full ${getStrengthColor(strength)}`}
                        style={{ width: `${score}%` }}
                    />
                </div>
            </div>

            {/* Requirements Checklist */}
            {showRequirements && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <RequirementItem
                        met={feedback.hasMinLength}
                        label="8+ characters"
                    />
                    <RequirementItem
                        met={feedback.hasUppercase}
                        label="Uppercase (A-Z)"
                    />
                    <RequirementItem
                        met={feedback.hasLowercase}
                        label="Lowercase (a-z)"
                    />
                    <RequirementItem
                        met={feedback.hasNumeric}
                        label="Number (0-9)"
                    />
                    <RequirementItem
                        met={feedback.hasSpecial}
                        label="Special (!@#$%)"
                    />
                    <RequirementItem
                        met={feedback.isNotCommon}
                        label="Not common"
                    />
                </div>
            )}

            {/* Suggestions */}
            {validation?.suggestions && validation.suggestions.length > 0 && (
                <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={16} />
                        <div className="text-xs text-amber-700">
                            {validation.suggestions[0]}
                        </div>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {isLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
                </div>
            )}
        </div>
    );
}

// Requirement Item Component
function RequirementItem({ met, label }: { met: boolean; label: string }) {
    return (
        <div className={`flex items-center gap-1.5 transition-all duration-300 ${met ? 'text-green-600' : 'text-gray-400'}`}>
            {met ? (
                <Check size={14} className="text-green-500" />
            ) : (
                <X size={14} className="text-gray-300" />
            )}
            <span className={met ? 'font-medium' : ''}>{label}</span>
        </div>
    );
}

export default PasswordStrengthIndicator;
