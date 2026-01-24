import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { validateEmail, checkEmailExists, type EmailValidationResponse, type EmailExistsResponse } from '../../api/auth';

interface EmailValidatorProps {
    email: string;
    onValidation?: (isValid: boolean, exists: boolean) => void;
}

export function EmailValidator({ email, onValidation }: EmailValidatorProps) {
    const [validation, setValidation] = useState<EmailValidationResponse | null>(null);
    const [existsCheck, setExistsCheck] = useState<EmailExistsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        // Basic email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            setValidation(null);
            setExistsCheck(null);
            onValidation?.(false, false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                // Validate email format and disposable check
                const validationResponse = await validateEmail(email);
                setValidation(validationResponse);

                if (validationResponse.valid) {
                    // Check if email already exists
                    const existsResponse = await checkEmailExists(email);
                    setExistsCheck(existsResponse);
                    onValidation?.(validationResponse.valid && !existsResponse.exists, existsResponse.exists);
                } else {
                    setExistsCheck(null);
                    onValidation?.(false, false);
                }
            } catch (error) {
                console.error('Email validation error:', error);
                // Assume valid if API fails
                setValidation({ valid: true, message: 'Email format OK', is_disposable: false });
                onValidation?.(true, false);
            } finally {
                setIsLoading(false);
            }
        }, 500);

        setDebounceTimer(timer);

        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [email]);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        return null;
    }

    return (
        <div className="mt-2 animate-fadeIn">
            {isLoading ? (
                <div className="flex items-center gap-2 text-gray-500 text-xs">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Checking email...</span>
                </div>
            ) : (
                <>
                    {/* Validation Status */}
                    {validation && (
                        <div className={`flex items-center gap-2 text-xs ${validation.valid ? 'text-green-600' : 'text-red-500'}`}>
                            {validation.valid ? (
                                <CheckCircle size={14} />
                            ) : (
                                <XCircle size={14} />
                            )}
                            <span>{validation.message}</span>
                        </div>
                    )}

                    {/* Disposable Email Warning */}
                    {validation?.is_disposable && (
                        <div className="flex items-center gap-2 text-xs text-amber-600 mt-1">
                            <AlertTriangle size={14} />
                            <span>Disposable emails are not allowed</span>
                        </div>
                    )}

                    {/* Email Exists Warning */}
                    {existsCheck?.exists && (
                        <div className="flex items-center gap-2 text-xs text-amber-600 mt-1">
                            <AlertTriangle size={14} />
                            <span>This email is already registered</span>
                        </div>
                    )}

                    {/* Email Available */}
                    {validation?.valid && existsCheck && !existsCheck.exists && (
                        <div className="flex items-center gap-2 text-xs text-green-600 mt-1">
                            <CheckCircle size={14} />
                            <span>Email is available</span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default EmailValidator;
