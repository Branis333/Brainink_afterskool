import React, { createContext, useContext, useState } from 'react';

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
    const [isLoading, setIsLoading] = useState(false); // Set to false to avoid loading state

    // SIMPLIFIED: No SecureStore operations to avoid native crashes
    const login = (authToken: string, userData: User) => {
        console.log('🔐 Logging in user:', userData.username);
        setToken(authToken);
        setUser(userData);
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
