/**
 * After School Service for React Native
 * Handles all after-school course management, lessons, and student progress
 * Based on BrainInk Backend after-school endpoints
 */

// Get the correct backend URL based on environment
const getBackendUrl = () => {
    // In React Native, we'll always use the production backend
    return 'https://brainink-backend.onrender.com';
};

// ===============================
// TYPESCRIPT INTERFACES
// ===============================


export interface CourseCreate {
    title: string;
    subject: string;
    description?: string;
    age_min: number;
    age_max: number;
    difficulty_level: 'beginner' | 'intermediate' | 'advanced';
}

export interface CourseUpdate {
    title?: string;
    subject?: string;
    description?: string;
    age_min?: number;
    age_max?: number;
    difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
    is_active?: boolean;
}

export interface Course {
    id: number;
    title: string;
    subject: string;
    description?: string;
    age_min: number;
    age_max: number;
    difficulty_level: string;
    created_by: number;
    is_active: boolean;

    // Enhanced course structure fields
    total_weeks: number;
    blocks_per_week: number;
    textbook_source?: string;
    generated_by_ai: boolean;

    created_at: string;
    updated_at: string;
}

// Lesson Interfaces
export interface LessonCreate {
    title: string;
    content?: string;
    learning_objectives?: string;
    order_index: number;
    estimated_duration: number;
}

export interface LessonUpdate {
    title?: string;
    content?: string;
    learning_objectives?: string;
    order_index?: number;
    estimated_duration?: number;
    is_active?: boolean;
}

export interface CourseLesson {
    id: number;
    course_id: number;
    title: string;
    content?: string;
    learning_objectives?: string;
    order_index: number;
    estimated_duration: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CourseWithLessons extends Course {
    lessons: CourseLesson[];
}

// Course Block Interfaces (for AI-generated courses)
export interface CourseBlock {
    id: number;
    course_id: number;
    week: number;
    block_number: number;
    title: string;
    description?: string;
    learning_objectives?: string[];
    content?: string;
    duration_minutes: number;
    resources?: Array<{ type: string; title: string; url: string }>;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// Course Assignment Interfaces
export interface CourseAssignment {
    id: number;
    course_id: number;
    title: string;
    description: string;
    assignment_type: 'homework' | 'quiz' | 'project' | 'assessment';
    instructions?: string;
    duration_minutes: number;
    points: number;
    rubric?: string;
    week_assigned?: number;
    block_id?: number;
    due_days_after_assignment: number;
    submission_format?: string;
    learning_outcomes?: string[];
    generated_by_ai: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// Student Assignment Interfaces
export interface StudentAssignment {
    id: number;
    user_id: number;
    assignment_id: number;
    course_id: number;
    assigned_at: string;
    due_date: string;
    submitted_at?: string;
    status: 'assigned' | 'submitted' | 'graded' | 'overdue' | 'passed' | 'needs_retry' | 'failed';
    submission_file_path?: string;
    submission_content?: string;
    grade?: number;
    ai_grade?: number;
    manual_grade?: number;
    feedback?: string;
    created_at: string;
    updated_at: string;

