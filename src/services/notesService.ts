/**
 * Notes Service for React Native
 * Handles student notes upload, AI analysis, and management
 * Students can upload handwritten or printed school notes as images
 * AI analyzes images directly using Gemini Vision API
 * Based on BrainInk Backend after-school notes endpoints
 */

// Get the correct backend URL based on environment
const getBackendUrl = () => {
    // In React Native, we'll always use the production backend
    return 'https://brainink-backend.onrender.com';
};

// ===============================
// TYPESCRIPT INTERFACES
// ===============================

// Shared Resource Interfaces
export interface VideoResource {
    title: string;
    url: string;
    type?: string;
    description?: string;
    thumbnail?: string;
    channel?: string;
    search_query?: string;
}

export interface ObjectiveItem {
    objective: string;
    summary?: string;
    videos?: VideoResource[];
}

export interface FlashcardItem {
    front: string;
    back: string;
}

export interface ObjectiveProgressEntry {
    objective_index: number;
    latest_grade: number;
    performance_summary?: string;
    last_quiz_at?: string;
}

// File Upload Interfaces
export interface FileValidationResult {
    valid: boolean;
    error?: string;
}

export interface UploadFile {
    name: string;
    uri: string;
    type: string;
    size?: number;
}

// Student Note Interfaces
export interface StudentNote {
    id: number;
    user_id: number;
    title: string;
    description?: string;
    subject?: string;
    course_id?: number;
    tags?: string[];

    // File information
    original_filename?: string;
    file_path?: string;
    file_type?: string;
    file_size?: number;
    total_images: number;
    image_files?: string[];
    content_hash?: string;

    // AI Analysis Results - matches backend field names
    ai_processed: boolean;
    processing_status: string; // pending, processing, completed, failed
    summary?: string;  // Backend uses 'summary', not 'ai_summary'
    key_points?: string[];  // Backend uses 'key_points', not 'ai_key_points'
    main_topics?: string[];  // Backend uses 'main_topics', not 'ai_main_topics'
    learning_concepts?: string[];  // Backend uses 'learning_concepts', not 'ai_learning_concepts'
    questions_generated?: string[];  // Backend uses 'questions_generated', not 'ai_questions_generated'

    // Enhanced structures
    objectives?: ObjectiveItem[];
    objective_flashcards?: FlashcardItem[][]; // aligned with objectives
    overall_flashcards?: FlashcardItem[];
    objective_progress?: ObjectiveProgressEntry[];

    // Metadata
    is_starred: boolean;
    is_public?: boolean;
    created_at: string;
    updated_at: string;
    processed_at?: string;
}

// Note Creation Interface
export interface StudentNoteCreate {
    title: string;
    description?: string;
    subject?: string;
    course_id?: number;
    tags?: string;
}

// Note Update Interface
export interface StudentNoteUpdate {
    title?: string;
    description?: string;
    subject?: string;
    course_id?: number;
    tags?: string;
    is_starred?: boolean;
}

// Note Upload Request
export interface NoteUploadRequest {
    title: string;
    files: UploadFile[];
    description?: string;
    subject?: string;
    course_id?: number;
    tags?: string;
}

// Note Upload Response - matches backend structure
export interface NoteUploadResponse {
    success: boolean;
    message: string;
    note_id: number;
    title: string;
    subject?: string;
    total_images: number;
    total_size: number;
    content_hash: string;
    image_files: string[];
    ai_processed: boolean;
    processing_status: string;
    processing_error?: string;
    analysis_results?: {
        summary: string;
        key_points: string[];
        main_topics: string[];
        learning_concepts: string[];
        questions_generated: string[];
        objectives?: ObjectiveItem[];
    };
    processed_at?: string;
    created_at?: string;
}

// Note List Response
export interface StudentNoteListResponse {
    total: number;
    notes: StudentNote[];
}

// Note Analysis Results
export interface NoteAnalysisResult {
    summary: string;
    key_points: string[];
    main_topics: string[];
    learning_concepts: string[];
    questions_generated: string[];
}

// Quiz & Flashcards Interfaces (backend-aligned)
export interface QuizQuestion {
    question: string;
    options: string[]; // length 4
    answer_index: number; // 0..3
}

export interface ObjectiveQuizResponse {
    note_id: number;
    objective_index: number; // normalised to 0-based by backend
    objective: string;
    num_questions: number;
    questions: QuizQuestion[];
    generated_at: string;
}

export interface QuizSubmitRequest {
    objective_index: number; // 1- or 0-based (backend normalises)
    questions: QuizQuestion[];
    user_answers: number[];
}

export interface QuizSubmitResponse {
    note_id: number;
    objective_index: number; // 0-based
    total_questions: number;
    correct_count: number;
    grade_percentage: number;
    performance_summary?: string;
    submitted_at: string;
}

