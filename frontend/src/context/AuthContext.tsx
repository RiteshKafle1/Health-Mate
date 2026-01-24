import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, Doctor, UserRole } from '../types';

interface AuthContextType {
    user: User | Doctor | null;
    token: string | null;
    role: UserRole;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (token: string, role: UserRole, userData?: User | Doctor) => void;
    logout: () => void;
    setUser: (user: User | Doctor) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | Doctor | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [role, setRole] = useState<UserRole>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize auth state from localStorage
    useEffect(() => {
        const storedRole = localStorage.getItem('role') as UserRole;
        let storedToken: string | null = null;

        if (storedRole === 'user') {
            storedToken = localStorage.getItem('token');
        } else if (storedRole === 'doctor') {
            storedToken = localStorage.getItem('dtoken');
        } else if (storedRole === 'admin') {
            storedToken = localStorage.getItem('atoken');
        }

        if (storedToken && storedRole) {
            setToken(storedToken);
            setRole(storedRole);
        }

        setIsLoading(false);
    }, []);

    const login = (newToken: string, newRole: UserRole, userData?: User | Doctor) => {
        setToken(newToken);
        setRole(newRole);
        if (userData) {
            setUser(userData);
        }

        // Store based on role
        localStorage.setItem('role', newRole || '');
        if (newRole === 'user') {
            localStorage.setItem('token', newToken);
        } else if (newRole === 'doctor') {
            localStorage.setItem('dtoken', newToken);
        } else if (newRole === 'admin') {
            localStorage.setItem('atoken', newToken);
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        setRole(null);

        // Clear all tokens
        localStorage.removeItem('token');
        localStorage.removeItem('dtoken');
        localStorage.removeItem('atoken');
        localStorage.removeItem('role');
    };

    const value: AuthContextType = {
        user,
        token,
        role,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
        setUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
