import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User, Menu, X } from 'lucide-react';
import { useState } from 'react';

export function Navbar() {
    const { isAuthenticated, role, logout, user } = useAuth();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getDashboardLink = () => {
        if (role === 'user') return '/user/dashboard';
        if (role === 'doctor') return '/doctor/dashboard';
        if (role === 'admin') return '/admin/dashboard';
        return '/';
    };

    return (
        <nav className="bg-dark-800/80 backdrop-blur-xl border-b border-dark-700/50 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link to={isAuthenticated ? getDashboardLink() : '/'} className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                            <span className="text-white font-bold text-xl">H</span>
                        </div>
                        <span className="text-xl font-bold text-gradient">HealthMate</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-6">
                        {!isAuthenticated ? (
                            <>
                                <Link to="/doctors" className="text-dark-300 hover:text-dark-100 transition-colors">
                                    Doctors
                                </Link>
                                <Link to="/login" className="btn-primary text-sm">
                                    Login / Register
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link to={getDashboardLink()} className="text-dark-300 hover:text-dark-100 transition-colors">
                                    Dashboard
                                </Link>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 text-dark-300">
                                        <User size={18} />
                                        <span className="text-sm">{user?.name || role}</span>
                                    </div>
                                    <button onClick={handleLogout} className="btn-secondary text-sm flex items-center gap-2">
                                        <LogOut size={16} />
                                        Logout
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden p-2 text-dark-300 hover:text-dark-100"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden py-4 border-t border-dark-700/50">
                        {!isAuthenticated ? (
                            <div className="flex flex-col gap-3">
                                <Link
                                    to="/doctors"
                                    className="text-dark-300 hover:text-dark-100 py-2"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    Doctors
                                </Link>
                                <Link
                                    to="/login"
                                    className="btn-primary text-center"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    Login / Register
                                </Link>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <Link
                                    to={getDashboardLink()}
                                    className="text-dark-300 hover:text-dark-100 py-2"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    Dashboard
                                </Link>
                                <button
                                    onClick={() => {
                                        handleLogout();
                                        setMobileMenuOpen(false);
                                    }}
                                    className="btn-secondary flex items-center justify-center gap-2"
                                >
                                    <LogOut size={16} />
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </nav>
    );
}
