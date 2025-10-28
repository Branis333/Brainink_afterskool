/**
 * Notifications Service for React Native (Frontend)
 * Wraps all After-School notifications endpoints.
 *
 * Endpoints covered:
 * - GET    /after-school/notifications/preferences
 * - PUT    /after-school/notifications/preferences
 * - GET    /after-school/notifications
 * - GET    /after-school/notifications/
 * - GET    /after-school/notifications/stats
 * - PUT    /after-school/notifications/{id}/read
 * - PUT    /after-school/notifications/{id}/dismiss
 * - POST   /after-school/notifications/mark-all-as-read
 */

// Get the correct backend URL based on environment
const getBackendUrl = () => {
    // In React Native, we'll always use the production backend
    return 'https://brainink-backend.onrender.com';
};

// ===============================
// TYPESCRIPT INTERFACES
// ===============================

export type NotificationType = 'due_date' | 'daily_encouragement' | 'completion';

export interface NotificationPreference {
    id: number;
    user_id: number;
    due_date_notifications: boolean;
    daily_encouragement: boolean;
    completion_notifications: boolean;
    push_notifications_enabled: boolean;
    push_token?: string | null;
    due_date_days_before: number; // 0..7
    daily_encouragement_time: string; // "HH:MM"
    created_at: string;
    updated_at: string;
}

export interface NotificationItem {
    id: number;
    user_id: number;
    type: NotificationType;
    title: string;
    body: string;
    course_id?: number | null;
    assignment_id?: number | null;
    block_id?: number | null;
    status: 'created' | 'scheduled' | 'sent' | 'failed' | 'dismissed' | 'read' | string;
    is_read: boolean;
    read_at?: string | null;
    dismissed_at?: string | null;
    created_at: string;
}

export interface NotificationStats {
    total_unread: number;
    due_date_unread: number;
    daily_encouragement_unread: number;
    completion_unread: number;
    total_dismissed: number;
}

export interface NotificationFilters {
    notification_type?: NotificationType;
    is_read?: boolean;
    limit?: number; // default 50, max 200
    skip?: number; // default 0
}

export interface MessageResponse {
    message: string;
}

// ===============================
// SERVICE IMPLEMENTATION
// ===============================

class NotificationsService {
    private async makeAuthenticatedRequest(
        endpoint: string,
        token: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
        body?: any
    ): Promise<Response> {
        if (!token) {
            console.error('❌ No token provided for authenticated request');
            throw new Error('Authentication token is required');
        }

        const headers: HeadersInit = {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        const config: RequestInit = { method, headers };

        if (body && (method === 'POST' || method === 'PUT')) {
            config.body = JSON.stringify(body);
        }

        const url = `${getBackendUrl()}${endpoint}`;
        console.log(`📡 Making ${method} request to: ${url}`);
        const response = await fetch(url, config);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage =
                errorData.detail || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
            console.error('API Error:', {
                endpoint,
                method,
                status: response.status,
                statusText: response.statusText,
                errorData,
                requestBody: body ?? null,
                token: token ? `${token.substring(0, 20)}...` : 'NO_TOKEN',
            });
            throw new Error(`[${method} ${endpoint}] ${errorMessage}`);
        }

        return response;
    }

    // ===============================
    // PREFERENCES
    // ===============================

    async getPreferences(token: string): Promise<NotificationPreference> {
        const res = await this.makeAuthenticatedRequest(
            '/after-school/notifications/preferences',
            token,
            'GET'
        );
        return res.json();
    }

    async updatePreferences(
        token: string,
        prefs: Partial<{
            due_date_notifications: boolean;
            daily_encouragement: boolean;
            completion_notifications: boolean;
            push_notifications_enabled: boolean;
            push_token: string | null;
            due_date_days_before: number; // 0..7
            daily_encouragement_time: string; // "HH:MM"
        }>
    ): Promise<NotificationPreference> {
        const res = await this.makeAuthenticatedRequest(
            '/after-school/notifications/preferences',
            token,
            'PUT',
            prefs
        );
        return res.json();
    }

    // ===============================
    // LIST + STATS
    // ===============================

    private buildQuery(params: Record<string, any>): string {
        const usp = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v === undefined || v === null || v === '') return;
            usp.append(k, String(v));
        });
        const s = usp.toString();
        return s ? `?${s}` : '';
    }

    async listNotifications(
        token: string,
        filters: NotificationFilters = {}
    ): Promise<NotificationItem[]> {
        const query = this.buildQuery({
            notification_type: filters.notification_type,
            is_read: filters.is_read,
            limit: filters.limit ?? 50,
            skip: filters.skip ?? 0,
        });
        const res = await this.makeAuthenticatedRequest(
            `/after-school/notifications/${query}`,
            token,
            'GET'
        );
        return res.json();
    }

    async getStats(token: string): Promise<NotificationStats> {
        const res = await this.makeAuthenticatedRequest(
            '/after-school/notifications/stats',
            token,
            'GET'
        );
        return res.json();
    }

    // ===============================
    // INTERACTION: READ/DISMISS
    // ===============================

    async markAsRead(token: string, notificationId: number): Promise<MessageResponse> {
        const res = await this.makeAuthenticatedRequest(
            `/after-school/notifications/${notificationId}/read`,
            token,
            'PUT'
        );
        return res.json();
    }

    async dismiss(token: string, notificationId: number): Promise<MessageResponse> {
        const res = await this.makeAuthenticatedRequest(
            `/after-school/notifications/${notificationId}/dismiss`,
            token,
            'PUT'
        );
        return res.json();
    }

    async markAllAsRead(token: string): Promise<MessageResponse> {
        const res = await this.makeAuthenticatedRequest(
            '/after-school/notifications/mark-all-as-read',
            token,
            'POST'
        );
        return res.json();
    }

    // ===============================
    // HELPERS (optional UX)
    // ===============================

    formatTypeLabel(type: NotificationType): string {
        switch (type) {
            case 'due_date':
                return 'Due Date';
            case 'daily_encouragement':
                return 'Daily Encouragement';
            case 'completion':
                return 'Completion';
            default:
                return type;
        }
    }

    typeEmoji(type: NotificationType): string {
        switch (type) {
            case 'due_date':
                return '⏰';
            case 'daily_encouragement':
                return '🌟';
            case 'completion':
                return '🏁';
            default:
                return '🔔';
        }
    }

    isUnread(n: NotificationItem): boolean {
        return !n.is_read && !n.dismissed_at;
    }
}

const notificationsService = new NotificationsService();
export default notificationsService;
