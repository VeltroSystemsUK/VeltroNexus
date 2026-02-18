import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'ADMIN' | 'EMPLOYER' | 'GUEST';

interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    orgName?: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (type: 'admin' | 'employer', email?: string, password?: string) => boolean;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const FAKE_ADMIN_USER: User = {
    id: 'adm_001',
    name: 'Shaun',
    email: 'pagenti@admin.com',
    role: 'ADMIN',
    orgName: 'Pagenti HQ'
};

const FAKE_EMPLOYER_USER: User = {
    id: 'emp_001',
    name: 'Sarah Connor',
    email: 'client@cyberdyne.com',
    role: 'EMPLOYER',
    orgName: 'Cyberdyne Systems'
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        try {
            const saved = localStorage.getItem('pagenti_auth_user');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to parse saved auth user:', error);
            localStorage.removeItem('pagenti_auth_user');
            return null;
        }
    });

    const login = (type: 'admin' | 'employer', email?: string, password?: string): boolean => {
        // Enforce Credentials for Admin
        if (type === 'admin') {
            // Check for specific admin credentials
            // In a real app this would be a backend call
            if (email === 'pagenti@admin.com' && password === 'admin123') {
                const newUser = FAKE_ADMIN_USER;
                setUser(newUser);
                localStorage.setItem('pagenti_auth_user', JSON.stringify(newUser));
                return true;
            } else {
                return false; // Invalid credentials
            }
        }

        // Permissive for Employers (Demo Mode)
        // Ensure they at least typed something valid-ish? No, keep it simple for demo
        else {
            const newUser = { ...FAKE_EMPLOYER_USER, email: email || FAKE_EMPLOYER_USER.email };
            setUser(newUser);
            localStorage.setItem('pagenti_auth_user', JSON.stringify(newUser));
            return true;
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('pagenti_auth_user');
        // Clear any temporary dashboard filters/state if implemented
        window.location.href = '/';
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            login,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
