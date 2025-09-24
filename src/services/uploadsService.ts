/**
 * Uploads Service for React Native
 * Handles file uploads, PDF generation, submission management, and AI processing
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
    session_id: number;
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

// Bulk PDF Upload Interfaces (Updated to match backend form data structure)
export interface BulkPDFUploadRequest {
    session_id: number;
    submission_type: 'homework' | 'quiz' | 'practice' | 'assessment';
    files: UploadFile[];
    storage_mode?: 'database';
    skip_db?: boolean;
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
    pdf_filename: string;
    pdf_size: number;
    content_hash: string;
    total_images: number;
    ai_processing_results?: AIProcessingResults;
}

// AI Processing Interfaces
export interface AIProcessingResults {
    content_extracted: string;
    ai_score: number;
    ai_feedback: string;
    ai_strengths: string;
    ai_improvements: string;
    ai_corrections: string;
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
    session_id: number;
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

        const response = await fetch(`${getBackendUrl()}${endpoint}`, config);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.detail || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
            console.error('API Error:', errorData);
            throw new Error(errorMessage);
        }

        return response;
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
     * Upload multiple image files and combine them into a single PDF
     */
    async bulkUploadImagesToPDF(uploadRequest: BulkPDFUploadRequest, token: string): Promise<BulkPDFUploadResponse> {
        try {
            console.log('📤 Starting bulk PDF upload for session:', uploadRequest.session_id);

            // Validate the upload request
            const validation = this.validateBulkUploadRequest(uploadRequest);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Create FormData for multipart upload
            const formData = new FormData();
            formData.append('session_id', uploadRequest.session_id.toString());
            formData.append('submission_type', uploadRequest.submission_type);

            if (uploadRequest.storage_mode) {
                formData.append('storage_mode', uploadRequest.storage_mode);
            }

            if (uploadRequest.skip_db !== undefined) {
                formData.append('skip_db', uploadRequest.skip_db.toString());
            }

            // Add files to FormData (React Native compatible)
            uploadRequest.files.forEach((file, index) => {
                // In React Native, files come as objects with uri, type, name
                formData.append('files', {
                    uri: file.uri,
                    type: file.type,
                    name: file.name
                } as any);
            });

            const response = await this.makeMultipartRequest(
                '/after-school/uploads/bulk-upload-to-pdf',
                token,
                formData
            );

            const data = await response.json();
            console.log('✅ Bulk PDF upload completed successfully');
            return data;
        } catch (error) {
            console.error('❌ Error in bulk PDF upload:', error);
            throw error;
        }
    }

    /**
     * Validate bulk upload request
     */
    private validateBulkUploadRequest(request: BulkPDFUploadRequest): FileValidationResult {
        if (!request.session_id || request.session_id <= 0) {
            return { valid: false, error: 'Valid session ID is required' };
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

        // Check that all files are images for PDF generation
        const nonImageFiles = request.files.filter(file => !this.isImageFile(file));
        if (nonImageFiles.length > 0) {
            return {
                valid: false,
                error: `All files must be images for PDF generation. Non-image files: ${nonImageFiles.map(f => f.name).join(', ')}`
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

    // ===============================
    // SINGLE FILE UPLOAD METHODS
    // ===============================

    /**
     * Upload a single file for a submission
     */
    async uploadSingleFile(
        sessionId: number,
        file: UploadFile,
        submissionType: 'homework' | 'quiz' | 'practice' | 'assessment',
        token: string
    ): Promise<AISubmission> {
        try {
            console.log('📤 Uploading single file for session:', sessionId);

            // Validate file
            const validation = this.validateFile(file);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Create FormData for file upload
            const formData = new FormData();
            formData.append('session_id', sessionId.toString());
            formData.append('submission_type', submissionType);

            const blob = new Blob([file.uri], { type: file.type });
            formData.append('file', blob, file.name);

            const response = await this.makeMultipartRequest(
                '/after-school/uploads/single-file',
                token,
                formData
            );

            const data = await response.json();
            console.log('✅ Single file uploaded successfully');
            return data;
        } catch (error) {
            console.error('❌ Error uploading single file:', error);
            throw error;
        }
    }

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
        sessionId: number,
        assignmentId: number,
        images: UploadFile[],
        token: string,
        submissionType: 'homework' | 'quiz' | 'practice' | 'assessment' = 'homework'
    ): Promise<{
        pdf_submission: BulkPDFUploadResponse;
        ai_processing: AIProcessingResults;
        ready_for_grading: boolean;
    }> {
        try {
            console.log('🚀 Starting complete assignment workflow with images');
            console.log('📊 Session ID:', sessionId, 'Assignment ID:', assignmentId, 'Images:', images.length);

            // Step 1: Validate images for the workflow
            const validation = this.validateBulkFiles(images);
            if (!validation.valid) {
                throw new Error(`Image validation failed: ${validation.error}`);
            }

            // Step 2: Upload images and convert to PDF
            console.log('📸 Step 2: Converting images to PDF...');
            const bulkUploadRequest: BulkPDFUploadRequest = {
                session_id: sessionId,
                submission_type: submissionType,
                files: images,
                storage_mode: 'database',
                skip_db: false  // We want to store in database for the workflow
            };

            const pdfSubmission = await this.bulkUploadImagesToPDF(bulkUploadRequest, token);
            console.log('✅ Step 2 completed: PDF created with submission ID:', pdfSubmission.submission_id);

            // Step 3: The backend automatically processes with AI, so we have the results
            console.log('🤖 Step 3: AI processing completed automatically');
            const aiProcessing = pdfSubmission.ai_processing_results;

            if (!aiProcessing) {
                console.warn('⚠️ No AI processing results returned from backend');
            }

            // Step 4: Workflow complete - ready for grading integration
            console.log('✅ Assignment workflow completed successfully');
            console.log('📊 AI Score:', aiProcessing?.ai_score, 'Feedback available:', !!aiProcessing?.ai_feedback);

            return {
                pdf_submission: pdfSubmission,
                ai_processing: aiProcessing || {
                    content_extracted: '',
                    ai_score: 0,
                    ai_feedback: 'Processing pending',
                    ai_strengths: '',
                    ai_improvements: '',
                    ai_corrections: ''
                },
                ready_for_grading: !!aiProcessing && aiProcessing.ai_score > 0
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
    generateUniqueFilename(originalFilename: string, userId: number, sessionId: number): string {
        const extension = this.getFileExtension(originalFilename);
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        return `session_${sessionId}_user_${userId}_${timestamp}_${randomString}${extension}`;
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
     * Get user's recent submissions across all sessions
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
        const pdfGenerated = !!pdfSubmission?.pdf_filename;
        const aiProcessed = !!aiResults?.ai_score;

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
            score: aiResults?.ai_score,
            feedback: aiResults?.ai_feedback,
            status
        };
    }
}

export const uploadsService = new UploadsService();