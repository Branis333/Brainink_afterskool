export type KanaRole = 'user' | 'assistant' | 'system';

export interface KanaMessage {
    role: KanaRole;
    content: string;
    route?: string | null;
    screen_context?: string | null;
    timestamp?: string | null;
}

export interface KanaChatRequest {
    message: string;
    session_id?: string;
    route?: string;
    screen_context?: string;
    metadata?: Record<string, unknown>;
    history?: KanaMessage[];
    screen_capture?: string;
    screen_capture_mime?: string;
}

export interface KanaChatResponse {
    session_id: string;
    reply: string;
    model?: string;
    route?: string;
    screen_context?: string;
    history: KanaMessage[];
}

export interface TranscriptionResponse {
    success: boolean;
    transcript: string;
    model?: string;
    filename?: string;
    mime_type?: string;
}

const getBackendUrl = () => {
    return 'https://brainink-backend.onrender.com';
};

class AgentService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = getBackendUrl();
    }

    async chat(payload: KanaChatRequest, token?: string): Promise<KanaChatResponse> {
        const url = `${this.baseUrl}/after-school/kana/chat`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'Kana service error');
        }

        const data = (await res.json()) as KanaChatResponse;
        return data;
    }

    async transcribeAudio(audioUri: string, token?: string, instructions?: string): Promise<TranscriptionResponse> {
        const url = `${this.baseUrl}/after-school/transcribe/audio`;
        const form = new FormData();

        form.append('audio', {
            uri: audioUri,
            name: 'recording.m4a',
            type: 'audio/mp4',
        } as any);

        if (instructions) {
            form.append('instructions', instructions);
        }

        const headers: Record<string, string> = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: form,
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'Transcription service error');
        }

        const data = (await res.json()) as TranscriptionResponse;
        return data;
    }
}

export const agentService = new AgentService();
