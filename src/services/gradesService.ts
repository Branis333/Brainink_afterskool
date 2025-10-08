/**
 * Grades and Sessions Service for React Native
 * Handles study sessions, AI grading, progress tracking, and analytics
 * Based on BrainInk Backend after-school grades endpoints
 */

// Get the correct backend URL based on environment
const getBackendUrl = () => {
    // In React Native, we'll always use the production backend
    return 'https://brainink-backend.onrender.com';
};

// ===============================
// TYPESCRIPT INTERFACES
// ===============================

// Study Session Interfaces (Enhanced for the new workflow)
export interface StudySessionStart {
    course_id: number;
    lesson_id?: number;  // Optional for backward compatibility
    block_id?: number;   // New: for AI-generated course blocks
}

export interface StudySessionEnd {
    completion_percentage: number;
    status: 'completed' | 'abandoned';
}

export interface StudySession {
    id: number;
    user_id: number;
    course_id: number;
    lesson_id?: number;  // Made optional for block-based sessions
    block_id?: number;   // New: for AI-generated course blocks
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

// Student Progress Interfaces
export interface StudentProgress {
    id: number;
    user_id: number;
    course_id: number;
    lessons_completed: number;
    total_lessons: number;
    completion_percentage: number;
    // Added for block-based progress tracking
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

// AI Submission Interfaces
export interface AISubmission {
    id: number;
    user_id: number;
    course_id: number;
    lesson_id?: number;  // Optional to support block-based sessions
    block_id?: number;   // Optional: AI-generated course blocks
    session_id?: number; // Optional in mark-done model
    assignment_id?: number; // Optional: link to assignment when applicable
    submission_type: 'homework' | 'quiz' | 'practice' | 'assessment';
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

// Analytics Interfaces
export interface LearningAnalytics {
    period_days: number;
    total_sessions: number;
    completed_sessions: number;
    total_study_time_minutes: number;
    average_score?: number;
    study_streak_days: number;
    sessions_per_day: number;
}

export interface NormalizedAIResponse {
    ai_score?: number | null;
    ai_feedback?: string | null;
    ai_strengths?: string | null;
    ai_improvements?: string | null;
    ai_corrections?: string | null;
    raw?: Record<string, unknown>;
}

// KANA AI Grading Interfaces
export interface KANAGradingRequest {
    course_id: number;
    lesson_id?: number;
    block_id?: number;
    assignment_id?: number;
    student_ids?: number[];
    grade_all_students?: boolean;
}

export interface KANAGradingResult {
    submission_id?: number;
    user_id?: number;
    student_name: string;
    score?: number | null;
    percentage?: number | null;
    grade_letter?: string | null;
    feedback?: string | null;
    overall_feedback?: string | null;
    strengths?: string[] | string | null;
    improvements?: string[] | string | null;
    recommendations?: string[] | string | null;
    corrections?: string[] | string | null;
    graded_by?: string | null;
    normalized?: NormalizedAIResponse;
    success: boolean;
    error?: string;
}

export interface BulkGradingResponse {
    status: string;
    message: string;
    grading_service: string;
    course: {
        id: number;
        title: string;
        description?: string | null;
        subject?: string | null;
    };
    content_context: {
        assignment?: {
            id: number;
            title: string;
            description?: string | null;
        } | null;
        lesson?: {
            id: number;
            title: string;
            learning_objectives?: string | string[] | null;
        } | null;
        block?: {
            id: number;
            title: string;
            week: number;
            block_number: number;
        } | null;
    };
    grading_results: KANAGradingResult[];
    batch_summary: {
        total_submissions: number;
        successfully_graded: number;
        failed_grades: number;
        success_rate: number;
        average_score?: number | null;
        grade_distribution?: Record<string, number>;
    };
    total_submissions: number;
    submissions_graded: number;
    submissions_failed: number;
    processed_at: string;
}

// Pending Submissions Interfaces
export interface PendingSubmission {
    id: number;
    user_id: number;
    student_name: string;
    filename?: string;
    submission_type: string;
    submitted_at?: string;
}

export interface PendingSubmissionsByLesson {
    lesson_id: number;
    lesson_title: string;
    submissions: PendingSubmission[];
}

export interface PendingSubmissionsByCourse {
    course_id: number;
    course_title: string;
    lessons: { [key: string]: PendingSubmissionsByLesson };
}

export interface PendingSubmissionsResponse {
    total_pending: number;
    grouped_submissions: { [key: string]: PendingSubmissionsByCourse };
}

// Session Filtering Options
export interface SessionFilters {
    course_id?: number;
    status?: 'in_progress' | 'completed' | 'abandoned';
    limit?: number;
}

// Progress Filtering Options
export interface ProgressFilters {
    course_id?: number;
}

// Student Assignment Interfaces (New for workflow)
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
}

// Auto-Grading Response (Enhanced for the workflow)
export interface AutoGradingResponse {
    status: string;
    message: string;
    assignment: {
        id: number;
        title: string;
        type: string;
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
        normalized?: NormalizedAIResponse;
        passing_grade: boolean;
        required_percentage: number;
    };
    student_assignment: {
        id: number;
        status: 'assigned' | 'submitted' | 'graded' | 'overdue' | 'passed' | 'needs_retry' | 'failed';
        grade: number | null;
        submitted_at: string;
        graded_by: string;
        can_retry: boolean;
        attempts_remaining: number;
    };
    processed_at: string;
    retry_info?: {
        is_retry_attempt: boolean;
        attempts_used: number;
        attempts_remaining: number;
    };
}

export interface ProcessSubmissionResponse {
    status: string;
    message: string;
    submission_id: number;
    grade_result: {
        score?: number | null;
        percentage?: number | null;
        grade_letter?: string | null;
        overall_feedback?: string | null;
        detailed_feedback?: string | null;
        strengths?: string[] | string | null;
        improvements?: string[] | string | null;
        recommendations?: string[] | string | null;
        corrections?: string[] | string | null;
        graded_by?: string | null;
        normalized?: NormalizedAIResponse;
        [key: string]: unknown;
    };
    processing_details: {
        assignment_title: string;
        rubric_used?: string | null;
        max_points: number;
        processed_by: string;
    };
    processed_at: string;
}

class GradesService {
    /**
     * Format a timestamp into a friendly relative string like
     * "Just now", "5 min ago", "2h ago", "Yesterday", or a date.
     * Helps avoid timezone confusion (e.g., showing "2 hours ago" incorrectly).
     */
    formatRelativeTime(dateStr?: string): string {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';

        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffSec = Math.round(diffMs / 1000);
        const diffMin = Math.round(diffSec / 60);
        const diffHr = Math.round(diffMin / 60);
        const diffDay = Math.round(diffHr / 24);

        if (diffSec < 30) return 'Just now';
        if (diffMin < 1) return `${diffSec}s ago`;
        if (diffMin < 60) return `${diffMin} min ago`;
        if (diffHr < 24) return `${diffHr}h ago`;
        if (diffDay === 1) return 'Yesterday';
        if (diffDay < 7) return `${diffDay}d ago`;
        return d.toLocaleDateString();
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
            console.error('API Error:', errorData);
            throw new Error(errorMessage);
        }

