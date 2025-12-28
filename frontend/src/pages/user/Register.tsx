import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../../api/user';
import { validatePassword } from '../../api/auth';
import { Navbar } from '../../components/layout/Navbar';
import { Mail, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';
import { PasswordStrengthIndicator } from '../../components/ui/PasswordStrengthIndicator';
import { EmailValidator } from '../../components/ui/EmailValidator';
import type { PasswordValidationResponse } from '../../api/auth';
import toast from 'react-hot-toast';

export function Register() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isPasswordValid, setIsPasswordValid] = useState(false);
    const [isEmailValid, setIsEmailValid] = useState(false);
    const [emailExists, setEmailExists] = useState(false);
    const navigate = useNavigate();

    const handlePasswordValidation = (isValid: boolean, _response: PasswordValidationResponse | null) => {
        setIsPasswordValid(isValid);
    };

    const handleEmailValidation = (isValid: boolean, exists: boolean) => {
        setIsEmailValid(isValid);
        setEmailExists(exists);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name || !email || !password || !confirmPassword) {
            toast.error('Please fill in all fields');
            return;
        }

        if (!isEmailValid) {
            toast.error('Please enter a valid email address');
            return;
        }

        if (emailExists) {
            toast.error('This email is already registered');
            return;
        }

        if (!isPasswordValid) {
            toast.error('Please create a stronger password');
            return;
        }

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setIsLoading(true);

        try {
            // Final breach check before registration
            const finalCheck = await validatePassword(password, true);
            if (!finalCheck.valid) {
                if (!finalCheck.feedback.isNotBreached) {
                    toast.error('This password has been found in data breaches. Please choose a different one.');
                } else {
                    toast.error(finalCheck.message);
                }
                setIsLoading(false);
                return;
            }

            const response = await registerUser({ name, email, password });

            if (response.success) {
                toast.success('Registration successful! Please login.');
                navigate('/login');
            } else {
                // Check for password feedback in response
                const responseAny = response as any;
                if (responseAny.password_feedback) {
                    const suggestions = responseAny.password_feedback.suggestions;
                    if (suggestions && suggestions.length > 0) {
                        toast.error(suggestions[0]);
                    } else {
                        toast.error(response.message || 'Registration failed');
                    }
                } else {
                    toast.error(response.message || 'Registration failed');
                }
            }
        } catch (error: any) {
            const message = error.response?.data?.detail?.message || error.message || 'Registration failed';
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            <Navbar />

            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12">
                <div className="w-full max-w-md">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
                        <p className="text-gray-600">Join HealthMate - Your AI-powered comprehensive health assistant</p>
                    </div>

                    {/* Registration Form */}
                    <form onSubmit={handleSubmit} className="glass-card p-8">
                        <div className="space-y-5">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                                        placeholder="Enter your full name"
                                        autoComplete="name"
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary/20 transition-all bg-white ${email && !isEmailValid ? 'border-red-300 focus:border-red-400' :
                                            email && isEmailValid && !emailExists ? 'border-green-300 focus:border-green-400' :
                                                'border-gray-200 focus:border-primary'
                                            }`}
                                        placeholder="Enter your email"
                                        autoComplete="email"
                                    />
                                </div>
                                {/* Email Validation Feedback */}
                                <EmailValidator email={email} onValidation={handleEmailValidation} />
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className={`w-full pl-12 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-primary/20 transition-all bg-white ${password && !isPasswordValid ? 'border-amber-300 focus:border-amber-400' :
                                            password && isPasswordValid ? 'border-green-300 focus:border-green-400' :
                                                'border-gray-200 focus:border-primary'
                                            }`}
                                        placeholder="Create a strong password"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>

                                {/* Password Strength Indicator */}
                                <PasswordStrengthIndicator
                                    password={password}
                                    onValidation={handlePasswordValidation}
                                    showRequirements={true}
                                />
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className={`w-full pl-12 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-primary/20 transition-all bg-white ${confirmPassword && confirmPassword !== password ? 'border-red-300 focus:border-red-400' :
                                            confirmPassword && confirmPassword === password ? 'border-green-300 focus:border-green-400' :
                                                'border-gray-200 focus:border-primary'
                                            }`}
                                        placeholder="Confirm your password"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {/* Password Match Indicator */}
                                {confirmPassword && (
                                    <div className={`mt-2 text-xs flex items-center gap-1.5 animate-fadeIn ${confirmPassword === password ? 'text-green-600' : 'text-red-500'
                                        }`}>
                                        {confirmPassword === password ? '✓ Passwords match' : '✗ Passwords do not match'}
                                    </div>
                                )}
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading || !isPasswordValid || !isEmailValid || emailExists || password !== confirmPassword}
                                className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-all ${isLoading || !isPasswordValid || !isEmailValid || emailExists || password !== confirmPassword
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-primary text-white hover:bg-primary-hover shadow-lg hover:shadow-xl'
                                    }`}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Creating account...
                                    </>
                                ) : (
                                    'Create Account'
                                )}
                            </button>
                        </div>

                        {/* Login Link */}
                        <p className="text-center text-gray-500 mt-6">
                            Already have an account?{' '}
                            <Link to="/login" className="text-primary hover:text-primary-hover font-medium">
                                Sign in here
                            </Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}
