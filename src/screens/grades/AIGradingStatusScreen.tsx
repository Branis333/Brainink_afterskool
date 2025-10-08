import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    Alert,
    ActivityIndicator,
    Modal,
    Animated,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigatorNew';
import { useAuth } from '../../context/AuthContext';
import {
    gradesService,
    PendingSubmissionsResponse,
    PendingSubmissionsByCourse,
    BulkGradingResponse,
    KANAGradingRequest,
    StudentAssignment
} from '../../services/gradesService';

const { width } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface GradingProgress {
    isGrading: boolean;
    coursesBeingGraded: Set<number>;
    progressData: { [courseId: number]: { current: number; total: number } };
}

const summarizeBulkGrading = (result: BulkGradingResponse) => {
    const gradingResults = Array.isArray(result.grading_results) ? result.grading_results : [];
    const total = result.total_submissions ?? result.batch_summary?.total_submissions ?? gradingResults.length;
    const graded = result.submissions_graded ?? result.batch_summary?.successfully_graded ?? gradingResults.filter(r => r.success).length;
    const failed = result.submissions_failed ?? result.batch_summary?.failed_grades ?? Math.max(total - graded, 0);
    const averageScore = result.batch_summary?.average_score ?? null;
    const successRate = result.batch_summary?.success_rate ?? (total > 0 ? (graded / total) * 100 : null);

    return {
        total,
        graded,
        failed,
        averageScore,
        successRate
    };
};