        return response;
    }

    // ===============================
    // STUDY SESSION MANAGEMENT
    // ===============================

    /**
     * [DEPRECATED] Start a new study session for a lesson.
     * Use mark-done flow instead (see afterSchoolService.markStudySessionDone / blocks availability).
     */
    async startStudySession(sessionData: StudySessionStart, token: string): Promise<StudySession> {
        try {
            console.warn('[DEPRECATED] startStudySession is legacy. Prefer mark-done workflows.');
            console.log('▶️ Starting study session:', sessionData);
            const response = await this.makeAuthenticatedRequest(
                '/after-school/sessions/start',
                token,
                'POST',
                sessionData
            );

            const data = await response.json();
            console.log('✅ Study session started successfully:', data.id);
            return data;
        } catch (error) {
            console.error('❌ Error starting study session:', error);
            throw error;
        }
    }

    /**
     * [DEPRECATED] End a study session and record completion.
     * In the mark-done model, explicit end is not required.
     */
    async endStudySession(sessionId: number, sessionData: StudySessionEnd, token: string): Promise<StudySession> {
        try {
            console.warn('[DEPRECATED] endStudySession is legacy. Prefer mark-done workflows.');
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
     * [DEPRECATED] Get user's study sessions with filtering.
     * Sessions are legacy; use progress endpoints and uploads where possible.
     */
    async getUserSessions(token: string, filters: SessionFilters = {}): Promise<StudySession[]> {
        try {
            console.warn('[DEPRECATED] getUserSessions is legacy. Prefer block progress and uploads.');
            console.log('📋 Fetching user sessions with filters:', filters);

            // Build query parameters
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.append(key, value.toString());
                }
            });

            const queryString = params.toString();
            const endpoint = `/after-school/sessions/${queryString ? `?${queryString}` : ''}`;

            const response = await this.makeAuthenticatedRequest(endpoint, token);
            const data = await response.json();

            console.log('✅ User sessions fetched successfully:', data.length, 'sessions');
            return data;
        } catch (error) {
            console.error('❌ Error fetching user sessions:', error);
            throw error;
        }
    }

