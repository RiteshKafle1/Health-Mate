import { NavLink } from 'react-router-dom';
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
    const { role } = useAuth();

    const getNavItems = (): NavItem[] => {
        if (role === 'user') return userNavItems;
        if (role === 'doctor') return doctorNavItems;
        if (role === 'admin') return adminNavItems;
        return [];
    };

    const navItems = getNavItems();

    return (
        <>
            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-dark-800/95 backdrop-blur-xl 
          border-r border-dark-700/50 z-50 transform transition-transform duration-300
          md:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
            >
                {/* Mobile close button */}
                <button
                    className="md:hidden absolute top-4 right-4 p-2 text-dark-400 hover:text-dark-100"
                    onClick={onClose}
                >
                    <X size={20} />
                </button>

                {/* Navigation */}
                <nav className="p-4 mt-4 md:mt-0">
                    <div className="space-y-1">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={onClose}
                                className={({ isActive }) =>
                                    isActive ? 'sidebar-link-active' : 'sidebar-link'
                                }
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                    </div>
                </nav>

                {/* Role badge */}
                <div className="absolute bottom-4 left-4 right-4">
                    <div className="glass-card p-3 text-center">
                        <span className="text-xs text-dark-400 uppercase tracking-wider">
                            Logged in as
                        </span>
                        <p className="text-sm font-medium text-primary-400 capitalize mt-1">
                            {role}
                        </p>
                    </div>
                </div>
            </aside>
        </>
    );
}
