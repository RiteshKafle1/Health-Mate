import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    LayoutDashboard,
    Calendar,
    User,
    Users,
    UserPlus,
    MessageCircle,
    Pill,
    LogOut,
    Activity,
    TrendingUp,
    ChevronLeft,
    ChevronRight,
    Settings
} from 'lucide-react';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

interface NavItem {
    label: string;
    path: string;
    icon: React.ReactNode;
}

const userNavItems: NavItem[] = [
    { label: 'Dashboard', path: '/user/dashboard', icon: <LayoutDashboard size={22} /> },
    { label: 'Find Doctors', path: '/user/doctors', icon: <Users size={22} /> },
    { label: 'Appointments', path: '/user/appointments', icon: <Calendar size={22} /> },
    { label: 'Medications', path: '/user/medications', icon: <Pill size={22} /> },
    { label: 'Analytics', path: '/user/analytics', icon: <TrendingUp size={22} /> },
    { label: 'HealthMate', path: '/user/chatbot', icon: <MessageCircle size={22} /> },
    { label: 'Profile', path: '/user/profile', icon: <User size={22} /> },
];

const doctorNavItems: NavItem[] = [
    { label: 'Dashboard', path: '/doctor/dashboard', icon: <LayoutDashboard size={22} /> },
    { label: 'Appointments', path: '/doctor/appointments', icon: <Calendar size={22} /> },
    { label: 'HealthMate', path: '/doctor/chatbot', icon: <MessageCircle size={22} /> },
    { label: 'Profile', path: '/doctor/profile', icon: <User size={22} /> },
];

const adminNavItems: NavItem[] = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={22} /> },
    { label: 'Add Doctor', path: '/admin/add-doctor', icon: <UserPlus size={22} /> },
    { label: 'All Doctors', path: '/admin/doctors', icon: <Users size={22} /> },
    { label: 'Appointments', path: '/admin/appointments', icon: <Calendar size={22} /> },
    { label: 'HealthMate', path: '/admin/chatbot', icon: <MessageCircle size={22} /> },
];

export function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }: SidebarProps) {
    const { role, logout } = useAuth();
    const navigate = useNavigate();

    const getNavItems = (): NavItem[] => {
        if (role === 'user') return userNavItems;
        if (role === 'doctor') return doctorNavItems;
        if (role === 'admin') return adminNavItems;
        return [];
    };

    const navItems = getNavItems();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside
            className={`
                fixed inset-y-0 left-0 z-50 bg-[#A9B5DF]/10 border-r border-[#A9B5DF]/20 shadow-sm transform transition-all duration-300 ease-in-out backdrop-blur-xl
                ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                ${isCollapsed ? 'w-20' : 'w-72'}
            `}
        >
            <div className="h-full flex flex-col justify-between py-6">
                {/* Header */}
                <div className={`flex items-center px-6 mb-8 transition-all duration-300 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                    {!isCollapsed && (
                        <div className="flex items-center gap-3 animate-fade-in">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <Activity className="h-6 w-6 text-primary" />
                            </div>
                            <span className="text-xl font-bold tracking-tight text-text">HealthMate</span>
                        </div>
                    )}
                    {isCollapsed && (
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Activity className="h-6 w-6 text-primary" />
                        </div>
                    )}

                    <button
                        onClick={onToggleCollapse}
                        className="hidden md:flex p-1.5 rounded-lg text-text-muted hover:bg-surface/50 hover:text-text transition-colors"
                        title={isCollapsed ? "Expand" : "Collapse"}
                    >
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </button>

                    {/* Mobile Close */}
                    <button
                        onClick={onClose}
                        className="md:hidden p-1 text-text-muted"
                    >
                        <ChevronLeft size={24} />
                    </button>
                </div>

                {/* Nav Items */}
                <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => window.innerWidth < 768 && onClose()}
                            className={({ isActive }) =>
                                `group flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative
                                ${isActive
                                    ? 'bg-white text-primary shadow-sm ring-1 ring-slate-100'
                                    : 'text-text-muted hover:text-text hover:bg-white/60'
                                }
                                ${isCollapsed ? 'justify-center' : ''}
                                `
                            }
                            title={isCollapsed ? item.label : undefined}
                        >
                            <span className={`transition-colors duration-200 ${isCollapsed ? '' : ''}`}>
                                {item.icon}
                            </span>

                            {!isCollapsed && (
                                <span className="animate-fade-in truncate">{item.label}</span>
                            )}

                            {/* Tooltip for collapsed state */}
                            {isCollapsed && (
                                <div className="absolute left-full ml-4 px-3 py-1.5 bg-text text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-xl">
                                    {item.label}
                                </div>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="px-4 pt-6 border-t border-slate-100/50">
                    <button
                        className={`flex items-center gap-3 w-full px-3 py-3 text-sm font-medium text-text-muted hover:text-text hover:bg-white/60 rounded-xl transition-all duration-200 ${isCollapsed ? 'justify-center' : ''}`}
                    >
                        <Settings size={22} />
                        {!isCollapsed && <span>Settings</span>}
                    </button>
                    <button
                        onClick={handleLogout}
                        className={`flex items-center gap-3 w-full px-3 py-3 mt-2 text-sm font-medium text-error hover:bg-error/5 rounded-xl transition-all duration-200 ${isCollapsed ? 'justify-center' : ''}`}
                        title={isCollapsed ? "Sign Out" : undefined}
                    >
                        <LogOut size={22} />
                        {!isCollapsed && <span>Sign Out</span>}
                    </button>
                </div>
            </div>
        </aside>
    );
}
