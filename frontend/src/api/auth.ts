import api from './api';

// Types
export interface PasswordValidationResponse {
    valid: boolean;
    score: number;
    strength: 'Weak' | 'Fair' | 'Good' | 'Strong';
    feedback: {
        hasMinLength: boolean;
        hasUppercase: boolean;
        hasLowercase: boolean;
        hasNumeric: boolean;
        hasSpecial: boolean;
        isNotCommon: boolean;
        isNotBreached: boolean;
        noSequential: boolean;
    };
    suggestions: string[];
    message: string;
}

export interface EmailValidationResponse {
    valid: boolean;
    message: string;
    is_disposable: boolean | null;
}

export interface EmailExistsResponse {
    exists: boolean;
    message: string;
}

export interface LoginResponse {
    success: boolean;
    message?: string;
    token?: string;
    locked?: boolean;
    locked_until?: number;
    password_feedback?: PasswordValidationResponse;
}

// Validate password strength (real-time)
export const validatePassword = async (
    password: string,
    checkBreach: boolean = false
): Promise<PasswordValidationResponse> => {
    const response = await api.post('/api/auth/validate-password', {
        password,
        check_breach: checkBreach
    });
    return response.data;
};

// Validate email (real-time)
export const validateEmail = async (email: string): Promise<EmailValidationResponse> => {
    const response = await api.post('/api/auth/validate-email', { email });
    return response.data;
};

// Check if email exists
export const checkEmailExists = async (email: string): Promise<EmailExistsResponse> => {
    const response = await api.post('/api/auth/check-email-exists', { email });
    return response.data;
};
