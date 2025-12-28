import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    LayoutDashboard,
    Calendar,
    User,
    Users,
    UserPlus,
    X,
    MessageCircle,
    Pill,
    LogOut,
    Activity
} from 'lucide-react';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

interface NavItem {
    label: string;
    path: string;
    icon: React.ReactNode;
}

const userNavItems: NavItem[] = [
    { label: 'Dashboard', path: '/user/dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'Find Doctors', path: '/user/doctors', icon: <Users size={20} /> },
    { label: 'My Appointments', path: '/user/appointments', icon: <Calendar size={20} /> },
    { label: 'Medications', path: '/user/medications', icon: <Pill size={20} /> },
    { label: 'HealthMate', path: '/user/chatbot', icon: <MessageCircle size={20} /> },
    { label: 'Profile', path: '/user/profile', icon: <User size={20} /> },
];

const doctorNavItems: NavItem[] = [
    { label: 'Dashboard', path: '/doctor/dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'Appointments', path: '/doctor/appointments', icon: <Calendar size={20} /> },
    { label: 'HealthMate', path: '/doctor/chatbot', icon: <MessageCircle size={20} /> },
    { label: 'Profile', path: '/doctor/profile', icon: <User size={20} /> },
];

const adminNavItems: NavItem[] = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={20} /> },
    { label: 'Add Doctor', path: '/admin/add-doctor', icon: <UserPlus size={20} /> },
    { label: 'All Doctors', path: '/admin/doctors', icon: <Users size={20} /> },
    { label: 'Appointments', path: '/admin/appointments', icon: <Calendar size={20} /> },
    { label: 'HealthMate', path: '/admin/chatbot', icon: <MessageCircle size={20} /> },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
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
                fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-surface/50 shadow-soft transform transition-transform duration-300 md:translate-x-0
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
        >
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="h-16 flex items-center px-6 border-b border-surface/50">
                    <div className="flex items-center gap-2 text-primary">
                        <Activity className="h-6 w-6" />
                        <span className="text-xl font-bold tracking-tight text-text">HealthMate</span>
                    </div>
                    <button
                        className="ml-auto md:hidden text-text-muted hover:text-text"
                        onClick={onClose}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Nav Items */}
                <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                    <p className="px-2 text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
                        Menu
                    </p>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={onClose}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                                ${isActive
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-text-muted hover:bg-surface/50 hover:text-text'
                                }`
                            }
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-surface/50">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-error hover:bg-error/5 rounded-lg transition-colors"
                    >
                        <LogOut size={20} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>
        </aside>
    );
}
