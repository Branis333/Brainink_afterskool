/**
 * Uploads Service for React Native
 * Handles file uploads, PDF generation, submission management, and AI processing
 * Canonical flow (mark-done, session-less):
 *   - Use bulkUploadImagesToPDF({ course_id, files, submission_type, lesson_id | block_id, assignment_id? })
 *   - Do NOT send session_id; backend accepts lesson/block context directly.
 *   - Single-file upload endpoint is deprecated and not supported by backend.
 * Based on BrainInk Backend after-school uploads endpoints
 */

// Get the correct backend URL based on environment
const getBackendUrl = () => {
    // In React Native, we'll always use the production backend
    return 'https://brainink-backend.onrender.com';
};

// ===============================
// TYPESCRIPT INTERFACES
// ===============================

// File Upload Interfaces
export interface FileValidationResult {
    valid: boolean;
    error?: string;
}

export interface AISubmission {
    id: number;
    user_id: number;
    course_id: number;
    lesson_id?: number;  // Made optional for block-based submissions
    block_id?: number;   // New: for AI-generated course blocks
    session_id?: number;  // Made optional since we switched to mark done approach
    assignment_id?: number;  // New: link to assignment for the workflow
    submission_type: string;
    original_filename?: string;
    file_path?: string;
    file_type?: string;
    ai_processed: boolean;
    ai_score?: number;
    ai_feedback?: string;
    ai_corrections?: string;
    ai_strengths?: string;
    ai_improvements?: string;
    requires_review: boolean;
    reviewed_by?: number;
    manual_score?: number;
    manual_feedback?: string;
    submitted_at: string;
    processed_at?: string;
    reviewed_at?: string;
}

// Simple file shape used by RN for uploads
export interface UploadFile {
    name: string;
    uri: string;
    type: string;
    size?: number;
}

// Bulk Image Upload Interfaces (sends images directly to Gemini without PDF conversion)
export interface BulkPDFUploadRequest {
    course_id: number;
    submission_type: 'homework' | 'quiz' | 'practice' | 'assessment';
    files: UploadFile[];
    storage_mode?: 'database';
    skip_db?: boolean;
    // Either lesson_id or block_id must be provided
    lesson_id?: number;
    block_id?: number;
    assignment_id?: number;
}

// Image Data Interface for bulk PDF creation 
export interface ImageDataForPDF {
    filename: string;
    data: string; // base64 or file path
}

export interface BulkPDFUploadResponse {
    success: boolean;
    message: string;
    submission_id: number;
    submission_filename: string;
    total_size: number;
    content_hash: string;
    total_images: number;
    image_files: string[];
    ai_processing_results?: AIProcessingResults;
    grade_available?: boolean;
    feedback_available?: boolean;
}

// AI Processing Interfaces - Now contains raw + normalized data (BrainInk pattern)
export interface AIProcessingResults {
    raw: Record<string, any>;  // Raw Gemini response - kept for backward compatibility
    normalized?: {
        score: number | null;
        percentage: number | null;
        feedback: string | null;
        ai_strengths: string[] | null;
        ai_improvements: string[] | null;
        ai_corrections: string[] | null;
        grade_letter: string | null;
        ai_processed: boolean;
        requires_review: boolean;
    };
    grade_available?: boolean;  // Flag to indicate if grade data is present
    feedback_available?: boolean;  // Flag to indicate if feedback is present
}

export interface AIGradingResponse {
    submission_id: number;
    ai_score: number;
    ai_feedback: string;
    ai_corrections?: string;
    ai_strengths?: string;
    ai_improvements?: string;
    processed_at: string;
}

export interface AISubmissionCreate {
    course_id: number;
    lesson_id?: number;  // Made optional for block-based submissions
    block_id?: number;   // New: for AI-generated course blocks
    session_id?: number;  // Made optional since we switched to mark done approach
    assignment_id?: number;  // New: link to assignment for workflow
    submission_type: 'homework' | 'quiz' | 'practice' | 'assessment';
}

// Submission Management Interfaces
export interface SessionSubmissionsFilters {
    submission_type?: string;
    limit?: number;
}

export interface SubmissionsSummary {
    session_id: number;
    course_title: string;
    lesson_title: string;
    total_submissions: number;
    processed_submissions: number;
    pending_submissions: number;
    average_score?: number;
    session_score?: number;
    session_status: string;
}

// File Download Interface
export interface FileDownloadResponse {
    blob: Blob;
    filename: string;
    contentType: string;
}

// Health Check Interface
export interface UploadServiceHealth {
    status: string;
    service: string;
    timestamp: string;
    supported_formats: string[];
    storage_method: string;
    features: string[];
}

// Configuration Constants
export const UPLOAD_CONFIG = {
    MAX_FILE_SIZE: 20 * 1024 * 1024, // 20MB
    ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.pdf', '.txt', '.doc', '.docx'],
    MAX_BULK_FILES: 20,
    SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'],
    SUPPORTED_DOCUMENT_TYPES: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};

