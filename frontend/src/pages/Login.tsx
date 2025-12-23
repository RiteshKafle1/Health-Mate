import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginUser } from '../api/user';
import { loginDoctor } from '../api/doctor';
import { loginAdmin } from '../api/admin';
import { Navbar } from '../components/layout/Navbar';
import { Mail, Lock, User, Stethoscope, Shield, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type LoginRole = 'user' | 'doctor' | 'admin';

export function Login() {
    const [role, setRole] = useState<LoginRole>('user');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
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
            let response;

            if (role === 'user') {
                response = await loginUser({ email, password });
            } else if (role === 'doctor') {
                response = await loginDoctor({ email, password });
            } else {
                response = await loginAdmin({ email, password });
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
            const message = error.response?.data?.detail?.message || error.message || 'Login failed';
            toast.error(message);
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
        <div className="min-h-screen bg-gradient-dark">
            <Navbar />

            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12">
                <div className="w-full max-w-md">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-dark-50 mb-2">Welcome Back</h1>
                        <p className="text-dark-400">Sign in to your account to continue</p>
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
                                        : 'bg-dark-800/50 border-dark-600 text-dark-300 hover:border-dark-500'
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
                                <label className="input-label">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="input-field pl-12"
                                        placeholder="Enter your email"
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="input-label">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="input-field pl-12"
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="btn-primary w-full flex items-center justify-center gap-2"
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
                            <p className="text-center text-dark-400 mt-6">
                                Don't have an account?{' '}
                                <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium">
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
