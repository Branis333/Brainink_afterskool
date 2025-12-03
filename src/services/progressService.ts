/**
 * Progress Digest Service (After-School)
 * -------------------------------------
 * Wraps backend endpoints for generating and retrieving AI-digested student progress summaries.
 * Endpoints implemented server-side:
 *  - POST /after-school/progress/weekly/generate
 *  - GET  /after-school/progress/weekly?reference_date=ISO8601
 *  - POST /after-school/progress/course/{course_id}/generate
 *  - GET  /after-school/progress/course/{course_id}
 *
 * Each digest returns two concise paragraphs summarizing strengths and next steps.
 * This file mirrors conventions used in afterSchoolService.ts (backend URL, typed interfaces, 404 handling).
 */

// ===============================
// Backend URL resolution (duplicate minimal helper for isolated usage)
// ===============================
const getBackendUrl = () => {
    // In React Native app we point to production API as in afterSchoolService
    return 'https://brainink-backend.onrender.com';
};

// ===============================
// TypeScript Interfaces
// ===============================

export interface ProgressDigest {
    id: number;
    user_id: number;
    scope: 'weekly' | 'course';
    period_start: string; // ISO timestamp
    period_end: string;   // ISO timestamp
    summary: string;      // Two paragraphs separated by blank line (\n\n)
    assignments_count: number;
    avg_grade?: number | null; // May be null if no grades yet
    course_id?: number | null; // Null for weekly digests
    created_at: string;
    updated_at: string;
}

// Optional richer response wrapper if needed later
export interface ProgressDigestResponse {
    digest: ProgressDigest;
}

// ===============================
// Internal helper types
// ===============================
interface RequestOptions extends RequestInit {
    token?: string; // Bearer token
    // Allow caller to disable throwing on non-OK status (used for graceful 404 → null)
    allow404?: boolean;
}

// ===============================
// Progress Service Implementation
// ===============================
export class ProgressService {
    private baseUrl: string;

    // Lightweight in-memory cache (session-level, not persistent)
    private cache: Map<string, ProgressDigest> = new Map();

    constructor() {
        this.baseUrl = getBackendUrl();
    }

    // ---- Public API Methods ----

    /** Generate (or update) weekly digest for current 7-day window. */
    async generateWeeklyDigest(token: string): Promise<ProgressDigest> {
        const digest = await this.request<ProgressDigest>(
            '/after-school/progress/weekly/generate',
            { method: 'POST', token }
        );
        this.cache.set(this.cacheKey('weekly'), digest);
        return digest;
    }

    /** Get weekly digest for current window (or specified reference date). Returns null if not generated yet. */
    async getWeeklyDigest(token: string, referenceDate?: Date): Promise<ProgressDigest | null> {
        const params = referenceDate ? `?reference_date=${encodeURIComponent(referenceDate.toISOString())}` : '';
        const digest = await this.request<ProgressDigest>(
            `/after-school/progress/weekly${params}`,
            { method: 'GET', token, allow404: true }
        );
        if (digest) this.cache.set(this.cacheKey('weekly'), digest);
        return digest;
    }

    /** Generate (or update) cumulative digest for a course. */
    async generateCourseDigest(courseId: number, token: string): Promise<ProgressDigest> {
        const digest = await this.request<ProgressDigest>(
            `/after-school/progress/course/${courseId}/generate`,
            { method: 'POST', token }
        );
        this.cache.set(this.cacheKey('course', courseId), digest);
        return digest;
    }

    /** Get latest saved course digest. Returns null if none exists yet. */
    async getCourseDigest(courseId: number, token: string): Promise<ProgressDigest | null> {
        const digest = await this.request<ProgressDigest>(
            `/after-school/progress/course/${courseId}`,
            { method: 'GET', token, allow404: true }
        );
        if (digest) this.cache.set(this.cacheKey('course', courseId), digest);
        return digest;
    }

