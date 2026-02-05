/**
 * Quiz Services (After-School)
 *
 * Frontend wrapper for ephemeral practice quiz endpoints:
 * - POST /after-school/quiz/practice/assignment/{assignment_id}
 * - POST /after-school/quiz/practice/block/{block_id}
 * - POST /after-school/quiz/practice/note/{note_id}
 *
 * These quizzes are NOT stored and DO NOT affect grades. They return a 5-question
 * multiple-choice quiz payload for immediate practice.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Get the correct backend URL based on environment (mirror pattern in afterSchoolService)
const getBackendUrl = () => {
    return 'https://brainink-backend.onrender.com';
};

const STORAGE_KEYS = {
    accessToken: 'access_token',
    refreshToken: 'refresh_token',
} as const;

// ===============================
// TYPES
// ===============================

export interface PracticeQuizQuestion {
    id: number;
    question: string;
    options: string[]; // length 4
    correct_index: number; // 0..3
    explanation?: string | null;
}

export interface PracticeQuiz {
    title: string;
    topic?: string | null;
    questions: PracticeQuizQuestion[]; // length 5
}

export interface RequestOptions {
    token?: string; // Bearer token (Authorization)
    signal?: AbortSignal; // optional cancellation signal
    timeoutMs?: number; // optional timeout
}

export class QuizService {
    private baseUrl: string;
    private authToken?: string;

    constructor(baseUrl = getBackendUrl()) {
        this.baseUrl = baseUrl;
    }

    /**
     * Configure a default Authorization token used for subsequent requests
     * You can also pass a token per call via RequestOptions
     */
    setAuthToken(token?: string) {
        this.authToken = token;
    }

    // ------------------------------
    // Public API
    // ------------------------------

    /**
     * Generate practice quiz grounded on assignment details + user's feedback (if any)
     */
    async generateAssignmentPracticeQuiz(
        assignmentId: number,
        options: RequestOptions = {}
    ): Promise<PracticeQuiz> {
        const url = `${this.baseUrl}/after-school/quiz/practice/assignment/${encodeURIComponent(
            assignmentId
        )}`;
        return this.requestQuiz(url, options);
    }

    /**
     * Generate practice quiz from a course block's content and learning objectives
     */
    async generateBlockPracticeQuiz(
        blockId: number,
        options: RequestOptions = {}
    ): Promise<PracticeQuiz> {
        const url = `${this.baseUrl}/after-school/quiz/practice/block/${encodeURIComponent(
            blockId
        )}`;
        return this.requestQuiz(url, options);
    }

    /**
     * Generate practice quiz from a student's analyzed notes (owner only)
     */
    async generateNotesPracticeQuiz(
        noteId: number,
        options: RequestOptions = {}
    ): Promise<PracticeQuiz> {
        const url = `${this.baseUrl}/after-school/quiz/practice/note/${encodeURIComponent(
            noteId
        )}`;
        return this.requestQuiz(url, options);
    }

    // ------------------------------
    // Internals
    // ------------------------------

    private async requestQuiz(url: string, options: RequestOptions): Promise<PracticeQuiz> {
        const { token, signal, timeoutMs } = options || {};
        const auth = token ?? this.authToken ?? (await AsyncStorage.getItem(STORAGE_KEYS.accessToken));

        if (!auth) {
            throw new Error('Not authenticated (missing access token).');
        }

        // Optional timeout via AbortController chaining
        const controller = timeoutMs ? new AbortController() : undefined;
        const timer = timeoutMs
            ? setTimeout(() => controller?.abort(), Math.max(0, timeoutMs))
            : undefined;

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${auth}`,
                },
                signal: controller?.signal ?? signal,
            });

            // If access token expired, refresh using refresh_token (mobile flow) and retry once.
            if (res.status === 401) {
                const newToken = await this.tryRefreshAccessToken();
                if (newToken) {
                    const retryRes = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${newToken}`,
                        },
                        signal: controller?.signal ?? signal,
                    });

                    if (!retryRes.ok) {
                        const text = await safeReadText(retryRes);
                        throw httpError(
                            retryRes.status,
                            `Quiz request failed (${retryRes.status}): ${text || retryRes.statusText}`
                        );
                    }

                    const payload = (await retryRes.json()) as PracticeQuiz;
                    return normalizeQuiz(payload);
                }
            }

            if (!res.ok) {
                const text = await safeReadText(res);
                throw httpError(res.status, `Quiz request failed (${res.status}): ${text || res.statusText}`);
            }

            const payload = (await res.json()) as PracticeQuiz;
            return normalizeQuiz(payload);
        } catch (err: any) {
            // Surface AbortError clearly to UI for retry/feedback
            if (err?.name === 'AbortError') {
                throw new Error('Request aborted (timeout or user cancel).');
            }
            throw err;
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    private async tryRefreshAccessToken(): Promise<string | null> {
        try {
            const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.refreshToken);
            if (!refreshToken) return null;

            const res = await fetch(`${this.baseUrl}/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    client_type: 'app',
                    refresh_token: refreshToken,
                }),
            });

            if (!res.ok) return null;

            const data = await res.json().catch(() => null);
            const access = data?.access_token as string | undefined;
            const rotatedRefresh = data?.refresh_token as string | undefined;

            if (access) {
                await AsyncStorage.setItem(STORAGE_KEYS.accessToken, access);
                this.authToken = access;
            }
            if (rotatedRefresh) {
                await AsyncStorage.setItem(STORAGE_KEYS.refreshToken, rotatedRefresh);
            }

            return access ?? null;
        } catch {
            return null;
        }
    }
}

// ===============================
// Helpers
// ===============================

function httpError(status: number, message: string) {
    const e = new Error(message) as Error & { status?: number };
    e.status = status;
    return e;
}

async function safeReadText(res: Response) {
    try {
        return await res.text();
    } catch {
        return '';
    }
}

function normalizeQuiz(q: PracticeQuiz): PracticeQuiz {
    if (!q) {
        return { title: 'Practice Quiz', topic: null, questions: [] };
    }
    const title = q.title || 'Practice Quiz';
    const topic = q.topic ?? null;
    const rawQuestions = Array.isArray(q.questions) ? q.questions : [];

    const questions = rawQuestions
        .slice(0, 5)
        .map((it, idx) => normalizeQuestion(it, idx))
        .filter(Boolean) as PracticeQuizQuestion[];

    // Ensure exactly 5 questions (pad if needed)
    while (questions.length < 5) {
        questions.push({
            id: questions.length + 1,
            question: '',
            options: ['', '', '', ''],
            correct_index: 0,
            explanation: '',
        });
    }

    return { title, topic, questions: questions.slice(0, 5) };
}

function normalizeQuestion(q: any, index: number): PracticeQuizQuestion {
    try {
        const id = toInt(q?.id, index + 1);
        const question = toStr(q?.question) || toStr(q?.text) || '';
        let options = q?.options;
        if (options && typeof options === 'object' && !Array.isArray(options)) {
            // options as dict -> alphabetic order
            options = Object.keys(options)
                .sort()
                .map((k) => toStr(options[k]))
                .filter((v) => v);
        } else if (typeof options === 'string') {
            options = options
                .replace(/;/g, '\n')
                .split('\n')
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
        }
        const arr = Array.isArray(options) ? options.map(toStr) : [];
        while (arr.length < 4) arr.push('');

        let correctIndex = toInt(q?.correct_index, undefined);
        if (correctIndex == null) {
            const letter = toStr(q?.correct_answer).toUpperCase();
            const mapLetter: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
            correctIndex = mapLetter[letter] ?? 0;
        }
        correctIndex = clampInt(correctIndex, 0, 3);

        const explanation = q?.explanation != null ? toStr(q?.explanation) : '';
        return {
            id,
            question,
            options: arr.slice(0, 4),
            correct_index: correctIndex,
            explanation,
        };
    } catch {
        return {
            id: index + 1,
            question: '',
            options: ['', '', '', ''],
            correct_index: 0,
            explanation: '',
        };
    }
}

function toStr(v: any): string {
    if (v == null) return '';
    return String(v);
}

function toInt(v: any, fallback: number | undefined): number {
    const n = Number.parseInt(String(v), 10);
    return Number.isFinite(n) ? n : (fallback as number);
}

function clampInt(v: number, min: number, max: number): number {
    try {
        if (!Number.isFinite(v)) return min;
        return Math.max(min, Math.min(max, Math.trunc(v)));
    } catch {
        return min;
    }
}

// Export a singleton for convenience
export const quizService = new QuizService();

/**
 * Usage examples:
 *
 * // Configure token once (e.g., after login)
 * quizService.setAuthToken(authToken);
 *
 * // Assignment-based practice quiz
 * const quiz = await quizService.generateAssignmentPracticeQuiz(assignmentId);
 *
 * // Block-based practice quiz with timeout
 * const quiz2 = await quizService.generateBlockPracticeQuiz(blockId, { timeoutMs: 15000 });
 *
 * // Notes-based practice quiz with explicit token and AbortSignal
 * const controller = new AbortController();
 * const quiz3 = await quizService.generateNotesPracticeQuiz(noteId, { token: authToken, signal: controller.signal });
 */