    /**
     * [DEPRECATED] Get specific study session details.
     */
    async getSessionDetails(sessionId: number, token: string): Promise<StudySession> {
        try {
            console.warn('[DEPRECATED] getSessionDetails is legacy. Prefer mark-done workflows.');
            console.log('📖 Fetching session details:', sessionId);
            const response = await this.makeAuthenticatedRequest(
                `/after-school/sessions/${sessionId}`,
                token
            );

            const data = await response.json();
            console.log('✅ Session details fetched successfully');
            return data;
        } catch (error) {
            console.error('❌ Error fetching session details:', error);
            throw error;
        }
    }

    // ===============================
    // PROGRESS TRACKING
    // ===============================

    /**
     * Get student's progress across courses
     */
    async getStudentProgress(token: string, filters: ProgressFilters = {}): Promise<StudentProgress[]> {
        try {
            console.log('📊 Fetching student progress (mark-done) with filters:', filters);
            if (filters.course_id) {
                const record = await this.getCourseProgress(filters.course_id, token);
                return [record];
            }
            console.warn('getStudentProgress without course_id is deprecated; returning empty list. Use getCourseProgress(courseId).');
            return [];
        } catch (error) {
            console.error('❌ Error fetching student progress:', error);
            throw error;
        }
    }

    /**
     * Get detailed progress for a specific course
     */
    async getCourseProgress(courseId: number, token: string): Promise<StudentProgress> {
        try {
            console.log('📊 Fetching course progress for course ID:', courseId);
            const response = await this.makeAuthenticatedRequest(
                `/after-school/courses/${courseId}/progress`,
                token
            );

            const data = await response.json();
            console.log('✅ Course progress fetched successfully');
            return data;
        } catch (error) {
            console.error('❌ Error fetching course progress:', error);
            throw error;
        }
    }

    // ===============================
    // LEARNING ANALYTICS
    // ===============================

    /**
     * Get learning analytics summary for the student
     */
    async getLearningAnalytics(token: string, days: number = 30): Promise<LearningAnalytics> {
        try {
            console.log('📈 Fetching learning analytics for', days, 'days');

            const params = new URLSearchParams();
            params.append('days', days.toString());

            const response = await this.makeAuthenticatedRequest(
                `/after-school/sessions/analytics/summary?${params.toString()}`,
                token
            );

            const data = await response.json();
            console.log('✅ Learning analytics fetched successfully');
            return data;
        } catch (error) {
            console.error('❌ Error fetching learning analytics:', error);
            throw error;
        }
    }

    // ===============================
    // KANA AI GRADING SYSTEM
    // ===============================

