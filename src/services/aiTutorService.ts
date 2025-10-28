import { Platform } from 'react-native';

const API_BASE_URL = 'https://brainink-backend.onrender.com';

export type TutorInputType = 'text' | 'voice' | 'button' | 'checkpoint';

export interface TutorCheckpointPrompt {
    required: boolean;
    checkpoint_id?: number;
    checkpoint_type?: 'photo' | 'reflection' | 'quiz';
    title?: string;
    instructions?: string;
    tips?: string[];
}

export interface TutorComprehensionCheck {
    question: string;
    choices?: string[];
    expected_answers?: string[];
    hint?: string;
}

export interface TutorTurn {
    turn_id: string;
    narration: string;
    summary?: string;
    reflection_prompt?: string;
    comprehension_check?: string | TutorComprehensionCheck | null;
    checkpoint?: TutorCheckpointPrompt | null;
    follow_up_options?: string[];
    follow_up_prompts?: string[];
    advance_segment?: boolean;
    next_action?: 'continue' | 'await_response' | 'await_checkpoint';
}

export interface TutorInteraction {
    id: string;
    turn_index: number;
    speaker: 'learner' | 'tutor';
    input_type: TutorInputType;
    content: string;
    created_at: string;
}

export interface TutorSessionSnapshot {
    session_id: number;
    learner_id?: number;
    course_id?: number;
    block_id?: number;
    lesson_id?: number;
    persona_name?: string;
    module_title?: string;
    status: 'active' | 'awaiting_checkpoint' | 'completed' | 'abandoned' | 'error';
    current_segment_index?: number; // optional, provided by backend for plan alignment
    total_segments?: number;
    created_at: string;
    updated_at: string;
    completed_at?: string;
    total_turns?: number;
}

export interface TutorSessionState {
    session: TutorSessionSnapshot;
    tutor_turn: TutorTurn;
    interactions: TutorInteraction[];
}

export interface TutorSessionListItem extends TutorSessionSnapshot {
    last_turn_summary?: string;
}

export interface TutorSessionListResponse {
    sessions: TutorSessionListItem[];
}

export interface StartSessionPayload {
    course_id: number;
    lesson_id?: number;
    block_id?: number;
    grade_level?: number;
    persona?: string;
    starting_context?: string;
}

export interface MessagePayload {
    input_type: TutorInputType;
    message?: string;
    choice_index?: number;
    metadata?: Record<string, unknown>;
}

export interface CheckpointSubmissionPayload {
    checkpoint_type: 'photo' | 'reflection' | 'quiz';
    notes?: string;
    file_uri?: string;
    file_name?: string;
    mime_type?: string;
    answers?: Array<{ question_id: string; answer: string }>; // for future extensions
}

export interface CheckpointResponse {
    checkpoint_id: number;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REVIEW_REQUIRED';
    ai_feedback?: {
        summary?: string;
        strengths?: string[];
        improvements?: string[];
        suggested_next_step?: string;
    };
    score?: number;
}

export interface CompleteSessionPayload {
    learner_feedback?: string;
    rating?: number;
}

// ------------------------------
// Lesson plan contracts
// ------------------------------
export interface LessonPlanSnippet {
    snippet: string;
    explanation: string;
    easier_explanation?: string | null;
    enrichment_explanation?: string | null;
    question?: string | null;
    follow_ups?: string[];
    checkpoint?: {
        required: boolean;
        checkpoint_type: 'photo' | 'reflection' | 'quiz';
        instructions: string;
        criteria?: string[];
    } | null;
}

export interface LessonPlanSegment {
    index: number;
    title?: string | null;
    text?: string | null;
    difficulty?: 'easy' | 'medium' | 'hard' | null;
    snippets: LessonPlanSnippet[];
}

export interface LessonPlan {
    module_title?: string | null;
    segments: LessonPlanSegment[];
}

const makeHeaders = (token: string, extra: Record<string, string> = {}) => ({
    'Authorization': `Bearer ${token}`,
    ...extra,
});