    // Populated assignment details
    assignment?: CourseAssignment;
}

export interface CourseWithBlocks extends Course {
    blocks: CourseBlock[];
    assignments: CourseAssignment[];
}

export interface ComprehensiveCourse extends Course {
    blocks: CourseBlock[];
    lessons: CourseLesson[];
    assignments: CourseAssignment[];
    total_blocks: number;
    estimated_total_duration: number;
}

// Unified shape returned by getUnifiedCourse (may normalize partial backend responses)
export interface UnifiedCourse extends ComprehensiveCourse {
    // No extra fields yet; placeholder for future normalization metadata
}

// Study Session Interfaces (deprecated - replaced by newer interface below)
export interface StudySessionMarkDoneLegacy {
    course_id: number;
    lesson_id?: number; // Optional for legacy courses
    block_id?: number;  // For AI-generated course blocks
}

export interface StudySessionEnd {
    completion_percentage: number;
    status: 'completed' | 'abandoned';
}

// Block Availability Interface
export interface BlockAvailability {
    available: boolean;
    completed: boolean;
    reason: string;
}

export interface StudySession {
    id: number;
    user_id: number;
    course_id: number;
    lesson_id?: number;  // Optional for block-based sessions
    block_id?: number;   // For AI-generated course blocks
    started_at: string;
    ended_at?: string;
    duration_minutes?: number;
    ai_score?: number;
    ai_feedback?: string;
    ai_recommendations?: string;
    status: string;
    completion_percentage: number;
    created_at: string;
    updated_at: string;
}

// AI Submission Interfaces
export interface AISubmissionCreate {
    course_id: number;
    lesson_id?: number;
    block_id?: number;
    session_id?: number; // deprecated in mark-done model
    submission_type: 'homework' | 'quiz' | 'practice' | 'assessment';
}

export interface AISubmission {
    id: number;
    user_id: number;
    course_id: number;
    lesson_id?: number;
    block_id?: number;
    session_id?: number; // may be undefined in mark-done model
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

// Student Progress Interfaces
export interface StudentProgress {
    id: number;
    user_id: number;
    course_id: number;
    lessons_completed: number;
    total_lessons: number;
    completion_percentage: number;
    // Added for block-based courses
    blocks_completed?: number;
    total_blocks?: number;
    average_score?: number;
    total_study_time: number;
    sessions_count: number;
    started_at: string;
    last_activity: string;
    completed_at?: string;
    created_at: string;
    updated_at: string;
}

// Response Interfaces
export interface CourseListResponse {
    courses: Course[];
    total: number;
}

export interface LessonListResponse {
    lessons: CourseLesson[];
    total: number;
}

export interface StudySessionListResponse {
    sessions: StudySession[];
    total: number;
}

export interface StudentDashboard {
    user_id: number;
    active_courses: Course[];
    recent_sessions: StudySession[];
    progress_summary?: StudentProgress[];
    total_study_time?: number;
    average_score?: number | null;
}

// Assignment Grading Interfaces - Updated to match backend response structure
export interface AssignmentGradeResult {
    status: 'success' | 'ready' | string;
    message: string;
    assignment: {
        id: number;
        title: string;
        type?: string;
        description?: string;
        points?: number;
    };
    grade_result: {
        score?: number | null;
        percentage?: number | null;
        grade_letter?: string | null;
        overall_feedback?: string | null;
        detailed_feedback?: string | null;
        strengths?: string[] | string | null;
        improvements?: string[] | string | null;
        recommendations?: string[] | string | null;
        normalized?: any;
        passing_grade: boolean;
        required_percentage: number;
    } | null;
    student_assignment: {
        id: number;
        status: 'assigned' | 'submitted' | 'graded' | 'overdue' | 'passed' | 'needs_retry' | 'failed';
        grade: number | null;
        submitted_at?: string | null;
        feedback?: string | null;
        graded_by?: string | null;
        submission_id?: number | null;
        attempts_used?: number;
        can_retry?: boolean;
        attempts_remaining?: number;
    };
    processed_at: string;
    retry_info?: {
        is_retry_attempt: boolean;
        attempts_used: number;
        attempts_remaining: number;
    };
}

export interface AssignmentStatus {
    assignment: {
        id: number;
        title: string;
        description?: string | null;
        points?: number | null;
        required_percentage: number;
    };
    student_assignment: {
        id: number;
        status: 'assigned' | 'submitted' | 'graded' | 'overdue' | 'passed' | 'needs_retry' | 'failed';
        grade: number;
        submitted_at?: string | null;
        feedback?: string | null;
        submission_id?: number | null;
    };
    attempts_info: {
        attempts_used: number;
        attempts_remaining: number;
        can_retry: boolean;
        latest_submission_at?: string | null;
    };
    message: string;
    passing_grade: boolean;
}

export interface BlockProgress {
    block_id: number;
    week: number;
    block_number: number;
    title: string;
    description: string;
    duration_minutes: number;
    is_completed: boolean;
    is_available: boolean;
    completed_at?: string;
}

export interface CourseBlocksProgress {
    course_id: number;
    total_blocks: number;
    completed_blocks: number;
    completion_percentage: number;
    blocks: BlockProgress[];
}

export interface MessageResponse {
    message: string;
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

// Course Filtering Options
export interface CourseFilters {
    subject?: string;
    search?: string;
    age?: number;
    age_range?: 'early' | 'middle' | 'late';
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    created_by?: number;
    active_only?: boolean;
    has_lessons?: boolean;
    popular?: boolean;
    recent?: boolean;
    sort_by?: 'title' | 'subject' | 'created_at' | 'difficulty' | 'popularity';
    sort_order?: 'asc' | 'desc';
    skip?: number;
    limit?: number;
}



// Course progress with blocks - Updated to match backend response
export interface CourseBlocksProgressResponse {
    course_id: number;
    total_blocks: number;
    completed_blocks: number;
    completion_percentage: number;
    blocks: Array<{
        block_id: number;
        week: number;
        block_number: number;
        title: string;
        description?: string;
        duration_minutes: number;
        is_completed: boolean;
        is_available: boolean;
        completed_at?: string;
    }>;
}

// Study session mark-done response mirrors backend StudySessionOut
export type StudySessionMarkDoneResponse = StudySession;

class AfterSchoolService {
    private dashboardInFlight: Promise<StudentDashboard> | null = null;
    /**
     * Enhanced error handler with specific error types and user-friendly messages
     */
    private handleApiError(error: any, context: string): Error {
        console.error(`❌ ${context}:`, error);

        let userMessage = 'An unexpected error occurred. Please try again.';

        if (error.message) {
            const errorMsg = error.message.toLowerCase();

            if (errorMsg.includes('database connection error') || errorMsg.includes('connection refused')) {
                userMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
            } else if (errorMsg.includes('validation error') || errorMsg.includes('pydantic')) {
                userMessage = 'Invalid data format. Please contact support if this continues.';
            } else if (errorMsg.includes('unauthorized') || errorMsg.includes('authentication')) {
                userMessage = 'Authentication failed. Please log in again.';
            } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
                userMessage = 'The requested content was not found.';
            } else if (errorMsg.includes('timeout')) {
                userMessage = 'Request timed out. Please try again.';
            } else {
                userMessage = error.message;
            }
        }

        return new Error(userMessage);
    }
    // Cache: courseId -> raw assignment definitions
    private assignmentDefinitionsCache: Map<number, CourseAssignment[]> = new Map();
    private assignmentDefinitionsFetchInFlight: Map<number, Promise<CourseAssignment[]>> = new Map();