    /**
     * Grade submissions for multiple students in a course using K.A.N.A. AI
     */
    async gradeCourseSubmissions(gradingRequest: KANAGradingRequest, token: string): Promise<BulkGradingResponse> {
        try {
            console.log('🤖 Starting KANA AI grading for course:', gradingRequest.course_id);
            const response = await this.makeAuthenticatedRequest(
                '/after-school/sessions/grade-course-submissions',
                token,
                'POST',
                gradingRequest
            );

            const data = await response.json() as BulkGradingResponse;
            console.log(
                '✅ KANA AI grading completed successfully',
                `graded=${data.batch_summary?.successfully_graded ?? 0}`,
                `failed=${data.batch_summary?.failed_grades ?? 0}`
            );
            return data;
        } catch (error) {
            console.error('❌ Error in KANA AI grading:', error);
            throw error;
        }
    }

    /**
     * Get all pending submissions that need grading
     */
    async getPendingSubmissionsForGrading(
        token: string,
        courseId?: number,
        lessonId?: number
    ): Promise<PendingSubmissionsResponse> {
        try {
            console.log('📋 Fetching pending submissions for grading');

            const params = new URLSearchParams();
            if (courseId !== undefined) {
                params.append('course_id', courseId.toString());
            }
            if (lessonId !== undefined) {
                params.append('lesson_id', lessonId.toString());
            }

            const queryString = params.toString();
            const endpoint = `/after-school/sessions/submissions/pending-grade${queryString ? `?${queryString}` : ''}`;

            const response = await this.makeAuthenticatedRequest(endpoint, token);
            const data = await response.json();

            console.log('✅ Pending submissions fetched successfully:', data.total_pending, 'submissions');
            return data;
        } catch (error) {
            console.error('❌ Error fetching pending submissions:', error);
            throw error;
        }
    }

    // ===============================
    // AI SUBMISSION MANAGEMENT
    // ===============================

    /**
     * Create a new AI submission for grading
     */
    /**
     * [DEPRECATED] Creating submissions directly is no longer supported.
     * Use uploadsService.uploadImagesForAssignmentWorkflow (bulk-upload-to-pdf) instead.
     */
    async createAISubmission(): Promise<AISubmission> {
        throw new Error('createAISubmission is deprecated. Use uploadsService.uploadImagesForAssignmentWorkflow instead.');
    }

    /**
     * Upload a file for AI submission and grading
     */
    /**
     * [DEPRECATED] Uploading to a submission is not used in the new workflow.
     * Use uploadsService.bulk upload endpoints to generate PDF and auto-grade.
     */
    async uploadSubmissionFile(): Promise<AISubmission> {
        throw new Error('uploadSubmissionFile is deprecated. Use uploadsService bulk upload workflow instead.');
    }

    /**
     * Get AI submission details
     */
    async getAISubmission(submissionId: number, token: string): Promise<AISubmission> {
        try {
            console.log('📖 Fetching AI submission details:', submissionId);
            const response = await this.makeAuthenticatedRequest(
                `/after-school/uploads/submissions/${submissionId}`,
                token
            );

            const data = await response.json();
            console.log('✅ AI submission details fetched successfully');
            return data;
        } catch (error) {
            console.error('❌ Error fetching AI submission details:', error);
            throw error;
        }
    }

    /**
     * Get all submissions for a specific session
     */
    async getSessionSubmissions(sessionId: number, token: string): Promise<AISubmission[]> {
        try {
            console.log('📋 Fetching submissions for session:', sessionId);
            const response = await this.makeAuthenticatedRequest(
                `/after-school/uploads/sessions/${sessionId}/submissions`,
                token
            );

            const data = await response.json();
            console.log('✅ Session submissions fetched successfully:', data.length, 'submissions');
            return data;
        } catch (error) {
            console.error('❌ Error fetching session submissions:', error);
            throw error;
        }
    }

    // ===============================
    // STUDENT ASSIGNMENT MANAGEMENT (New for Workflow)
    // ===============================