const handleResponse = async <T>(response: Response, context?: string): Promise<T> => {
    if (!response.ok) {
    const statusLabel = `${response.status} ${response.statusText}`.trim();
    let detail = 'Request failed';
        let rawDetail: unknown = null;
        try {
            const data = await response.json();
            rawDetail = data;
            const extracted = data?.detail ?? data?.message ?? detail;
            if (Array.isArray(extracted)) {
                detail = extracted
                    .map((item) => {
                        if (typeof item === 'string') return item;
                        if (item?.msg) return item.msg;
                        if (item?.message) return item.message;
                        return JSON.stringify(item);
                    })
                    .join('\n');
            } else if (typeof extracted === 'object') {
                detail = extracted?.message || extracted?.error || JSON.stringify(extracted);
            } else {
                detail = extracted;
            }
        } catch (error) {
            // ignore
        }
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.error('[AI Tutor API error]', context || 'request', {
                status: response.status,
                statusText: response.statusText,
                detail,
                raw: rawDetail,
            });
        }
        throw new Error(`${statusLabel}: ${detail}`);
    }
    return response.json() as Promise<T>;
};

// Map backend enum-like statuses to frontend-friendly strings used by UI
const normalizeStatus = (status: string | undefined): TutorSessionSnapshot['status'] => {
    const s = (status || '').toUpperCase();
    switch (s) {
        case 'IN_PROGRESS':
            return 'active';
        case 'AWAITING_CHECKPOINT':
            return 'awaiting_checkpoint';
        case 'COMPLETED':
            return 'completed';
        case 'ABANDONED':
            return 'abandoned';
        case 'ERROR':
            return 'error';
        default:
            // If already a lowercase form, pass through
            const low = (status || '').toLowerCase() as TutorSessionSnapshot['status'];
            return (['active','awaiting_checkpoint','completed','abandoned','error'] as const).includes(low) ? low : 'active';
    }
};

// Fetch full session detail and compose the state shape expected by the UI
async function fetchSessionState(token: string, sessionId: number, tutorTurnOverride?: TutorTurn): Promise<TutorSessionState> {
    const res = await fetch(`${API_BASE_URL}/after-school/ai-tutor/sessions/${sessionId}`, {
        method: 'GET',
        headers: makeHeaders(token),
    });
    const detail = await handleResponse<{ session: any; interactions: any[] }>(res, 'getSession');
    const session: TutorSessionSnapshot = {
        ...detail.session,
        status: normalizeStatus(detail.session?.status),
    };
    return {
        session,
        tutor_turn: tutorTurnOverride as any, // may be undefined when just loading session
        interactions: (detail.interactions || []) as TutorInteraction[],
    };
}

