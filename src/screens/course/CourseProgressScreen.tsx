/**
 * Course Progress Screen
 * Detailed progress view with completion stats, scores, time spent, and achievements
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
    StudentProgress,
    StudySession,
    CourseWithLessons,
    CourseLesson,
    StudentAssignment
} from '../../services/afterSchoolService';
import { gradesService } from '../../services/gradesService';

type NavigationProp = NativeStackNavigationProp<any>;
type RouteProp_ = RouteProp<{ params: { courseId: number; courseTitle: string } }>;

interface Props {
    navigation: NavigationProp;
    route: RouteProp_;
}

const { width } = Dimensions.get('window');

export const CourseProgressScreen: React.FC<Props> = ({ navigation, route }) => {
    const { courseId, courseTitle } = route.params;
    const { token } = useAuth();

    const [progress, setProgress] = useState<StudentProgress | null>(null);
    const [course, setCourse] = useState<CourseWithLessons | null>(null);
    const [sessions, setSessions] = useState<StudySession[]>([]);
    const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'assignments' | 'sessions' | 'analytics'>('overview');

    // Load progress data
    const loadProgressData = async (isRefresh: boolean = false) => {
        try {
            if (!isRefresh) setLoading(true);

            if (!token) {
                throw new Error('No authentication token available');
            }

            // Load progress and course data in parallel
            const [progressData, courseData, assignmentsData] = await Promise.all([
                afterSchoolService.getStudentProgress(courseId, token).catch(() => null),
                afterSchoolService.getCourseDetails(courseId, token),
                afterSchoolService.getCourseAssignments(courseId, token).catch(() => [])
            ]);

            setProgress(progressData);
            setCourse(courseData);
            setAssignments(assignmentsData);
            // For now, use empty sessions array - in real app would fetch from appropriate service
            setSessions([]);
        } catch (error) {
            console.error('Error loading progress data:', error);
            Alert.alert(
                'Error',
                'Failed to load progress details. Please try again.',
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
            loadProgressData();
        }, [courseId, token])
    );

    // Pull to refresh
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadProgressData(true);
    }, []);

    // Navigate back to course details
    const navigateBackToCourse = () => {
        navigation.navigate('CourseDetails', {
            courseId,
            courseTitle
        });
    };

    // Navigate to assignment workflow
    const navigateToAssignment = (assignment: StudentAssignment) => {
        navigation.navigate('CourseAssignment', {
            courseId,
            assignmentId: assignment.assignment_id,
            assignmentTitle: `Assignment ${assignment.assignment_id}`
        });
    };

    // Continue workflow from progress screen
    const continueWorkflow = () => {
        const nextAssignment = assignments.find(a => a.status === 'assigned');
        if (nextAssignment) {
            navigateToAssignment(nextAssignment);
        } else {
            navigation.navigate('CourseDetails', { courseId, courseTitle });
        }
    };

    // Format duration
    const formatDuration = (minutes: number): string => {
        if (minutes < 60) {
            return `${minutes}m`;
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    };

    // Calculate progress percentage
    const getProgressPercentage = (): number => {
        if (!progress || progress.total_lessons === 0) return 0;
        return Math.round((progress.lessons_completed / progress.total_lessons) * 100);
    };

    // Get achievement level
    const getAchievementLevel = (): string => {
        const percentage = getProgressPercentage();
        if (percentage >= 100) return 'Course Master';
        if (percentage >= 80) return 'Expert Learner';
        if (percentage >= 60) return 'Advanced Student';
        if (percentage >= 40) return 'Good Progress';
        if (percentage >= 20) return 'Getting Started';
        return 'Beginner';
    };

    // Get average session duration
    const getAverageSessionDuration = (): number => {
        const completedSessions = sessions.filter(s => s.duration_minutes && s.duration_minutes > 0);
        if (completedSessions.length === 0) return 0;

        const totalDuration = completedSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
        return Math.round(totalDuration / completedSessions.length);
    };

    // Get study streak (consecutive days with sessions)
    const getStudyStreak = (): number => {
        if (sessions.length === 0) return 0;

        const sessionDates = sessions
            .map(s => new Date(s.started_at).toDateString())
            .filter((date, index, arr) => arr.indexOf(date) === index)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        let streak = 0;
        let currentDate = new Date();

        for (const dateStr of sessionDates) {
            const sessionDate = new Date(dateStr);
            const daysDiff = Math.floor((currentDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));

            if (daysDiff === streak) {
                streak++;
                currentDate = sessionDate;
            } else if (daysDiff === streak + 1) {
                // Allow for one day gap
                streak++;
                currentDate = sessionDate;
            } else {
                break;
            }
        }

        return streak;
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
                    <Text style={styles.headerTitle}>Progress</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading progress...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Render progress overview
    const renderProgressOverview = () => {
        if (!progress) {
            return (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No progress data available</Text>
                    <Text style={styles.emptySubtext}>Start studying to track your progress</Text>
                </View>
            );
        }

        const progressPercentage = getProgressPercentage();
        const achievementLevel = getAchievementLevel();
        const averageSessionDuration = getAverageSessionDuration();
        const studyStreak = getStudyStreak();

        return (
            <View style={styles.contentContainer}>
                {/* Progress Circle */}
                <View style={styles.progressCircleContainer}>
                    <View style={styles.progressCircle}>
                        <Text style={styles.progressPercentageText}>{progressPercentage}%</Text>
                        <Text style={styles.progressPercentageLabel}>Complete</Text>
                    </View>
                    <Text style={styles.achievementText}>{achievementLevel}</Text>
                </View>

                {/* Progress Stats Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{progress.lessons_completed}</Text>
                        <Text style={styles.statLabel}>Lessons Completed</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{progress.total_lessons}</Text>
                        <Text style={styles.statLabel}>Total Lessons</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{formatDuration(progress.total_study_time)}</Text>
                        <Text style={styles.statLabel}>Study Time</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>
                            {progress.average_score ? `${Math.round(progress.average_score)}%` : 'N/A'}
                        </Text>
                        <Text style={styles.statLabel}>Average Score</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{progress.sessions_count}</Text>
                        <Text style={styles.statLabel}>Study Sessions</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{studyStreak}</Text>
                        <Text style={styles.statLabel}>Day Streak</Text>
                    </View>
                </View>

                {/* Assignment Workflow Status */}
                {assignments.length > 0 && (
                    <View style={styles.workflowCard}>
                        <Text style={styles.workflowTitle}>Assignment Workflow</Text>
                        <View style={styles.workflowStats}>
                            <View style={styles.workflowStatItem}>
                                <Text style={styles.workflowStatValue}>
                                    {assignments.filter(a => a.status === 'assigned').length}
                                </Text>
                                <Text style={styles.workflowStatLabel}>Pending</Text>
                            </View>
                            <View style={styles.workflowStatItem}>
                                <Text style={styles.workflowStatValue}>
                                    {assignments.filter(a => a.status === 'submitted').length}
                                </Text>
                                <Text style={styles.workflowStatLabel}>Submitted</Text>
                            </View>
                            <View style={styles.workflowStatItem}>
                                <Text style={styles.workflowStatValue}>
                                    {assignments.filter(a => a.status === 'graded').length}
                                </Text>
                                <Text style={styles.workflowStatLabel}>Graded</Text>
                            </View>
                        </View>

                        {assignments.some(a => a.status === 'assigned') && (
                            <TouchableOpacity style={styles.workflowButton} onPress={continueWorkflow}>
                                <Text style={styles.workflowButtonText}>Continue Workflow</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Progress Timeline */}
                <View style={styles.timelineCard}>
                    <Text style={styles.timelineTitle}>Progress Timeline</Text>
                    <View style={styles.timelineItem}>
                        <Text style={styles.timelineLabel}>Started:</Text>
                        <Text style={styles.timelineValue}>
                            {new Date(progress.started_at).toLocaleDateString()}
                        </Text>
                    </View>
                    <View style={styles.timelineItem}>
                        <Text style={styles.timelineLabel}>Last Activity:</Text>
                        <Text style={styles.timelineValue}>
                            {new Date(progress.last_activity).toLocaleDateString()}
                        </Text>
                    </View>
                    {progress.completed_at && (
                        <View style={styles.timelineItem}>
                            <Text style={styles.timelineLabel}>Completed:</Text>
                            <Text style={styles.timelineValue}>
                                {new Date(progress.completed_at).toLocaleDateString()}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    // Render sessions tab
    const renderSessionsContent = () => {
        if (sessions.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No study sessions yet</Text>
                    <Text style={styles.emptySubtext}>Your study sessions will appear here</Text>
                </View>
            );
        }

        return (
            <View style={styles.contentContainer}>
                {sessions
                    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
                    .map((session) => (
                        <View key={session.id} style={styles.sessionCard}>
                            <View style={styles.sessionHeader}>
                                <Text style={styles.sessionTitle}>Study Session</Text>
                                <View style={styles.sessionStatus}>
                                    <Text style={[styles.statusBadge, {
                                        backgroundColor: session.status === 'completed' ? '#e8f5e8' : '#fff3cd',
                                        color: session.status === 'completed' ? '#28a745' : '#856404'
                                    }]}>
                                        {session.status === 'completed' ? 'Completed' : 'In Progress'}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.sessionDetails}>
                                <View style={styles.sessionDetailItem}>
                                    <Text style={styles.sessionDetailLabel}>Started:</Text>
                                    <Text style={styles.sessionDetailValue}>
                                        {new Date(session.started_at).toLocaleDateString()} at{' '}
                                        {new Date(session.started_at).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </Text>
                                </View>

                                {session.ended_at && (
                                    <View style={styles.sessionDetailItem}>
                                        <Text style={styles.sessionDetailLabel}>Duration:</Text>
                                        <Text style={styles.sessionDetailValue}>
                                            {session.duration_minutes ? formatDuration(session.duration_minutes) : 'N/A'}
                                        </Text>
                                    </View>
                                )}

                                <View style={styles.sessionDetailItem}>
                                    <Text style={styles.sessionDetailLabel}>Completion:</Text>
                                    <Text style={styles.sessionDetailValue}>
                                        {Math.round(session.completion_percentage)}%
                                    </Text>
                                </View>

                                {session.ai_score !== undefined && session.ai_score !== null && (
                                    <View style={styles.sessionDetailItem}>
                                        <Text style={styles.sessionDetailLabel}>AI Score:</Text>
                                        <Text style={styles.sessionDetailValue}>
                                            {Math.round(session.ai_score)}%
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {typeof session.ai_feedback === 'string' && session.ai_feedback.trim().length > 0 && (
                                <View style={styles.feedbackContainer}>
                                    <Text style={styles.feedbackTitle}>AI Feedback:</Text>
                                    <Text style={styles.feedbackText} numberOfLines={3}>
                                        {session.ai_feedback}
                                    </Text>
                                </View>
                            )}
                        </View>
                    ))}
            </View>
        );
    };

    // Render assignments tab
    const renderAssignmentsContent = () => {
        if (assignments.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyTitle}>No Assignments</Text>
                    <Text style={styles.emptySubtitle}>
                        Assignments will appear here when they are available.
                    </Text>
                    <TouchableOpacity style={styles.continueButton} onPress={navigateBackToCourse}>
                        <Text style={styles.continueButtonText}>Browse Course</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.contentContainer}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Course Assignments</Text>
                    <Text style={styles.sectionSubtitle}>Track your assignment progress</Text>
                </View>

                {assignments.map((assignment) => (
                    <TouchableOpacity
                        key={assignment.id}
                        style={styles.assignmentCard}
                        onPress={() => navigateToAssignment(assignment)}
                    >
                        <View style={styles.assignmentHeader}>
                            <Text style={styles.assignmentTitle}>Assignment #{assignment.assignment_id}</Text>
                            <View style={[
                                styles.statusBadge,
                                styles[`status${assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1).replace('_', '')}`]
                            ]}>
                                <Text style={styles.statusText}>
                                    {assignment.status.replace('_', ' ').toUpperCase()}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.assignmentDetails}>
                            <Text style={styles.assignmentMeta}>
                                Due: {new Date(assignment.due_date).toLocaleDateString()}
                            </Text>
                            {assignment.submitted_at && (
                                <Text style={styles.assignmentMeta}>
                                    Submitted: {new Date(assignment.submitted_at).toLocaleDateString()}
                                </Text>
                            )}
                        </View>

                        {assignment.grade !== undefined && (
                            <View style={styles.gradeContainer}>
                                <Text style={styles.gradeLabel}>Grade:</Text>
                                <Text style={styles.gradeValue}>{assignment.grade}%</Text>
                            </View>
                        )}

                        {assignment.feedback && (
                            <View style={styles.feedbackContainer}>
                                <Text style={styles.feedbackTitle}>Feedback:</Text>
                                <Text style={styles.feedbackText} numberOfLines={2}>
                                    {assignment.feedback}
                                </Text>
                            </View>
                        )}

                        <View style={styles.assignmentActions}>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.primaryButton]}
                                onPress={() => navigateToAssignment(assignment)}
                            >
                                <Text style={styles.primaryButtonText}>
                                    {assignment.status === 'assigned' ? 'Start Assignment' : 'View Details'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                ))}

                {assignments.some(a => a.status === 'assigned') && (
                    <TouchableOpacity style={styles.continueButton} onPress={continueWorkflow}>
                        <Text style={styles.continueButtonText}>Continue Workflow</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    // Render analytics tab
    const renderAnalyticsContent = () => {
        if (!progress || sessions.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Not enough data for analytics</Text>
                    <Text style={styles.emptySubtext}>Complete more sessions to see detailed analytics</Text>
                </View>
            );
        }

        const averageSessionDuration = getAverageSessionDuration();
        const studyStreak = getStudyStreak();
        const completedSessions = sessions.filter(s => s.status === 'completed').length;
        const averageCompletion = sessions.length > 0
            ? sessions.reduce((sum, s) => sum + s.completion_percentage, 0) / sessions.length
            : 0;

        return (
            <View style={styles.contentContainer}>
                <View style={styles.analyticsCard}>
                    <Text style={styles.analyticsTitle}>Learning Analytics</Text>

                    <View style={styles.analyticsGrid}>
                        <View style={styles.analyticsItem}>
                            <Text style={styles.analyticsValue}>{formatDuration(averageSessionDuration)}</Text>
                            <Text style={styles.analyticsLabel}>Avg Session</Text>
                        </View>

                        <View style={styles.analyticsItem}>
                            <Text style={styles.analyticsValue}>{studyStreak}</Text>
                            <Text style={styles.analyticsLabel}>Study Streak</Text>
                        </View>

                        <View style={styles.analyticsItem}>
                            <Text style={styles.analyticsValue}>{completedSessions}</Text>
                            <Text style={styles.analyticsLabel}>Completed Sessions</Text>
                        </View>

                        <View style={styles.analyticsItem}>
                            <Text style={styles.analyticsValue}>{Math.round(averageCompletion)}%</Text>
                            <Text style={styles.analyticsLabel}>Avg Completion</Text>
                        </View>
                    </View>

                    <View style={styles.progressBarContainer}>
                        <Text style={styles.progressBarLabel}>Course Progress</Text>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { width: `${getProgressPercentage()}%` }
                                ]}
                            />
                        </View>
                        <Text style={styles.progressBarText}>{getProgressPercentage()}% Complete</Text>
                    </View>
                </View>

                {/* Study Pattern Analysis */}
                <View style={styles.analyticsCard}>
                    <Text style={styles.analyticsTitle}>Study Patterns</Text>
                    <Text style={styles.analyticsDescription}>
                        Based on your {sessions.length} study sessions, you tend to study for an average of{' '}
                        {formatDuration(averageSessionDuration)} per session. Keep up the consistent learning!
                    </Text>
                </View>
            </View>
        );
    };

    // Render tab navigation
    const renderTabNavigation = () => (
        <View style={styles.tabContainer}>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
                onPress={() => setActiveTab('overview')}
            >
                <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
                    Overview
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'assignments' && styles.activeTab]}
                onPress={() => setActiveTab('assignments')}
            >
                <Text style={[styles.tabText, activeTab === 'assignments' && styles.activeTabText]}>
                    Assignments ({assignments.length})
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'sessions' && styles.activeTab]}
                onPress={() => setActiveTab('sessions')}
            >
                <Text style={[styles.tabText, activeTab === 'sessions' && styles.activeTabText]}>
                    Sessions ({sessions.length})
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'analytics' && styles.activeTab]}
                onPress={() => setActiveTab('analytics')}
            >
                <Text style={[styles.tabText, activeTab === 'analytics' && styles.activeTabText]}>
                    Analytics
                </Text>
            </TouchableOpacity>
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
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>Progress</Text>
                    <Text style={styles.headerSubtitle} numberOfLines={1}>{courseTitle}</Text>
                </View>
            </View>

            {renderTabNavigation()}

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {activeTab === 'overview' && renderProgressOverview()}
                {activeTab === 'assignments' && renderAssignmentsContent()}
                {activeTab === 'sessions' && renderSessionsContent()}
                {activeTab === 'analytics' && renderAnalyticsContent()}
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
    headerTitleContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
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
        paddingBottom: 20,
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
    progressCircleContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    progressCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    progressPercentageText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    progressPercentageLabel: {
        fontSize: 12,
        color: '#fff',
        opacity: 0.8,
    },
    achievementText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 24,
        gap: 12,
    },
    statCard: {
        width: (width - 52) / 2, // Account for padding and gap
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    timelineCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    timelineTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 16,
    },
    timelineItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    timelineLabel: {
        fontSize: 14,
        color: '#666',
    },
    timelineValue: {
        fontSize: 14,
        color: '#1a1a1a',
        fontWeight: '600',
    },
    sessionCard: {
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
    sessionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sessionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    sessionStatus: {

    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        fontSize: 12,
        fontWeight: '600',
    },
    sessionDetails: {
        marginBottom: 8,
    },
    sessionDetailItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    sessionDetailLabel: {
        fontSize: 13,
        color: '#666',
    },
    sessionDetailValue: {
        fontSize: 13,
        color: '#1a1a1a',
        fontWeight: '600',
    },
    feedbackContainer: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
        marginTop: 8,
    },
    feedbackTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
        marginBottom: 4,
    },
    feedbackText: {
        fontSize: 13,
        color: '#333',
        lineHeight: 18,
    },
    analyticsCard: {
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
    analyticsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 16,
    },
    analyticsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 20,
    },
    analyticsItem: {
        width: '50%',
        alignItems: 'center',
        paddingVertical: 12,
    },
    analyticsValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#007AFF',
        marginBottom: 4,
    },
    analyticsLabel: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    analyticsDescription: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    progressBarContainer: {
        marginTop: 16,
    },
    progressBarLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    progressBar: {
        height: 8,
        backgroundColor: '#e0e0e0',
        borderRadius: 4,
        marginBottom: 8,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#007AFF',
        borderRadius: 4,
    },
    progressBarText: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    // Assignment-specific styles
    assignmentCard: {
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
        alignItems: 'center',
        marginBottom: 12,
    },
    assignmentTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        flex: 1,
        marginRight: 12,
    },
    assignmentDetails: {
        marginBottom: 12,
    },
    assignmentMeta: {
        fontSize: 13,
        color: '#666',
        marginBottom: 4,
    },
    assignmentActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 12,
    },
    actionButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        marginLeft: 8,
    },
    primaryButton: {
        backgroundColor: '#007AFF',
    },
    primaryButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    gradeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    gradeLabel: {
        fontSize: 13,
        color: '#666',
        marginRight: 8,
    },
    gradeValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    continueButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 16,
    },
    continueButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    // Status badge variations
    statusAssigned: {
        backgroundColor: '#FFF3CD',
        borderColor: '#FFEAA7',
    },
    statusSubmitted: {
        backgroundColor: '#CCE5FF',
        borderColor: '#74B9FF',
    },
    statusGraded: {
        backgroundColor: '#D4EDDA',
        borderColor: '#00B894',
    },
    statusOverdue: {
        backgroundColor: '#F8D7DA',
        borderColor: '#E17055',
    },
    statusText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#333',
    },
    // Workflow-specific styles
    workflowCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    workflowTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 12,
    },
    workflowStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 16,
    },
    workflowStatItem: {
        alignItems: 'center',
    },
    workflowStatValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    workflowStatLabel: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
    },
    workflowButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
    },
    workflowButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    // Section styles
    sectionHeader: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#666',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        textAlign: 'center',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 16,
    },
});