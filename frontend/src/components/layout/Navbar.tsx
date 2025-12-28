import { useAuth } from '../../context/AuthContext';
import { User, Menu, Bell } from 'lucide-react';

interface NavbarProps {
    onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
    const { isAuthenticated, role, user } = useAuth();

    return (
        <nav className="h-16 bg-white/80 backdrop-blur-md border-b border-surface/50 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 transition-all duration-300">
            <div className="flex items-center gap-4">
                <button
                    onClick={onMenuClick}
                    className="md:hidden text-text-muted hover:text-primary transition-colors"
                >
                    <Menu size={24} />
                </button>

                {/* Breadcrumb or Page Title Placeholder */}
                <h2 className="text-lg font-semibold text-text hidden md:block capitalize">
                    {location.pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard'}
                </h2>
            </div>

            <div className="flex items-center gap-4">
                {isAuthenticated && (
                    <>
                        <button className="relative text-text-muted hover:text-primary transition-colors">
                            <Bell size={20} />
                            <span className="absolute top-0 right-0 w-2 h-2 bg-error rounded-full ring-2 ring-white"></span>
                        </button>

                        <div className="h-8 w-px bg-surface/50 mx-2 hidden md:block"></div>

                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium text-text">{user?.name || 'User'}</p>
                                <p className="text-xs text-text-muted capitalize">{role}</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold ring-2 ring-white shadow-sm">
                                {user?.name?.[0]?.toUpperCase() || <User size={20} />}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </nav>
    );
}
