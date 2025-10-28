import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
interface User {
    id: number;
    username: string;
    email: string;
    fname: string;
    lname: string;
}

interface School {
    id: number;
    name: string;
    location?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    school: School | null;
    role: 'teacher' | 'principal' | null;
    isLoading: boolean;
    login: (token: string, userData: User) => void;
    logout: () => void;
    setSchoolAndRole: (school: School, role: 'teacher' | 'principal') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [school, setSchool] = useState<School | null>(null);
    const [role, setRole] = useState<'teacher' | 'principal' | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Hydrate auth state from AsyncStorage on app start
    useEffect(() => {
        const bootstrap = async () => {
            try {
                const [storedToken, storedUser] = await Promise.all([
                    AsyncStorage.getItem('access_token'),
                    AsyncStorage.getItem('user_profile'),
                ]);
                if (storedToken) setToken(storedToken);
                if (storedUser) {
                    try {
                        setUser(JSON.parse(storedUser));
                    } catch {
                        // ignore corrupt JSON
                    }
                }
            } finally {
                setIsLoading(false);
            }
        };
        bootstrap();
    }, []);

    // SIMPLIFIED: Keep AsyncStorage in sync for persistence
    const login = (authToken: string, userData: User) => {
        console.log('🔐 Logging in user:', userData.username);
        setToken(authToken);
        setUser(userData);
        // Persist in background (no await needed)
        AsyncStorage.setItem('access_token', authToken).catch(() => { });
        AsyncStorage.setItem('user_profile', JSON.stringify(userData)).catch(() => { });
    };

    const setSchoolAndRole = (schoolData: School, userRole: 'teacher' | 'principal') => {
        console.log('🏫 Setting school and role:', schoolData.name, userRole);
        setSchool(schoolData);
        setRole(userRole);
    };

    const logout = () => {
        console.log('👋 Logging out user');
        setUser(null);
        setToken(null);
        setSchool(null);
        setRole(null);
        // Clear persisted data
        AsyncStorage.multiRemove(['access_token', 'encrypted_user_data', 'user_profile']).catch(() => { });
    };

    const value: AuthContextType = {
        user,
        token,
        school,
        role,
        isLoading,
        login,
        logout,
        setSchoolAndRole,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
