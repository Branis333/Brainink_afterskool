/**
 * Profile Service
 * Handles user profile management, authentication, and account operations
 * Integrates with the backend auth endpoints
 */

// Base configuration
const API_BASE_URL = 'https://brainink-backend.onrender.com';

export interface User {
    id: number;
    username: string;
    email: string;
    fname?: string;
    lname?: string;
    is_active: boolean;
    email_confirmed: boolean;
    is_verified: boolean;
    created_at: string;
    last_login?: string;
    updated_at: string;
}

export interface UpdateProfileRequest {
    fname?: string;
    lname?: string;
    email?: string;
    username?: string;
    current_password?: string;
    new_password?: string;
}

export interface PasswordResetRequest {
    email: string;
}

export interface VerifyResetCodeRequest {
    email: string;
    reset_code: string;
}

export interface ResetPasswordRequest {
    email: string;
    reset_code: string;
    new_password: string;
}

class ProfileService {
    private apiUrl: string;

    constructor() {
        this.apiUrl = API_BASE_URL;
    }

    /** Normalize various backend shapes to our User interface */
    private normalizeUser(raw: any): User {
        const email =
            raw?.email ??
            raw?.Email ??
            raw?.email_address ??
            raw?.user_email ??
            '';
        const username = raw?.username ?? raw?.user_name ?? raw?.user ?? '';
        const id = raw?.id ?? raw?.user_id ?? 0;
        const fname = raw?.fname ?? raw?.first_name ?? undefined;
        const lname = raw?.lname ?? raw?.last_name ?? undefined;
        const is_active = raw?.is_active ?? raw?.active ?? true;
        const email_confirmed = raw?.email_confirmed ?? raw?.is_email_verified ?? false;
        const is_verified = raw?.is_verified ?? raw?.verified ?? false;
        const created_at = raw?.created_at ?? raw?.createdAt ?? new Date().toISOString();
        const updated_at = raw?.updated_at ?? raw?.updatedAt ?? new Date().toISOString();
        const last_login = raw?.last_login ?? raw?.lastLogin ?? undefined;

        return {
            id,
            username,
            email,
            fname,
            lname,
            is_active,
            email_confirmed,
            is_verified,
            created_at,
            updated_at,
            last_login,
        };
    }

    /**
     * Make authenticated request to API
     */
    private async makeAuthenticatedRequest(endpoint: string, token: string, options: RequestInit = {}) {
        const url = `${this.apiUrl}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...options.headers,
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
            throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
    }

    /**
     * Get current user profile information
     */
    async getUserProfile(token: string): Promise<User> {
        try {
            console.log('🔍 Fetching user profile...');

            const response = await this.makeAuthenticatedRequest('/me', token);
            const data = await response.json();

            const raw = data?.encrypted_data?.UserInfo ?? data;
            const normalized = this.normalizeUser(raw);
            console.log('✅ User profile fetched successfully');
            return normalized;
        } catch (error) {
            console.error('❌ Error fetching user profile:', error);
            throw error;
        }
    }

    /**
     * Update user profile
     */
    async updateProfile(token: string, profileData: UpdateProfileRequest): Promise<User> {
        try {
            console.log('📝 Updating user profile...');

            const response = await this.makeAuthenticatedRequest('/update-profile', token, {
                method: 'PUT',
                body: JSON.stringify(profileData),
            });

            const data = await response.json();
            const raw = data?.encrypted_data?.UserInfo ?? data;
            const normalized = this.normalizeUser(raw);
            console.log('✅ Profile updated successfully');
            return normalized;
        } catch (error) {
            console.error('❌ Error updating profile:', error);
            throw error;
        }
    }

    /**
     * Delete user account
     */
    async deleteAccount(token: string, password: string): Promise<void> {
        try {
            console.log('🗑️ Deleting user account...');

            await this.makeAuthenticatedRequest(`/delete-account?password=${encodeURIComponent(password)}`, token, {
                method: 'DELETE',
            });

            console.log('✅ Account deleted successfully');
        } catch (error) {
            console.error('❌ Error deleting account:', error);
            throw error;
        }
    }

    /**
     * Request password reset
     */
    async requestPasswordReset(email: string): Promise<void> {
        try {
            console.log('📧 Requesting password reset...');

            const response = await fetch(`${this.apiUrl}/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
                throw new Error(errorData.detail || 'Password reset request failed');
            }

            console.log('✅ Password reset email sent');
        } catch (error) {
            console.error('❌ Error requesting password reset:', error);
            throw error;
        }
    }

    /**
     * Verify reset code
     */
    async verifyResetCode(email: string, resetCode: string): Promise<boolean> {
        try {
            console.log('🔍 Verifying reset code...');

            const response = await fetch(`${this.apiUrl}/verify-reset-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, reset_code: resetCode }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Verification failed' }));
                throw new Error(errorData.detail || 'Reset code verification failed');
            }

            console.log('✅ Reset code verified');
            return true;
        } catch (error) {
            console.error('❌ Error verifying reset code:', error);
            throw error;
        }
    }

    /**
     * Reset password with code
     */
    async resetPassword(email: string, resetCode: string, newPassword: string): Promise<void> {
        try {
            console.log('🔒 Resetting password...');

            const response = await fetch(`${this.apiUrl}/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    reset_code: resetCode,
                    new_password: newPassword,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Reset failed' }));
                throw new Error(errorData.detail || 'Password reset failed');
            }

            console.log('✅ Password reset successfully');
        } catch (error) {
            console.error('❌ Error resetting password:', error);
            throw error;
        }
    }

    /**
     * Resend reset code
     */
    async resendResetCode(email: string): Promise<void> {
        try {
            console.log('📧 Resending reset code...');

            const response = await fetch(`${this.apiUrl}/resend-reset-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Resend failed' }));
                throw new Error(errorData.detail || 'Failed to resend reset code');
            }

            console.log('✅ Reset code resent');
        } catch (error) {
            console.error('❌ Error resending reset code:', error);
            throw error;
        }
    }

    /**
     * Logout (client-side token cleanup)
     */
    async logout(): Promise<void> {
        try {
            console.log('🚪 Logging out...');

            const response = await fetch(`${this.apiUrl}/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            // Logout endpoint doesn't require authentication and always succeeds
            console.log('✅ Logged out successfully');
        } catch (error) {
            console.error('❌ Error during logout:', error);
            // Don't throw error for logout as it should always succeed client-side
        }
    }
}

// Export singleton instance
export const profileService = new ProfileService();