    /**
     * Retry wrapper for API calls with exponential backoff for database connection errors
     */
    private async retryApiCall<T>(
        apiCall: () => Promise<T>,
        maxRetries: number = 3,
        baseDelayMs: number = 1000
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await apiCall();
            } catch (error: any) {
                lastError = error;

                // Only retry on database connection errors
                const errorMsg = error.message?.toLowerCase() || '';
                const isRetryableError = errorMsg.includes('database connection error') ||
                    errorMsg.includes('connection refused') ||
                    errorMsg.includes('timeout');

                if (!isRetryableError || attempt === maxRetries) {
                    throw error;
                }

                // Exponential backoff with jitter
                const delayMs = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000;
                console.log(`⏳ Retrying in ${Math.round(delayMs)}ms... (attempt ${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        throw lastError || new Error('Retry failed');
    }

    /**
     * Sanitize course data to ensure all required fields have proper default values
     * This handles cases where backend might return null/undefined for new fields
     */
    private sanitizeCourseData(course: any): Course {
        return {
            ...course,
            // Ensure new fields have default values if null/undefined
            total_weeks: course.total_weeks ?? 8,
            blocks_per_week: course.blocks_per_week ?? 2,
            textbook_source: course.textbook_source ?? null,
            textbook_content: course.textbook_content ?? null,
            generated_by_ai: course.generated_by_ai ?? false,

            // Ensure other fields have sensible defaults
            description: course.description ?? '',
            difficulty_level: course.difficulty_level ?? 'beginner',
            is_active: course.is_active ?? true,
            age_min: course.age_min ?? 3,
            age_max: course.age_max ?? 16
        };
    }

    /**
     * Sanitize course list response to handle potential backend issues
     */
    private sanitizeCourseListResponse(response: any): CourseListResponse {
        try {
            const courses = Array.isArray(response.courses)
                ? response.courses.map((course: any) => this.sanitizeCourseData(course))
                : [];

            return {
                courses,
                total: response.total ?? courses.length
            };
        } catch (error) {
            console.warn('⚠️ Error sanitizing course list response, returning empty list:', error);
            return {
                courses: [],
                total: 0
            };
        }
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
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const config: RequestInit = {
            method,
            headers
        };

        if (body && (method === 'POST' || method === 'PUT')) {
            config.body = JSON.stringify(body);
        }

        const response = await fetch(`${getBackendUrl()}${endpoint}`, config);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.detail || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
            console.error('API Error:', {
                endpoint,
                method,
                status: response.status,
                statusText: response.statusText,
                errorData,
                requestBody: body ?? null
            });
            // Enrich the error message with context to help backend debugging
            throw new Error(`[${method} ${endpoint}] ${errorMessage}`);
        }

        return response;
    }

    // ===============================
    // COURSE MANAGEMENT METHODS
    // ===============================

    /**
     * Create a new after-school course
     */
    async createCourse(courseData: CourseCreate, token: string): Promise<Course> {
        try {
            console.log('📚 Creating new course:', courseData.title);
            const response = await this.makeAuthenticatedRequest(
                '/after-school/courses/',
                token,
                'POST',
                courseData
            );

            const data = await response.json();
            console.log('✅ Course created successfully:', data);
            return data;
        } catch (error) {
            console.error('❌ Error creating course:', error);
            throw error;
        }
    }

    /**
     * Get list of courses with advanced filtering
     */
    async listCourses(token: string, filters: CourseFilters = {}): Promise<CourseListResponse> {
        return this.retryApiCall(async () => {
            try {
                console.log('📚 Fetching courses with filters:', filters);

                // Build query parameters
                const params = new URLSearchParams();
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                        params.append(key, value.toString());
                    }
                });

                const queryString = params.toString();
                const endpoint = `/after-school/courses/${queryString ? `?${queryString}` : ''}`;

                const response = await this.makeAuthenticatedRequest(endpoint, token);
                const rawData = await response.json();

                // Sanitize the response to handle potential NULL values or schema issues
                const sanitizedData = this.sanitizeCourseListResponse(rawData);

                console.log('✅ Courses fetched successfully:', sanitizedData.total, 'courses');
                return sanitizedData;
            } catch (error) {
                throw this.handleApiError(error, 'Error fetching courses');
            }
        });
    }

    /**
     * Get comprehensive course details with lessons
     */
    async getCourseDetails(
        courseId: number,
        token: string,
        options: {
            include_stats?: boolean;
            include_progress?: boolean;
            include_recommendations?: boolean;
        } = {}
    ): Promise<CourseWithLessons> {
        try {
            console.log('📖 Fetching course details for course ID:', courseId);

            const params = new URLSearchParams();
            Object.entries(options).forEach(([key, value]) => {
                if (value !== undefined) {
                    params.append(key, value.toString());
                }
            });

            const queryString = params.toString();
            const endpoint = `/after-school/courses/${courseId}${queryString ? `?${queryString}` : ''}`;

            const response = await this.makeAuthenticatedRequest(endpoint, token);
            const rawData = await response.json();

            // Sanitize course data to handle potential NULL values
            const sanitizedData = {
                ...this.sanitizeCourseData(rawData),
                lessons: Array.isArray(rawData.lessons) ? rawData.lessons : []
            };

            console.log('✅ Course details fetched successfully:', sanitizedData.title);
            return sanitizedData;
        } catch (error) {
            console.error('❌ Error fetching course details:', error);
            throw error;
        }
    }

    /**
     * Update course with comprehensive validation
     */
    async updateCourse(
        courseId: number,
        courseData: CourseUpdate,
        token: string,
        options: {
            force_update?: boolean;
            create_backup?: boolean;
        } = {}
    ): Promise<Course> {
        try {
            console.log('📝 Updating course ID:', courseId);

            const params = new URLSearchParams();
            Object.entries(options).forEach(([key, value]) => {
                if (value !== undefined) {
                    params.append(key, value.toString());
                }
            });

            const queryString = params.toString();
            const endpoint = `/after-school/courses/${courseId}${queryString ? `?${queryString}` : ''}`;

            const response = await this.makeAuthenticatedRequest(
                endpoint,
                token,
                'PUT',
                courseData
            );

            const data = await response.json();
            console.log('✅ Course updated successfully:', data.title);
            return data;
        } catch (error) {
            console.error('❌ Error updating course:', error);
            throw error;
        }
    }

    /**
     * Delete course with safety checks
     */
    async deleteCourse(
        courseId: number,
        token: string,
        options: {
            force_delete?: boolean;
            archive_data?: boolean;
        } = {}
    ): Promise<MessageResponse> {
        try {
            console.log('🗑️ Deleting course ID:', courseId);

            const params = new URLSearchParams();
            Object.entries(options).forEach(([key, value]) => {
                if (value !== undefined) {
                    params.append(key, value.toString());
                }
            });

            const queryString = params.toString();
            const endpoint = `/after-school/courses/${courseId}${queryString ? `?${queryString}` : ''}`;

            const response = await this.makeAuthenticatedRequest(endpoint, token, 'DELETE');
            const data = await response.json();

            console.log('✅ Course deleted successfully:', data.message);
            return data;
        } catch (error) {
            console.error('❌ Error deleting course:', error);
            throw error;
        }
    }

    // ===============================
    // LESSON MANAGEMENT METHODS
    // ===============================

    /**
     * Create a new lesson for a course
     */
    async createLesson(courseId: number, lessonData: LessonCreate, token: string): Promise<CourseLesson> {
        try {
            console.log('📄 Creating lesson for course ID:', courseId);
            const response = await this.makeAuthenticatedRequest(
                `/after-school/courses/${courseId}/lessons`,
                token,
                'POST',
                lessonData
            );

            const data = await response.json();
            console.log('✅ Lesson created successfully:', data.title);
            return data;
        } catch (error) {
            console.error('❌ Error creating lesson:', error);
            throw error;
        }
    }

    /**
     * Get list of lessons for a course
     */
    async listLessons(
        courseId: number,
        token: string,
        activeOnly: boolean = true
    ): Promise<LessonListResponse> {
        try {
            console.log('📄 Fetching lessons for course ID:', courseId);

            const params = new URLSearchParams();
            params.append('active_only', activeOnly.toString());

            const endpoint = `/after-school/courses/${courseId}/lessons?${params.toString()}`;

            const response = await this.makeAuthenticatedRequest(endpoint, token);
            const data = await response.json();

            console.log('✅ Lessons fetched successfully:', data.total, 'lessons');
            return data;
        } catch (error) {
            console.error('❌ Error fetching lessons:', error);
            throw error;
        }
    }

    /**
     * Get specific lesson details
     */
    async getLessonDetails(courseId: number, lessonId: number, token: string): Promise<CourseLesson> {
        try {
            console.log('📖 Fetching lesson details:', { courseId, lessonId });
            const response = await this.makeAuthenticatedRequest(
                `/after-school/courses/${courseId}/lessons/${lessonId}`,
                token
            );

            const data = await response.json();
            console.log('✅ Lesson details fetched successfully:', data.title);
            return data;
        } catch (error) {
            console.error('❌ Error fetching lesson details:', error);
            throw error;
        }
    }

    /**
     * Update lesson
     */
    async updateLesson(
        courseId: number,
        lessonId: number,
        lessonData: LessonUpdate,
        token: string
    ): Promise<CourseLesson> {
        try {
            console.log('📝 Updating lesson:', { courseId, lessonId });
            const response = await this.makeAuthenticatedRequest(
                `/after-school/courses/${courseId}/lessons/${lessonId}`,
                token,
                'PUT',
                lessonData
            );

            const data = await response.json();
            console.log('✅ Lesson updated successfully:', data.title);
            return data;
        } catch (error) {
            console.error('❌ Error updating lesson:', error);
            throw error;
        }
    }

    /**
     * Delete lesson (soft delete)
     */
    async deleteLesson(courseId: number, lessonId: number, token: string): Promise<MessageResponse> {
        try {
            console.log('🗑️ Deleting lesson:', { courseId, lessonId });
            const response = await this.makeAuthenticatedRequest(
                `/after-school/courses/${courseId}/lessons/${lessonId}`,
                token,
                'DELETE'
            );

            const data = await response.json();
            console.log('✅ Lesson deleted successfully:', data.message);
            return data;
        } catch (error) {
            console.error('❌ Error deleting lesson:', error);
            throw error;
        }
    }

    // ===============================
    // STUDENT DASHBOARD METHODS
    // ===============================

    /**
     * Get comprehensive student dashboard
     */
    async getStudentDashboard(token: string): Promise<StudentDashboard> {
        if (this.dashboardInFlight) {
            return this.dashboardInFlight; // Reuse existing call
        }
        this.dashboardInFlight = this.retryApiCall(async () => {
            try {
                console.log('📊 Fetching student dashboard...');
                const response = await this.makeAuthenticatedRequest(
                    '/after-school/courses/dashboard',
                    token
                );
                const data = await response.json();
                console.log('✅ Student dashboard fetched successfully');
                return data;
            } catch (error) {
                throw this.handleApiError(error, 'Error fetching student dashboard');
            } finally {
                this.dashboardInFlight = null;
            }
        });
        return this.dashboardInFlight;
    }

    // ===============================
    // STUDY SESSION METHODS
    // ===============================



    /**
     * Check if a block is available for the current user
     */
    async checkBlockAvailability(blockId: number, token: string): Promise<BlockAvailability> {
        try {
            const response = await this.makeAuthenticatedRequest(
                `/grades/blocks/${blockId}/availability`,
                token,
                'GET'
            );

            const data = await response.json();
            console.log('✅ Block availability checked:', { blockId, available: data.available });
            return data;
        } catch (error) {
            console.error('❌ Error checking block availability:', error);
            throw error;
        }
    }

    /**
     * End a study session (deprecated - mark-done model no longer requires sessions)
     */
    async endStudySession(sessionId: number, sessionData: StudySessionEnd, token: string): Promise<StudySession> {
        try {
            console.log('⏹️ Ending study session:', sessionId);
            const response = await this.makeAuthenticatedRequest(
                `/after-school/sessions/${sessionId}/end`,
                token,
                'PUT',
                sessionData
            );

            const data = await response.json();
            console.log('✅ Study session ended successfully');
            return data;
        } catch (error) {
            console.error('❌ Error ending study session:', error);
            throw error;
        }
    }

    /**
     * Get study session details (deprecated - retained for backward compatibility)
     */
    async getStudySession(sessionId: number, token: string): Promise<StudySession> {
        try {
            console.log('📖 Fetching study session:', sessionId);
            const response = await this.makeAuthenticatedRequest(
                `/after-school/sessions/${sessionId}`,
                token
            );

            const data = await response.json();
            console.log('✅ Study session fetched successfully');
            return data;
        } catch (error) {
            console.error('❌ Error fetching study session:', error);
            throw error;
        }
    }

    // ===============================
    // AI SUBMISSION METHODS
    // ===============================

    /**
     * Create AI submission
     */
    async createAISubmission(submissionData: AISubmissionCreate, token: string): Promise<AISubmission> {
        try {
            console.log('🤖 Creating AI submission:', submissionData);
            const response = await this.makeAuthenticatedRequest(
                '/after-school/submissions/',
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

    /**
     * Upload file for AI submission
     */
    async uploadSubmissionFile(submissionId: number, fileData: FormData, token: string): Promise<AISubmission> {
        try {
            console.log('📤 Uploading file for submission:', submissionId);

            const headers: HeadersInit = {
                'Authorization': `Bearer ${token}`
                // Don't set Content-Type for FormData, let the browser set it with boundary
            };

            const response = await fetch(`${getBackendUrl()}/after-school/submissions/${submissionId}/upload`, {
                method: 'POST',
                headers,
                body: fileData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.detail || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('✅ File uploaded successfully for submission:', submissionId);
            return data;
        } catch (error) {
            console.error('❌ Error uploading submission file:', error);
            throw error;
        }
    }

    /**
     * Get AI submission details
     */
    async getAISubmission(submissionId: number, token: string): Promise<AISubmission> {
        try {
            console.log('📖 Fetching AI submission:', submissionId);
            const response = await this.makeAuthenticatedRequest(
                `/after-school/submissions/${submissionId}`,
                token
            );

            const data = await response.json();
            console.log('✅ AI submission fetched successfully');
            return data;
        } catch (error) {
            console.error('❌ Error fetching AI submission:', error);
            throw error;
        }
    }

    /**
     * Process AI grading for submission
     */
    async processAIGrading(submissionId: number, token: string): Promise<AIGradingResponse> {
        try {
            console.log('🤖 Processing AI grading for submission:', submissionId);
            const response = await this.makeAuthenticatedRequest(
                `/after-school/submissions/${submissionId}/grade`,
                token,
                'POST'
            );

            const data = await response.json();
            console.log('✅ AI grading processed successfully');
            return data;
        } catch (error) {
            console.error('❌ Error processing AI grading:', error);
            throw error;
        }
    }

    // ===============================
    // STUDENT PROGRESS METHODS
    // ===============================

    /**
     * Get student progress for a course (updated for mark-done model)
     */
    async getStudentProgress(courseId: number, token: string): Promise<StudentProgress> {
        try {
            console.log('📊 Fetching student progress for course:', courseId);
            // Use course progress endpoint instead of session-based endpoint
            const response = await this.makeAuthenticatedRequest(
                `/after-school/courses/${courseId}/progress`,
                token
            );

            const data = await response.json();
            console.log('✅ Student progress fetched successfully');
            return data;
        } catch (error) {
            console.error('❌ Error fetching student progress:', error);
            const msg = error.message?.toLowerCase() || '';
            if (msg.includes('not found') || msg.includes('no progress')) {
                console.log('ℹ️ No existing progress record. Synthesizing default progress.');
                // Attempt to pull total lessons from course details to populate totals
                let totalLessons = 0;
                try {
                    const course = await this.getCourseDetails(courseId, token, {});
                    totalLessons = course.lessons?.length || 0;
                } catch (_) { /* ignore */ }
                const now = new Date().toISOString();
                const fallback: StudentProgress = {
                    id: 0,
                    user_id: 0,
                    course_id: courseId,
                    lessons_completed: 0,
                    total_lessons: totalLessons,
                    completion_percentage: 0,
                    average_score: undefined,
                    total_study_time: 0,
                    sessions_count: 0,
                    started_at: now,
                    last_activity: now,
                    completed_at: undefined,
                    created_at: now,
                    updated_at: now,
                };
                return fallback;
            }
            throw this.handleApiError(error, 'Error fetching student progress');
        }
    }

    /**
     * Update student progress
     */
    async updateStudentProgress(courseId: number, progressData: Partial<StudentProgress>, token: string): Promise<StudentProgress> {
        try {
            console.log('📝 Updating student progress for course:', courseId);
            const response = await this.makeAuthenticatedRequest(
                `/after-school/progress/course/${courseId}`,
                token,
                'PUT',
                progressData
            );

            const data = await response.json();
            console.log('✅ Student progress updated successfully');
            return data;
        } catch (error) {
            console.error('❌ Error updating student progress:', error);
            throw error;
        }
    }

    // ===============================
    // ENHANCED COURSE METHODS
    // ===============================

    /**
     * Get comprehensive course details including blocks, assignments, and analytics
     */
    async getComprehensiveCourseDetails(
        courseId: number,
        token: string,
        options: {
            include_stats?: boolean;
            include_progress?: boolean;
            include_recommendations?: boolean;
        } = {}
    ): Promise<ComprehensiveCourse> {
        try {
            console.log('📊 Fetching comprehensive course details for course ID:', courseId);

            const params = new URLSearchParams();
            Object.entries(options).forEach(([key, value]) => {
                if (value !== undefined) {
                    params.append(key, value.toString());
                }
            });

            const queryString = params.toString();
            // Backend exposes this as GET /after-school/courses/{course_id}
            const endpoint = `/after-school/courses/${courseId}${queryString ? `?${queryString}` : ''}`;

            const response = await this.makeAuthenticatedRequest(endpoint, token);
            const data = await response.json();

            console.log('✅ Comprehensive course details fetched successfully:', data.title);
            return data;
        } catch (error) {
            console.error('❌ Error fetching comprehensive course details:', error);
            throw error;
        }
    }

    /**
     * Unified course fetch with graceful fallback.
     * Tries comprehensive → blocks endpoint → basic details.
     * Always returns a normalized object containing lessons, blocks, assignments arrays.
     */
    async getUnifiedCourse(
        courseId: number,
        token: string,
        options: {
            include_stats?: boolean;
            include_progress?: boolean;
            include_recommendations?: boolean;
        } = {}
    ): Promise<UnifiedCourse> {
        // Allow only one in-flight request per course to reduce duplicate network chatter
        (this as any)._unifiedInFlight = (this as any)._unifiedInFlight || new Map<number, Promise<UnifiedCourse>>();
        const inFlight: Map<number, Promise<UnifiedCourse>> = (this as any)._unifiedInFlight;
        if (inFlight.has(courseId)) {
            return inFlight.get(courseId)!;
        }

        const p = (async () => {
            // Attempt comprehensive endpoint first
            try {
                const comprehensive = await this.getComprehensiveCourseDetails(courseId, token, options);
                return {
                    ...comprehensive,
                    lessons: Array.isArray((comprehensive as any).lessons) ? (comprehensive as any).lessons : [],
                    blocks: Array.isArray((comprehensive as any).blocks) ? (comprehensive as any).blocks : [],
                    assignments: Array.isArray((comprehensive as any).assignments) ? (comprehensive as any).assignments : [],
                    total_blocks: (comprehensive as any).total_blocks ?? ((comprehensive as any).blocks?.length || 0),
                    estimated_total_duration: (comprehensive as any).estimated_total_duration ?? 0
                } as UnifiedCourse;
            } catch (err) {
                console.warn('⚠️ Comprehensive course fetch failed, falling back:', err);
            }

            // Fallback: try blocks endpoint
            let blocks: CourseBlock[] = [];
            try {
                const withBlocks = await this.getCourseWithBlocks(courseId, token);
                blocks = Array.isArray(withBlocks.blocks) ? withBlocks.blocks : [];
            } catch (err) {
                console.warn('⚠️ Blocks fetch failed (may be lesson-based course):', err);
            }

            // Basic details & lessons
            let basic: CourseWithLessons | null = null;
            try {
                basic = await this.getCourseDetails(courseId, token, options);
            } catch (err) {
                console.error('❌ Basic course details fetch failed:', err);
                throw err; // If even basic fetch fails, propagate
            }

            return {
                ...basic,
                lessons: Array.isArray(basic.lessons) ? basic.lessons : [],
                blocks,
                assignments: [],
                total_blocks: blocks.length,
                estimated_total_duration: (basic as any).estimated_total_duration ?? 0
            } as UnifiedCourse;
        })()
            .finally(() => {
                inFlight.delete(courseId);
            });

        inFlight.set(courseId, p);
        return p;
    }

    /**
     * Enroll in a course
     */
    async enrollInCourse(courseId: number, token: string): Promise<MessageResponse> {
        try {
            console.log('📚 Enrolling in course ID:', courseId);

            const response = await this.makeAuthenticatedRequest(
                `/after-school/courses/${courseId}/enroll`,
                token,
                'POST'
            );

            const data = await response.json();
            console.log('✅ Successfully enrolled in course');
            return data;
        } catch (error) {
            console.error('❌ Error enrolling in course:', error);
            throw error;
        }
    }

    // ===============================
    // COURSE BLOCKS METHODS
    // ===============================

    /**
     * Get course with blocks structure
     */
    async getCourseWithBlocks(courseId: number, token: string): Promise<CourseWithBlocks> {
        try {
            console.log('📚 Fetching course with blocks for course ID:', courseId);

            const response = await this.makeAuthenticatedRequest(
                `/after-school/courses/${courseId}/blocks`,
                token
            );

            const data = await response.json();
            console.log('✅ Course with blocks fetched successfully');
            // Backend returns a plain array of CourseBlockOut; normalize to expected shape
            if (Array.isArray(data)) {
                return ({ blocks: data, assignments: [] } as any) as CourseWithBlocks;
            }
            return data;
        } catch (error) {
            console.error('❌ Error fetching course with blocks:', error);
            throw error;
        }
    }

    /**
     * Get specific course block details
     */
    async getCourseBlockDetails(courseId: number, blockId: number, token: string): Promise<CourseBlock> {
        try {
            console.log('📖 Fetching course block details:', blockId);

            const response = await this.makeAuthenticatedRequest(
                `/after-school/courses/${courseId}/blocks/${blockId}`,
                token
            );

            const data = await response.json();
            console.log('✅ Course block details fetched successfully');
            return data;
        } catch (error) {
            console.error('❌ Error fetching course block details:', error);
            throw error;
        }
    }

    // ===============================
    // ASSIGNMENT MANAGEMENT METHODS
    // ===============================

    /**
     * Get assignments for the current user
     */
    async getMyAssignments(
        token: string,
        filters: {
            course_id?: number;
            status?: 'assigned' | 'submitted' | 'graded' | 'overdue';
            limit?: number;
        } = {}
    ): Promise<StudentAssignment[]> {
        try {
            console.log('📋 Fetching user assignments with filters:', filters);

            const params = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.append(key, value.toString());
                }
            });

            const queryString = params.toString();
            const endpoint = `/after-school/courses/assignments/my-assignments${queryString ? `?${queryString}` : ''}`;

            const response = await this.makeAuthenticatedRequest(endpoint, token);
            const data = await response.json();

            const list = Array.isArray(data) ? data : (Array.isArray(data?.assignments) ? data.assignments : []);
            console.log('✅ User assignments fetched successfully:', list.length);
            return list;
        } catch (error) {
            console.error('❌ Error fetching user assignments:', error);
            throw error;
        }
    }

    /**
     * Get assignments for a specific course block
     */
    async getBlockAssignments(courseId: number, blockId: number, token: string): Promise<CourseAssignment[]> {
        try {
            console.log('📋 Fetching assignments for block:', blockId);

            const response = await this.makeAuthenticatedRequest(
                `/after-school/courses/${courseId}/blocks/${blockId}/assignments`,
                token
            );

            const data = await response.json();
            console.log('✅ Block assignments fetched successfully:', data.length);
            return data;
        } catch (error) {
            console.error('❌ Error fetching block assignments:', error);
            throw error;
        }
    }

    /**
     * Get specific assignment details
     */
    async getAssignmentDetails(
        courseId: number,
        assignmentId: number,
        token: string
    ): Promise<StudentAssignment> {
        try {
            console.log('📝 Fetching assignment details for assignment ID:', assignmentId);

            const response = await this.makeAuthenticatedRequest(
                `/after-school/courses/${courseId}/assignments/${assignmentId}`,
                token
            );

            const data = await response.json();
            console.log('✅ Assignment details fetched successfully');
            return data;
        } catch (error) {
            console.error('❌ Error fetching assignment details:', error);
            throw error;
        }
    }

    /**
     * Get assignments available for a specific course (for the workflow: read course → see assignments)
     */
    async getCourseAssignments(
        courseId: number,
        token: string,
        filters: {
            status?: 'assigned' | 'submitted' | 'graded';
            block_id?: number;
        } = {}
    ): Promise<StudentAssignment[]> {
        try {
            console.log('📚 Fetching assignments for course ID:', courseId);

            // Use the correct endpoint that exists in backend
            const params = new URLSearchParams();
            // Add course filter to get assignments for specific course
            params.append('course_id', courseId.toString());

            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.append(key, value.toString());
                }
            });

            const queryString = params.toString();
            const endpoint = `/after-school/courses/assignments/my-assignments${queryString ? `?${queryString}` : ''}`;

            const response = await this.makeAuthenticatedRequest(endpoint, token);
            const data = await response.json();

            const list = Array.isArray(data) ? data : (Array.isArray(data?.assignments) ? data.assignments : []);
            console.log('✅ Course assignments fetched successfully:', list.length);
            return list;
        } catch (error) {
            console.error('❌ Error fetching course assignments:', error);
            throw this.handleApiError(error, 'Error fetching course assignments');
        }
    }

    /**
     * Fetch raw course assignment definitions (non student-specific).
     * Backend endpoint expected: GET /after-school/courses/{course_id}/assignments
     */
    async getCourseAssignmentDefinitions(courseId: number, token: string): Promise<CourseAssignment[]> {
        // Serve from cache if present
        if (this.assignmentDefinitionsCache.has(courseId)) {
            return this.assignmentDefinitionsCache.get(courseId)!;
        }

        // Reuse in-flight fetch to avoid duplicate network calls
        if (this.assignmentDefinitionsFetchInFlight.has(courseId)) {
            return this.assignmentDefinitionsFetchInFlight.get(courseId)!;
        }

        const fetchPromise = (async () => {
            try {
                console.log('📋 Fetching raw assignment definitions for course ID:', courseId);
                let response: Response;
                try {
                    response = await this.makeAuthenticatedRequest(
                        `/after-school/courses/${courseId}/assignments`,
                        token
                    );
                } catch (err: any) {
                    const msg = (err.message || '').toLowerCase();
                    if (msg.includes('not found') || msg.includes('404')) {
                        console.warn(`ℹ️ Assignment definitions endpoint not found for course ${courseId}. Returning empty list (backend should implement).`);
                        this.assignmentDefinitionsCache.set(courseId, []);
                        return [];
                    }
                    throw err;
                }
                const data = await response.json();
                const list = Array.isArray(data) ? data : [];
                this.assignmentDefinitionsCache.set(courseId, list);
                console.log('✅ Raw assignment definitions fetched:', list.length);
                return list;
            } catch (error) {
                console.error('❌ Error fetching raw course assignment definitions:', error);
                throw this.handleApiError(error, 'Error fetching course assignment definitions');
            } finally {
                this.assignmentDefinitionsFetchInFlight.delete(courseId);
            }
        })();

        this.assignmentDefinitionsFetchInFlight.set(courseId, fetchPromise);
        return fetchPromise;
    }

    /**
     * Submit assignment and trigger auto-grading
     * This is the core method for your workflow: upload images -> PDF conversion -> auto-grading
     */
    async submitAndGradeAssignment(
        courseId: number,
        assignmentId: number,
        token: string,
        submissionData?: {
            submission_content?: string;
            submission_file_path?: string;
        }
    ): Promise<{
        submission: StudentAssignment;
        grading_results: AIGradingResponse;
    }> {
        try {
            console.log('📤 Submitting and auto-grading assignment:', assignmentId);

            const response = await this.makeAuthenticatedRequest(
                `/after-school/courses/${courseId}/assignments/${assignmentId}/submit-and-grade`,
                token,
                'POST',
                submissionData
            );

            const data = await response.json();
            console.log('✅ Assignment submitted and graded successfully');
            return data;
        } catch (error) {
            console.error('❌ Error submitting and grading assignment:', error);
            throw error;
        }
    }

    // ===============================
    // INTEGRATED WORKFLOW METHODS (Core workflow: Read -> Assignment -> Upload -> Grade -> Results)
    // ===============================

    /**
     * Complete workflow: Upload images for assignment, convert to PDF, and auto-grade
     * This integrates with the uploads service for the seamless workflow
     * Core workflow: Read course → Assignment → Upload images → Auto PDF → Auto grade → Results
     */
    async submitAssignmentWithImages(
        courseId: number,
        assignmentId: number,
        blockId: number,
        imageFiles: any[],
        token: string,
        submissionType: 'homework' | 'quiz' | 'practice' | 'assessment' = 'homework'
    ): Promise<{
        pdf_submission: any;
        grading_results: AIGradingResponse;
        student_assignment: StudentAssignment;
    }> {
        try {
            console.log('🚀 Starting integrated assignment submission workflow');
            console.log('📋 Course ID:', courseId, 'Assignment ID:', assignmentId, 'Block ID:', blockId);

            // Step 1: Convert images to PDF using uploads service
            console.log('📸 Step 1: Converting images to PDF...');
            const uploadsService = require('./uploadsService').uploadsService;

            const bulkUploadRequest = {
                course_id: courseId,
                submission_type: submissionType,
                files: imageFiles,
                assignment_id: assignmentId,
                block_id: blockId
            };

            const pdfSubmission = await uploadsService.bulkUploadImagesToPDF(bulkUploadRequest, token);
            console.log('✅ Step 1 completed: PDF created with submission ID:', pdfSubmission.submission_id);

            // Step 2: Submit assignment with PDF reference
            console.log('📤 Step 2: Submitting assignment with PDF...');
            const submissionData = {
                submission_content: `PDF submission with ${imageFiles.length} pages`,
                submission_file_path: pdfSubmission.file_path || `/submissions/${pdfSubmission.submission_id}.pdf`
            };

            // Step 3: Auto-grade the assignment
            console.log('🤖 Step 3: Auto-grading assignment...');
            const gradingResults = await this.submitAndGradeAssignment(
                courseId,
                assignmentId,
                token,
                submissionData
            );

            console.log('✅ Complete workflow finished successfully');
            console.log('📊 Grading results:', gradingResults.grading_results.ai_score);

            return {
                pdf_submission: pdfSubmission,
                grading_results: gradingResults.grading_results,
                student_assignment: gradingResults.submission
            };
        } catch (error) {
            console.error('❌ Error in integrated assignment workflow:', error);
            throw error;
        }
    }

    // ===============================
    // STUDY SESSION MANAGEMENT (NEW)
    // ===============================

    /**
     * Mark a study session as done
     */
    async markStudySessionDone(blockId: number, courseId: number, token: string): Promise<StudySession> {
        try {
            const response = await this.makeAuthenticatedRequest(
                '/after-school/sessions/mark-done',
                token,
                'POST',
                {
                    block_id: blockId,
                    course_id: courseId
                }
            );

            const data = await response.json();
            console.log('✅ Study session marked as done:', data);
            return data;

        } catch (error) {
            console.error('❌ Error marking study session as done:', error);
            throw this.handleApiError(error, 'Mark Study Session Done');
        }
    }

    /**
     * Get course blocks progress
     */
    async getCourseBlocksProgress(courseId: number, token: string): Promise<CourseBlocksProgressResponse> {
        try {
            // Preferred endpoint if available in backend
            const response = await this.makeAuthenticatedRequest(
                `/after-school/courses/${courseId}/blocks-progress`,
                token,
                'GET'
            );

            const data = await response.json();
            console.log('✅ Course blocks progress retrieved:', data);
            return data;

        } catch (primaryError: any) {
            const msg = primaryError?.message?.toLowerCase() || '';
            const is404 = msg.includes('404') || msg.includes('not found');
            if (!is404) {
                console.warn('⚠️ Primary blocks-progress endpoint failed, attempting fallback:', primaryError?.message || primaryError);
            } else {
                console.log('ℹ️ blocks-progress endpoint not available; deriving progress locally.');
            }

            // Fallback strategy: derive progress from course blocks and student progress counts
            try {
                const [withBlocks, progress] = await Promise.all([
                    this.getCourseWithBlocks(courseId, token).catch(() => ({ blocks: [] as CourseBlock[] } as any)),
                    this.getStudentProgress(courseId, token).catch(() => null)
                ]);

                const blocks: CourseBlock[] = Array.isArray((withBlocks as any).blocks) ? (withBlocks as any).blocks : [];

                // Sort blocks in curriculum order
                const sortedBlocks = [...blocks].sort((a, b) => {
                    if (a.week !== b.week) return (a.week ?? 0) - (b.week ?? 0);
                    if (a.block_number !== b.block_number) return (a.block_number ?? 0) - (b.block_number ?? 0);
                    return (a.id ?? 0) - (b.id ?? 0);
                });

                const totalBlocks = sortedBlocks.length;
                const completedCount = Math.max(0, Math.min(
                    totalBlocks,
                    progress?.blocks_completed ?? 0
                ));

                const blocksProgress: BlockProgress[] = sortedBlocks.map((b, idx) => ({
                    block_id: b.id,
                    week: b.week,
                    block_number: b.block_number,
                    title: b.title,
                    description: b.description ?? '',
                    duration_minutes: b.duration_minutes ?? 0,
                    is_completed: idx < completedCount,
                    is_available: idx === completedCount, // next block available; others locked
                    completed_at: undefined
                }));

                const completedBlocks = completedCount;
                const completion_percentage = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0;

                const derived: CourseBlocksProgressResponse = {
                    course_id: courseId,
                    total_blocks: totalBlocks,
                    completed_blocks: completedBlocks,
                    completion_percentage,
                    blocks: blocksProgress
                };

                console.log('✅ Derived course blocks progress (fallback):', {
                    total_blocks: derived.total_blocks,
                    completed_blocks: derived.completed_blocks
                });
                return derived;
            } catch (fallbackError) {
                console.error('❌ Fallback derivation for blocks progress failed:', fallbackError);
                throw this.handleApiError(primaryError, 'Get Course Blocks Progress');
            }
        }
    }

    // ===============================
    // ASSIGNMENT GRADING (NEW)
    // ===============================

    /**
     * Get assignment status (updated for mark-done model)
     */
    async getAssignmentStatus(assignmentId: string, token: string): Promise<AssignmentStatus | null> {
        try {
            // Try the new assignment status endpoint first
            const response = await this.makeAuthenticatedRequest(
                `/after-school/assignments/${assignmentId}/status`,
                token,
                'GET'
            );

            const data = await response.json();
            console.log('✅ Assignment status retrieved:', data);
            return data;

        } catch (error: any) {
            const msg = error?.message?.toLowerCase() || '';
            if (msg.includes('404') || msg.includes('not found')) {
                // Quietly treat as no status available
                console.log('ℹ️ Assignment status endpoint not available; returning null.');
            } else {
                console.warn('⚠️ Error getting assignment status (non-fatal):', error?.message || error);
            }
            // Return null instead of throwing to allow graceful fallback
            return null;
        }
    }

    /**
     * Retry assignment
     */
    async retryAssignment(
        assignmentId: string,
        token: string,
        submissionData?: {
            submission_content?: string;
            submission_file_path?: string;
            content?: string;
            file_path?: string;
        }
    ): Promise<AssignmentGradeResult> {
        try {
            const response = await this.makeAuthenticatedRequest(
                `/after-school/sessions/assignments/${assignmentId}/retry`,
                token,
                'POST',
                submissionData
            );

            const data = await response.json();
            console.log('✅ Assignment retry initiated:', data);
            return data;

        } catch (error) {
            console.error('❌ Error retrying assignment:', error);
            throw this.handleApiError(error, 'Retry Assignment');
        }
    }

    // ===============================
    // UTILITY METHODS
    // ===============================

    /**
     * Get available subjects for courses
     */
    getAvailableSubjects(): string[] {
        return [
            "Mathematics", "Science", "English", "Reading", "Writing", "History",
            "Geography", "Art", "Music", "Physical Education", "Technology",
            "Languages", "Social Studies", "Critical Thinking", "Problem Solving"
        ];
    }

    /**
     * Get available difficulty levels
     */
    getAvailableDifficultyLevels(): Array<'beginner' | 'intermediate' | 'advanced'> {
        return ['beginner', 'intermediate', 'advanced'];
    }

    /**
     * Validate age range for course
     */
    validateAgeRange(ageMin: number, ageMax: number): boolean {
        return ageMin >= 3 && ageMax <= 16 && ageMax >= ageMin;
    }

    /**
     * Get age range category
     */
    getAgeRangeCategory(age: number): 'early' | 'middle' | 'late' | null {
        if (age >= 3 && age <= 6) return 'early';
        if (age >= 7 && age <= 10) return 'middle';
        if (age >= 11 && age <= 16) return 'late';
        return null;
    }

    /**
     * Format duration in minutes to readable string
     */
    formatDuration(minutes: number): string {
        if (minutes < 60) {
            return `${minutes} minutes`;
        }

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (remainingMinutes === 0) {
            return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
        }

        return `${hours}h ${remainingMinutes}m`;
    }
}

export const afterSchoolService = new AfterSchoolService();