    /**
     * Get student assignments for a specific user
     */
    async getStudentAssignments(
        userId: number,
        token: string,
        filters: {
            course_id?: number;
            status?: 'assigned' | 'submitted' | 'graded' | 'overdue';
            limit?: number;
        } = {}
    ): Promise<StudentAssignment[]> {
        try {
            console.log('📋 Fetching student assignments for user:', userId);

            const params = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.append(key, value.toString());
                }
            });

            const queryString = params.toString();
            const endpoint = `/after-school/sessions/assignments/student/${userId}${queryString ? `?${queryString}` : ''}`;

            const response = await this.makeAuthenticatedRequest(endpoint, token);
            const data = await response.json();

            console.log('✅ Student assignments fetched successfully:', data.length);
            return data;
        } catch (error) {
            console.error('❌ Error fetching student assignments:', error);
            throw error;
        }
    }

    /**
     * Get course assignments overview for teachers/admins
     */
    async getCourseAssignmentsOverview(
        courseId: number,
        token: string,
        filters: {
            assignment_id?: number;
            student_ids?: number[];
            include_stats?: boolean;
        } = {}
    ): Promise<StudentAssignment[]> {
        try {
            console.log('📊 Fetching course assignments overview for course:', courseId);

            const params = new URLSearchParams();
            if (filters.assignment_id) params.append('assignment_id', filters.assignment_id.toString());
            if (filters.include_stats !== undefined) params.append('include_stats', filters.include_stats.toString());
            if (filters.student_ids) {
                filters.student_ids.forEach(id => params.append('student_ids', id.toString()));
            }

            const queryString = params.toString();
            const endpoint = `/after-school/sessions/assignments/course/${courseId}${queryString ? `?${queryString}` : ''}`;

            const response = await this.makeAuthenticatedRequest(endpoint, token);
            const data = await response.json();

            console.log('✅ Course assignments overview fetched successfully');
            return data;
        } catch (error) {
            console.error('❌ Error fetching course assignments overview:', error);
            throw error;
        }
    }

    /**
     * Auto-grade assignment submission (Core workflow method)
     * This is the key method for the workflow: upload → auto-grade → results
     */
    async autoGradeAssignmentSubmission(
        assignmentId: number,
        token: string,
        submissionData: {
            submission_content?: string;
            submission_file_path?: string;
        } = {}
    ): Promise<AutoGradingResponse> {
        try {
            console.log('🤖 Auto-grading assignment submission for assignment:', assignmentId);

            const response = await this.makeAuthenticatedRequest(
                `/after-school/sessions/assignments/${assignmentId}/auto-grade`,
                token,
                'POST',
                submissionData
            );

            const data = await response.json() as AutoGradingResponse;
            const score = data.grade_result?.normalized?.ai_score ?? data.grade_result?.percentage ?? null;
            console.log('✅ Assignment auto-graded successfully:', score !== null ? `${score}%` : 'score unavailable');
            return data;
        } catch (error) {
            console.error('❌ Error auto-grading assignment:', error);
            throw error;
        }
    }

    /**
     * Process submission with Gemini AI (Advanced AI processing)
     */
    async processSubmissionWithAI(submissionId: number, token: string): Promise<ProcessSubmissionResponse> {
        try {
            console.log('🧠 Processing submission with Gemini AI:', submissionId);

            const response = await this.makeAuthenticatedRequest(
                `/after-school/sessions/submissions/${submissionId}/process-with-ai`,
                token,
                'POST'
            );

            const data = await response.json() as ProcessSubmissionResponse;
            console.log(
                '✅ Submission processed with AI successfully',
                'score=',
                data.grade_result?.normalized?.ai_score ?? data.grade_result?.percentage ?? 'N/A'
            );
            return data;
        } catch (error) {
            console.error('❌ Error processing submission with AI:', error);
            throw error;
        }
    }

    // ===============================
    // INTEGRATED WORKFLOW METHODS (Core workflow support)
    // ===============================

    /**
     * Complete workflow method: Start session → Submit → Auto-grade → Results
     * This supports the cycle: "read course → assignment → upload → auto-grade → results"
     */
    async executeAssignmentWorkflow(
        courseId: number,
        assignmentId: number,
        submissionData: {
            session_data?: StudySessionStart;
            submission_content?: string;
            submission_file_path?: string;
        },
        token: string
    ): Promise<{
        session?: StudySession;
        grading_results: AutoGradingResponse;
    }> {
        try {
            console.log('🚀 Executing complete assignment workflow');

            let session = undefined;

            // Step 1: Start session if needed
            if (submissionData.session_data) {
                console.log('📚 Step 1: Starting study session...');
                session = await this.startStudySession(submissionData.session_data, token);
            }

            // Step 2: Auto-grade the assignment
            console.log('🤖 Step 2: Auto-grading assignment...');
            const gradingResults = await this.autoGradeAssignmentSubmission(
                assignmentId,
                token,
                {
                    submission_content: submissionData.submission_content,
                    submission_file_path: submissionData.submission_file_path
                }
            );

            // Step 3: End session if started
            if (session) {
                console.log('✅ Step 3: Ending study session...');
                await this.endStudySession(session.id, {
                    completion_percentage: 100,
                    status: 'completed'
                }, token);
            }

            console.log('✅ Assignment workflow completed successfully');
            return {
                session,
                grading_results: gradingResults
            };
        } catch (error) {
            console.error('❌ Error executing assignment workflow:', error);
            throw error;
        }
    }

    // ===============================
    // UTILITY AND HELPER METHODS
    // ===============================

    /**
     * Calculate study session duration in human-readable format
     */
    formatSessionDuration(durationMinutes?: number): string {
        if (!durationMinutes || durationMinutes === 0) {
            return 'Not completed';
        }

        if (durationMinutes < 60) {
            return `${durationMinutes} minutes`;
        }

        const hours = Math.floor(durationMinutes / 60);
        const remainingMinutes = durationMinutes % 60;

        if (remainingMinutes === 0) {
            return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
        }

        return `${hours}h ${remainingMinutes}m`;
    }

    /**
     * Get completion status color for UI
     */
    getCompletionStatusColor(completionPercentage: number): string {
        if (completionPercentage >= 100) return '#10B981'; // green
        if (completionPercentage >= 75) return '#F59E0B'; // amber
        if (completionPercentage >= 50) return '#EF4444'; // red
        return '#6B7280'; // gray
    }

    /**
     * Get score color for UI based on performance
     */
    getScoreColor(score?: number): string {
        if (!score) return '#6B7280'; // gray

        if (score >= 90) return '#10B981'; // excellent - green
        if (score >= 80) return '#84CC16'; // good - lime
        if (score >= 70) return '#F59E0B'; // average - amber
        if (score >= 60) return '#F97316'; // below average - orange
        return '#EF4444'; // poor - red
    }

    /**
     * Calculate overall progress percentage across all courses
     */
    calculateOverallProgress(progressRecords: StudentProgress[]): number {
        if (!progressRecords.length) return 0;

        const totalCompletion = progressRecords.reduce((sum, record) => {
            return sum + record.completion_percentage;
        }, 0);

        return Math.round(totalCompletion / progressRecords.length);
    }

    /**
     * Get study streak message for motivation
     */
    getStudyStreakMessage(streakDays: number): string {
        if (streakDays === 0) {
            return "Start your learning streak today! 🚀";
        } else if (streakDays === 1) {
            return "Great start! Keep it up! ⭐";
        } else if (streakDays < 7) {
            return `${streakDays} days strong! 🔥`;
        } else if (streakDays < 30) {
            return `Amazing ${streakDays}-day streak! 🏆`;
        } else {
            return `Incredible ${streakDays}-day streak! You're unstoppable! 🎯`;
        }
    }

    /**
     * Format analytics data for charts and displays
     */
    formatAnalyticsForDisplay(analytics: LearningAnalytics): {
        studyTimeFormatted: string;
        completionRate: number;
        averageScoreFormatted: string;
        streakMessage: string;
    } {
        return {
            studyTimeFormatted: this.formatSessionDuration(analytics.total_study_time_minutes),
            completionRate: analytics.total_sessions > 0
                ? Math.round((analytics.completed_sessions / analytics.total_sessions) * 100)
                : 0,
            averageScoreFormatted: analytics.average_score
                ? `${Math.round(analytics.average_score)}%`
                : 'No scores yet',
            streakMessage: this.getStudyStreakMessage(analytics.study_streak_days)
        };
    }

    /**
     * Check if user should be encouraged to study (based on streak and recent activity)
     */
    shouldEncourageStudy(analytics: LearningAnalytics): {
        shouldEncourage: boolean;
        message: string;
    } {
        const { study_streak_days, sessions_per_day } = analytics;

        // If no streak, encourage to start
        if (study_streak_days === 0) {
            return {
                shouldEncourage: true,
                message: "Ready to start learning today? Let's build that streak! 🌟"
            };
        }

        // If low activity, encourage more sessions
        if (sessions_per_day < 0.5) {
            return {
                shouldEncourage: true,
                message: "You're doing great! Consider adding more study sessions to boost your progress! 📚"
            };
        }

        // If doing well, motivate to continue
        if (study_streak_days >= 7) {
            return {
                shouldEncourage: false,
                message: "You're on fire! Keep up the excellent work! 🔥"
            };
        }

        return {
            shouldEncourage: false,
            message: "Great progress! You're building a solid learning habit! 👍"
        };
    }

    /**
     * Validate session data before starting
     */
    validateSessionStart(sessionData: StudySessionStart): { valid: boolean; error?: string } {
        if (!sessionData.course_id || sessionData.course_id <= 0) {
            return { valid: false, error: 'Valid course ID is required' };
        }

        if (!sessionData.lesson_id || sessionData.lesson_id <= 0) {
            return { valid: false, error: 'Valid lesson ID is required' };
        }

        return { valid: true };
    }

    /**
     * Validate session end data
     */
    validateSessionEnd(sessionData: StudySessionEnd): { valid: boolean; error?: string } {
        if (sessionData.completion_percentage < 0 || sessionData.completion_percentage > 100) {
            return { valid: false, error: 'Completion percentage must be between 0 and 100' };
        }

        const allowedStatuses = ['completed', 'abandoned'];
        if (!allowedStatuses.includes(sessionData.status)) {
            return { valid: false, error: 'Status must be either "completed" or "abandoned"' };
        }

        return { valid: true };
    }

    /**
     * Get available submission types
     */
    getAvailableSubmissionTypes(): Array<'homework' | 'quiz' | 'practice' | 'assessment'> {
        return ['homework', 'quiz', 'practice', 'assessment'];
    }

    /**
     * Get supported file types for submissions
     */
    getSupportedFileTypes(): string[] {
        return ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png'];
    }

    // ===============================
    // WORKFLOW-SPECIFIC HELPER METHODS
    // ===============================

    /**
     * Validate assignment workflow data
     */
    validateAssignmentWorkflow(workflowData: {
        courseId: number;
        assignmentId: number;
        submissionData?: any;
    }): { valid: boolean; error?: string } {
        if (!workflowData.courseId || workflowData.courseId <= 0) {
            return { valid: false, error: 'Valid course ID is required' };
        }

        if (!workflowData.assignmentId || workflowData.assignmentId <= 0) {
            return { valid: false, error: 'Valid assignment ID is required' };
        }

        return { valid: true };
    }

    /**
     * Get assignment status color for UI
     */
    getAssignmentStatusColor(status: string): string {
        switch (status) {
            case 'assigned': return '#2196F3'; // Blue
            case 'submitted': return '#FF9800'; // Orange  
            case 'graded': return '#4CAF50'; // Green
            case 'overdue': return '#F44336'; // Red
            default: return '#757575'; // Gray
        }
    }

    /**
     * Format assignment due date for display
     */
    formatAssignmentDueDate(dueDate: string): {
        formatted: string;
        isOverdue: boolean;
        daysUntilDue: number;
    } {
        const due = new Date(dueDate);
        const now = new Date();
        const timeDiff = due.getTime() - now.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

        return {
            formatted: due.toLocaleDateString(),
            isOverdue: daysDiff < 0,
            daysUntilDue: daysDiff
        };
    }

    /**
     * Check if user can continue the workflow cycle
     */
    canContinueWorkflowCycle(
        lastSession?: StudySession,
        lastAssignment?: StudentAssignment
    ): {
        canContinue: boolean;
        reason?: string;
        nextAction?: string;
    } {
        // If no previous activity, can start fresh
        if (!lastSession && !lastAssignment) {
            return {
                canContinue: true,
                nextAction: 'Select a course to read and start learning'
            };
        }

        // If last assignment is graded, can continue to next
        if (lastAssignment && lastAssignment.status === 'graded') {
            return {
                canContinue: true,
                nextAction: 'Continue to next assignment or course block'
            };
        }

        // If session in progress, should complete it first
        if (lastSession && lastSession.status === 'in_progress') {
            return {
                canContinue: false,
                reason: 'Complete current study session first',
                nextAction: 'Finish current session before starting new workflow'
            };
        }

        // If assignment submitted but not graded, wait for grading
        if (lastAssignment && lastAssignment.status === 'submitted') {
            return {
                canContinue: false,
                reason: 'Assignment is being graded',
                nextAction: 'Wait for grading results or check back later'
            };
        }

        return {
            canContinue: true,
            nextAction: 'Ready to start new workflow cycle'
        };
    }

    /**
     * Get workflow progress summary
     */
    getWorkflowProgressSummary(
        sessions: StudySession[],
        assignments: StudentAssignment[]
    ): {
        totalSessions: number;
        completedSessions: number;
        totalAssignments: number;
        gradedAssignments: number;
        averageScore: number;
        workflowCompletionRate: number;
    } {
        const completedSessions = sessions.filter(s => s.status === 'completed').length;
        const gradedAssignments = assignments.filter(a => a.status === 'graded').length;

        const scores = assignments
            .filter(a => a.grade !== null && a.grade !== undefined)
            .map(a => a.grade!);

        const averageScore = scores.length > 0
            ? scores.reduce((sum, score) => sum + score, 0) / scores.length
            : 0;

        const workflowCompletionRate = assignments.length > 0
            ? (gradedAssignments / assignments.length) * 100
            : 0;

        return {
            totalSessions: sessions.length,
            completedSessions,
            totalAssignments: assignments.length,
            gradedAssignments,
            averageScore,
            workflowCompletionRate
        };
    }

    /**
     * Find most recent AI submission linked to a specific assignment id.
     * Scans recent sessions and returns the newest processed submission.
     */
    async findLatestSubmissionForAssignment(
        assignmentId: number,
        token: string,
        scanLimit: number = 30
    ): Promise<AISubmission | null> {
        try {
            // Include both legacy session-tied and session-less (recent submissions) sources
            const recentResp = await this.makeAuthenticatedRequest(
                `/after-school/uploads/user/recent-submissions?limit=${encodeURIComponent(scanLimit)}`,
                token
            );
            const recentList: AISubmission[] = await recentResp.json();

            const sessionLists = await (async () => {
                try {
                    const sessions = await this.getUserSessions(token, { limit: scanLimit });
                    const lists = await Promise.all(
                        sessions.map(s => this.getSessionSubmissions(s.id, token).catch(() => []))
                    );
                    return lists.flat();
                } catch {
                    return [] as AISubmission[];
                }
            })();

            const combined = [...recentList, ...sessionLists].filter(
                s => s && s.ai_processed && (s as any).assignment_id === assignmentId
            );
            if (combined.length === 0) return null;
            combined.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
            return combined[0];
        } catch (e) {
            console.warn('findLatestSubmissionForAssignment failed', e);
            return null;
        }
    }
}

export const gradesService = new GradesService();