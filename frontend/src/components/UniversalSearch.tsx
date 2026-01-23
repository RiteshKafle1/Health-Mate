import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Search, X, Command, ArrowRight,
    Pill, Calendar, Activity, FileText, MessageCircle,
    User, Stethoscope, LayoutDashboard, Plus, Upload
} from 'lucide-react';

interface SearchItem {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    path: string;
    category: 'navigation' | 'action';
}

interface UniversalSearchProps {
    onClose?: () => void;
}

export function UniversalSearch({ onClose }: UniversalSearchProps) {
    const [isOpen, setIsOpen] = useState(true);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const { role } = useAuth();

    // Define searchable items based on user role
    const searchItems: SearchItem[] = role === 'user' ? [
        // Navigation Pages
        { id: 'dashboard', title: 'Dashboard', description: 'Overview of your health', icon: <LayoutDashboard size={18} />, path: '/user/dashboard', category: 'navigation' },
        { id: 'medications', title: 'Medications', description: 'Manage your medications', icon: <Pill size={18} />, path: '/user/medications', category: 'navigation' },
        { id: 'appointments', title: 'Appointments', description: 'View your appointments', icon: <Calendar size={18} />, path: '/user/appointments', category: 'navigation' },
        { id: 'analytics', title: 'Health Insights', description: 'Adherence analytics & trends', icon: <Activity size={18} />, path: '/user/analytics', category: 'navigation' },
        { id: 'reports', title: 'Lab Reports', description: 'Upload and view reports', icon: <FileText size={18} />, path: '/user/reports', category: 'navigation' },
        { id: 'chatbot', title: 'HealthMate Clinician', description: 'AI-powered health assistant', icon: <MessageCircle size={18} />, path: '/user/chatbot', category: 'navigation' },
        { id: 'doctors', title: 'Find Doctors', description: 'Browse specialists', icon: <Stethoscope size={18} />, path: '/user/doctors', category: 'navigation' },
        { id: 'profile', title: 'Profile', description: 'Your profile settings', icon: <User size={18} />, path: '/user/profile', category: 'navigation' },
        // Quick Actions
        { id: 'add-medication', title: 'Add Medication', description: 'Add a new medication', icon: <Plus size={18} />, path: '/user/medications?action=add', category: 'action' },
        { id: 'book-appointment', title: 'Book Appointment', description: 'Schedule with a doctor', icon: <Calendar size={18} />, path: '/user/doctors', category: 'action' },
        { id: 'upload-report', title: 'Upload Report', description: 'Upload a lab report', icon: <Upload size={18} />, path: '/user/reports?action=upload', category: 'action' },
    ] : role === 'doctor' ? [
        { id: 'dashboard', title: 'Dashboard', description: 'Your overview', icon: <LayoutDashboard size={18} />, path: '/doctor/dashboard', category: 'navigation' },
        { id: 'appointments', title: 'Appointments', description: 'Patient appointments', icon: <Calendar size={18} />, path: '/doctor/appointments', category: 'navigation' },
        { id: 'patient-reports', title: 'Patient Reports', description: 'View patient reports', icon: <FileText size={18} />, path: '/doctor/patient-reports', category: 'navigation' },
        { id: 'availability', title: 'Availability', description: 'Set your schedule', icon: <Calendar size={18} />, path: '/doctor/availability', category: 'navigation' },
        { id: 'profile', title: 'Profile', description: 'Your profile settings', icon: <User size={18} />, path: '/doctor/profile', category: 'navigation' },
    ] : [
        { id: 'dashboard', title: 'Dashboard', description: 'Admin overview', icon: <LayoutDashboard size={18} />, path: '/admin/dashboard', category: 'navigation' },
        { id: 'doctors', title: 'All Doctors', description: 'Manage doctors', icon: <Stethoscope size={18} />, path: '/admin/doctors', category: 'navigation' },
        { id: 'patients', title: 'All Patients', description: 'Manage patients', icon: <User size={18} />, path: '/admin/patients', category: 'navigation' },
        { id: 'appointments', title: 'Appointments', description: 'All appointments', icon: <Calendar size={18} />, path: '/admin/appointments', category: 'navigation' },
    ];

    // Filter items based on query
    const filteredItems = query.trim()
        ? searchItems.filter(item =>
            item.title.toLowerCase().includes(query.toLowerCase()) ||
            item.description.toLowerCase().includes(query.toLowerCase())
        )
        : searchItems;

    // Group by category
    const navigationItems = filteredItems.filter(i => i.category === 'navigation');
    const actionItems = filteredItems.filter(i => i.category === 'action');

    const closeModal = useCallback(() => {
        setIsOpen(false);
        onClose?.();
    }, [onClose]);

    // Keyboard shortcut handler
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Open with Cmd/Ctrl + K
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            setIsOpen(prev => !prev);
        }
        // Close with Escape
        if (e.key === 'Escape') {
            closeModal();
        }
    }, [closeModal]);

    // Selection keyboard navigation
    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
            e.preventDefault();
            handleSelect(filteredItems[selectedIndex]);
        }
    };

    const handleSelect = (item: SearchItem) => {
        navigate(item.path);
        closeModal();
        setQuery('');
        setSelectedIndex(0);
    };

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={closeModal}
            />

            {/* Modal */}
            <div className="relative w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl border border-surface/20 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
                {/* Search Input */}
                <div className="flex items-center gap-3 p-4 border-b border-surface/20">
                    <Search size={20} className="text-text-muted flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        placeholder="Search pages, actions, or type a command..."
                        className="flex-1 bg-transparent text-text placeholder:text-text-muted outline-none text-base"
                    />
                    <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 bg-surface/30 rounded-lg text-xs text-text-muted font-medium">
                        <span>ESC</span>
                    </kbd>
                    <button
                        onClick={closeModal}
                        className="p-1 text-text-muted hover:text-text transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Results */}
                <div className="max-h-[50vh] overflow-y-auto p-2">
                    {/* Navigation Section */}
                    {navigationItems.length > 0 && (
                        <div className="mb-2">
                            <p className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
                                Pages
                            </p>
                            {navigationItems.map((item) => {
                                const globalIdx = filteredItems.indexOf(item);
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleSelect(item)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${selectedIndex === globalIdx
                                            ? 'bg-primary/10 text-primary'
                                            : 'hover:bg-surface/30 text-text'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-lg ${selectedIndex === globalIdx ? 'bg-primary/20' : 'bg-surface/30'}`}>
                                            {item.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{item.title}</p>
                                            <p className="text-sm text-text-muted truncate">{item.description}</p>
                                        </div>
                                        <ArrowRight size={16} className={selectedIndex === globalIdx ? 'opacity-100' : 'opacity-0'} />
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Quick Actions Section */}
                    {actionItems.length > 0 && (
                        <div>
                            <p className="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
                                Quick Actions
                            </p>
                            {actionItems.map((item) => {
                                const globalIdx = filteredItems.indexOf(item);
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleSelect(item)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${selectedIndex === globalIdx
                                            ? 'bg-primary/10 text-primary'
                                            : 'hover:bg-surface/30 text-text'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-lg ${selectedIndex === globalIdx ? 'bg-primary/20' : 'bg-surface/30'}`}>
                                            {item.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{item.title}</p>
                                            <p className="text-sm text-text-muted truncate">{item.description}</p>
                                        </div>
                                        <ArrowRight size={16} className={selectedIndex === globalIdx ? 'opacity-100' : 'opacity-0'} />
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Empty State */}
                    {filteredItems.length === 0 && (
                        <div className="py-8 text-center">
                            <Search size={32} className="mx-auto text-text-muted/50 mb-2" />
                            <p className="text-text-muted">No results found for "{query}"</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-3 bg-surface/10 border-t border-surface/20 text-xs text-text-muted">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-surface/30 rounded">↑</kbd>
                            <kbd className="px-1.5 py-0.5 bg-surface/30 rounded">↓</kbd>
                            <span>Navigate</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-surface/30 rounded">↵</kbd>
                            <span>Select</span>
                        </span>
                    </div>
                    <span className="hidden sm:flex items-center gap-1">
                        <Command size={12} />
                        <span>K to toggle</span>
                    </span>
                </div>
            </div>
        </div>
    );
}