    /** Convenience: get from cache first, then network. */
    async getWeeklyDigestCached(token: string, referenceDate?: Date): Promise<ProgressDigest | null> {
        const cached = this.cache.get(this.cacheKey('weekly'));
        if (cached) return cached;
        return this.getWeeklyDigest(token, referenceDate);
    }

    async getCourseDigestCached(courseId: number, token: string): Promise<ProgressDigest | null> {
        const cached = this.cache.get(this.cacheKey('course', courseId));
        if (cached) return cached;
        return this.getCourseDigest(courseId, token);
    }

    // ---- Helpers ----
    private cacheKey(scope: 'weekly' | 'course', courseId?: number): string {
        return scope === 'weekly' ? 'weekly' : `course:${courseId}`;
    }

    private async request<T>(path: string, opts: RequestOptions): Promise<T | null> {
        const url = `${this.baseUrl}${path}`;
        const headers: Record<string, string> = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        };
        if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

        const init: RequestInit = {
            method: opts.method || 'GET',
            headers,
            body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
        };

        let res: Response;
        try {
            res = await fetch(url, init);
        } catch (e) {
            throw new Error(`Network error while calling ${path}: ${(e as Error).message}`);
        }

        if (!res.ok) {
            if (res.status === 404 && opts.allow404) {
                return null; // Graceful missing digest
            }
            // Try to extract backend detail
            let detail: string | undefined;
            try {
                const errJson = await res.json();
                detail = errJson.detail || errJson.message;
            } catch { /* ignore */ }
            throw new Error(`Request failed (${res.status}) ${detail ? '- ' + detail : ''}`);
        }

        // Some endpoints may legitimately return empty JSON; treat that as null
        if (res.status === 204) return null;

        let data: any;
        try {
            data = await res.json();
        } catch (e) {
            throw new Error(`Failed to parse JSON from ${path}: ${(e as Error).message}`);
        }

        // Validate shape loosely; enforce critical fields
        if (data && typeof data === 'object') {
            if ('id' in data && 'summary' in data && 'scope' in data) {
                return this.normalizeDigest(data) as T;
            }
            // If wrapped inside a digest key
            if ('digest' in data && typeof data.digest === 'object') {
                return this.normalizeDigest(data.digest) as T;
            }
        }
        // Unexpected shape
        throw new Error(`Unexpected response shape from ${path}`);
    }

    private normalizeDigest(raw: any): ProgressDigest {
        // Ensure types & defaults (defensive for runtime safety)
        const digest: ProgressDigest = {
            id: Number(raw.id),
            user_id: Number(raw.user_id),
            scope: raw.scope === 'course' ? 'course' : 'weekly',
            period_start: String(raw.period_start),
            period_end: String(raw.period_end),
            summary: String(raw.summary || ''),
            assignments_count: Number(raw.assignments_count || 0),
            avg_grade: raw.avg_grade === null || raw.avg_grade === undefined ? null : Number(raw.avg_grade),
            course_id: raw.course_id === null || raw.course_id === undefined ? null : Number(raw.course_id),
            created_at: String(raw.created_at),
            updated_at: String(raw.updated_at),
        };

        // Guarantee two paragraphs separation for UI rendering convenience
        const parts = digest.summary.split('\n\n').map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length === 1) {
            digest.summary = `${parts[0]}\n\nKeep practicing; focus on the highlighted areas next week.`;
        } else if (parts.length > 2) {
            digest.summary = `${parts[0]}\n\n${parts[1]}`; // Trim extras
        }
        return digest;
    }
}

// Singleton export (mirrors afterSchoolService pattern)
export const progressService = new ProgressService();

// ===============================
// Optional convenience hooks (can be used in React components)
// ===============================
// Example usage (pseudo-code):
// const digest = await progressService.getWeeklyDigest(authToken);
// const courseDigest = await progressService.getCourseDigest(courseId, authToken);

