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

// Course Interfaces
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

// Study Session Interfaces
export interface StudySessionStart {
    course_id: number;
    lesson_id: number;
}

export interface StudySessionEnd {
    completion_percentage: number;
    status: 'completed' | 'abandoned';
}

export interface StudySession {
    id: number;
    user_id: number;
    course_id: number;
    lesson_id: number;
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
    lesson_id: number;
    session_id: number;
    submission_type: 'homework' | 'quiz' | 'practice' | 'assessment';
}

export interface AISubmission {
    id: number;
    user_id: number;
    course_id: number;
    lesson_id: number;
    session_id: number;
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
    progress_summary: StudentProgress[];
    total_study_time: number;
    average_score?: number;
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

class AfterSchoolService {
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
            const data = await response.json();

            console.log('✅ Courses fetched successfully:', data.total, 'courses');
            return data;
        } catch (error) {
            console.error('❌ Error fetching courses:', error);
            throw error;
        }
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
            const data = await response.json();

            console.log('✅ Course details fetched successfully:', data.title);
            return data;
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
            console.error('❌ Error fetching student dashboard:', error);
            throw error;
        }
    }

    // ===============================
    // STUDY SESSION METHODS
    // ===============================

    /**
     * Start a new study session
     */
    async startStudySession(sessionData: StudySessionStart, token: string): Promise<StudySession> {
        try {
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
     * End a study session
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
     * Get study session details
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
     * Get student progress for a course
     */
    async getStudentProgress(courseId: number, token: string): Promise<StudentProgress> {
        try {
            console.log('📊 Fetching student progress for course:', courseId);
            const response = await this.makeAuthenticatedRequest(
                `/after-school/progress/course/${courseId}`,
                token
            );

            const data = await response.json();
            console.log('✅ Student progress fetched successfully');
            return data;
        } catch (error) {
            console.error('❌ Error fetching student progress:', error);
            throw error;
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