class UploadsService {
    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private normaliseStoredArray(value: unknown): string[] | null {
        if (!value) return null;

        if (Array.isArray(value)) {
            return value.map(item => {
                if (typeof item === 'string') return item;
                try {
                    return JSON.stringify(item);
                } catch {
                    return String(item);
                }
            }).filter(Boolean);
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return [];
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return parsed.map(item => {
                        if (typeof item === 'string') return item;
                        try {
                            return JSON.stringify(item);
                        } catch {
                            return String(item);
                        }
                    }).filter(Boolean);
                }
            } catch {
                // Not JSON, return string as single element array
            }
            return [trimmed];
        }

        try {
            return [JSON.stringify(value)];
        } catch {
            return [String(value)];
        }
    }

    private async fetchSubmissionDetailsWithRetry(
        submissionId: number,
        token: string,
        attempts: number = 4,
        delayMs: number = 1200
    ): Promise<any | null> {
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                const response = await this.makeAuthenticatedRequest(
                    `/after-school/submissions/${submissionId}`,
                    token
                );
                const data = await response.json();
                if (data && typeof data === 'object') {
                    console.log('✅ Submission details fetched:', { submissionId, attempt });
                    return data;
                }
            } catch (error: any) {
                const message = error?.message?.toLowerCase?.() || '';
                if (message.includes('not found') || message.includes('404')) {
                    console.log(`ℹ️ Submission ${submissionId} not ready yet (attempt ${attempt}/${attempts})`);
                } else {
                    console.warn('⚠️ Error fetching submission details:', error);
                }
            }

            if (attempt < attempts) {
                await this.delay(delayMs);
            }
        }

        return null;
    }

    /**
     * Check if a submission has already been graded (BrainInk pattern)
     * Returns grade status and details if available
     */
    private async checkSubmissionGrade(
        submissionId: number,
        token: string
    ): Promise<{
        already_graded: boolean;
        submission_id: number;
        ai_score: number | null;
        ai_feedback: string | null;
        ai_strengths: string[] | null;
        ai_improvements: string[] | null;
        ai_corrections: string[] | null;
        processed_at: string | null;
        requires_review: boolean;
    } | null> {
        try {
            const response = await this.makeAuthenticatedRequest(
                `/after-school/submissions/${submissionId}/check-grade`,
                token
            );
            const data = await response.json();
            console.log('✅ Grade check result:', { submissionId, already_graded: data.already_graded });
            return data;
        } catch (error) {
            console.warn('⚠️ Error checking grade:', error);
            return null;
        }
    }

    private async fetchAssignmentStatusWithRetry(
        assignmentId: number | undefined,
        token: string,
        attempts: number = 3,
        delayMs: number = 1500
    ): Promise<any | null> {
        if (!assignmentId) return null;

        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                const response = await this.makeAuthenticatedRequest(
                    `/after-school/assignments/${assignmentId}/status`,
                    token
                );
                const data = await response.json();
                if (data) {
                    console.log('✅ Assignment status fetched:', { assignmentId, attempt });
                    return data;
                }
            } catch (error: any) {
                const message = error?.message?.toLowerCase?.() || '';
                if (message.includes('not found') || message.includes('404')) {
                    console.log(`ℹ️ Assignment status not ready yet for ${assignmentId} (attempt ${attempt}/${attempts})`);
                } else {
                    console.warn('⚠️ Error fetching assignment status:', error?.message || error);
                }
            }

            if (attempt < attempts) {
                await this.delay(delayMs);
            }
        }

        return null;
    }

    /**
     * Fix malformed JSON from Gemini API that has escaped quotes and trailing commas
     * Example: {"\"score\"": "0,"} -> {"score": 0}
     */
    /**
     * Parse raw Gemini grading response into usable format
     * Handles malformed keys like "\"score\"" and values like "85,"
     */
    private parseGeminiGrading(raw: any): {
        score: number | null;
        percentage: number | null;
        feedback: string | null;
        strengths: string[] | null;
        improvements: string[] | null;
        corrections: string[] | null;
        grade_letter: string | null;
        error?: string;
    } {
        // Accept many shapes: object, stringified JSON, or Gemini candidate objects
        if (!raw) {
            console.warn('⚠️ parseGeminiGrading: Empty raw data', raw);
            return {
                score: null,
                percentage: null,
                feedback: null,
                strengths: null,
                improvements: null,
                corrections: null,
                grade_letter: null,
                error: 'Empty response from AI'
            };
        }

        // If raw is a string (common when the service returns plain text), try to parse it
        let workingRaw: any = raw;
        if (typeof raw === 'string') {
            const trimmed = raw.trim();
            try {
                workingRaw = JSON.parse(trimmed);
            } catch {
                // Not JSON — store as text container so further extraction can use it
                workingRaw = { text: trimmed };
            }
        }

        // If Gemini-like wrapper objects exist, pull canonical text out
        // Common shapes: { text: '...', candidates: [{ content: { text: '...' } }] }, or { candidates: [{ text: '...' }] }
        if (workingRaw?.candidates && Array.isArray(workingRaw.candidates) && workingRaw.candidates.length > 0) {
            const cand = workingRaw.candidates[0];
            if (cand?.content?.text) workingRaw.text = cand.content.text;
            if (cand?.text) workingRaw.text = cand.text;
        }

        if (workingRaw?.choices && Array.isArray(workingRaw.choices) && workingRaw.choices.length > 0) {
            const ch = workingRaw.choices[0];
            if (ch?.message?.content?.text) workingRaw.text = ch.message.content.text;
            if (ch?.text) workingRaw.text = ch.text;
        }

        // Keep an 'error' marker but don't bail out immediately; sometimes `error` exists alongside useful fields
        const declaredError = workingRaw?.error || workingRaw?.errors || null;

        // Helper to get value from potentially malformed key
        const getValue = (obj: any, ...possibleKeys: string[]): any => {
            for (const key of possibleKeys) {
                // Try exact match
                if (key in obj) return obj[key];
                // Try with quotes
                if (`"${key}"` in obj) return obj[`"${key}"`];
                // Try with escaped quotes
                if (`\\"${key}\\"` in obj) return obj[`\\"${key}\\"`];
            }
            return null;
        };

        // Helper to clean string value (remove trailing commas, quotes, etc.)
        const cleanString = (val: any): string | null => {
            if (!val) return null;
            if (typeof val !== 'string') return String(val);
            return val.replace(/^"(.+)"$/, '$1').replace(/,\s*$/, '').trim() || null;
        };

        // Helper to parse number from potentially malformed value
        const parseNumber = (val: any): number | null => {
            if (val === null || val === undefined) return null;
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
                const cleaned = val.replace(/,\s*$/, '').trim();
                const num = parseFloat(cleaned);
                return isNaN(num) ? null : num;
            }
            return null;
        };

        // Extract values from workingRaw first, fall back to raw
        const score = parseNumber(getValue(workingRaw, 'score', 'Score')) ?? parseNumber(getValue(raw, 'score', 'Score'));
        const percentage = parseNumber(getValue(workingRaw, 'percentage', 'percent', 'Percentage')) ?? parseNumber(getValue(raw, 'percentage', 'percent', 'Percentage'));
        let feedback = cleanString(getValue(workingRaw, 'overall_feedback', 'detailed_feedback', 'feedback')) ?? cleanString(getValue(raw, 'overall_feedback', 'detailed_feedback', 'feedback'));
        const grade_letter = cleanString(getValue(workingRaw, 'grade_letter', 'letter_grade')) ?? cleanString(getValue(raw, 'grade_letter', 'letter_grade'));

        // If no explicit feedback field, but we have a text blob, use that as feedback
        if (!feedback && typeof workingRaw?.text === 'string') {
            feedback = cleanString(workingRaw.text);
        }

        // Log if score is missing
        if (score === null && percentage === null) {
            console.warn('⚠️ parseGeminiGrading: No score or percentage found in response', {
                keys: Object.keys(raw),
                rawScore: raw.score,
                rawPercentage: raw.percentage
            });
        }

        // Parse arrays (backend now returns clean arrays after normalization)
        const parseArray = (val: any): string[] | null => {
            if (!val) return null;

            // Backend normalization should give us clean arrays now
            if (Array.isArray(val)) {
                return val.map(String).filter(Boolean);
            }

            // Handle incomplete/malformed array markers
            if (typeof val === 'string') {
                const trimmed = val.trim();
                // Empty or incomplete array markers
                if (trimmed === '[' || trimmed === '{' || trimmed === '[]' || trimmed === '{}') {
                    return [];
                }
                // Try parsing stringified JSON arrays
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) {
                        return parsed.map(String).filter(Boolean);
                    }
                } catch {
                    // Not valid JSON, return empty array for safety
                    return [];
                }
            }

            return [];
        };

        const strengths = parseArray(getValue(workingRaw, 'strengths')) ?? parseArray(getValue(raw, 'strengths'));
        const improvements = parseArray(getValue(workingRaw, 'improvements', 'recommendations')) ?? parseArray(getValue(raw, 'improvements', 'recommendations'));
        const corrections = parseArray(getValue(workingRaw, 'corrections')) ?? parseArray(getValue(raw, 'corrections'));

        // If the raw payload declared an error, include it in the returned payload's error field but keep other data
        const finalError = declaredError ? (typeof declaredError === 'string' ? declaredError : JSON.stringify(declaredError)) : undefined;

        return {
            score,
            percentage,
            feedback,
            strengths,
            improvements,
            corrections,
            grade_letter,
            ...(finalError ? { error: finalError } : {})
        };
    }

    private fixMalformedGeminiJSON(raw: any): any {
        if (!raw || typeof raw !== 'object') {
            return raw;
        }

        const fixed: any = {};

        for (const [key, value] of Object.entries(raw)) {
            // Remove escaped quotes from keys: "\"score\"" -> "score"
            let cleanKey = key.replace(/^"(.+)"$/, '$1').replace(/\\"/g, '"');

            // Clean values
            let cleanValue: any = value;

            if (typeof value === 'string') {
                // Remove escaped quotes and trailing commas from string values
                // "\"F\"," -> "F"
                // "0," -> 0
                cleanValue = value.replace(/^"(.+)"$/, '$1').replace(/\\"/g, '"').replace(/,\s*$/, '').trim();

                // Try to parse as number if it looks like a number
                if (/^-?\d+(\.\d+)?$/.test(cleanValue)) {
                    cleanValue = parseFloat(cleanValue);
                }

                // Handle incomplete JSON objects/arrays (just the opening bracket)
                if (cleanValue === '[' || cleanValue === '{') {
                    cleanValue = cleanValue === '[' ? [] : {};
                }
            } else if (typeof value === 'object' && value !== null) {
                // Recursively fix nested objects
                cleanValue = this.fixMalformedGeminiJSON(value);
            }

            fixed[cleanKey] = cleanValue;
        }

        return fixed;
    }

    private async makeAuthenticatedRequest(
        endpoint: string,
        token: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
        body?: any
    ): Promise<Response> {
        if (!token) {
            throw new Error('Authentication token is required');
        }

        const headers: HeadersInit = {
            'Authorization': `Bearer ${token}`
        };

        // Only set JSON content type when sending a body
        if ((method === 'POST' || method === 'PUT')) {
            headers['Content-Type'] = 'application/json';
        }

        const config: RequestInit = {
            method,
            headers
        };

        if (body && (method === 'POST' || method === 'PUT')) {
            config.body = JSON.stringify(body);
        }

        const response = await fetch(`${getBackendUrl()}${endpoint}`, config);

        if (!response.ok) {
            // Try parse JSON error, otherwise text, otherwise status
            const text = await response.text().catch(() => '');
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const errorData = text ? JSON.parse(text) : {};
                errorMessage = errorData.detail || errorData.message || errorMessage;
                console.error('API Error:', errorData);
            } catch {
                console.error('API Error (raw):', text);
            }
            throw new Error(errorMessage);
        }

        return response;
    }

    private async makeMultipartRequest(
        endpoint: string,
        token: string,
        formData: FormData
    ): Promise<Response> {
        if (!token) {
            throw new Error('Authentication token is required');
        }

        const headers: HeadersInit = {
            'Authorization': `Bearer ${token}`
            // Don't set Content-Type for FormData, let the browser set it with boundary
        };

        const config: RequestInit = {
            method: 'POST',
            headers,
            body: formData
        };

        console.log('🌐 Making multipart request to:', `${getBackendUrl()}${endpoint}`);
        console.log('📦 FormData prepared, sending request...');

        try {
            const response = await fetch(`${getBackendUrl()}${endpoint}`, config);

            console.log('📡 Response received:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.detail || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
                console.error('❌ API Error Response:', errorData);
                throw new Error(errorMessage);
            }

            return response;
        } catch (error) {
            console.error('❌ Network/Request Error:', error);
            // If it's already our formatted error, rethrow
            if (error instanceof Error && error.message.includes('HTTP')) {
                throw error;
            }
            // Otherwise, wrap it
            throw new Error(`Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // ===============================
    // FILE VALIDATION METHODS
    // ===============================

    /**
     * Validate a single file for upload
     */
    validateFile(file: UploadFile): FileValidationResult {
        if (!file.name) {
            return { valid: false, error: 'No filename provided' };
        }

        // Check file extension
        const fileExtension = this.getFileExtension(file.name);
        if (!UPLOAD_CONFIG.ALLOWED_EXTENSIONS.includes(fileExtension)) {
            return {
                valid: false,
                error: `File type ${fileExtension} not allowed. Allowed types: ${UPLOAD_CONFIG.ALLOWED_EXTENSIONS.join(', ')}`
            };
        }

        // Check file size
        if (file.size && file.size > UPLOAD_CONFIG.MAX_FILE_SIZE) {
            return {
                valid: false,
                error: `File size exceeds maximum allowed size of ${UPLOAD_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`
            };
        }

        return { valid: true };
    }

    /**
     * Validate multiple files for bulk upload
     */
    validateBulkFiles(files: UploadFile[]): FileValidationResult {
        if (!files || files.length === 0) {
            return { valid: false, error: 'No files provided' };
        }

        if (files.length > UPLOAD_CONFIG.MAX_BULK_FILES) {
            return {
                valid: false,
                error: `Too many files. Maximum allowed: ${UPLOAD_CONFIG.MAX_BULK_FILES}`
            };
        }

        // Validate each file
        for (let i = 0; i < files.length; i++) {
            const validation = this.validateFile(files[i]);
            if (!validation.valid) {
                return {
                    valid: false,
                    error: `File ${i + 1} (${files[i].name}): ${validation.error}`
                };
            }
        }

        return { valid: true };
    }

    /**
     * Check if file is an image
     */
    isImageFile(file: UploadFile): boolean {
        return UPLOAD_CONFIG.SUPPORTED_IMAGE_TYPES.includes(file.type) ||
            ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(this.getFileExtension(file.name));
    }

    /**
     * Check if file is a document
     */
    isDocumentFile(file: UploadFile): boolean {
        return UPLOAD_CONFIG.SUPPORTED_DOCUMENT_TYPES.includes(file.type) ||
            ['.pdf', '.txt', '.doc', '.docx'].includes(this.getFileExtension(file.name));
    }

    /**
     * Get file extension from filename
     */
    getFileExtension(filename: string): string {
        return filename.toLowerCase().substring(filename.lastIndexOf('.'));
    }

    // ===============================
    // BULK PDF UPLOAD METHODS
    // ===============================

    /**
     * Upload multiple image files and send them directly to AI for grading
     * No PDF conversion - images are sent directly to Gemini for more reliable processing
     */
    async bulkUploadImagesToPDF(uploadRequest: BulkPDFUploadRequest, token: string): Promise<BulkPDFUploadResponse> {
        try {
            console.log('📤 Starting bulk image upload for course:', uploadRequest.course_id);

            // Validate the upload request
            const validation = this.validateBulkUploadRequest(uploadRequest);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Create FormData for multipart upload
            const formData = new FormData();
            formData.append('course_id', uploadRequest.course_id.toString());
            formData.append('submission_type', uploadRequest.submission_type);

            if (uploadRequest.storage_mode) {
                formData.append('storage_mode', uploadRequest.storage_mode);
            }

            if (uploadRequest.skip_db !== undefined) {
                formData.append('skip_db', uploadRequest.skip_db.toString());
            }

            // Include lesson or block context (one must be provided)
            if (uploadRequest.lesson_id) formData.append('lesson_id', uploadRequest.lesson_id.toString());
            if (uploadRequest.block_id) formData.append('block_id', uploadRequest.block_id.toString());
            if (uploadRequest.assignment_id) formData.append('assignment_id', uploadRequest.assignment_id.toString());

            // Add files to FormData (React Native compatible)
            // CRITICAL: React Native file upload MUST have proper structure for backend
            console.log('📎 Adding files to FormData:', uploadRequest.files.length);

            for (let i = 0; i < uploadRequest.files.length; i++) {
                const file = uploadRequest.files[i];
                console.log(`  File ${i + 1}:`, file.name, file.type, file.uri);

                // IMPORTANT: React Native FormData requires this EXACT structure
                // If the file upload fails, the URI might not be accessible or the file might be empty
                // The backend expects actual file binary data, not just a URI reference

                // Ensure file has all required fields
                if (!file.uri) {
                    console.error(`❌ File ${i + 1} has no URI!`);
                    throw new Error(`File ${i + 1} (${file.name}) has no URI`);
                }

                if (!file.name) {
                    console.warn(`⚠️ File ${i + 1} has no name, using default`);
                    file.name = `image_${i}.jpg`;
                }

                if (!file.type) {
                    console.warn(`⚠️ File ${i + 1} has no type, using image/jpeg`);
                    file.type = 'image/jpeg';
                }

                // React Native FormData will automatically read the file from URI
                // and send it as multipart/form-data IF the structure is correct
                const fileToUpload = {
                    uri: file.uri,
                    type: file.type,
                    name: file.name
                };

                console.log(`    ✓ Adding file with structure:`, JSON.stringify(fileToUpload, null, 2));
                formData.append('files', fileToUpload as any);
            } console.log('📤 Sending FormData to backend...');
            console.log('📝 Request summary:', {
                endpoint: '/after-school/uploads/bulk-upload-to-pdf',
                course_id: uploadRequest.course_id,
                submission_type: uploadRequest.submission_type,
                lesson_id: uploadRequest.lesson_id,
                block_id: uploadRequest.block_id,
                assignment_id: uploadRequest.assignment_id,
                fileCount: uploadRequest.files.length,
                files: uploadRequest.files.map((f, i) => ({
                    index: i + 1,
                    name: f.name,
                    type: f.type,
                    uriLength: f.uri?.length || 0
                }))
            });

            const response = await this.makeMultipartRequest(
                '/after-school/uploads/bulk-upload-to-pdf',
                token,
                formData
            );

            console.log('✅ Backend response received:', {
                status: response.status,
                ok: response.ok
            });

            const data = await response.json();

            // Response now contains ONLY raw Gemini data - no more normalized fields
            console.log('✅ Bulk image upload completed successfully');
            return data;
        } catch (error) {
            console.error('❌ Error in bulk image upload:', error);
            throw error;
        }
    }

    /**
     * Validate bulk upload request
     */
    private validateBulkUploadRequest(request: BulkPDFUploadRequest): FileValidationResult {
        if (!request.course_id || request.course_id <= 0) {
            return { valid: false, error: 'Valid course ID is required' };
        }

        if (!request.lesson_id && !request.block_id) {
            return { valid: false, error: 'Either lesson_id or block_id must be provided' };
        }

        const allowedTypes = ['homework', 'quiz', 'practice', 'assessment'];
        if (!allowedTypes.includes(request.submission_type)) {
            return { valid: false, error: `Invalid submission type. Allowed: ${allowedTypes.join(', ')}` };
        }

        // Validate files
        const filesValidation = this.validateBulkFiles(request.files);
        if (!filesValidation.valid) {
            return filesValidation;
        }

        // Check that all files are images for direct submission
        const nonImageFiles = request.files.filter(file => !this.isImageFile(file));
        if (nonImageFiles.length > 0) {
            return {
                valid: false,
                error: `All files must be images. Non-image files: ${nonImageFiles.map(f => f.name).join(', ')}`
            };
        }

        return { valid: true };
    }

    // ===============================
    // SUBMISSION MANAGEMENT METHODS
    // ===============================

    /**
     * Get all submissions for a study session
     */
    async getSessionSubmissions(
        sessionId: number,
        token: string,
        filters: SessionSubmissionsFilters = {}
    ): Promise<AISubmission[]> {
        try {
            console.log('📋 Fetching submissions for session:', sessionId);

            const params = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.append(key, value.toString());
                }
            });

            const queryString = params.toString();
            const endpoint = `/after-school/uploads/sessions/${sessionId}/submissions${queryString ? `?${queryString}` : ''}`;

            const response = await this.makeAuthenticatedRequest(endpoint, token);
            const data = await response.json();

            console.log('✅ Session submissions fetched successfully:', data.length, 'submissions');
            return data;
        } catch (error) {
            console.error('❌ Error fetching session submissions:', error);
            throw error;
        }
    }

    /**
     * Get submissions summary for a study session
     */
    async getSessionSubmissionsSummary(sessionId: number, token: string): Promise<SubmissionsSummary> {
        try {
            console.log('📊 Fetching submissions summary for session:', sessionId);
            const response = await this.makeAuthenticatedRequest(
                `/after-school/uploads/sessions/${sessionId}/submissions-summary`,
                token
            );

            const data = await response.json();
            console.log('✅ Submissions summary fetched successfully');
            return data;
        } catch (error) {
            console.error('❌ Error fetching submissions summary:', error);
            throw error;
        }
    }

    /**
     * Create a new AI submission
     */
    async createAISubmission(submissionData: AISubmissionCreate, token: string): Promise<AISubmission> {
        try {
            console.log('📤 Creating AI submission:', submissionData);
            const response = await this.makeAuthenticatedRequest(
                '/after-school/uploads/submissions/',
                token,
                'POST',
                submissionData
            );

            const data = await response.json();
            console.log('✅ AI submission created successfully:', data.id);
            return data;
        } catch (error) {
            console.error('❌ Error creating AI submission:', error);
            throw error;
        }
    }

    // ===============================
    // FILE OPERATION METHODS
    // ===============================

    /**
     * Download submission file by ID
     */
    async downloadSubmissionFile(submissionId: number, token: string): Promise<FileDownloadResponse> {
        try {
            console.log('⬇️ Downloading submission file:', submissionId);

            const headers: HeadersInit = {
                'Authorization': `Bearer ${token}`
            };

            const response = await fetch(`${getBackendUrl()}/after-school/uploads/submissions/${submissionId}/download`, {
                method: 'GET',
                headers
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.detail || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
                throw new Error(errorMessage);
            }

            // Get filename from Content-Disposition header or use default
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `submission_${submissionId}`;

            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }

            const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
            const blob = await response.blob();

            console.log('✅ File downloaded successfully:', filename);
            return {
                blob,
                filename,
                contentType
            };
        } catch (error) {
            console.error('❌ Error downloading submission file:', error);
            throw error;
        }
    }

    /**
     * Delete submission by ID
     */
    async deleteSubmission(submissionId: number, token: string): Promise<{ message: string }> {
        try {
            console.log('🗑️ Deleting submission:', submissionId);
            const response = await this.makeAuthenticatedRequest(
                `/after-school/uploads/submissions/${submissionId}`,
                token,
                'DELETE'
            );

            const data = await response.json();
            console.log('✅ Submission deleted successfully');
            return data;
        } catch (error) {
            console.error('❌ Error deleting submission:', error);
            throw error;
        }
    }

    /**
     * Reprocess submission with AI
     */
    async reprocessSubmission(submissionId: number, token: string): Promise<AIGradingResponse> {
        try {
            console.log('🤖 Reprocessing submission with AI:', submissionId);
            const response = await this.makeAuthenticatedRequest(
                `/after-school/uploads/submissions/${submissionId}/reprocess`,
                token,
                'POST'
            );

            const data = await response.json();
            console.log('✅ Submission reprocessed successfully');
            return data;
        } catch (error) {
            console.error('❌ Error reprocessing submission:', error);
            throw error;
        }
    }

    // Note: Single-file upload method removed. Use bulkUploadImagesToPDF instead.

    // ===============================
    // SERVICE HEALTH AND UTILITIES
    // ===============================

    /**
     * Check upload service health
     */
    async getServiceHealth(): Promise<UploadServiceHealth> {
        try {
            const response = await fetch(`${getBackendUrl()}/after-school/uploads/health`);

            if (!response.ok) {
                throw new Error(`Health check failed: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Upload service health check successful');
            return data;
        } catch (error) {
            console.error('❌ Upload service health check failed:', error);
            throw error;
        }
    }

    // ===============================
    // INTEGRATED WORKFLOW METHODS (New for seamless assignment workflow)
    // ===============================

    /**
     * Complete workflow: Upload images → Convert to PDF → Process with AI → Return results
     * This is the core method for the workflow: "upload pictures that turn into PDF and automatically start grading"
     */
    async uploadImagesForAssignmentWorkflow(
        courseId: number,
        assignmentId: number,
        images: UploadFile[],
        token: string,
        submissionType: 'homework' | 'quiz' | 'practice' | 'assessment' = 'homework',
        context?: { lesson_id?: number; block_id?: number }
    ): Promise<{
        pdf_submission: BulkPDFUploadResponse;
        ai_processing: AIProcessingResults;
        ready_for_grading: boolean;
    }> {
        try {
            console.log('🚀 Starting complete assignment workflow with images');
            console.log('📊 Course ID:', courseId, 'Assignment ID:', assignmentId, 'Images:', images.length);

            // Step 1: Validate images for the workflow
            const validation = this.validateBulkFiles(images);
            if (!validation.valid) {
                throw new Error(`Image validation failed: ${validation.error}`);
            }

            // Step 2: Upload images and convert to PDF
            console.log('📸 Step 2: Converting images to PDF...');
            const bulkUploadRequest: BulkPDFUploadRequest = {
                course_id: courseId,
                submission_type: submissionType,
                files: images,
                storage_mode: 'database',
                skip_db: false, // We want to store in database for the workflow
                assignment_id: assignmentId,
                lesson_id: context?.lesson_id,
                block_id: context?.block_id
            };

            const pdfSubmission = await this.bulkUploadImagesToPDF(bulkUploadRequest, token);
            console.log('✅ Step 2 completed: PDF created with submission ID:', pdfSubmission.submission_id);

            // Step 3: The backend automatically processes with AI, results are now normalized
            console.log('🤖 Step 3: AI processing completed automatically');
            let aiProcessing = pdfSubmission.ai_processing_results;

            if (!aiProcessing) {
                console.warn('⚠️ No AI processing results returned from backend');
            }

            // Use normalized data first (BrainInk pattern), fall back to raw parsing if needed
            let parsed: {
                score: number | null;
                percentage: number | null;
                feedback: string | null;
                strengths: string[] | null;
                improvements: string[] | null;
                corrections: string[] | null;
                grade_letter: string | null;
                error?: string;
            };

            if (aiProcessing?.normalized && aiProcessing.grade_available) {
                // Use normalized data directly (BrainInk pattern)
                console.log('✅ Using normalized AI results from backend');
                const norm = aiProcessing.normalized;
                parsed = {
                    score: norm.score ?? null,
                    percentage: norm.percentage ?? null,
                    feedback: norm.feedback ?? null,
                    strengths: norm.ai_strengths ?? null,
                    improvements: norm.ai_improvements ?? null,
                    corrections: norm.ai_corrections ?? null,
                    grade_letter: norm.grade_letter ?? null
                };
            } else if (aiProcessing?.raw) {
                // Fall back to parsing raw Gemini data
                console.log('ℹ️ Parsing raw Gemini data (normalized not available)');
                parsed = this.parseGeminiGrading(aiProcessing.raw);
            } else {
                // No data available
                parsed = {
                    score: null,
                    percentage: null,
                    feedback: null,
                    strengths: null,
                    improvements: null,
                    corrections: null,
                    grade_letter: null,
                    error: 'No AI processing results'
                };
            }

            // Handle specific Gemini edge cases by triggering a reprocess fallback
            if (parsed.error && pdfSubmission.submission_id) {
                const normalizedError = parsed.error.toLowerCase();
                const shouldRetry = normalizedError.includes('no text returned by gemini response') ||
                    normalizedError.includes('no text returned by the gemini response');

                if (shouldRetry) {
                    console.warn('⚠️ Gemini returned empty text. Attempting automatic fallback sync with backend...');

                    const submissionId = Number(pdfSubmission.submission_id);
                    const assignmentIdForStatus = Number.isFinite(assignmentId) ? assignmentId : undefined;

                    let fallbackRaw: Record<string, any> | null = null;
                    let reprocessData: any = null;

                    // Step 1: Wait for submission record to be queryable (handles DB timing delays)
                    const refreshedSubmission = submissionId ?
                        await this.fetchSubmissionDetailsWithRetry(submissionId, token) :
                        null;

                    if (refreshedSubmission) {
                        fallbackRaw = {
                            score: refreshedSubmission?.ai_score ?? null,
                            percentage: refreshedSubmission?.ai_score ?? null,
                            overall_feedback: refreshedSubmission?.ai_feedback || null,
                            detailed_feedback: refreshedSubmission?.ai_feedback || null,
                            strengths: this.normaliseStoredArray(refreshedSubmission?.ai_strengths),
                            improvements: this.normaliseStoredArray(refreshedSubmission?.ai_improvements),
                            corrections: this.normaliseStoredArray(refreshedSubmission?.ai_corrections)
                        };
                    }

                    // Step 2: Attempt a backend reprocess after a short delay (avoids hitting stale state)
                    if (submissionId) {
                        await this.delay(1200);
                        try {
                            const reprocessResponse = await this.makeAuthenticatedRequest(
                                `/after-school/uploads/submissions/${submissionId}/reprocess`,
                                token,
                                'POST'
                            );
                            reprocessData = await reprocessResponse.json();

                            if (!fallbackRaw) {
                                fallbackRaw = {};
                            }

                            if (reprocessData) {
                                fallbackRaw.score = reprocessData.ai_score ?? fallbackRaw.score ?? null;
                                fallbackRaw.percentage = reprocessData.ai_score ?? fallbackRaw.percentage ?? null;
                                fallbackRaw.overall_feedback = reprocessData.ai_feedback || fallbackRaw.overall_feedback || null;
                                fallbackRaw.detailed_feedback = fallbackRaw.overall_feedback || fallbackRaw.detailed_feedback || null;
                            }
                        } catch (fallbackError) {
                            console.error('❌ Reprocess attempt failed (will try other fallbacks):', fallbackError);
                        }
                    }

                    // Step 3: Poll assignment status for the latest grading outcome if still empty
                    if ((!fallbackRaw || (!fallbackRaw.overall_feedback && fallbackRaw.score == null)) && assignmentIdForStatus) {
                        const assignmentStatus = await this.fetchAssignmentStatusWithRetry(assignmentIdForStatus, token);
                        const gradeResult = assignmentStatus?.grade_result;
                        const studentAssignment = assignmentStatus?.student_assignment;

                        if (gradeResult || studentAssignment) {
                            fallbackRaw = {
                                score: gradeResult?.score ?? studentAssignment?.grade ?? fallbackRaw?.score ?? null,
                                percentage: gradeResult?.percentage ?? studentAssignment?.grade ?? fallbackRaw?.percentage ?? null,
                                grade_letter: gradeResult?.grade_letter ?? null,
                                overall_feedback: gradeResult?.overall_feedback || studentAssignment?.feedback || fallbackRaw?.overall_feedback || null,
                                detailed_feedback: gradeResult?.detailed_feedback || fallbackRaw?.detailed_feedback || null,
                                strengths: this.normaliseStoredArray(gradeResult?.strengths || gradeResult?.normalized?.ai_strengths || fallbackRaw?.strengths || null),
                                improvements: this.normaliseStoredArray(gradeResult?.improvements || gradeResult?.recommendations || fallbackRaw?.improvements || null),
                                corrections: this.normaliseStoredArray(gradeResult?.corrections || fallbackRaw?.corrections || null)
                            };
                        }
                    }

                    if (fallbackRaw) {
                        const reparsed = this.parseGeminiGrading(fallbackRaw);

                        if (!reparsed.error) {
                            console.log('✅ Fallback sync succeeded. Using refreshed AI results.');
                            parsed = reparsed;
                            aiProcessing = { raw: fallbackRaw };
                        } else {
                            console.error('❌ Fallback sync still produced an error:', reparsed.error);
                        }
                    }
                }
            }

            // If parsing still resulted in an error after fallbacks, do not throw — return partial results
            if (parsed.error) {
                console.error('❌ AI processing error (non-fatal):', parsed.error);

                // Ensure aiProcessing exists and attach normalized fields and error info for the UI
                aiProcessing = aiProcessing || { raw: {} };
                aiProcessing.normalized = aiProcessing.normalized || {
                    score: parsed.score ?? null,
                    percentage: parsed.percentage ?? null,
                    feedback: parsed.feedback ?? null,
                    ai_strengths: parsed.strengths ?? null,
                    ai_improvements: parsed.improvements ?? null,
                    ai_corrections: parsed.corrections ?? null,
                    grade_letter: parsed.grade_letter ?? null,
                    ai_processed: false,
                    requires_review: true
                };
                // Expose the parsing error so UI can show a message/helpful feedback
                aiProcessing.raw = aiProcessing.raw || {};
                aiProcessing.raw._parsing_error = parsed.error;

                console.log('✅ Assignment workflow completed with AI parsing issues (partial results returned)');

                return {
                    pdf_submission: pdfSubmission,
                    ai_processing: aiProcessing,
                    ready_for_grading: false
                };
            }

            console.log('✅ Assignment workflow completed successfully');
            console.log('📊 AI Score:', parsed.score, 'Feedback available:', !!parsed.feedback);

            // Attach normalized result to aiProcessing for consistency
            aiProcessing = aiProcessing || { raw: {} };
            aiProcessing.normalized = aiProcessing.normalized || {
                score: parsed.score ?? null,
                percentage: parsed.percentage ?? null,
                feedback: parsed.feedback ?? null,
                ai_strengths: parsed.strengths ?? null,
                ai_improvements: parsed.improvements ?? null,
                ai_corrections: parsed.corrections ?? null,
                grade_letter: parsed.grade_letter ?? null,
                ai_processed: true,
                requires_review: false
            };

            return {
                pdf_submission: pdfSubmission,
                ai_processing: aiProcessing,
                ready_for_grading: parsed.score != null && parsed.score >= 0
            };

        } catch (error) {
            console.error('❌ Error in assignment workflow:', error);
            throw error;
        }
    }

    /**
     * Check if uploaded images are ready for assignment workflow
     */
    validateImagesForWorkflow(images: UploadFile[]): {
        valid: boolean;
        error?: string;
        warnings?: string[];
    } {
        const warnings: string[] = [];

        // Check if any images provided
        if (!images || images.length === 0) {
            return { valid: false, error: 'At least one image is required for the assignment workflow' };
        }

        // Check maximum number of images (backend might have limits)
        if (images.length > 20) {
            return { valid: false, error: 'Too many images. Maximum 20 images allowed per assignment.' };
        }

        // Validate each image
        for (const image of images) {
            const validation = this.validateFile(image);
            if (!validation.valid) {
                return { valid: false, error: `Image "${image.name}": ${validation.error}` };
            }

            if (!this.isImageFile(image)) {
                return { valid: false, error: `File "${image.name}" is not a valid image file` };
            }
        }

        // Add warnings for common issues
        if (images.length > 10) {
            warnings.push('Large number of images may take longer to process');
        }

        const totalSize = this.calculateTotalFileSize(images);
        if (totalSize > 15 * 1024 * 1024) { // 15MB warning threshold
            warnings.push('Large total file size may slow down processing');
        }

        return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
    }

    // ===============================
    // UTILITY AND HELPER METHODS
    // ===============================

    /**
     * Format file size in human-readable format
     */
    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Get file type category
     */
    getFileTypeCategory(file: UploadFile): 'image' | 'document' | 'other' {
        if (this.isImageFile(file)) return 'image';
        if (this.isDocumentFile(file)) return 'document';
        return 'other';
    }

    /**
     * Generate unique filename for upload
     */
    generateUniqueFilename(originalFilename: string, userId: number, contextId: number): string {
        const extension = this.getFileExtension(originalFilename);
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        return `ctx_${contextId}_user_${userId}_${timestamp}_${randomString}${extension}`;
    }

    /**
     * Check if submission needs review based on AI score
     */
    needsManualReview(submission: AISubmission): boolean {
        if (!submission.ai_processed || submission.ai_score === null || submission.ai_score === undefined) {
            return true; // Not processed yet, needs review
        }

        // Low scores might need manual review
        if (submission.ai_score < 60) {
            return true;
        }

        // Already manually reviewed
        if (submission.reviewed_by) {
            return false;
        }

        return false;
    }

    /**
     * Get submission status color for UI
     */
    getSubmissionStatusColor(submission: AISubmission): string {
        if (!submission.ai_processed) return '#F59E0B'; // pending - amber
        if (submission.requires_review) return '#EF4444'; // needs review - red
        if (submission.ai_score && submission.ai_score >= 80) return '#10B981'; // good - green
        if (submission.ai_score && submission.ai_score >= 60) return '#F59E0B'; // average - amber
        return '#EF4444'; // poor - red
    }

    /**
     * Get submission type display name
     */
    getSubmissionTypeDisplayName(type: string): string {
        const displayNames: { [key: string]: string } = {
            'homework': 'Homework Assignment',
            'quiz': 'Quiz Submission',
            'practice': 'Practice Exercise',
            'assessment': 'Assessment Task'
        };
        return displayNames[type] || type;
    }

    /**
     * Calculate total file size for bulk upload
     */
    calculateTotalFileSize(files: UploadFile[]): number {
        return files.reduce((total, file) => total + (file.size || 0), 0);
    }

    /**
     * Validate total file size for bulk upload
     */
    validateTotalFileSize(files: UploadFile[]): FileValidationResult {
        const totalSize = this.calculateTotalFileSize(files);
        const maxTotalSize = UPLOAD_CONFIG.MAX_FILE_SIZE * 5; // Allow 5x the single file limit for bulk

        if (totalSize > maxTotalSize) {
            return {
                valid: false,
                error: `Total file size (${this.formatFileSize(totalSize)}) exceeds maximum allowed (${this.formatFileSize(maxTotalSize)})`
            };
        }

        return { valid: true };
    }

    /**
     * Get AI processing status message
     */
    getAIProcessingStatusMessage(submission: AISubmission): string {
        if (!submission.ai_processed) {
            return 'Processing with AI...';
        }

        if (submission.ai_score === null || submission.ai_score === undefined) {
            return 'AI processing completed, no score available';
        }

        if (submission.ai_score >= 90) {
            return `Excellent work! Score: ${submission.ai_score}%`;
        } else if (submission.ai_score >= 80) {
            return `Great job! Score: ${submission.ai_score}%`;
        } else if (submission.ai_score >= 70) {
            return `Good effort! Score: ${submission.ai_score}%`;
        } else if (submission.ai_score >= 60) {
            return `Keep improving! Score: ${submission.ai_score}%`;
        } else {
            return `Needs more work. Score: ${submission.ai_score}%`;
        }
    }

    /**
     * Get user's recent submissions (mark-done model)
     */
    async getUserRecentSubmissions(token: string, limit: number = 10): Promise<AISubmission[]> {
        try {
            // Enforce backend constraint: limit must be <= 50 per API validation
            const safeLimit = Math.min(Math.max(1, Math.floor(limit || 10)), 50);
            console.log('📋 Fetching recent submissions for user...');

            const response = await this.makeAuthenticatedRequest(
                `/after-school/uploads/user/recent-submissions?limit=${encodeURIComponent(safeLimit)}`,
                token
            );

            const data = await response.json();
            const submissions: AISubmission[] = Array.isArray(data) ? data : [];
            console.log(`✅ User recent submissions fetched successfully: ${submissions.length} submissions`);
            return submissions;
        } catch (error) {
            console.error('❌ Error fetching user recent submissions:', error?.message || error);
            return [];
        }
    }

    /**
     * Get user's upload statistics and analytics
     */
    async getUserUploadStats(token: string): Promise<{
        totalUploads: number;
        totalSizeUploaded: number;
        successfulUploads: number;
        pendingProcessing: number;
        averageScore: number;
        thisWeekUploads: number;
        thisMonthUploads: number;
    }> {
        try {
            console.log('📊 Fetching user upload statistics...');

            const response = await this.makeAuthenticatedRequest(
                `/after-school/uploads/user/statistics`,
                token
            );

            const stats = await response.json();
            console.log('✅ User upload statistics fetched successfully');
            return {
                totalUploads: stats.total_uploads || 0,
                totalSizeUploaded: stats.total_size_uploaded || 0,
                successfulUploads: stats.successful_uploads || 0,
                pendingProcessing: stats.pending_processing || 0,
                averageScore: stats.average_score || 0,
                thisWeekUploads: stats.this_week_uploads || 0,
                thisMonthUploads: stats.this_month_uploads || 0,
            };
        } catch (error) {
            console.error('❌ Error fetching user upload statistics:', (error as any)?.message || error);
            return {
                totalUploads: 0,
                totalSizeUploaded: 0,
                successfulUploads: 0,
                pendingProcessing: 0,
                averageScore: 0,
                thisWeekUploads: 0,
                thisMonthUploads: 0,
            };
        }
    }

    /**
     * Extract key insights from AI feedback
     */
    extractAIInsights(submission: AISubmission): {
        hasStrengths: boolean;
        hasImprovements: boolean;
        hasCorrections: boolean;
        overallTone: 'positive' | 'neutral' | 'needs_work';
    } {
        const hasStrengths = Boolean(submission.ai_strengths && submission.ai_strengths.trim().length > 0);
        const hasImprovements = Boolean(submission.ai_improvements && submission.ai_improvements.trim().length > 0);
        const hasCorrections = Boolean(submission.ai_corrections && submission.ai_corrections.trim().length > 0);

        let overallTone: 'positive' | 'neutral' | 'needs_work' = 'neutral';

        if (submission.ai_score) {
            if (submission.ai_score >= 80) {
                overallTone = 'positive';
            } else if (submission.ai_score < 60) {
                overallTone = 'needs_work';
            }
        }

        return {
            hasStrengths,
            hasImprovements,
            hasCorrections,
            overallTone
        };
    }

    // ===============================
    // WORKFLOW-SPECIFIC HELPER METHODS
    // ===============================

    /**
     * Get workflow step description for UI
     */
    getWorkflowStepDescription(step: 'upload' | 'convert' | 'process' | 'complete'): string {
        switch (step) {
            case 'upload': return 'Uploading images for assignment...';
            case 'convert': return 'Converting images to PDF document...';
            case 'process': return 'Processing with AI for automatic grading...';
            case 'complete': return 'Assignment submitted successfully! Results ready.';
            default: return 'Processing assignment...';
        }
    }

    /**
     * Estimate processing time for workflow
     */
    estimateWorkflowProcessingTime(imageCount: number): {
        estimatedSeconds: number;
        displayMessage: string;
    } {
        // Rough estimate: 2-3 seconds per image + PDF conversion + AI processing
        const baseTime = 10; // Base processing time
        const perImageTime = 3; // Seconds per image
        const estimatedSeconds = baseTime + (imageCount * perImageTime);

        let displayMessage = '';
        if (estimatedSeconds < 30) {
            displayMessage = 'This should take less than 30 seconds...';
        } else if (estimatedSeconds < 60) {
            displayMessage = 'This should take about a minute...';
        } else {
            displayMessage = `This may take up to ${Math.ceil(estimatedSeconds / 60)} minutes...`;
        }

        return { estimatedSeconds, displayMessage };
    }

    /**
     * Check if workflow is ready for next step
     */
    isWorkflowReadyForNextStep(
        currentStep: 'images_selected' | 'uploading' | 'processing' | 'completed',
        images?: UploadFile[],
        submission?: BulkPDFUploadResponse
    ): {
        ready: boolean;
        nextStep?: string;
        message?: string;
    } {
        switch (currentStep) {
            case 'images_selected':
                if (!images || images.length === 0) {
                    return { ready: false, message: 'Please select at least one image' };
                }
                return {
                    ready: true,
                    nextStep: 'uploading',
                    message: `Ready to upload ${images.length} image${images.length > 1 ? 's' : ''}`
                };

            case 'uploading':
                return {
                    ready: false,
                    message: 'Please wait while images are being uploaded and converted to PDF...'
                };

            case 'processing':
                if (submission && submission.ai_processing_results) {
                    return {
                        ready: true,
                        nextStep: 'completed',
                        message: 'AI processing completed! Results are ready.'
                    };
                }
                return {
                    ready: false,
                    message: 'AI is analyzing your submission...'
                };

            case 'completed':
                return {
                    ready: true,
                    message: 'Assignment workflow completed! You can continue to the next assignment.'
                };

            default:
                return { ready: false, message: 'Unknown workflow state' };
        }
    }

    /**
     * Get assignment workflow summary for display
     */
    getWorkflowSummary(
        images: UploadFile[],
        pdfSubmission?: BulkPDFUploadResponse,
        aiResults?: AIProcessingResults
    ): {
        imagesCount: number;
        pdfGenerated: boolean;
        aiProcessed: boolean;
        score?: number;
        feedback?: string;
        status: 'pending' | 'processing' | 'completed' | 'error';
    } {
        const imagesCount = images?.length || 0;
        const pdfGenerated = !!pdfSubmission?.submission_filename;

        // Parse raw AI results if available
        const parsed = aiResults?.raw ? this.parseGeminiGrading(aiResults.raw) : null;
        const aiProcessed = !!(parsed && parsed.score != null);

        let status: 'pending' | 'processing' | 'completed' | 'error' = 'pending';

        if (aiProcessed) {
            status = 'completed';
        } else if (pdfGenerated) {
            status = 'processing';
        } else if (imagesCount > 0) {
            status = 'processing';
        }

        return {
            imagesCount,
            pdfGenerated,
            aiProcessed,
            score: parsed?.score ?? undefined,
            feedback: parsed?.feedback ?? undefined,
            status
        };
    }
}

export const uploadsService = new UploadsService();