// Separate Kana learning flow service (step-by-step tutoring)

const getBackendUrl = () => 'https://brainink-backend.onrender.com';

export type KanaClarifyTurn = {
    role: 'user' | 'assistant' | string;
    content: string;
    timestamp?: string;
};

export type KanaStep = {
    step_number: number;
    title: string;
    explanation: string;
    check_question: string;
    clarify_history: KanaClarifyTurn[];
};

export type KanaStepOverviewItem = {
    step_number: number;
    title: string;
    is_current: boolean;
    is_completed: boolean;
};

export type KanaLearningSession = {
    session_id: string;
    question: string;
    current_step_index: number;
    total_steps: number;
    completed: boolean;
    current_step?: KanaStep | null;
    steps_overview: KanaStepOverviewItem[];
    route?: string | null;
    screen_context?: string | null;
    updated_at?: string | null;
};

type StartSessionPayload = {
    question: string;
    route?: string;
    screen_context?: string;
    metadata?: Record<string, unknown>;
    image_base64?: string;
    image_mime?: string;
};

type ClarifyPayload = {
    message: string;
    image_base64?: string;
    image_mime?: string;
};

type AudioSessionPayload = {
    audioUri: string;
    filename?: string;
    mimeType?: string;
    route?: string;
    screen_context?: string;
    metadata?: Record<string, unknown>;
};

type AudioClarifyPayload = {
    audioUri: string;
    filename?: string;
    mimeType?: string;
};

type ClarifyResponse = {
    session: KanaLearningSession;
    clarify_reply: string;
    clarify_history: KanaClarifyTurn[];
};

class KanaServices {
    private parseMessage(parsed: any, statusCode: number): string {
        const detail = parsed?.detail;
        if (typeof detail === 'string') return detail;
        if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
        return parsed?.message || `Request failed (${statusCode})`;
    }

    private async request<T>(path: string, init: RequestInit, token?: string): Promise<T> {
        const response = await fetch(`${getBackendUrl()}${path}`, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(init.headers || {}),
            },
        });

        const text = await response.text();
        const parsed = text ? JSON.parse(text) : null;

        if (!response.ok) {
            throw new Error(this.parseMessage(parsed, response.status));
        }

        return parsed as T;
    }

    private async requestMultipart<T>(path: string, formData: FormData, token?: string): Promise<T> {
        const response = await fetch(`${getBackendUrl()}${path}`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: formData,
        });

        const text = await response.text();
        const parsed = text ? JSON.parse(text) : null;

        if (!response.ok) {
            throw new Error(this.parseMessage(parsed, response.status));
        }

        return parsed as T;
    }

    async startSession(payload: StartSessionPayload, token?: string): Promise<KanaLearningSession> {
        return this.request<KanaLearningSession>(
            '/after-school/kana-learning/sessions',
            {
                method: 'POST',
                body: JSON.stringify(payload),
            },
            token
        );
    }

    async getSession(sessionId: string, token?: string): Promise<KanaLearningSession> {
        return this.request<KanaLearningSession>(
            `/after-school/kana-learning/sessions/${sessionId}`,
            { method: 'GET' },
            token
        );
    }

    async clarifyStep(sessionId: string, payload: ClarifyPayload, token?: string): Promise<ClarifyResponse> {
        return this.request<ClarifyResponse>(
            `/after-school/kana-learning/sessions/${sessionId}/clarify`,
            {
                method: 'POST',
                body: JSON.stringify(payload),
            },
            token
        );
    }

    async continueStep(sessionId: string, token?: string): Promise<KanaLearningSession> {
        return this.request<KanaLearningSession>(
            `/after-school/kana-learning/sessions/${sessionId}/continue`,
            { method: 'POST' },
            token
        );
    }

    async restartSession(sessionId: string, token?: string): Promise<KanaLearningSession> {
        return this.request<KanaLearningSession>(
            `/after-school/kana-learning/sessions/${sessionId}/restart`,
            { method: 'POST' },
            token
        );
    }

    async startSessionFromAudio(payload: AudioSessionPayload, token?: string): Promise<KanaLearningSession> {
        const form = new FormData();
        form.append('audio', {
            uri: payload.audioUri,
            name: payload.filename || `kana-audio-${Date.now()}.m4a`,
            type: payload.mimeType || 'audio/mp4',
        } as any);

        if (payload.route) form.append('route', payload.route);
        if (payload.screen_context) form.append('screen_context', payload.screen_context);
        if (payload.metadata) form.append('metadata', JSON.stringify(payload.metadata));

        return this.requestMultipart<KanaLearningSession>('/after-school/kana-learning/sessions/audio', form, token);
    }

    async clarifyStepFromAudio(
        sessionId: string,
        payload: AudioClarifyPayload,
        token?: string
    ): Promise<ClarifyResponse> {
        const form = new FormData();
        form.append('audio', {
            uri: payload.audioUri,
            name: payload.filename || `kana-clarify-${Date.now()}.m4a`,
            type: payload.mimeType || 'audio/mp4',
        } as any);

        return this.requestMultipart<ClarifyResponse>(
            `/after-school/kana-learning/sessions/${sessionId}/clarify/audio`,
            form,
            token
        );
    }
}

export const kanaServices = new KanaServices();

