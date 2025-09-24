/**
 * Course Homepage Screen
 * Main dashboard showing enrolled courses, recent activity, and progress overview
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { afterSchoolService, Course, StudentDashboard, StudentProgress } from '../services/afterSchoolService';

type NavigationProp = NativeStackNavigationProp<any>;

interface Props {
    navigation: NavigationProp;
}

const { width } = Dimensions.get('window');

export const CourseHomepageScreen: React.FC<Props> = ({ navigation }) => {
    const { token, user } = useAuth();
    const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Load dashboard data
    const loadDashboard = async (isRefresh: boolean = false) => {
        try {
            if (!isRefresh) setLoading(true);

            if (!token) {
                throw new Error('No authentication token available');
            }

            const dashboardData = await afterSchoolService.getStudentDashboard(token);
            setDashboard(dashboardData);
            setLoadError(null);
        } catch (error) {
            console.error('Error loading dashboard:', error);

            // Check if it's a database connection error
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isDatabaseError = errorMessage.includes('Database connection error');

            // Save a simplified error for UI fallback instead of spamming Alerts on focus
            setLoadError(
                isDatabaseError
                    ? 'Unable to reach the server right now.'
                    : 'Failed to load your dashboard.'
            );
        } finally {
            setLoading(false);
            if (isRefresh) setRefreshing(false);
        }
    };

    // Load data on screen focus
    useFocusEffect(
        useCallback(() => {
            loadDashboard();
        }, [token])
    );

    // Pull to refresh
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadDashboard(true);
    }, []);

    // Navigate to course details
    const navigateToCourse = (course: Course) => {
        navigation.navigate('CourseDetails', { courseId: course.id, courseTitle: course.title });
    };

    // Navigate to course search
    const navigateToCourseSearch = () => {
        navigation.navigate('CourseSearch');
    };

    // Navigate to course progress
    const navigateToProgress = (courseId: number, courseTitle: string) => {
        navigation.navigate('CourseProgress', { courseId, courseTitle });
    };

    // Navigate directly to course assignments (New workflow)
    const navigateToAssignments = (course: Course) => {
        navigation.navigate('CourseAssignments', {
            courseId: course.id,
            courseTitle: course.title,
            enableWorkflow: true
        });
    };

    // Navigate to continue learning workflow
    const continueWorkflow = (course: Course) => {
        // This will take user to the next available assignment
        navigation.navigate('CourseDetails', {
            courseId: course.id,
            courseTitle: course.title,
            autoStartWorkflow: true
        });
    };

    // Get progress percentage for a course
    const getProgressPercentage = (courseId: number): number => {
        if (!dashboard?.progress_summary) return 0;
        const progress = dashboard.progress_summary.find(p => p.course_id === courseId);
        return progress?.completion_percentage || 0;
    };

    // Format study time
    const formatStudyTime = (minutes: number): string => {
        if (minutes < 60) {
            return `${minutes}m`;
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    };

    // Get workflow status for a course (New for workflow)
    const getWorkflowStatus = (courseId: number): {
        hasAvailableAssignments: boolean;
        nextAction: string;
        canContinue: boolean;
    } => {
        // This would be enhanced to check actual assignments from the dashboard
        // For now, return default workflow-ready state
        return {
            hasAvailableAssignments: true,
            nextAction: 'Continue Learning',
            canContinue: true
        };
    };

    // Render loading state
    if (loading) {
        return (
            <SafeAreaView style={styles.fullscreenContainer} edges={['top', 'left', 'right']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading your courses...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Render welcome header
    const renderWelcomeHeader = () => (
        <View style={styles.welcomeContainer}>
            <View style={styles.welcomeHeader}>
                <View>
                    <Text style={styles.welcomeText}>Welcome back!</Text>
                    <Text style={styles.userNameText}>
                        {user?.fname ? `${user.fname}` : 'Student'}
                    </Text>
                </View>
                <View style={styles.headerButtons}>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={() => navigation.navigate('UploadsOverview')}
                    >
                        <Text style={styles.headerButtonText}>Uploads</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={() => navigation.navigate('GradesOverview')}
                    >
                        <Text style={styles.headerButtonText}>My Grades</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                    <Text style={styles.statNumber}>
                        {dashboard?.active_courses?.length || 0}
                    </Text>
                    <Text style={styles.statLabel}>Active Courses</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={styles.statNumber}>
                        {formatStudyTime(dashboard?.total_study_time || 0)}
                    </Text>
                    <Text style={styles.statLabel}>Study Time</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={styles.statNumber}>
                        {dashboard?.average_score ? `${Math.round(dashboard.average_score)}%` : 'N/A'}
                    </Text>
                    <Text style={styles.statLabel}>Avg Score</Text>
                </View>
            </View>
        </View>
    );

    // Render course card
    const renderCourseCard = (course: Course) => {
        const progressPercentage = getProgressPercentage(course.id);
        const isCompleted = progressPercentage >= 100;

        return (
            <TouchableOpacity
                key={course.id}
                style={[styles.courseCard, isCompleted && styles.completedCourseCard]}
                onPress={() => navigateToCourse(course)}
                activeOpacity={0.7}
            >
                <View style={styles.courseHeader}>
                    <View style={styles.courseInfo}>
                        <View style={styles.courseTitleRow}>
                            <Text style={styles.courseTitle} numberOfLines={2}>
                                {course.title || 'Untitled Course'}
                            </Text>
                            {course.generated_by_ai && (
                                <View style={styles.aiBadge}>
                                    <Text style={styles.aiBadgeText}>🤖 AI</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.courseSubject}>{course.subject || 'General'}</Text>
                        <View style={styles.courseMetaRow}>
                            <Text style={styles.courseDifficulty}>
                                {course.difficulty_level ?
                                    course.difficulty_level.charAt(0).toUpperCase() + course.difficulty_level.slice(1) :
                                    'Beginner'
                                }
                            </Text>
                            <Text style={styles.courseDuration}>
                                📅 {course.total_weeks || 8} weeks • {course.blocks_per_week || 2} blocks/week
                            </Text>
                        </View>
                    </View>
                    <View style={styles.courseActions}>
                        {!isCompleted && (
                            <TouchableOpacity
                                style={styles.workflowButton}
                                onPress={() => continueWorkflow(course)}
                            >
                                <Text style={styles.workflowButtonText}>Continue</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.progressButton}
                            onPress={() => navigateToProgress(course.id, course.title)}
                        >
                            <Text style={styles.progressButtonText}>Progress</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${progressPercentage}%` },
                                isCompleted && styles.completedProgressFill
                            ]}
                        />
                    </View>
                    <Text style={styles.progressText}>{Math.round(progressPercentage)}%</Text>
                </View>

                {/* Course Description */}
                {typeof course.description === 'string' && course.description.trim().length > 0 && (
                    <Text style={styles.courseDescription} numberOfLines={2}>
                        {course.description}
                    </Text>
                )}

                {/* Workflow Status Indicator */}
                {!isCompleted && (
                    <View style={styles.workflowIndicator}>
                        <Text style={styles.workflowIndicatorText}>
                            📋 Ready for assignments
                        </Text>
                    </View>
                )}

                {/* Status Badge */}
                <View style={styles.statusContainer}>
                    <View style={[styles.statusBadge, isCompleted && styles.completedBadge]}>
                        <Text style={[styles.statusText, isCompleted && styles.completedStatusText]}>
                            {isCompleted ? 'Completed' : 'In Progress'}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // Render recent sessions
    const renderRecentSessions = () => {
        if (!dashboard?.recent_sessions?.length) {
            return (
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Recent Activity</Text>
                    <View style={styles.emptyStateContainer}>
                        <Text style={styles.emptyStateText}>No recent activity</Text>
                        <Text style={styles.emptyStateSubtext}>Start a lesson to see your activity here</Text>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                {dashboard.recent_sessions.slice(0, 3).map((session) => (
                    <View key={session.id} style={styles.sessionCard}>
                        <View style={styles.sessionInfo}>
                            <Text style={styles.sessionTitle}>Study Session</Text>
                            <Text style={styles.sessionDetails}>
                                Course ID: {String(session.course_id || 'N/A')} • Lesson ID: {String(session.lesson_id || 'N/A')}
                            </Text>
                            <Text style={styles.sessionTime}>
                                {session.started_at ? new Date(session.started_at).toLocaleDateString() : 'Unknown date'} • {session.duration_minutes ? `${formatStudyTime(session.duration_minutes)}` : 'In progress'}
                            </Text>
                        </View>
                        {session.ai_score !== undefined && session.ai_score !== null && (
                            <View style={styles.scoreContainer}>
                                <Text style={styles.scoreText}>{Math.round(Number(session.ai_score))}%</Text>
                            </View>
                        )}
                    </View>
                ))}
            </View>
        );
    };

    // Render courses section
    const renderCoursesSection = () => {
        if (loadError && !dashboard) {
            return (
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Your Courses</Text>
                    <View style={styles.emptyStateContainer}>
                        <Text style={styles.emptyStateText}>Dashboard Unavailable</Text>
                        <Text style={styles.emptyStateSubtext}>{loadError}</Text>
                        <TouchableOpacity
                            style={styles.enrollButton}
                            onPress={() => loadDashboard()}
                        >
                            <Text style={styles.enrollButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }
        if (!dashboard?.active_courses?.length) {
            return (
                <View style={styles.sectionContainer}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Your Courses</Text>
                        <TouchableOpacity
                            style={styles.browseButton}
                            onPress={navigateToCourseSearch}
                        >
                            <Text style={styles.browseButtonText}>Browse Courses</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.emptyStateContainer}>
                        <Text style={styles.emptyStateText}>No courses enrolled</Text>
                        <Text style={styles.emptyStateSubtext}>Discover and enroll in courses to start learning</Text>
                        <TouchableOpacity
                            style={styles.enrollButton}
                            onPress={navigateToCourseSearch}
                        >
                            <Text style={styles.enrollButtonText}>Find Courses</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Your Courses</Text>
                    <TouchableOpacity
                        style={styles.browseButton}
                        onPress={navigateToCourseSearch}
                    >
                        <Text style={styles.browseButtonText}>Browse More</Text>
                    </TouchableOpacity>
                </View>
                {dashboard.active_courses.map(renderCourseCard)}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.fullscreenContainer} edges={['top', 'left', 'right']}>
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                contentInsetAdjustmentBehavior="never"
            >
                {renderWelcomeHeader()}
                {renderCoursesSection()}
                {renderRecentSessions()}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    fullscreenContainer: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollView: {
        flex: 1,
        backgroundColor: 'transparent',
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
    welcomeContainer: {
        backgroundColor: '#007AFF',
        padding: 20,
        paddingTop: 10,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        marginBottom: 24,
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
    welcomeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
        paddingTop: 8,
    },
    welcomeText: {
        fontSize: 18,
        color: 'rgba(255, 255, 255, 0.9)',
        marginBottom: 6,
        fontWeight: '500',
    },
    userNameText: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.5,
    },
    gradesButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    gradesButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    headerButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    headerButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    headerButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 12,
        marginTop: 8,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statNumber: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
    },
    statLabel: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.9)',
        marginTop: 4,
        fontWeight: '500',
    },
    sectionContainer: {
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    browseButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#007AFF',
        borderRadius: 20,
    },
    browseButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    courseCard: {
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
    completedCourseCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#28a745',
    },
    courseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    courseInfo: {
        flex: 1,
        marginRight: 12,
    },
    courseTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    courseSubject: {
        fontSize: 14,
        color: '#007AFF',
        marginBottom: 2,
    },
    courseTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    aiBadge: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
        marginLeft: 8,
    },
    aiBadgeText: {
        fontSize: 10,
        color: '#10b981',
        fontWeight: '600',
    },
    courseMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 2,
    },
    courseDifficulty: {
        fontSize: 12,
        color: '#666',
        textTransform: 'capitalize',
        flex: 1,
    },
    courseDuration: {
        fontSize: 11,
        color: '#888',
        textAlign: 'right',
        flex: 1,
    },
    courseActions: {
        alignItems: 'flex-end',
        gap: 6,
    },
    workflowButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#007AFF',
        borderRadius: 8,
    },
    workflowButtonText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '600',
    },
    progressButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#f0f0f0',
        borderRadius: 6,
    },
    progressButtonText: {
        fontSize: 12,
        color: '#007AFF',
        fontWeight: '600',
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    progressBar: {
        flex: 1,
        height: 6,
        backgroundColor: '#e0e0e0',
        borderRadius: 3,
        marginRight: 8,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#007AFF',
        borderRadius: 3,
    },
    completedProgressFill: {
        backgroundColor: '#28a745',
    },
    progressText: {
        fontSize: 12,
        color: '#666',
        minWidth: 35,
    },
    courseDescription: {
        fontSize: 13,
        color: '#666',
        lineHeight: 18,
        marginBottom: 8,
    },
    workflowIndicator: {
        backgroundColor: '#e8f5e8',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginBottom: 8,
        alignSelf: 'flex-start',
    },
    workflowIndicatorText: {
        fontSize: 11,
        color: '#28a745',
        fontWeight: '600',
    },
    statusContainer: {
        alignItems: 'flex-start',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#e3f2fd',
        borderRadius: 12,
    },
    completedBadge: {
        backgroundColor: '#e8f5e8',
    },
    statusText: {
        fontSize: 11,
        color: '#007AFF',
        fontWeight: '600',
    },
    completedStatusText: {
        color: '#28a745',
    },
    sessionCard: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    sessionInfo: {
        flex: 1,
    },
    sessionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 2,
    },
    sessionDetails: {
        fontSize: 12,
        color: '#666',
        marginBottom: 2,
    },
    sessionTime: {
        fontSize: 11,
        color: '#999',
    },
    scoreContainer: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#f0f8ff',
        borderRadius: 6,
    },
    scoreText: {
        fontSize: 12,
        color: '#007AFF',
        fontWeight: '600',
    },
    emptyStateContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyStateText: {
        fontSize: 16,
        color: '#666',
        marginBottom: 8,
    },
    emptyStateSubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        marginBottom: 20,
    },
    enrollButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: '#007AFF',
        borderRadius: 8,
    },
    enrollButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});