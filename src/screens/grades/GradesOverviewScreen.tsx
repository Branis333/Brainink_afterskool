import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
    Alert,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigatorNew';
import { useAuth } from '../../context/AuthContext';
import { gradesService, LearningAnalytics, StudentProgress, AISubmission, StudentAssignment } from '../../services/gradesService';

const { width } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const GradesOverviewScreen: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const { user, token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [analytics, setAnalytics] = useState<LearningAnalytics | null>(null);
    const [progress, setProgress] = useState<StudentProgress[]>([]);
    const [recentSubmissions, setRecentSubmissions] = useState<AISubmission[]>([]);
    const [overallGrade, setOverallGrade] = useState<number | null>(null);
    const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
    const [workflowStatus, setWorkflowStatus] = useState<{
        hasAvailableAssignments: boolean;
        nextAction: string;
        canContinue: boolean;
    }>({
        hasAvailableAssignments: false,
        nextAction: 'No assignments available',
        canContinue: false
    });

    const loadGradesData = async (isRefresh = false) => {
        if (!token) {
            Alert.alert('Error', 'Please log in to view grades');
            return;
        }

        try {
            if (!isRefresh) setLoading(true);

            // Load analytics data for the last 30 days
            const analyticsData = await gradesService.getLearningAnalytics(token, 30);
            setAnalytics(analyticsData);

            // Load student progress across all courses
            const progressData = await gradesService.getStudentProgress(token);
            setProgress(progressData);

            // Calculate overall grade from progress data
            const averageScore = progressData.reduce((sum, prog) => {
                return sum + (prog.average_score || 0);
            }, 0) / (progressData.length || 1);
            setOverallGrade(averageScore);

            // Get recent sessions to find recent submissions
            const recentSessions = await gradesService.getUserSessions(token, { limit: 10 });

            // Load recent submissions
            // Try to get submissions from both sessions and assignments
            try {
                const allSubmissions: AISubmission[] = [];

                // Get submissions from recent sessions
                if (recentSessions.length > 0) {
                    const submissionsPromises = recentSessions
                        .filter(session => session.id)
                        .slice(0, 10)
                        .map(session =>
                            gradesService.getSessionSubmissions(session.id, token)
                                .catch(() => []) // Handle errors gracefully
                        );

                    const submissionsArrays = await Promise.all(submissionsPromises);
                    const sessionSubmissions = submissionsArrays.flat()
                        .filter(submission => submission.ai_processed && submission.ai_score !== null);

                    allSubmissions.push(...sessionSubmissions);
                }

                // Remove duplicates by ID and sort by date, take top 5
                const uniqueSubmissions = Array.from(
                    new Map(allSubmissions.map(s => [s.id, s])).values()
                ).sort((a, b) =>
                    new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
                ).slice(0, 5);

                setRecentSubmissions(uniqueSubmissions);
            } catch (error) {
                console.warn('Error loading recent submissions:', error);
                setRecentSubmissions([]);
            }

            // Load student assignments for workflow integration
            if (user?.id) {
                try {
                    const assignmentsData = await gradesService.getStudentAssignments(user.id, token, { limit: 10 });
                    setAssignments(assignmentsData);

                    // Determine workflow status
                    const availableAssignments = assignmentsData.filter(a => a.status === 'assigned');
                    const canContinueWorkflow = availableAssignments.length > 0 || assignmentsData.some(a => a.status === 'graded');

                    setWorkflowStatus({
                        hasAvailableAssignments: availableAssignments.length > 0,
                        nextAction: availableAssignments.length > 0
                            ? `${availableAssignments.length} assignments ready`
                            : assignmentsData.some(a => a.status === 'graded')
                                ? 'View recent results'
                                : 'Complete course content to unlock assignments',
                        canContinue: canContinueWorkflow
                    });
                } catch (error) {
                    console.warn('Error loading assignments:', error);
                    setAssignments([]);
                }
            }

        } catch (error) {
            console.error('Error loading grades data:', error);
            Alert.alert('Error', 'Failed to load grades data. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadGradesData();
        }, [token])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadGradesData(true);
    };

    const getGradeColor = (score: number): string => {
        return gradesService.getScoreColor(score);
    };

    const getGradeLetter = (score: number): string => {
        if (score >= 90) return 'A';
        if (score >= 80) return 'B';
        if (score >= 70) return 'C';
        if (score >= 60) return 'D';
        return 'F';
    };

    // Workflow Navigation Functions
    const navigateToNextAssignment = () => {
        const nextAssignment = assignments.find(a => a.status === 'assigned');
        if (nextAssignment) {
            navigation.navigate('CourseAssignments', {
                courseId: nextAssignment.course_id,
                courseTitle: `Course ${nextAssignment.course_id}`
            });
        }
    };

    const continueWorkflowCycle = () => {
        // Navigate back to course homepage to continue the learning cycle
        navigation.navigate('CourseHomepage');
    };

    const navigateToRecentResults = () => {
        const recentGradedAssignment = assignments.find(a => a.status === 'graded');
        if (recentGradedAssignment) {
            navigation.navigate('GradeDetails', {
                submissionId: recentGradedAssignment.id,
                submissionType: 'homework' as const
            });
        }
    };

    const renderWorkflowStatusCard = () => (
        <View style={styles.workflowCard}>
            <View style={styles.workflowHeader}>
                <Ionicons
                    name={workflowStatus.hasAvailableAssignments ? "checkmark-circle" : "time"}
                    size={24}
                    color={workflowStatus.hasAvailableAssignments ? "#28a745" : "#FFC107"}
                />
                <Text style={styles.workflowTitle}>Learning Workflow</Text>
            </View>
            <Text style={styles.workflowStatus}>{workflowStatus.nextAction}</Text>

            {workflowStatus.canContinue && (
                <View style={styles.workflowActions}>
                    {workflowStatus.hasAvailableAssignments ? (
                        <TouchableOpacity
                            style={styles.workflowButton}
                            onPress={navigateToNextAssignment}
                        >
                            <Text style={styles.workflowButtonText}>Start Assignment</Text>
                            <Ionicons name="arrow-forward" size={16} color="#fff" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.workflowButton, styles.workflowButtonSecondary]}
                            onPress={navigateToRecentResults}
                        >
                            <Text style={[styles.workflowButtonText, styles.workflowButtonTextSecondary]}>
                                View Results
                            </Text>
                            <Ionicons name="eye" size={16} color="#007AFF" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={styles.continueButton}
                        onPress={continueWorkflowCycle}
                    >
                        <Text style={styles.continueButtonText}>Continue Learning</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    const renderGradeSummaryCard = () => (
        <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
                <Ionicons name="trophy" size={24} color="#FFD700" />
                <Text style={styles.summaryTitle}>Overall Performance</Text>
            </View>
            <View style={styles.summaryContent}>
                <View style={styles.gradeDisplay}>
                    <Text style={[styles.gradeNumber, { color: getGradeColor(overallGrade || 0) }]}>
                        {overallGrade ? Math.round(overallGrade) : '--'}%
                    </Text>
                    <Text style={[styles.gradeLetter, { color: getGradeColor(overallGrade || 0) }]}>
                        {overallGrade ? getGradeLetter(overallGrade) : '--'}
                    </Text>
                </View>
                <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{progress.length}</Text>
                        <Text style={styles.statLabel}>Courses</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                            {analytics ? analytics.completed_sessions : 0}
                        </Text>
                        <Text style={styles.statLabel}>Sessions</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                            {analytics ? `${analytics.study_streak_days}d` : '0d'}
                        </Text>
                        <Text style={styles.statLabel}>Streak</Text>
                    </View>
                </View>
            </View>
        </View>
    );

    const renderQuickActionsCard = () => (
        <View style={styles.actionsCard}>
            <Text style={styles.cardTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('GradesAnalytics')}
                >
                    <Ionicons name="analytics" size={20} color="#3B82F6" />
                    <Text style={styles.actionText}>Analytics</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('SubmissionsManagement')}
                >
                    <Ionicons name="document-text" size={20} color="#10B981" />
                    <Text style={styles.actionText}>Submissions</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('GradeHistory')}
                >
                    <Ionicons name="time" size={20} color="#8B5CF6" />
                    <Text style={styles.actionText}>History</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('AIGradingStatus')}
                >
                    <Ionicons name="hardware-chip" size={20} color="#F59E0B" />
                    <Text style={styles.actionText}>AI Status</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderRecentGradesCard = () => (
        <View style={styles.recentCard}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Recent Grades</Text>
                <TouchableOpacity onPress={() => navigation.navigate('GradeHistory')}>
                    <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
            </View>
            {recentSubmissions.length > 0 ? (
                recentSubmissions.map((submission, index) => (
                    <TouchableOpacity
                        key={submission.id}
                        style={styles.gradeItem}
                        onPress={() => navigation.navigate('GradeDetails', {
                            submissionId: submission.id,
                            submissionType: submission.submission_type
                        })}
                    >
                        <View style={styles.gradeItemLeft}>
                            <Ionicons
                                name={
                                    submission.submission_type === 'homework' ? 'book' :
                                        submission.submission_type === 'quiz' ? 'help-circle' :
                                            submission.submission_type === 'practice' ? 'fitness' :
                                                'school'
                                }
                                size={16}
                                color="#6B7280"
                            />
                            <View style={styles.gradeItemInfo}>
                                <Text style={styles.gradeItemTitle}>
                                    {submission.submission_type.charAt(0).toUpperCase() +
                                        submission.submission_type.slice(1)}
                                </Text>
                                <Text style={styles.gradeItemDate}>
                                    {gradesService.formatRelativeTime(submission.submitted_at)}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.gradeItemRight}>
                            {submission.ai_score ? (
                                <View style={[styles.scoreContainer, {
                                    backgroundColor: getGradeColor(submission.ai_score) + '20'
                                }]}>
                                    <Text style={[styles.scoreText, {
                                        color: getGradeColor(submission.ai_score)
                                    }]}>
                                        {Math.round(submission.ai_score)}%
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.pendingContainer}>
                                    <Text style={styles.pendingText}>Pending</Text>
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>
                ))
            ) : (
                <View style={styles.emptyState}>
                    <Ionicons name="document-outline" size={32} color="#D1D5DB" />
                    <Text style={styles.emptyStateText}>No recent grades yet</Text>
                    <Text style={styles.emptyStateSubtext}>
                        Complete assignments to see your grades here
                    </Text>
                </View>
            )}
        </View>
    );

    const renderProgressCard = () => (
        <View style={styles.progressCard}>
            <Text style={styles.cardTitle}>Course Progress</Text>
            {progress.length > 0 ? (
                progress.slice(0, 3).map((courseProgress, index) => (
                    <View key={courseProgress.id} style={styles.progressItem}>
                        <View style={styles.progressHeader}>
                            <Text style={styles.progressTitle}>Course {courseProgress.course_id}</Text>
                            <Text style={[styles.progressScore, {
                                color: getGradeColor(courseProgress.average_score || 0)
                            }]}>
                                {courseProgress.average_score ?
                                    `${Math.round(courseProgress.average_score)}%` :
                                    'No grades'
                                }
                            </Text>
                        </View>
                        <View style={styles.progressBarContainer}>
                            <View
                                style={[
                                    styles.progressBar,
                                    { width: `${courseProgress.completion_percentage}%` }
                                ]}
                            />
                        </View>
                        <Text style={styles.progressDetail}>
                            {courseProgress.lessons_completed}/{courseProgress.total_lessons} lessons completed
                        </Text>
                    </View>
                ))
            ) : (
                <View style={styles.emptyState}>
                    <Ionicons name="book-outline" size={32} color="#D1D5DB" />
                    <Text style={styles.emptyStateText}>No courses in progress</Text>
                </View>
            )}
            {progress.length > 3 && (
                <TouchableOpacity
                    style={styles.seeMoreButton}
                    onPress={() => navigation.navigate('CourseHomepage')}
                >
                    <Text style={styles.seeMoreText}>See All Courses</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>Loading your grades...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color="#1F2937" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Grades</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('GradesAnalytics')}>
                        <Ionicons name="analytics" size={24} color="#3B82F6" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                showsVerticalScrollIndicator={false}
            >
                {renderWorkflowStatusCard()}
                {renderGradeSummaryCard()}
                {renderQuickActionsCard()}
                {renderRecentGradesCard()}
                {renderProgressCard()}

                <View style={styles.bottomSpace} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    loadingText: {
        fontSize: 16,
        color: '#6B7280',
        marginTop: 12,
        textAlign: 'center',
    },
    header: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    summaryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginTop: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        marginLeft: 8,
    },
    summaryContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    gradeDisplay: {
        flex: 1,
        alignItems: 'center',
    },
    gradeNumber: {
        fontSize: 32,
        fontWeight: 'bold',
    },
    gradeLetter: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 4,
    },
    statsGrid: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    statLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    actionsCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginTop: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 16,
    },
    actionsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    actionButton: {
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        minWidth: (width - 80) / 4,
    },
    actionText: {
        fontSize: 12,
        color: '#374151',
        marginTop: 4,
        textAlign: 'center',
    },
    recentCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginTop: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    seeAllText: {
        fontSize: 14,
        color: '#3B82F6',
        fontWeight: '500',
    },
    gradeItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    gradeItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    gradeItemInfo: {
        marginLeft: 12,
    },
    gradeItemTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1F2937',
    },
    gradeItemDate: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    gradeItemRight: {
        alignItems: 'flex-end',
    },
    scoreContainer: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    scoreText: {
        fontSize: 14,
        fontWeight: '600',
    },
    pendingContainer: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#FEF3C7',
    },
    pendingText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#D97706',
    },
    progressCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginTop: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    progressItem: {
        marginBottom: 16,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    progressTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1F2937',
    },
    progressScore: {
        fontSize: 14,
        fontWeight: '600',
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: '#E5E7EB',
        borderRadius: 3,
        marginBottom: 4,
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#3B82F6',
        borderRadius: 3,
    },
    progressDetail: {
        fontSize: 12,
        color: '#6B7280',
    },
    seeMoreButton: {
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    seeMoreText: {
        fontSize: 14,
        color: '#3B82F6',
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    emptyStateText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#9CA3AF',
        marginTop: 8,
    },
    emptyStateSubtext: {
        fontSize: 14,
        color: '#D1D5DB',
        marginTop: 4,
        textAlign: 'center',
    },
    // Workflow Status Card Styles
    workflowCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderLeftWidth: 4,
        borderLeftColor: '#007AFF',
    },
    workflowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    workflowTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1a1a1a',
        marginLeft: 8,
    },
    workflowStatus: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
    },
    workflowActions: {
        flexDirection: 'row',
        gap: 12,
    },
    workflowButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    workflowButtonSecondary: {
        backgroundColor: '#F0F8FF',
        borderWidth: 1,
        borderColor: '#007AFF',
    },
    workflowButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    workflowButtonTextSecondary: {
        color: '#007AFF',
    },
    continueButton: {
        backgroundColor: '#F8F9FA',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#DEE2E6',
        flex: 1,
    },
    continueButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#495057',
        textAlign: 'center',
    },
    bottomSpace: {
        height: 20,
    },
});