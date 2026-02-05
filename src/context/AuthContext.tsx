import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://brainink-backend.onrender.com';

const STORAGE_KEYS = {
    accessToken: 'access_token',
    refreshToken: 'refresh_token',
    encryptedUserData: 'encrypted_user_data',
    userProfile: 'user_profile',
} as const;

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
    refreshToken: string | null;
    school: School | null;
    role: 'teacher' | 'principal' | null;
    isLoading: boolean;
    login: (
        token: string,
        userData: User,
        session?: { refresh_token?: string; encrypted_data?: any }
    ) => void;
    logout: () => Promise<void>;
    setSchoolAndRole: (school: School, role: 'teacher' | 'principal') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [school, setSchool] = useState<School | null>(null);
    const [role, setRole] = useState<'teacher' | 'principal' | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Hydrate auth state from AsyncStorage on app start
    useEffect(() => {
        const bootstrap = async () => {
            try {
                const [storedToken, storedRefreshToken, storedEncryptedData, storedUser] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEYS.accessToken),
                    AsyncStorage.getItem(STORAGE_KEYS.refreshToken),
                    AsyncStorage.getItem(STORAGE_KEYS.encryptedUserData),
                    AsyncStorage.getItem(STORAGE_KEYS.userProfile),
                ]);
                if (storedToken) setToken(storedToken);
                if (storedRefreshToken) setRefreshToken(storedRefreshToken);

                // Keep encrypted user data around for other screens that may need it later
                if (storedEncryptedData == null) {
                    // nothing
                }

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
    const login = (authToken: string, userData: User, session?: { refresh_token?: string; encrypted_data?: any }) => {
        console.log('🔐 Logging in user:', userData.username);
        setToken(authToken);
        if (session?.refresh_token) {
            setRefreshToken(session.refresh_token);
        }
        setUser(userData);
        // Persist in background (no await needed)
        AsyncStorage.setItem(STORAGE_KEYS.accessToken, authToken).catch(() => { });
        AsyncStorage.setItem(STORAGE_KEYS.userProfile, JSON.stringify(userData)).catch(() => { });
        if (session?.refresh_token) {
            AsyncStorage.setItem(STORAGE_KEYS.refreshToken, session.refresh_token).catch(() => { });
        }

        // Backend returns encrypted payload as `encrypted_data` (we store it under `encrypted_user_data`)
        if (session?.encrypted_data != null) {
            AsyncStorage.setItem(STORAGE_KEYS.encryptedUserData, JSON.stringify(session.encrypted_data)).catch(() => { });
        }
    };

    const setSchoolAndRole = (schoolData: School, userRole: 'teacher' | 'principal') => {
        console.log('🏫 Setting school and role:', schoolData.name, userRole);
        setSchool(schoolData);
        setRole(userRole);
    };

    const logout = async () => {
        console.log('👋 Logging out user');

        // Best-effort server-side logout for mobile (refresh_token is not in cookies)
        try {
            const storedRefresh = refreshToken ?? (await AsyncStorage.getItem(STORAGE_KEYS.refreshToken));
            await fetch(`${API_BASE_URL}/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    client_type: 'app',
                    ...(storedRefresh ? { refresh_token: storedRefresh } : {}),
                }),
            });
        } catch (error) {
            console.warn('Logout request failed (local session cleared anyway):', error);
        }

        setUser(null);
        setToken(null);
        setRefreshToken(null);
        setSchool(null);
        setRole(null);
        // Clear persisted data
        AsyncStorage.multiRemove([
            STORAGE_KEYS.accessToken,
            STORAGE_KEYS.refreshToken,
            STORAGE_KEYS.encryptedUserData,
            STORAGE_KEYS.userProfile,
        ]).catch(() => { });
    };

    const value: AuthContextType = {
        user,
        token,
        refreshToken,
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