export interface FlashcardsResponse {
    note_id: number;
    scope: 'objective' | 'overall';
    objective_index?: number;
    count: number;
    flashcards: FlashcardItem[];
    generated_at: string;
}

// Notes Statistics
export interface NotesStatistics {
    total_notes: number;
    processed_notes: number;
    failed_notes: number;
    pending_notes: number;
    subject_distribution: Record<string, number>;
    total_storage_bytes: number;
    total_storage_mb: number;
}

// Message Response
export interface MessageResponse {
    message: string;
}

// Configuration Constants
export const NOTES_CONFIG = {
    MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB
    ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
    MAX_BULK_FILES: 20,
    SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'],
};

class NotesService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = getBackendUrl();
    }

    // ===============================
    // FILE VALIDATION METHODS
    // ===============================

    /**
     * Validate a single file for upload
     */
    validateFile(file: UploadFile): FileValidationResult {
        // Check file size
        if (file.size && file.size > NOTES_CONFIG.MAX_FILE_SIZE) {
            return {
                valid: false,
                error: `File ${file.name} exceeds maximum size of ${NOTES_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`
            };
        }

        // Check file extension
        const extension = this.getFileExtension(file.name);
        if (!NOTES_CONFIG.ALLOWED_EXTENSIONS.includes(extension)) {
            return {
                valid: false,
                error: `File type ${extension} is not supported. Allowed types: ${NOTES_CONFIG.ALLOWED_EXTENSIONS.join(', ')}`
            };
        }

        // Check if it's an image file
        if (!this.isImageFile(file)) {
            return {
                valid: false,
                error: `File ${file.name} is not a valid image file`
            };
        }

        return { valid: true };
    }

    /**
     * Validate multiple files for bulk upload
     */
    validateBulkFiles(files: UploadFile[]): FileValidationResult {
        if (!files || files.length === 0) {
            return {
                valid: false,
                error: 'No files provided for upload'
            };
        }

        if (files.length > NOTES_CONFIG.MAX_BULK_FILES) {
            return {
                valid: false,
                error: `Cannot upload more than ${NOTES_CONFIG.MAX_BULK_FILES} files at once`
            };
        }

        // Validate each file
        for (const file of files) {
            const validation = this.validateFile(file);
            if (!validation.valid) {
                return validation;
            }
        }

        return { valid: true };
    }

    /**
     * Check if file is an image
     */
    isImageFile(file: UploadFile): boolean {
        return NOTES_CONFIG.SUPPORTED_IMAGE_TYPES.includes(file.type.toLowerCase());
    }

    /**
     * Get file extension from filename
     */
    getFileExtension(filename: string): string {
        return '.' + filename.split('.').pop()?.toLowerCase() || '';
    }

    /**
     * Format file size in human-readable format
     */
    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    // ===============================
    // NOTE UPLOAD & ANALYSIS METHODS
    // ===============================

    /**
     * Upload and analyze student notes
     * Combines upload and AI analysis in ONE step
     * Endpoint: POST /after-school/notes/upload
     */
    async uploadAndAnalyzeNotes(
        uploadRequest: NoteUploadRequest,
        token: string
    ): Promise<NoteUploadResponse> {
        try {
            console.log('📤 Starting note upload and analysis:', uploadRequest.title);

            // Validate files
            const validation = this.validateBulkFiles(uploadRequest.files);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Create FormData
            const formData = new FormData();
            formData.append('title', uploadRequest.title);

            if (uploadRequest.description) {
                formData.append('description', uploadRequest.description);
            }

            if (uploadRequest.subject) {
                formData.append('subject', uploadRequest.subject);
            }

            if (uploadRequest.course_id) {
                formData.append('course_id', uploadRequest.course_id.toString());
            }

            if (uploadRequest.tags) {
                formData.append('tags', uploadRequest.tags);
            }

            // Append files
            for (const file of uploadRequest.files) {
                const fileToUpload = {
                    uri: file.uri,
                    type: file.type,
                    name: file.name,
                } as any;
                formData.append('files', fileToUpload);
            }

            // Send request
            const response = await fetch(`${this.baseUrl}/after-school/notes/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    // Note: Don't set Content-Type for FormData, browser will set it automatically
                },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }));
                throw new Error(errorData.detail || errorData.message || 'Failed to upload notes');
            }

            const data = await response.json();
            console.log('✅ Notes uploaded and analyzed successfully');

            return data;

        } catch (error: any) {
            console.error('❌ Error uploading notes:', error);
            throw error;
        }
    }

    // ===============================
    // OBJECTIVE QUIZ METHODS
    // ===============================

    /**
     * Generate quiz for a specific objective (simple route)
     * Endpoint: POST /after-school/notes/{note_id}/quiz
     */
    async generateObjectiveQuiz(
        noteId: number,
        objectiveIndex: number,
        token: string,
        numQuestions: number = 7
    ): Promise<ObjectiveQuizResponse> {
        const form = new FormData();
        form.append('objective_index', String(objectiveIndex));
        form.append('num_questions', String(numQuestions));

        const res = await fetch(`${this.baseUrl}/after-school/notes/${noteId}/quiz`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: form,
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Failed to generate objective quiz');
        }
        return res.json();
    }

    /**
     * Submit quiz answers for a specific objective
     * Endpoint: POST /after-school/notes/{note_id}/quiz/submit
     */
    async submitObjectiveQuiz(
        noteId: number,
        payload: QuizSubmitRequest,
        token: string
    ): Promise<QuizSubmitResponse> {
        const res = await fetch(`${this.baseUrl}/after-school/notes/${noteId}/quiz/submit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Failed to submit quiz');
        }
        return res.json();
    }

    /**
     * Persist latest grade for an objective (manual grade endpoint)
     * Endpoint: POST /after-school/notes/{note_id}/objectives/{objective_index}/quiz/grade
     */
    async submitObjectiveQuizGrade(
        noteId: number,
        objectiveIndex: number,
        gradePercentage: number,
        token: string,
        performanceSummary?: string
    ): Promise<MessageResponse> {
        const res = await fetch(`${this.baseUrl}/after-school/notes/${noteId}/objectives/${objectiveIndex}/quiz/grade`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ grade_percentage: gradePercentage, performance_summary: performanceSummary }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Failed to store objective grade');
        }
        return res.json();
    }

    // ===============================
    // OBJECTIVE FLASHCARDS METHODS
    // ===============================

    /**
     * Generate flashcards for a specific objective (simple route)
     * Endpoint: POST /after-school/notes/{note_id}/flashcards
     */
    async generateObjectiveFlashcards(
        noteId: number,
        objectiveIndex: number,
        token: string,
        count: number = 8
    ): Promise<FlashcardsResponse> {
        const form = new FormData();
        form.append('objective_index', String(objectiveIndex));
        form.append('count', String(count));

        const res = await fetch(`${this.baseUrl}/after-school/notes/${noteId}/flashcards`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: form,
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Failed to generate objective flashcards');
        }
        return res.json();
    }

    // ===============================
    // NOTE RETRIEVAL METHODS
    // ===============================

    /**
     * Get all notes for the current user
     * Endpoint: GET /after-school/notes
     */
    async getUserNotes(
        token: string,
        filters?: {
            course_id?: number;
            subject?: string;
            is_starred?: boolean;
            limit?: number;
            offset?: number;
        }
    ): Promise<StudentNoteListResponse> {
        try {
            console.log('📚 Fetching user notes...');

            // Build query parameters
            const params = new URLSearchParams();
            if (filters?.course_id) params.append('course_id', filters.course_id.toString());
            if (filters?.subject) params.append('subject', filters.subject);
            if (filters?.is_starred !== undefined) params.append('is_starred', filters.is_starred.toString());
            if (filters?.limit) params.append('limit', filters.limit.toString());
            if (filters?.offset) params.append('offset', filters.offset.toString());

            const queryString = params.toString();
            const url = `${this.baseUrl}/after-school/notes${queryString ? '?' + queryString : ''}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch notes' }));
                throw new Error(errorData.detail || 'Failed to fetch notes');
            }

            const data = await response.json();
            console.log(`✅ Fetched ${data.total} notes`);

            return data;

        } catch (error: any) {
            console.error('❌ Error fetching notes:', error);
            throw error;
        }
    }

    /**
     * Get a specific note by ID
     * Endpoint: GET /after-school/notes/{note_id}
     */
    async getNoteById(noteId: number, token: string): Promise<StudentNote> {
        try {
            console.log(`📖 Fetching note ${noteId}...`);

            const response = await fetch(`${this.baseUrl}/after-school/notes/${noteId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Note not found' }));
                throw new Error(errorData.detail || 'Failed to fetch note');
            }

            const data = await response.json();
            console.log('✅ Note fetched successfully');

            return data;

        } catch (error: any) {
            console.error('❌ Error fetching note:', error);
            throw error;
        }
    }

    /**
     * Update a note's metadata
     * Endpoint: PUT /after-school/notes/{note_id}
     */
    async updateNote(
        noteId: number,
        updateData: StudentNoteUpdate,
        token: string
    ): Promise<StudentNote> {
        try {
            console.log(`✏️ Updating note ${noteId}...`);

            const response = await fetch(`${this.baseUrl}/after-school/notes/${noteId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updateData),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Failed to update note' }));
                throw new Error(errorData.detail || 'Failed to update note');
            }

            const data = await response.json();
            console.log('✅ Note updated successfully');

            return data;

        } catch (error: any) {
            console.error('❌ Error updating note:', error);
            throw error;
        }
    }

    /**
     * Delete a note
     * Endpoint: DELETE /after-school/notes/{note_id}
     */
    async deleteNote(noteId: number, token: string): Promise<MessageResponse> {
        try {
            console.log(`🗑️ Deleting note ${noteId}...`);

            const response = await fetch(`${this.baseUrl}/after-school/notes/${noteId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Failed to delete note' }));
                throw new Error(errorData.detail || 'Failed to delete note');
            }

            const data = await response.json();
            console.log('✅ Note deleted successfully');

            return data;

        } catch (error: any) {
            console.error('❌ Error deleting note:', error);
            throw error;
        }
    }

    // ===============================
    // NOTES ANALYTICS & STATISTICS
    // ===============================

    /**
     * Get statistics about user's uploaded notes
     * Endpoint: GET /after-school/notes/user/statistics
     */
    async getUserStatistics(token: string): Promise<NotesStatistics> {
        try {
            console.log('📊 Fetching notes statistics...');

            const response = await fetch(`${this.baseUrl}/after-school/notes/user/statistics`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch statistics' }));
                throw new Error(errorData.detail || 'Failed to fetch statistics');
            }

            const data = await response.json();
            console.log('✅ Statistics fetched successfully');

            return data;

        } catch (error: any) {
            console.error('❌ Error fetching statistics:', error);
            throw error;
        }
    }

    // ===============================
    // UTILITY METHODS
    // ===============================

    /**
     * Toggle starred status of a note
     */
    async toggleStarred(noteId: number, currentStatus: boolean, token: string): Promise<StudentNote> {
        return this.updateNote(noteId, { is_starred: !currentStatus }, token);
    }

    /**
     * Filter notes by subject
     */
    async getNotesBySubject(subject: string, token: string): Promise<StudentNoteListResponse> {
        return this.getUserNotes(token, { subject });
    }

    /**
     * Filter notes by course
     */
    async getNotesByCourse(courseId: number, token: string): Promise<StudentNoteListResponse> {
        return this.getUserNotes(token, { course_id: courseId });
    }

    /**
     * Get starred notes only
     */
    async getStarredNotes(token: string): Promise<StudentNoteListResponse> {
        return this.getUserNotes(token, { is_starred: true });
    }

    /**
     * Search notes by query
     * Endpoint: GET /after-school/notes/search/query
     * Searches across title, subject, summary, and description
     */
    async searchNotes(
        query: string,
        token: string,
        sortBy: 'recent' | 'title' | 'subject' = 'recent',
        limit: number = 100,
        offset: number = 0
    ): Promise<StudentNoteListResponse> {
        try {
            if (!query || query.trim().length === 0) {
                throw new Error('Search query cannot be empty');
            }

            const params = new URLSearchParams();
            params.append('q', query.trim());
            params.append('sort_by', sortBy);
            params.append('limit', limit.toString());
            params.append('offset', offset.toString());

            const response = await fetch(
                `${this.baseUrl}/after-school/notes/search/query?${params.toString()}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.detail || `Search failed with status ${response.status}`
                );
            }

            const data: StudentNoteListResponse = await response.json();
            console.log(`✅ Found ${data.total} notes matching query: "${query}"`);
            return data;

        } catch (error: any) {
            console.error('❌ Error searching notes:', error);
            throw error;
        }
    }

    /**
     * Check notes service health
     * Endpoint: GET /after-school/notes/health
     */
    async checkHealth(): Promise<any> {
        try {
            const response = await fetch(`${this.baseUrl}/after-school/notes/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Health check failed');
            }

            return await response.json();

        } catch (error: any) {
            console.error('❌ Health check failed:', error);
            throw error;
        }
    }

    /**
     * Validate note upload request
     */
    validateNoteUploadRequest(request: NoteUploadRequest): {
        valid: boolean;
        error?: string;
        warnings?: string[];
    } {
        const warnings: string[] = [];

        // Check title
        if (!request.title || request.title.trim().length === 0) {
            return {
                valid: false,
                error: 'Note title is required'
            };
        }

        if (request.title.length > 200) {
            return {
                valid: false,
                error: 'Note title must be 200 characters or less'
            };
        }

        // Check files
        if (!request.files || request.files.length === 0) {
            return {
                valid: false,
                error: 'At least one image file is required'
            };
        }

        // Validate files
        const fileValidation = this.validateBulkFiles(request.files);
        if (!fileValidation.valid) {
            return {
                valid: false,
                error: fileValidation.error
            };
        }

        // Warnings for optional fields
        if (!request.subject) {
            warnings.push('No subject specified - note organization may be limited');
        }

        if (!request.description) {
            warnings.push('No description provided - consider adding context');
        }

        return {
            valid: true,
            warnings: warnings.length > 0 ? warnings : undefined
        };
    }
}

export const notesService = new NotesService();
