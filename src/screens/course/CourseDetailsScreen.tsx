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
    StudySession
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

    const [course, setCourse] = useState<CourseWithLessons | null>(null);
    const [progress, setProgress] = useState<StudentProgress | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'lessons' | 'progress' | 'assignments'>('lessons');

    // Load course data
    const loadCourseData = async (isRefresh: boolean = false) => {
        try {
            if (!isRefresh) setLoading(true);

            if (!token) {
                throw new Error('No authentication token available');
            }

            // Load course details and progress in parallel
            const [courseData, progressData] = await Promise.all([
                afterSchoolService.getCourseDetails(courseId, token, {
                    include_stats: true,
                    include_progress: true
                }),
                afterSchoolService.getStudentProgress(courseId, token).catch(() => null)
            ]);

            setCourse(courseData);
            setProgress(progressData);
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
        }
    };

    // Load data on screen focus
    useFocusEffect(
        useCallback(() => {
            loadCourseData();
        }, [courseId, token])
    );

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

            const session = await afterSchoolService.startStudySession({
                course_id: courseId,
                lesson_id: lesson.id
            }, token);

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
            {course.description && (
                <View style={styles.descriptionContainer}>
                    <Text style={styles.descriptionText}>{course.description}</Text>
                </View>
            )}
        </View>
    );

    // Render tab navigation
    const renderTabNavigation = () => (
        <View style={styles.tabContainer}>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'lessons' && styles.activeTab]}
                onPress={() => setActiveTab('lessons')}
            >
                <Text style={[styles.tabText, activeTab === 'lessons' && styles.activeTabText]}>
                    Lessons ({course.lessons?.length || 0})
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'progress' && styles.activeTab]}
                onPress={() => setActiveTab('progress')}
            >
                <Text style={[styles.tabText, activeTab === 'progress' && styles.activeTabText]}>
                    Progress
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'assignments' && styles.activeTab]}
                onPress={() => setActiveTab('assignments')}
            >
                <Text style={[styles.tabText, activeTab === 'assignments' && styles.activeTabText]}>
                    Assignments
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
                        {lesson.learning_objectives && (
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
        if (!course.lessons?.length) {
            return (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No lessons available</Text>
                    <Text style={styles.emptySubtext}>Lessons will appear here when they're added to the course</Text>
                </View>
            );
        }

        return (
            <View style={styles.contentContainer}>
                {course.lessons
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((lesson, index) => renderLessonCard(lesson, index))}
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

    // Render assignments tab content
    const renderAssignmentsContent = () => (
        <View style={styles.contentContainer}>
            <View style={styles.assignmentCard}>
                <Text style={styles.assignmentTitle}>Course Assignments</Text>
                <Text style={styles.assignmentDescription}>
                    View and submit your homework, quizzes, and assessments for this course.
                </Text>
                <TouchableOpacity
                    style={styles.viewAssignmentsButton}
                    onPress={navigateToAssignments}
                >
                    <Text style={styles.viewAssignmentsButtonText}>View All Assignments</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

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
});