import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { isAuthenticated, role, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (!allowedRoles.includes(role)) {
        // Redirect to appropriate dashboard based on role
        if (role === 'user') return <Navigate to="/user/dashboard" replace />;
        if (role === 'doctor') return <Navigate to="/doctor/dashboard" replace />;
        if (role === 'admin') return <Navigate to="/admin/dashboard" replace />;
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}