export const aiTutorService = {
    async resumeSession(
        token: string,
        params?: { course_id?: number; block_id?: number; lesson_id?: number }
    ): Promise<TutorSessionState> {
        const qs = new URLSearchParams();
        if (params?.course_id != null) qs.append('course_id', String(params.course_id));
        if (params?.block_id != null) qs.append('block_id', String(params.block_id));
        if (params?.lesson_id != null) qs.append('lesson_id', String(params.lesson_id));

        const url = `${API_BASE_URL}/after-school/ai-tutor/sessions/resume${qs.toString() ? `?${qs.toString()}` : ''}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: makeHeaders(token),
        });

        const resumed = await handleResponse<{ session: any; tutor_turn: TutorTurn }>(response, 'resumeSession');
        const normalized: TutorSessionSnapshot = {
            ...resumed.session,
            status: normalizeStatus(resumed.session?.status),
        };
        // Compose latest state with interactions and override tutor_turn
        return fetchSessionState(token, normalized.session_id, resumed.tutor_turn);
    },
    async startSession(token: string, payload: StartSessionPayload): Promise<TutorSessionState> {
        // Backend contract: POST /after-school/ai-tutor/sessions
        // Only this endpoint is valid; prior fallbacks caused accidental hits on /sessions/{session_id} with "start"
        // which produced 422 ("start" is not an integer). Keep it simple and strict.

        // Avoid sending unknown fields that backend schema doesn't accept
        const { course_id, block_id, lesson_id, grade_level, persona } = payload;
        const body = JSON.stringify({ course_id, block_id, lesson_id, grade_level, persona });

        const response = await fetch(`${API_BASE_URL}/after-school/ai-tutor/sessions`, {
            method: 'POST',
            headers: makeHeaders(token, { 'Content-Type': 'application/json' }),
            body,
        });

        // Expect shape: { session: TutorSessionSnapshot, tutor_turn: TutorTurn }
        try {
            const start = await handleResponse<{ session: any; tutor_turn: TutorTurn }>(response, 'startSession');
            const normalized: TutorSessionSnapshot = {
                ...start.session,
                status: normalizeStatus(start.session?.status),
            };
            // Also fetch interactions so UI has full context
            return fetchSessionState(token, normalized.session_id, start.tutor_turn);
        } catch (e) {
            // Defensive fallback: if parsing the start payload fails for any reason, fetch latest session
            if (typeof __DEV__ !== 'undefined' && __DEV__) {
                console.warn('[AI Tutor API] startSession parse failed, falling back to latest session', e);
            }
            const list = await this.listSessions(token);
            const latest = list.sessions.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
            if (!latest) {
                throw e;
            }
            return fetchSessionState(token, latest.session_id);
        }
    },

    async sendMessage(token: string, sessionId: number, payload: MessagePayload): Promise<TutorSessionState> {
        const response = await fetch(`${API_BASE_URL}/after-school/ai-tutor/sessions/${sessionId}/message`, {
            method: 'POST',
            headers: {
                ...makeHeaders(token, { 'Content-Type': 'application/json' }),
            },
            body: JSON.stringify(payload),
        });
        const tutorTurn = await handleResponse<TutorTurn>(response, 'sendMessage');
        // Compose latest state by fetching session detail
        return fetchSessionState(token, sessionId, tutorTurn);
    },

    async submitCheckpoint(token: string, sessionId: number, payload: CheckpointSubmissionPayload): Promise<CheckpointResponse> {
        const formData = new FormData();
        formData.append('checkpoint_type', payload.checkpoint_type);
        if (payload.notes) {
            formData.append('notes', payload.notes);
        }
        if (payload.answers) {
            formData.append('answers', JSON.stringify(payload.answers));
        }
        if (payload.file_uri) {
            formData.append('artifact', {
                uri: payload.file_uri,
                name: payload.file_name || `checkpoint-${Date.now()}.jpg`,
                type: payload.mime_type || 'image/jpeg',
            } as any);
        }

        const response = await fetch(`${API_BASE_URL}/after-school/ai-tutor/sessions/${sessionId}/checkpoint`, {
            method: 'POST',
            headers: makeHeaders(token),
            body: formData,
        });
        return handleResponse<CheckpointResponse>(response, 'submitCheckpoint');
    },

    async completeSession(token: string, sessionId: number, payload?: CompleteSessionPayload): Promise<TutorSessionSnapshot> {
        const response = await fetch(`${API_BASE_URL}/after-school/ai-tutor/sessions/${sessionId}/complete`, {
            method: 'POST',
            headers: {
                ...makeHeaders(token, { 'Content-Type': 'application/json' }),
            },
            body: JSON.stringify(payload || {}),
        });
        const snap = await handleResponse<any>(response, 'completeSession');
        return { ...snap, status: normalizeStatus(snap?.status) } as TutorSessionSnapshot;
    },

    async listSessions(token: string): Promise<TutorSessionListResponse> {
        const response = await fetch(`${API_BASE_URL}/after-school/ai-tutor/sessions`, {
            method: 'GET',
            headers: makeHeaders(token),
        });
        const raw = await handleResponse<{ items: any[]; total: number }>(response, 'listSessions');
        const sessions = (raw.items || []).map((it) => ({
            ...it,
            status: normalizeStatus(it.status),
        })) as TutorSessionListItem[];
        return { sessions };
    },

    async getSession(token: string, sessionId: number): Promise<TutorSessionState> {
        return fetchSessionState(token, sessionId);
    },

    async getLessonPlan(token: string, sessionId: number): Promise<LessonPlan> {
        const response = await fetch(`${API_BASE_URL}/after-school/ai-tutor/sessions/${sessionId}/lesson-plan`, {
            method: 'GET',
            headers: makeHeaders(token),
        });
        const data = await handleResponse<{ lesson_plan: LessonPlan }>(response, 'getLessonPlan');
        return data.lesson_plan;
    },
};