export const AIGradingStatusScreen: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pendingData, setPendingData] = useState<PendingSubmissionsResponse | null>(null);
    const [gradingProgress, setGradingProgress] = useState<GradingProgress>({
        isGrading: false,
        coursesBeingGraded: new Set(),
        progressData: {}
    });
    const [showGradingModal, setShowGradingModal] = useState(false);
    const [recentAssignments, setRecentAssignments] = useState<StudentAssignment[]>([]);
    const [autoGradingQueue, setAutoGradingQueue] = useState<{
        processing: boolean;
        completedCount: number;
        totalCount: number;
        currentAssignment?: string;
    }>({
        processing: false,
        completedCount: 0,
        totalCount: 0
    });
    const [workflowEnabled, setWorkflowEnabled] = useState(true);
    const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
    const [lastGradingResults, setLastGradingResults] = useState<BulkGradingResponse | null>(null);
    const progressAnimation = useState(new Animated.Value(0))[0];

    const loadPendingSubmissions = async (isRefresh = false) => {
        if (!token) {
            Alert.alert('Error', 'Please log in to view grading status');
            return;
        }

        try {
            if (!isRefresh) setLoading(true);

            const pendingSubmissions = await gradesService.getPendingSubmissionsForGrading(token);
            setPendingData(pendingSubmissions);

            // Load recent assignments for workflow tracking
            try {
                const assignments = await gradesService.getStudentAssignments(1, token, { limit: 10 });
                setRecentAssignments(assignments);

                // Check for automatic grading in progress
                const submittedAssignments = assignments.filter(a => a.status === 'submitted');
                if (submittedAssignments.length > 0 && workflowEnabled) {
                    // Simulate checking for automatic grading status
                    setAutoGradingQueue({
                        processing: submittedAssignments.length > 0,
                        completedCount: assignments.filter(a => a.status === 'graded').length,
                        totalCount: assignments.length,
                        currentAssignment: submittedAssignments[0]?.id ? `Assignment ${submittedAssignments[0].assignment_id}` : undefined
                    });
                }
            } catch (assignmentError) {
                console.warn('Error loading assignments:', assignmentError);
            }

        } catch (error) {
            console.error('Error loading pending submissions:', error);
            Alert.alert('Error', 'Failed to load pending submissions. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadPendingSubmissions();
        }, [token])
    );

    useEffect(() => {
        if (gradingProgress.isGrading) {
            // Animate progress indicator
            Animated.loop(
                Animated.sequence([
                    Animated.timing(progressAnimation, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(progressAnimation, {
                        toValue: 0,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            progressAnimation.stopAnimation();
        }
    }, [gradingProgress.isGrading]);

    const onRefresh = () => {
        setRefreshing(true);
        loadPendingSubmissions(true);
    };

    // Workflow Navigation Functions
    const navigateToRecentResults = () => {
        const gradedAssignment = recentAssignments.find(a => a.status === 'graded');
        if (gradedAssignment) {
            navigation.navigate('GradeDetails', {
                submissionId: gradedAssignment.id,
                submissionType: 'homework' as const
            });
        }
    };

    const continueWorkflowCycle = () => {
        navigation.navigate('CourseHomepage');
    };

    const navigateToAssignments = () => {
        const nextAssignment = recentAssignments.find(a => a.status === 'assigned');
        if (nextAssignment) {
            navigation.navigate('CourseAssignments', {
                courseId: nextAssignment.course_id,
                courseTitle: `Course ${nextAssignment.course_id}`
            });
        }
    };

    const startBulkGrading = async (courseId: number, gradeAllStudents: boolean = true) => {
        if (!token) {
            Alert.alert('Error', 'Please log in to start grading');
            return;
        }

        try {
            const courseName = `Course ${courseId}`;
            const pendingCount = pendingData?.grouped_submissions[courseId.toString()]?.lessons
                ? Object.values(pendingData.grouped_submissions[courseId.toString()].lessons)
                    .reduce((total, lesson) => total + lesson.submissions.length, 0)
                : 0;

            if (pendingCount === 0) {
                Alert.alert('No Submissions', 'There are no pending submissions for this course.');
                return;
            }

            Alert.alert(
                'Start AI Grading',
                `Start K.A.N.A. AI grading for ${courseName}?\n\nThis will grade ${pendingCount} pending submission${pendingCount > 1 ? 's' : ''}.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Start Grading',
                        style: 'default',
                        onPress: () => performBulkGrading(courseId, gradeAllStudents)
                    }
                ]
            );
        } catch (error) {
            console.error('Error preparing bulk grading:', error);
            Alert.alert('Error', 'Failed to prepare grading. Please try again.');
        }
    };

    const performBulkGrading = async (courseId: number, gradeAllStudents: boolean) => {
        if (!token) return;

        try {
            // Update grading progress state
            setGradingProgress(prev => ({
                ...prev,
                isGrading: true,
                coursesBeingGraded: new Set([...prev.coursesBeingGraded, courseId])
            }));

            setShowGradingModal(true);
            setSelectedCourse(courseId);

            const gradingRequest: KANAGradingRequest = {
                course_id: courseId,
                grade_all_students: gradeAllStudents
            };

            const result = await gradesService.gradeCourseSubmissions(gradingRequest, token);
            setLastGradingResults(result);

            const summary = summarizeBulkGrading(result);
            const averageLine = summary.averageScore !== null
                ? `\n🎯 Average score: ${Math.round(summary.averageScore)}%`
                : '';
            const successRateLine = summary.successRate !== null
                ? `\n📈 Success rate: ${Math.round(summary.successRate)}%`
                : '';

            Alert.alert(
                'Grading Complete',
                `K.A.N.A. AI has finished grading!\n\n✅ Successfully graded: ${summary.graded}\n❌ Failed: ${summary.failed}\n📊 Total processed: ${summary.total}${averageLine}${successRateLine}`,
                [{ text: 'OK', onPress: () => setShowGradingModal(false) }]
            );

            // Refresh the pending submissions data
            await loadPendingSubmissions(true);

        } catch (error) {
            console.error('Error during bulk grading:', error);
            Alert.alert(
                'Grading Error',
                'An error occurred during grading. Some submissions may have been processed successfully.'
            );
        } finally {
            // Update grading progress state
            setGradingProgress(prev => {
                const newSet = new Set(prev.coursesBeingGraded);
                newSet.delete(courseId);
                return {
                    ...prev,
                    isGrading: newSet.size > 0,
                    coursesBeingGraded: newSet
                };
            });
        }
    };

    const renderAutomaticGradingCard = () => (
        <View style={styles.automaticGradingCard}>
            <View style={styles.automaticGradingHeader}>
                <Ionicons
                    name={autoGradingQueue.processing ? "sync" : "checkmark-circle"}
                    size={24}
                    color={autoGradingQueue.processing ? "#FFC107" : "#28a745"}
                />
                <Text style={styles.automaticGradingTitle}>
                    {autoGradingQueue.processing ? "Auto-Grading in Progress" : "Automatic Grading"}
                </Text>
            </View>

            {autoGradingQueue.processing ? (
                <View style={styles.gradingProgress}>
                    <Text style={styles.gradingProgressText}>
                        Processing: {autoGradingQueue.currentAssignment}
                    </Text>
                    <Text style={styles.gradingProgressCount}>
                        {autoGradingQueue.completedCount}/{autoGradingQueue.totalCount} assignments processed
                    </Text>
                    <View style={styles.progressBarContainer}>
                        <View
                            style={[
                                styles.progressBar,
                                { width: `${(autoGradingQueue.completedCount / autoGradingQueue.totalCount) * 100}%` }
                            ]}
                        />
                    </View>
                </View>
            ) : (
                <Text style={styles.automaticGradingDescription}>
                    Assignments are automatically graded when submitted. No manual intervention required.
                </Text>
            )}

            <View style={styles.workflowActions}>
                {recentAssignments.some(a => a.status === 'graded') && (
                    <TouchableOpacity
                        style={styles.workflowActionButton}
                        onPress={navigateToRecentResults}
                    >
                        <Text style={styles.workflowActionText}>View Results</Text>
                        <Ionicons name="eye" size={16} color="#fff" />
                    </TouchableOpacity>
                )}

                {recentAssignments.some(a => a.status === 'assigned') && (
                    <TouchableOpacity
                        style={[styles.workflowActionButton, styles.workflowActionButtonSecondary]}
                        onPress={navigateToAssignments}
                    >
                        <Text style={[styles.workflowActionText, styles.workflowActionTextSecondary]}>
                            Next Assignment
                        </Text>
                        <Ionicons name="arrow-forward" size={16} color="#007AFF" />
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={styles.continueWorkflowButton}
                    onPress={continueWorkflowCycle}
                >
                    <Text style={styles.continueWorkflowText}>Continue Learning</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderStatusCard = () => (
        <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
                <Ionicons name="hardware-chip" size={24} color="#3B82F6" />
                <Text style={styles.statusTitle}>K.A.N.A. AI Status</Text>
            </View>
            <View style={styles.statusContent}>
                <View style={styles.statusItem}>
                    <View style={[
                        styles.statusIndicator,
                        { backgroundColor: gradingProgress.isGrading ? '#10B981' : '#6B7280' }
                    ]} />
                    <Text style={styles.statusText}>
                        {gradingProgress.isGrading ? 'Processing Submissions' : 'Ready to Grade'}
                    </Text>
                </View>
                {pendingData && (
                    <Text style={styles.pendingCount}>
                        {pendingData.total_pending} submission{pendingData.total_pending !== 1 ? 's' : ''} pending
                    </Text>
                )}
            </View>
        </View>
    );

    const renderCourseCard = (courseId: string, courseData: PendingSubmissionsByCourse) => {
        const isBeingGraded = gradingProgress.coursesBeingGraded.has(parseInt(courseId));
        const totalSubmissions = Object.values(courseData.lessons)
            .reduce((total, lesson) => total + lesson.submissions.length, 0);

        if (totalSubmissions === 0) return null;

        return (
            <View key={courseId} style={styles.courseCard}>
                <View style={styles.courseHeader}>
                    <View style={styles.courseInfo}>
                        <Text style={styles.courseTitle}>{courseData.course_title}</Text>
                        <Text style={styles.submissionCount}>
                            {totalSubmissions} submission{totalSubmissions !== 1 ? 's' : ''} pending
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[
                            styles.gradeButton,
                            isBeingGraded && styles.gradingButton
                        ]}
                        onPress={() => startBulkGrading(parseInt(courseId))}
                        disabled={isBeingGraded}
                    >
                        {isBeingGraded ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Ionicons name="play" size={16} color="#FFFFFF" />
                        )}
                        <Text style={styles.gradeButtonText}>
                            {isBeingGraded ? 'Grading...' : 'Grade All'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Lessons breakdown */}
                <View style={styles.lessonsContainer}>
                    {Object.values(courseData.lessons).map(lesson => (
                        <View key={lesson.lesson_id} style={styles.lessonItem}>
                            <View style={styles.lessonInfo}>
                                <Ionicons name="book-outline" size={14} color="#6B7280" />
                                <Text style={styles.lessonTitle}>{lesson.lesson_title}</Text>
                            </View>
                            <Text style={styles.lessonCount}>
                                {lesson.submissions.length}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Recent submissions preview */}
                <View style={styles.submissionsPreview}>
                    <Text style={styles.previewTitle}>Recent Submissions</Text>
                    {Object.values(courseData.lessons)
                        .flatMap(lesson => lesson.submissions)
                        .slice(0, 3)
                        .map(submission => (
                            <View key={submission.id} style={styles.submissionPreviewItem}>
                                <View style={styles.submissionPreviewInfo}>
                                    <Text style={styles.studentName}>{submission.student_name}</Text>
                                    <Text style={styles.submissionType}>
                                        {submission.submission_type.charAt(0).toUpperCase() +
                                            submission.submission_type.slice(1)}
                                    </Text>
                                </View>
                                {submission.submitted_at && (
                                    <Text style={styles.submissionTime}>
                                        {new Date(submission.submitted_at).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </Text>
                                )}
                            </View>
                        ))}
                </View>
            </View>
        );
    };

    const renderGradingModal = () => (
        <Modal
            visible={showGradingModal}
            transparent
            animationType="fade"
            onRequestClose={() => { }}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.gradingModalContent}>
                    <View style={styles.gradingModalHeader}>
                        <Ionicons name="hardware-chip" size={32} color="#3B82F6" />
                        <Text style={styles.gradingModalTitle}>K.A.N.A. AI is Working</Text>
                        <Text style={styles.gradingModalSubtitle}>
                            Processing submissions for Course {selectedCourse}
                        </Text>
                    </View>

                    <View style={styles.progressContainer}>
                        <Animated.View
                            style={[
                                styles.progressIndicator,
                                {
                                    transform: [
                                        {
                                            rotate: progressAnimation.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: ['0deg', '360deg'],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        >
                            <Ionicons name="sync" size={40} color="#3B82F6" />
                        </Animated.View>
                    </View>

                    <View style={styles.gradingSteps}>
                        <View style={styles.stepItem}>
                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                            <Text style={styles.stepText}>Analyzing submissions</Text>
                        </View>
                        <View style={styles.stepItem}>
                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                            <Text style={styles.stepText}>Applying AI models</Text>
                        </View>
                        <View style={styles.stepItem}>
                            <ActivityIndicator size="small" color="#3B82F6" />
                            <Text style={[styles.stepText, styles.activeStep]}>Generating feedback</Text>
                        </View>
                        <View style={styles.stepItem}>
                            <View style={styles.pendingDot} />
                            <Text style={[styles.stepText, styles.pendingStep]}>Finalizing results</Text>
                        </View>
                    </View>

                    <Text style={styles.gradingNote}>
                        This process may take a few moments. Please don't close the app.
                    </Text>
                </View>
            </View>
        </Modal>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#10B981" />
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptySubtitle}>
                No submissions are pending for AI grading at the moment.
            </Text>
            <TouchableOpacity
                style={styles.refreshButton}
                onPress={() => loadPendingSubmissions(true)}
            >
                <Ionicons name="refresh" size={16} color="#FFFFFF" />
                <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
        </View>
    );

    const renderResultsCard = () => {
        if (!lastGradingResults) return null;

        const summary = summarizeBulkGrading(lastGradingResults);

        return (
            <View style={styles.resultsCard}>
                <Text style={styles.cardTitle}>Last Grading Results</Text>
                <View style={styles.resultsGrid}>
                    <View style={styles.resultItem}>
                        <Text style={styles.resultValue}>{summary.total}</Text>
                        <Text style={styles.resultLabel}>Total</Text>
                    </View>
                    <View style={styles.resultItem}>
                        <Text style={[styles.resultValue, { color: '#10B981' }]}>
                            {summary.graded}
                        </Text>
                        <Text style={styles.resultLabel}>Graded</Text>
                    </View>
                    <View style={styles.resultItem}>
                        <Text style={[styles.resultValue, { color: '#EF4444' }]}>
                            {summary.failed}
                        </Text>
                        <Text style={styles.resultLabel}>Failed</Text>
                    </View>
                </View>
                {(summary.averageScore !== null || summary.successRate !== null) && (
                    <View style={styles.summaryMetrics}>
                        {summary.averageScore !== null && (
                            <View style={styles.summaryMetricRow}>
                                <Text style={styles.summaryMetricLabel}>Average Score</Text>
                                <Text style={styles.summaryMetricValue}>
                                    {Math.round(summary.averageScore)}%
                                </Text>
                            </View>
                        )}
                        {summary.successRate !== null && (
                            <View style={styles.summaryMetricRow}>
                                <Text style={styles.summaryMetricLabel}>Success Rate</Text>
                                <Text style={styles.summaryMetricValue}>
                                    {Math.round(summary.successRate)}%
                                </Text>
                            </View>
                        )}
                    </View>
                )}
                <TouchableOpacity
                    style={styles.viewResultsButton}
                    onPress={() => {
                        setLastGradingResults(null);
                        navigation.navigate('SubmissionsManagement');
                    }}
                >
                    <Text style={styles.viewResultsText}>View Updated Submissions</Text>
                </TouchableOpacity>
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>Loading grading status...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#1F2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>AI Grading Status</Text>
                <TouchableOpacity onPress={() => loadPendingSubmissions(true)}>
                    <Ionicons name="refresh" size={24} color="#3B82F6" />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                showsVerticalScrollIndicator={false}
            >
                {renderAutomaticGradingCard()}
                {renderStatusCard()}
                {renderResultsCard()}

                {pendingData && pendingData.total_pending > 0 ? (
                    Object.entries(pendingData.grouped_submissions).map(([courseId, courseData]) =>
                        renderCourseCard(courseId, courseData)
                    )
                ) : (
                    renderEmptyState()
                )}

                <View style={styles.bottomSpace} />
            </ScrollView>

            {renderGradingModal()}
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
    },
    loadingText: {
        fontSize: 16,
        color: '#6B7280',
        marginTop: 12,
    },
    header: {
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
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
    statusCard: {
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
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    statusTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        marginLeft: 8,
    },
    statusContent: {
        gap: 8,
    },
    statusItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    statusText: {
        fontSize: 16,
        color: '#374151',
        fontWeight: '500',
    },
    pendingCount: {
        fontSize: 14,
        color: '#6B7280',
        marginLeft: 16,
    },
    courseCard: {
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
    courseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    courseInfo: {
        flex: 1,
    },
    courseTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 4,
    },
    submissionCount: {
        fontSize: 14,
        color: '#6B7280',
    },
    gradeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3B82F6',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 4,
    },
    gradingButton: {
        backgroundColor: '#6B7280',
    },
    gradeButtonText: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    lessonsContainer: {
        marginBottom: 16,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    lessonItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    lessonInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    lessonTitle: {
        fontSize: 14,
        color: '#374151',
        marginLeft: 8,
    },
    lessonCount: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    submissionsPreview: {
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    previewTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
        marginBottom: 8,
    },
    submissionPreviewItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    submissionPreviewInfo: {
        flex: 1,
    },
    studentName: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    submissionType: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    submissionTime: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#374151',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 16,
        color: '#9CA3AF',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3B82F6',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
    },
    refreshButtonText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    resultsCard: {
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
    resultsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 16,
    },
    resultItem: {
        alignItems: 'center',
    },
    resultValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    resultLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    summaryMetrics: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        gap: 8,
    },
    summaryMetricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryMetricLabel: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
    },
    summaryMetricValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    viewResultsButton: {
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    viewResultsText: {
        fontSize: 14,
        color: '#3B82F6',
        fontWeight: '500',
    },
    bottomSpace: {
        height: 20,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    gradingModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        width: '100%',
        maxWidth: 320,
    },
    gradingModalHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    gradingModalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1F2937',
        marginTop: 12,
        marginBottom: 4,
    },
    gradingModalSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    progressContainer: {
        marginBottom: 24,
    },
    progressIndicator: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    gradingSteps: {
        alignSelf: 'stretch',
        gap: 12,
        marginBottom: 20,
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    stepText: {
        fontSize: 14,
        color: '#6B7280',
    },
    activeStep: {
        color: '#3B82F6',
        fontWeight: '500',
    },
    pendingStep: {
        color: '#D1D5DB',
    },
    pendingDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#E5E7EB',
    },
    gradingNote: {
        fontSize: 12,
        color: '#9CA3AF',
        textAlign: 'center',
        lineHeight: 16,
    },
    // Automatic Grading Card Styles
    automaticGradingCard: {
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
        borderLeftColor: '#28a745',
    },
    automaticGradingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    automaticGradingTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1a1a1a',
        marginLeft: 8,
    },
    automaticGradingDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
        lineHeight: 20,
    },
    gradingProgress: {
        marginBottom: 16,
    },
    gradingProgressText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    gradingProgressCount: {
        fontSize: 12,
        color: '#666',
        marginBottom: 8,
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: '#E5E7EB',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#3B82F6',
        borderRadius: 3,
    },
    workflowActions: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    workflowActionButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
        minWidth: 120,
    },
    workflowActionButtonSecondary: {
        backgroundColor: '#F0F8FF',
        borderWidth: 1,
        borderColor: '#007AFF',
    },
    workflowActionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    workflowActionTextSecondary: {
        color: '#007AFF',
    },
    continueWorkflowButton: {
        backgroundColor: '#F8F9FA',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#DEE2E6',
        flex: 1,
        minWidth: 140,
    },
    continueWorkflowText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#495057',
        textAlign: 'center',
    },
});