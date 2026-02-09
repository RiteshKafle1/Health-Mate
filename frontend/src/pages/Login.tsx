import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginUser } from '../api/user';
import { loginDoctor } from '../api/doctor';
import { loginAdmin } from '../api/admin';
import { Navbar } from '../components/layout/Navbar';
import { Mail, Lock, User, Stethoscope, Shield, Loader2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

type LoginRole = 'user' | 'doctor' | 'admin';

interface LoginResponse {
    success: boolean;
    message?: string;
    token?: string;
}

export function Login() {
    const [role, setRole] = useState<LoginRole>('user');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            toast.error('Please fill in all fields');
            return;
        }

        setIsLoading(true);

        try {
            let response: LoginResponse;

            if (role === 'user') {
                response = await loginUser({ email, password }) as LoginResponse;
            } else if (role === 'doctor') {
                response = await loginDoctor({ email, password }) as LoginResponse;
            } else {
                response = await loginAdmin({ email, password }) as LoginResponse;
            }

            if (response.success && response.token) {
                login(response.token, role);
                toast.success('Login successful!');

                // Redirect based on role
                if (role === 'user') navigate('/user/dashboard');
                else if (role === 'doctor') navigate('/doctor/dashboard');
                else navigate('/admin/dashboard');
            } else {
                toast.error(response.message || 'Login failed');
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.detail?.message ||
                error.response?.data?.message ||
                error.message ||
                'Login failed';
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const roleOptions = [
        { id: 'user', label: 'Patient', icon: <User size={20} />, color: 'from-blue-500 to-cyan-500' },
        { id: 'doctor', label: 'Doctor', icon: <Stethoscope size={20} />, color: 'from-emerald-500 to-teal-500' },
        { id: 'admin', label: 'Admin', icon: <Shield size={20} />, color: 'from-purple-500 to-pink-500' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            <Navbar />

            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12">
                <div className="w-full max-w-md">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
                        <p className="text-gray-600">Sign in to your account to continue</p>
                    </div>

                    {/* Role Selector */}
                    <div className="grid grid-cols-3 gap-3 mb-8">
                        {roleOptions.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => setRole(option.id as LoginRole)}
                                className={`
                                    p-4 rounded-xl border-2 transition-all duration-300 flex flex-col items-center gap-2
                                    ${role === option.id
                                        ? `bg-gradient-to-br ${option.color} border-transparent text-white shadow-lg`
                                        : 'bg-white/70 border-gray-200 text-gray-600 hover:border-gray-300'
                                    }
                                `}
                            >
                                {option.icon}
                                <span className="text-sm font-medium">{option.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="glass-card p-8">
                        <div className="space-y-5">
                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                                        placeholder="Enter your email"
                                        autoComplete="email"
                                    />
                                </div>
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
                                        className="w-full pl-12 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-all ${isLoading
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-primary text-white hover:bg-primary-hover shadow-lg hover:shadow-xl'
                                    }`}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </button>
                        </div>

                        {/* Register Link (for users only) */}
                        {role === 'user' && (
                            <p className="text-center text-gray-500 mt-6">
                                Don't have an account?{' '}
                                <Link to="/register" className="text-primary hover:text-primary-hover font-medium">
                                    Register here
                                </Link>
                            </p>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
}
