import { useAuth } from '../../context/AuthContext';
import { User, Menu, Cross, Search, Stethoscope, BookOpen } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { NotificationDropdown } from '../NotificationDropdown';

interface NavbarProps {
    onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
    const { isAuthenticated, role, user } = useAuth();
    const location = useLocation();

    // Contextual Page Title Logic
    const getPageTitle = () => {
        const path = location.pathname;
        if (path.includes('/dashboard')) return `Welcome Back, ${user?.name?.split(' ')[0] || 'User'}`;
        if (path.includes('/doctors')) return 'Find Specialists';
        if (path.includes('/appointments')) return 'My Appointments';
        if (path.includes('/medications')) return 'Medication Schedule';
        if (path.includes('/analytics')) return 'Health Insights';
        if (path.includes('/reports')) return role === 'doctor' ? 'Patient Reports' : 'My Lab Reports';
        if (path.includes('/chatbot')) return 'HealthMate Clinician';
        if (path.includes('/profile')) return 'Profile Settings';

        // Fallback to capitalizing URL
        return path.split('/').pop()?.replace('-', ' ')?.replace(/^\w/, c => c.toUpperCase()) || 'Dashboard';
    };

    // Check if current page is the chatbot/clinician page
    const isClinicianPage = location.pathname.includes('/chatbot');

    return (
        <nav className="h-20 bg-[#FFF2F2] border-b border-surface/30 px-6 md:px-10 flex items-center justify-between sticky top-0 z-40 transition-all duration-300 shadow-sm">
            {/* Left: Logo & Toggle (Mobile) & Title */}
            <div className="flex items-center gap-6">
                <button
                    onClick={onMenuClick}
                    className="md:hidden text-text hover:text-primary transition-colors p-1"
                >
                    <Menu size={24} />
                </button>

                {/* Logo - requested to be on left */}
                <div className="hidden md:flex items-center gap-2 text-primary">
                    <div className="p-1.5 bg-white/50 rounded-xl shadow-sm border border-white/60">
                        <Cross className="h-5 w-5" />
                    </div>
                    {/* Optional: Add Text if desired, but minimalism requested */}
                </div>

                {/* Vertical Divider */}
                <div className="h-8 w-px bg-text/10 hidden md:block"></div>

                {/* Contextual Title with Clinician Icons */}
                <div className="flex items-center gap-2">
                    {isClinicianPage && (
                        <div className="flex items-center gap-1 p-1.5 bg-primary/10 rounded-lg">
                            <Stethoscope className="h-4 w-4 text-primary" />
                            <BookOpen className="h-4 w-4 text-primary" />
                        </div>
                    )}
                    <h2 className="text-xl font-bold text-text tracking-tight animate-fade-in">
                        {getPageTitle()}
                    </h2>
                </div>
            </div>

            {/* Center: Optional Search? Keeping it minimal as requested, so skipping. */}

            {/* Right: Actions & Profile */}
            <div className="flex items-center gap-5">
                {isAuthenticated && (
                    <>
                        {/* Quick Actions */}
                        <div className="flex items-center gap-2">
                            <button className="p-2 text-text/60 hover:text-primary hover:bg-white/60 rounded-full transition-all duration-200">
                                <Search size={20} />
                            </button>
                            {/* Notification Dropdown - only for users */}
                            {role === 'user' && <NotificationDropdown />}
                        </div>

                        {/* Divider */}
                        <div className="h-8 w-px bg-text/10 mx-1 hidden sm:block"></div>

                        {/* User Profile */}
                        <div className="flex items-center gap-3 pl-2 group cursor-pointer">
                            {/* Initials Avatar with Premium styling */}
                            <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow-md ring-2 ring-white group-hover:ring-primary/20 transition-all">
                                {user?.name?.[0]?.toUpperCase() || <User size={18} />}
                            </div>

                            <div className="hidden sm:block text-left">
                                <p className="text-sm font-bold text-text leading-tight group-hover:text-primary transition-colors">
                                    {user?.name || 'Guest User'}
                                </p>
                                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                                    {role || 'Patient'}
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </nav>
    );
}
