/**
 * Course Details Screen
 * Shows comprehensive course information, lessons, progress, and actions
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Alert,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import {
    afterSchoolService,
    CourseWithLessons,
    CourseLesson,
    StudentProgress,
    CourseBlock,
    StudentAssignment,
    UnifiedCourse,
    CourseAssignment
} from '../../services/afterSchoolService';

type NavigationProp = NativeStackNavigationProp<any>;
type RouteProp_ = RouteProp<{ params: { courseId: number; courseTitle: string } }>;

interface Props {
    navigation: NavigationProp;
    route: RouteProp_;
}

const { width } = Dimensions.get('window');

export const CourseDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
    const { courseId, courseTitle } = route.params;
    const { token } = useAuth();

    const [course, setCourse] = useState<UnifiedCourse | null>(null);
    const [blocks, setBlocks] = useState<CourseBlock[]>([]);
    const [progress, setProgress] = useState<StudentProgress | null>(null);
    const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
    const [rawAssignments, setRawAssignments] = useState<CourseAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingAssignments, setLoadingAssignments] = useState(false);
    const [enrolling, setEnrolling] = useState(false);
    const [isEnrolled, setIsEnrolled] = useState(false); // explicit enrollment UI flag
    const [activeTab, setActiveTab] = useState<'lessons' | 'progress' | 'assignments'>('lessons');
    const [activeLessonSessions, setActiveLessonSessions] = useState<Record<number, number>>({}); // lessonId -> sessionId
    const [activeBlockSessions, setActiveBlockSessions] = useState<Record<number, number>>({}); // blockId -> sessionId

    // Load course data
    const inFlightRef = React.useRef<Promise<void> | null>(null);

    const loadCourseData = async (isRefresh: boolean = false) => {
        try {
            if (!isRefresh) setLoading(true);

            if (!token) {
                throw new Error('No authentication token available');
            }
            if (inFlightRef.current) {
                return; // prevent duplicate load
            }
            inFlightRef.current = (async () => {
                // Load unified course & progress in parallel
                const [courseData, progressData] = await Promise.all([
                    afterSchoolService.getUnifiedCourse(courseId, token, {
                        include_stats: true,
                        include_progress: true
                    }),
                    afterSchoolService.getStudentProgress(courseId, token).catch(() => null)
                ]);

                setCourse(courseData);
                setBlocks(Array.isArray(courseData.blocks) ? courseData.blocks : []);
                setProgress(progressData);
                // Recalculate enrollment flag based on any progress or assignments already fetched later
                setIsEnrolled(!!progressData);
                try {
                    await detectActiveSessions(courseData, progressData);
                } catch (e) {
                    console.warn('Active session detection skipped', e);
                }
            })();
            await inFlightRef.current;
        } catch (error) {
            console.error('Error loading course data:', error);
            Alert.alert(
                'Error',
                'Failed to load course details. Please try again.',
                [{ text: 'OK' }]
            );
        } finally {
            setLoading(false);
            if (isRefresh) setRefreshing(false);
            inFlightRef.current = null;
        }
    };

    // Load assignments for the course
    const loadAssignments = async () => {
        if (!token) return;

        try {
            setLoadingAssignments(true);
            const [studentSpecific, definitions] = await Promise.all([
                afterSchoolService.getCourseAssignments(courseId, token).catch(() => []),
                afterSchoolService.getCourseAssignmentDefinitions(courseId, token).catch(() => [])
            ]);
            setAssignments(studentSpecific);
            setRawAssignments(definitions);
            if (studentSpecific.length > 0) setIsEnrolled(true);
        } catch (error) {
            console.error('Error loading assignments:', error);
        } finally {
            setLoadingAssignments(false);
        }
    };

    // Enroll in course
    const handleEnroll = async () => {
        if (!token) return;
        if (enrolling) return;
        // If we already have progress or assignments, assume enrolled
        if (isEnrolled || progress || assignments.length > 0) return;
        try {
            setEnrolling(true);
            const res = await afterSchoolService.enrollInCourse(courseId, token);
            Alert.alert('Enrollment', res?.message || 'You have been enrolled in this course.');
            // Immediately reflect enrollment before heavy reloads
            setIsEnrolled(true);
            await Promise.all([
                loadCourseData(true),
                loadAssignments(),
            ]);
            setActiveTab('assignments');
        } catch (e: any) {
            const msg = (e && e.message) || 'Failed to enroll in this course. Please try again.';
            if (msg.toLowerCase().includes('already enrolled')) {
                // Force a refresh anyway
                setIsEnrolled(true);
                await Promise.all([loadCourseData(true), loadAssignments()]);
            } else {
                Alert.alert('Error', msg);
            }
        } finally {
            setEnrolling(false);
        }
    };

    // Load data on screen focus
    useFocusEffect(
        useCallback(() => {
            loadCourseData();
        }, [courseId, token])
    );

    // Load assignments when assignments tab is activated
    const onTabChange = (tab: 'lessons' | 'progress' | 'assignments') => {
        setActiveTab(tab);
        if (tab === 'assignments' && assignments.length === 0) {
            loadAssignments();
        }
    };

    // Detect active sessions for lessons & blocks
    const detectActiveSessions = async (courseData?: UnifiedCourse | null, progressData?: StudentProgress | null) => {
        if (!token) return;
        const targetCourse = courseData || course;
        if (!targetCourse) return;
        try {
            const lessonMap: Record<number, number> = {};
            const blockMap: Record<number, number> = {};
            const lessons = (targetCourse.lessons || []).slice(0, 50);
            const blocksData = (targetCourse.blocks || []).slice(0, 50);
            const fetchOne = async (params: { lesson_id?: number; block_id?: number }) => {
                const qp: string[] = [`course_id=${targetCourse.id}`, 'status=in_progress', 'limit=1'];
                if (params.lesson_id) qp.push(`lesson_id=${params.lesson_id}`);
                if (params.block_id) qp.push(`block_id=${params.block_id}`);
                try {
                    // Reuse service low-level fetcher if exposed; otherwise direct fetch
                    const resp = await fetch(`${afterSchoolService ? ((afterSchoolService as any).baseUrl || 'https://brainink-backend.onrender.com') : 'https://brainink-backend.onrender.com'}/after-school/sessions/?${qp.join('&')}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!resp.ok) return;
                    const data = await resp.json();
                    if (Array.isArray(data) && data.length > 0) {
                        const s = data[0];
                        if (params.lesson_id) lessonMap[params.lesson_id] = s.id;
                        if (params.block_id) blockMap[params.block_id] = s.id;
                    }
                } catch (e) {
                    // Silent per-item failure
                }
            };
            await Promise.allSettled([
                ...lessons.map(l => fetchOne({ lesson_id: l.id })),
                ...blocksData.map(b => fetchOne({ block_id: b.id }))
            ]);
            setActiveLessonSessions(lessonMap);
            setActiveBlockSessions(blockMap);
        } catch (e) {
            console.warn('detectActiveSessions error', e);
        }
    };

    // Pull to refresh
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadCourseData(true);
    }, []);

    // Navigate to lesson
    const navigateToLesson = (lesson: CourseLesson) => {
        navigation.navigate('LessonView', {
            courseId,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            courseTitle
        });
    };

    // Start study session
    const startStudySession = async (lesson: CourseLesson) => {
        try {
            if (!token) return;
            if (activeLessonSessions[lesson.id]) {
                navigation.navigate('StudySession', {
                    sessionId: activeLessonSessions[lesson.id],
                    courseId,
                    lessonId: lesson.id,
                    lessonTitle: lesson.title,
                    courseTitle
                });
                return;
            }
            const session = await afterSchoolService.startStudySession({ course_id: courseId, lesson_id: lesson.id }, token);
            setActiveLessonSessions(prev => ({ ...prev, [lesson.id]: session.id }));

            navigation.navigate('StudySession', {
                sessionId: session.id,
                courseId,
                lessonId: lesson.id,
                lessonTitle: lesson.title,
                courseTitle
            });
        } catch (error) {
            console.error('Error starting study session:', error);
            Alert.alert(
                'Error',
                'Failed to start study session. Please try again.',
                [{ text: 'OK' }]
            );
        }
    };

    // Navigate to assignments
    const navigateToAssignments = () => {
        navigation.navigate('CourseAssignments', {
            courseId,
            courseTitle
        });
    };

    // Navigate to progress details
    const navigateToProgress = () => {
        navigation.navigate('CourseProgress', {
            courseId,
            courseTitle
        });
    };

    // Navigate to assignment workflow
    const navigateToAssignment = (assignment: StudentAssignment) => {
        navigation.navigate('CourseAssignment', {
            courseId,
            assignmentId: assignment.assignment_id,
            assignmentTitle: assignment.assignment.title,
            courseTitle
        });
    };

    // Start assignment workflow directly
    const startAssignmentWorkflow = (assignment: StudentAssignment) => {
        navigation.navigate('CourseAssignment', {
            courseId,
            assignmentId: assignment.assignment_id,
            assignmentTitle: assignment.assignment.title,
            courseTitle,
            startWorkflow: true
        });
    };

    // Format duration
    const formatDuration = (minutes: number): string => {
        if (minutes < 60) {
            return `${minutes} min`;
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    };

    // Render loading state
    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {courseTitle}
                    </Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading course details...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!course) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Course Not Found</Text>
                </View>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Course not found</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => loadCourseData()}
                    >
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // Render course header
    const renderCourseHeader = () => (
        <View style={styles.courseHeaderContainer}>
            <Text style={styles.courseTitle}>{course.title}</Text>
            <Text style={styles.courseSubject}>{course.subject}</Text>
            <View style={styles.courseMetaContainer}>
                <View style={styles.courseMeta}>
                    <Text style={styles.courseMetaLabel}>Difficulty:</Text>
                    <Text style={styles.courseMetaValue}>
                        {course.difficulty_level.charAt(0).toUpperCase() + course.difficulty_level.slice(1)}
                    </Text>
                </View>
                <View style={styles.courseMeta}>
                    <Text style={styles.courseMetaLabel}>Age Range:</Text>
                    <Text style={styles.courseMetaValue}>
                        {course.age_min}-{course.age_max} years
                    </Text>
                </View>
            </View>

            {/* Progress Overview */}
            {progress && (
                <View style={styles.progressOverview}>
                    <Text style={styles.progressTitle}>Your Progress</Text>
                    <View style={styles.progressStats}>
                        <View style={styles.progressStat}>
                            <Text style={styles.progressStatValue}>
                                {progress.lessons_completed}/{progress.total_lessons}
                            </Text>
                            <Text style={styles.progressStatLabel}>Lessons</Text>
                        </View>
                        <View style={styles.progressStat}>
                            <Text style={styles.progressStatValue}>
                                {Math.round(progress.completion_percentage)}%
                            </Text>
                            <Text style={styles.progressStatLabel}>Complete</Text>
                        </View>
                        <View style={styles.progressStat}>
                            <Text style={styles.progressStatValue}>
                                {progress.average_score ? `${Math.round(progress.average_score)}%` : 'N/A'}
                            </Text>
                            <Text style={styles.progressStatLabel}>Avg Score</Text>
                        </View>
                    </View>
                    <View style={styles.progressBarContainer}>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { width: `${progress.completion_percentage}%` }
                                ]}
                            />
                        </View>
                        <TouchableOpacity
                            style={styles.progressDetailsButton}
                            onPress={navigateToProgress}
                        >
                            <Text style={styles.progressDetailsButtonText}>View Details</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Course Description */}
            {typeof course.description === 'string' && course.description.trim().length > 0 && (
                <View style={styles.descriptionContainer}>
                    <Text style={styles.descriptionText}>{course.description}</Text>
                </View>
            )}

            {/* Enroll CTA */}
            <View style={{ marginTop: 16 }}>
                {isEnrolled || progress || assignments.length > 0 ? (
                    <View style={[styles.enrollButton, { backgroundColor: '#28A745' }]}>
                        <Text style={styles.enrollButtonText}>Enrolled</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        onPress={handleEnroll}
                        disabled={enrolling}
                        style={[styles.enrollButton, enrolling && { opacity: 0.7 }]}
                    >
                        <Text style={styles.enrollButtonText}>{enrolling ? 'Enrolling…' : 'Enroll in Course'}</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    // Render tab navigation
    const hasLessons = !!course.lessons?.length;
    const hasBlocks = blocks.length > 0;

    const renderTabNavigation = () => (
        <View style={styles.tabContainer}>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'lessons' && styles.activeTab]}
                onPress={() => onTabChange('lessons')}
            >
                <Text style={[styles.tabText, activeTab === 'lessons' && styles.activeTabText]}>
                    {hasLessons ? 'Lessons' : hasBlocks ? 'Blocks' : 'Lessons'} ({hasLessons ? course.lessons?.length || 0 : hasBlocks ? blocks.length : 0})
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'progress' && styles.activeTab]}
                onPress={() => onTabChange('progress')}
            >
                <Text style={[styles.tabText, activeTab === 'progress' && styles.activeTabText]}>
                    Progress
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'assignments' && styles.activeTab]}
                onPress={() => onTabChange('assignments')}
            >
                <Text style={[styles.tabText, activeTab === 'assignments' && styles.activeTabText]}>
                    Assignments ({assignments.length})
                </Text>
            </TouchableOpacity>
        </View>
    );

    // Render lesson card
    const renderLessonCard = (lesson: CourseLesson, index: number) => {
        const isCompleted = progress ? index < progress.lessons_completed : false;
        const isAvailable = progress ? index <= progress.lessons_completed : index === 0;

        return (
            <View key={lesson.id} style={[styles.lessonCard, !isAvailable && styles.lockedLessonCard]}>
                <View style={styles.lessonHeader}>
                    <View style={styles.lessonInfo}>
                        <Text style={styles.lessonOrder}>Lesson {lesson.order_index}</Text>
                        <Text style={[styles.lessonTitle, !isAvailable && styles.disabledText]}>
                            {lesson.title}
                        </Text>
                        <Text style={[styles.lessonDuration, !isAvailable && styles.disabledText]}>
                            {formatDuration(lesson.estimated_duration)}
                        </Text>
                        {typeof lesson.learning_objectives === 'string' && lesson.learning_objectives.trim().length > 0 && (
                            <Text style={[styles.lessonObjectives, !isAvailable && styles.disabledText]} numberOfLines={2}>
                                {lesson.learning_objectives}
                            </Text>
                        )}
                    </View>
                    <View style={styles.lessonActions}>
                        {isCompleted && (
                            <View style={styles.completedBadge}>
                                <Text style={styles.completedBadgeText}>✓</Text>
                            </View>
                        )}
                        {!isAvailable && (
                            <View style={styles.lockedBadge}>
                                <Text style={styles.lockedBadgeText}>🔒</Text>
                            </View>
                        )}
                    </View>
                </View>

                {isAvailable && (
                    <View style={styles.lessonButtonContainer}>
                        <TouchableOpacity
                            style={styles.viewLessonButton}
                            onPress={() => navigateToLesson(lesson)}
                        >
                            <Text style={styles.viewLessonButtonText}>View Lesson</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.startStudyButton}
                            onPress={() => startStudySession(lesson)}
                        >
                            <Text style={styles.startStudyButtonText}>Start Study</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    // Render lessons tab content
    const renderLessonsContent = () => {
        // If lessons exist, show them
        if (hasLessons) {
            return (
                <View style={styles.contentContainer}>
                    {course.lessons
                        .sort((a, b) => a.order_index - b.order_index)
                        .map((lesson, index) => renderLessonCard(lesson, index))}
                </View>
            );
        }

        // Fallback: show blocks if no lessons
        if (hasBlocks) {
            return (
                <View style={styles.contentContainer}>
                    {blocks
                        .sort((a, b) => (a.week - b.week) || (a.block_number - b.block_number))
                        .map((block, idx) => renderBlockCard(block, idx))}
                </View>
            );
        }

        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No content available</Text>
                <Text style={styles.emptySubtext}>Lessons or blocks will appear here when added</Text>
            </View>
        );
    };

    const startBlockSession = async (block: CourseBlock) => {
        try {
            if (!token) return;
            if (activeBlockSessions[block.id]) {
                navigation.navigate('StudySession', {
                    sessionId: activeBlockSessions[block.id],
                    courseId,
                    blockId: block.id,
                    blockTitle: block.title,
                    courseTitle
                });
                return;
            }
            const session = await afterSchoolService.startStudySession({ course_id: courseId, block_id: block.id }, token);
            setActiveBlockSessions(prev => ({ ...prev, [block.id]: session.id }));
            navigation.navigate('StudySession', {
                sessionId: session.id,
                courseId,
                blockId: block.id,
                blockTitle: block.title,
                courseTitle
            });
        } catch (error) {
            console.error('Error starting block study session:', error);
            Alert.alert('Error', 'Failed to start block study session.');
        }
    };

    const renderBlockCard = (block: CourseBlock, index: number) => {
        return (
            <View key={block.id} style={styles.lessonCard}>
                <View style={styles.lessonHeader}>
                    <View style={styles.lessonInfo}>
                        <Text style={styles.lessonOrder}>Week {block.week} • Block {block.block_number}</Text>
                        <Text style={styles.lessonTitle}>{block.title}</Text>
                        <Text style={styles.lessonDuration}>{formatDuration(block.duration_minutes)}</Text>
                        {Array.isArray(block.learning_objectives) && block.learning_objectives.length > 0 && (
                            <Text style={styles.lessonObjectives} numberOfLines={2}>
                                {block.learning_objectives.join('; ')}
                            </Text>
                        )}
                    </View>
                </View>
                <View style={styles.lessonButtonContainer}>
                    <TouchableOpacity
                        style={styles.startStudyButton}
                        onPress={() => startBlockSession(block)}
                    >
                        <Text style={styles.startStudyButtonText}>
                            {activeBlockSessions[block.id] ? 'Continue Study' : 'Start Study'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    // Render progress tab content
    const renderProgressContent = () => {
        if (!progress) {
            return (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No progress data</Text>
                    <Text style={styles.emptySubtext}>Start studying to track your progress</Text>
                </View>
            );
        }

        return (
            <View style={styles.contentContainer}>
                <View style={styles.progressDetailCard}>
                    <Text style={styles.progressDetailTitle}>Study Statistics</Text>
                    <View style={styles.progressDetailGrid}>
                        <View style={styles.progressDetailItem}>
                            <Text style={styles.progressDetailValue}>{progress.sessions_count}</Text>
                            <Text style={styles.progressDetailLabel}>Study Sessions</Text>
                        </View>
                        <View style={styles.progressDetailItem}>
                            <Text style={styles.progressDetailValue}>{formatDuration(progress.total_study_time)}</Text>
                            <Text style={styles.progressDetailLabel}>Total Time</Text>
                        </View>
                        <View style={styles.progressDetailItem}>
                            <Text style={styles.progressDetailValue}>
                                {new Date(progress.started_at).toLocaleDateString()}
                            </Text>
                            <Text style={styles.progressDetailLabel}>Started</Text>
                        </View>
                        <View style={styles.progressDetailItem}>
                            <Text style={styles.progressDetailValue}>
                                {new Date(progress.last_activity).toLocaleDateString()}
                            </Text>
                            <Text style={styles.progressDetailLabel}>Last Activity</Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    // Get assignment status display
    const getAssignmentStatusDisplay = (assignment: StudentAssignment) => {
        switch (assignment.status) {
            case 'assigned':
                return { text: 'New Assignment', color: '#007AFF', bgColor: '#E3F2FD' };
            case 'submitted':
                return { text: 'Submitted', color: '#FF9500', bgColor: '#FFF3E0' };
            case 'graded':
                return { text: 'Completed', color: '#28A745', bgColor: '#E8F5E8' };
            default:
                return { text: 'Unknown', color: '#666', bgColor: '#F5F5F5' };
        }
    };

    // Render assignment card
    const renderAssignmentCard = (assignment: StudentAssignment) => {
        const statusDisplay = getAssignmentStatusDisplay(assignment);
        const isCompleted = assignment.status === 'graded';
        const canStartWorkflow = assignment.status === 'assigned';

        return (
            <View key={assignment.id} style={styles.assignmentWorkflowCard}>
                <View style={styles.assignmentHeader}>
                    <View style={styles.assignmentInfo}>
                        <Text style={styles.assignmentWorkflowTitle}>{assignment.assignment.title}</Text>
                        <Text style={styles.assignmentDescription}>{assignment.assignment.description}</Text>
                        <View style={styles.assignmentMeta}>
                            <Text style={styles.assignmentMetaText}>
                                Due: {new Date(assignment.due_date).toLocaleDateString()}
                            </Text>
                            {assignment.assignment.duration_minutes && (
                                <Text style={styles.assignmentMetaText}>
                                    • {assignment.assignment.duration_minutes} min
                                </Text>
                            )}
                        </View>
                    </View>
                    <View style={[styles.assignmentStatus, { backgroundColor: statusDisplay.bgColor }]}>
                        <Text style={[styles.assignmentStatusText, { color: statusDisplay.color }]}>
                            {statusDisplay.text}
                        </Text>
                    </View>
                </View>

                <View style={styles.assignmentActions}>
                    {canStartWorkflow && (
                        <TouchableOpacity
                            style={styles.startWorkflowButton}
                            onPress={() => startAssignmentWorkflow(assignment)}
                        >
                            <Text style={styles.startWorkflowButtonText}>Start Assignment</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={isCompleted ? styles.viewResultsButton : styles.viewDetailsButton}
                        onPress={() => navigateToAssignment(assignment)}
                    >
                        <Text style={isCompleted ? styles.viewResultsButtonText : styles.viewDetailsButtonText}>
                            {isCompleted ? 'View Results' : 'View Details'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {assignment.status === 'graded' && assignment.grade !== undefined && (
                    <View style={styles.gradeDisplay}>
                        <Text style={styles.gradeText}>Grade: {assignment.grade}%</Text>
                        {assignment.feedback && (
                            <Text style={styles.feedbackText} numberOfLines={2}>
                                {assignment.feedback}
                            </Text>
                        )}
                    </View>
                )}
            </View>
        );
    };

    // Render assignments tab content
    const adaptDefinition = (definition: CourseAssignment): StudentAssignment => ({
        id: definition.id,
        user_id: -1,
        assignment_id: definition.id,
        course_id: definition.course_id,
        assigned_at: definition.created_at,
        due_date: definition.due_days_after_assignment
            ? new Date(Date.now() + definition.due_days_after_assignment * 86400000).toISOString()
            : definition.created_at,
        status: 'assigned',
        created_at: definition.created_at,
        updated_at: definition.updated_at,
        assignment: definition
    });

    const renderAssignmentsContent = () => {
        if (loadingAssignments) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading assignments...</Text>
                </View>
            );
        }

        const hasStudent = assignments.length > 0;
        const hasDefinitions = rawAssignments.length > 0;

        if (!hasStudent && !hasDefinitions) {
            return (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No assignments available</Text>
                    <Text style={styles.emptySubtext}>Your instructor hasn't added assignments yet.</Text>
                </View>
            );
        }
        // Always show available definitions section. Filter out ones already assigned to avoid duplication.
        const assignedDefinitionIds = new Set(
            assignments
                .map(a => (a.assignment?.id ?? a.assignment_id))
                .filter(id => typeof id === 'number')
        );
        const availableDefinitionAdapters = hasDefinitions
            ? rawAssignments
                .filter(def => !assignedDefinitionIds.has(def.id))
                .map(adaptDefinition)
            : [];

        return (
            <View style={styles.contentContainer}>
                <View style={styles.assignmentWorkflowInfo}>
                    <Text style={styles.workflowInfoTitle}>📚 Assignment Workflow</Text>
                    <Text style={styles.workflowInfoText}>
                        Read course → Complete assignment → Upload images → Auto-grade → View results
                    </Text>
                </View>
                {hasStudent && (
                    <View style={{ marginBottom: 16 }}>
                        <Text style={styles.sectionHeading}>Your Assigned Work ({assignments.length})</Text>
                        {assignments.map(renderAssignmentCard)}
                    </View>
                )}
                {hasDefinitions && (
                    <View style={{ marginBottom: 8 }}>
                        <Text style={styles.sectionHeading}>Available Assignments ({availableDefinitionAdapters.length})</Text>
                        {availableDefinitionAdapters.length > 0 ? (
                            availableDefinitionAdapters.map(renderAssignmentCard)
                        ) : (
                            <Text style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                                All available assignments have already been assigned to you.
                            </Text>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {course.title}
                </Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {renderCourseHeader()}
                {renderTabNavigation()}
                {activeTab === 'lessons' && renderLessonsContent()}
                {activeTab === 'progress' && renderProgressContent()}
                {activeTab === 'assignments' && renderAssignmentsContent()}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    backButton: {
        marginRight: 16,
    },
    backButtonText: {
        fontSize: 16,
        color: '#007AFF',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        flex: 1,
    },
    sectionHeading: {
        fontSize: 16,
        fontWeight: '600',
        color: '#222',
        marginBottom: 6
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        color: '#666',
        marginBottom: 16,
    },
    retryButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#007AFF',
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    courseHeaderContainer: {
        backgroundColor: '#fff',
        padding: 20,
        marginBottom: 16,
    },
    courseTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    courseSubject: {
        fontSize: 16,
        color: '#007AFF',
        marginBottom: 16,
    },
    courseMetaContainer: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    courseMeta: {
        marginRight: 24,
    },
    courseMetaLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 2,
    },
    courseMetaValue: {
        fontSize: 14,
        color: '#1a1a1a',
        fontWeight: '600',
    },
    progressOverview: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    progressTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 12,
    },
    progressStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    progressStat: {
        alignItems: 'center',
    },
    progressStatValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    progressStatLabel: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    progressBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    progressBar: {
        flex: 1,
        height: 8,
        backgroundColor: '#e0e0e0',
        borderRadius: 4,
        marginRight: 12,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#007AFF',
        borderRadius: 4,
    },
    progressDetailsButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#007AFF',
        borderRadius: 6,
    },
    progressDetailsButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    descriptionContainer: {
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    descriptionText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    enrollButton: {
        paddingVertical: 12,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        alignItems: 'center',
    },
    enrollButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        marginBottom: 16,
    },
    tab: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: '#007AFF',
    },
    tabText: {
        fontSize: 14,
        color: '#666',
    },
    activeTabText: {
        color: '#007AFF',
        fontWeight: '600',
    },
    contentContainer: {
        paddingHorizontal: 20,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
    lessonCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    lockedLessonCard: {
        backgroundColor: '#f5f5f5',
        opacity: 0.7,
    },
    lessonHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    lessonInfo: {
        flex: 1,
    },
    lessonOrder: {
        fontSize: 12,
        color: '#007AFF',
        fontWeight: '600',
        marginBottom: 4,
    },
    lessonTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    lessonDuration: {
        fontSize: 12,
        color: '#666',
        marginBottom: 8,
    },
    lessonObjectives: {
        fontSize: 13,
        color: '#666',
        lineHeight: 18,
    },
    disabledText: {
        color: '#999',
    },
    lessonActions: {
        alignItems: 'center',
    },
    completedBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#28a745',
        alignItems: 'center',
        justifyContent: 'center',
    },
    completedBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    lockedBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#ccc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    lockedBadgeText: {
        fontSize: 12,
    },
    lessonButtonContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    viewLessonButton: {
        flex: 1,
        paddingVertical: 10,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        alignItems: 'center',
    },
    viewLessonButtonText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '600',
    },
    startStudyButton: {
        flex: 1,
        paddingVertical: 10,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        alignItems: 'center',
    },
    startStudyButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    progressDetailCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    progressDetailTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 16,
    },
    progressDetailGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    progressDetailItem: {
        width: '50%',
        alignItems: 'center',
        paddingVertical: 12,
    },
    progressDetailValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#007AFF',
        marginBottom: 4,
    },
    progressDetailLabel: {
        fontSize: 12,
        color: '#666',
    },
    assignmentCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    assignmentTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    assignmentDescription: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
        marginBottom: 16,
    },
    viewAssignmentsButton: {
        paddingVertical: 12,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        alignItems: 'center',
    },
    viewAssignmentsButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    // Workflow styles
    assignmentWorkflowInfo: {
        backgroundColor: '#E3F2FD',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    workflowInfoTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    workflowInfoText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    assignmentWorkflowCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    assignmentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    assignmentInfo: {
        flex: 1,
        marginRight: 12,
    },
    assignmentWorkflowTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    assignmentMeta: {
        flexDirection: 'row',
        marginTop: 4,
    },
    assignmentMetaText: {
        fontSize: 12,
        color: '#666',
        marginRight: 8,
    },
    assignmentStatus: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    assignmentStatusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    assignmentActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    startWorkflowButton: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        alignItems: 'center',
    },
    startWorkflowButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    viewDetailsButton: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        alignItems: 'center',
    },
    viewDetailsButtonText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '600',
    },
    viewResultsButton: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: '#28A745',
        borderRadius: 8,
        alignItems: 'center',
    },
    viewResultsButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    gradeDisplay: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
        marginTop: 12,
    },
    gradeText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#28A745',
        marginBottom: 4,
    },
    feedbackText: {
        fontSize: 12,
        color: '#666',
        lineHeight: 16,
    },
});