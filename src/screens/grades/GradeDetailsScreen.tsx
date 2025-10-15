import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Dimensions,
    Modal,
    Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigatorNew';
import { useAuth } from '../../context/AuthContext';
import { gradesService, AISubmission, StudentAssignment as GradesStudentAssignment } from '../../services/gradesService';
import { afterSchoolService } from '../../services/afterSchoolService';

const { width } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type GradeDetailsRouteProp = RouteProp<RootStackParamList, 'GradeDetails'>;

export const GradeDetailsScreen: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<GradeDetailsRouteProp>();
    const { submissionId, submissionType } = route.params;
    const { token } = useAuth();

    const [loading, setLoading] = useState(true);
    const [submission, setSubmission] = useState<AISubmission | null>(null);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'feedback' | 'improvements'>('overview');
    const [nextAssignment, setNextAssignment] = useState<GradesStudentAssignment | null>(null);
    const [workflowContext, setWorkflowContext] = useState<{
        canContinue: boolean;
        nextAction: string;
        courseId?: number;
    }>({
        canContinue: false,
        nextAction: 'No next steps available'
    });

    // Sanitize raw AI feedback to avoid leaking provider/system errors to users
    const cleanAIText = useCallback((text?: string | null): string | null => {
        if (!text || typeof text !== 'string') return text ?? null;
        let t = text.trim();
        // Remove known provider artifacts and overly-technical messages
        const patterns: Array<RegExp | string> = [
            /(?<=^|\n).*finish_reason\s*=\s*\d+.*$/gim,
            /(?<=^|\n).*response\.text.*quick accessor.*$/gim,
            /(?<=^|\n).*(safety system|content filter).*blocked.*$/gim,
            /(?<=^|\n).*policy.*violation.*$/gim,
            /(?<=^|\n).*model.*overloaded.*try again.*$/gim
        ];
        patterns.forEach(p => {
            t = t.replace(p as any, '').trim();
        });
        // Collapse excessive whitespace
        t = t.replace(/\n{3,}/g, '\n\n').trim();
        // Provide a friendly fallback when text becomes empty
        if (t.length === 0) {
            return 'Feedback is not available yet. Please try again shortly.';
        }
        return t;
    }, []);

    useEffect(() => {
        loadSubmissionDetails();
    }, [submissionId]);

    const loadSubmissionDetails = async () => {
        if (!token) {
            Alert.alert('Error', 'Please log in to view submission details');
            return;
        }

        try {
            setLoading(true);
            const submissionData = await gradesService.getAISubmission(submissionId, token);
            setSubmission(submissionData);

            // Load workflow context - find next available assignment
            try {
                const assignments = await afterSchoolService.getMyAssignments(
                    token,
                    { limit: 20 }
                );
                const availableAssignments = assignments.filter(a => a.status === 'assigned');

                if (availableAssignments.length > 0) {
                    // Cast structurally to the grades service type (fields used in UI overlap)
                    const a = availableAssignments[0] as unknown as GradesStudentAssignment;
                    setNextAssignment(a);
                    setWorkflowContext({
                        canContinue: true,
                        nextAction: 'Start next assignment',
                        courseId: a.course_id
                    });
                } else {
                    const canContinueLearning = assignments.some(a => a.status === 'graded');
                    setWorkflowContext({
                        canContinue: canContinueLearning,
                        nextAction: canContinueLearning ? 'Continue learning' : 'Complete more course content'
                    });
                }
            } catch (workflowError) {
                console.warn('Error loading workflow context:', workflowError);
                setWorkflowContext({
                    canContinue: true,
                    nextAction: 'Continue learning'
                });
            }

        } catch (error) {
            console.error('Error loading submission details:', error);
            Alert.alert('Error', 'Failed to load submission details. Please try again.');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const getSubmissionIcon = (type: string) => {
        switch (type) {
            case 'homework': return 'book';
            case 'quiz': return 'help-circle';
            case 'practice': return 'fitness';
            case 'assessment': return 'school';
            default: return 'document-text';
        }
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

    const getPerformanceLevel = (score: number): { level: string; color: string; message: string } => {
        if (score >= 90) {
            return {
                level: 'Excellent',
                color: '#10B981',
                message: 'Outstanding work! Keep it up!'
            };
        } else if (score >= 80) {
            return {
                level: 'Good',
                color: '#84CC16',
                message: 'Great job! You\'re doing well.'
            };
        } else if (score >= 70) {
            return {
                level: 'Average',
                color: '#F59E0B',
                message: 'Good effort. There\'s room for improvement.'
            };
        } else if (score >= 60) {
            return {
                level: 'Below Average',
                color: '#F97316',
                message: 'Consider reviewing the material and trying again.'
            };
        } else {
            return {
                level: 'Needs Improvement',
                color: '#EF4444',
                message: 'Don\'t give up! Review the material and ask for help if needed.'
            };
        }
    };

    // Workflow Navigation Functions
    const navigateToNextAssignment = () => {
        if (nextAssignment) {
            navigation.navigate('CourseAssignments', {
                courseId: nextAssignment.course_id,
                courseTitle: `Course ${nextAssignment.course_id}`
            });
        }
    };

    const continueWorkflowCycle = () => {
        navigation.navigate('CourseHomepage');
    };

    const navigateToCourseContent = () => {
        if (workflowContext.courseId) {
            navigation.navigate('CourseDetails', {
                courseId: workflowContext.courseId,
                courseTitle: `Course ${workflowContext.courseId}`
            });
        } else {
            continueWorkflowCycle();
        }
    };

    const renderOverviewTab = () => {
        if (!submission) return null;

        const performance = submission.ai_score ? getPerformanceLevel(submission.ai_score) : null;
        const previewFeedback = cleanAIText(submission.ai_feedback);

        return (
            <View style={styles.tabContent}>
                {/* Score Section */}
                <View style={styles.scoreSection}>
                    <View style={styles.scoreContainer}>
                        <View style={[styles.scoreCircle, {
                            borderColor: getGradeColor(submission.ai_score || 0)
                        }]}>
                            <Text style={[styles.scoreNumber, {
                                color: getGradeColor(submission.ai_score || 0)
                            }]}>
                                {submission.ai_score ? Math.round(submission.ai_score) : '--'}
                            </Text>
                            <Text style={[styles.scoreLetter, {
                                color: getGradeColor(submission.ai_score || 0)
                            }]}>
                                {submission.ai_score ? getGradeLetter(submission.ai_score) : '--'}
                            </Text>
                        </View>
                    </View>
                    {performance && (
                        <View style={styles.performanceSection}>
                            <Text style={[styles.performanceLevel, { color: performance.color }]}>
                                {performance.level}
                            </Text>
                            <Text style={styles.performanceMessage}>
                                {performance.message}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Submission Info */}
                <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>Submission Details</Text>
                    <View style={styles.infoGrid}>
                        <View style={styles.infoItem}>
                            <Ionicons name="calendar" size={16} color="#6B7280" />
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Submitted</Text>
                                <Text style={styles.infoValue}>
                                    {gradesService.formatRelativeTime(submission.submitted_at)}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.infoItem}>
                            <Ionicons name={getSubmissionIcon(submission.submission_type)} size={16} color="#6B7280" />
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Type</Text>
                                <Text style={styles.infoValue}>
                                    {submission.submission_type.charAt(0).toUpperCase() +
                                        submission.submission_type.slice(1)}
                                </Text>
                            </View>
                        </View>

                        {submission.original_filename && (
                            <View style={styles.infoItem}>
                                <Ionicons name="document" size={16} color="#6B7280" />
                                <View style={styles.infoContent}>
                                    <Text style={styles.infoLabel}>File</Text>
                                    <Text style={styles.infoValue} numberOfLines={1}>
                                        {submission.original_filename}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {submission.processed_at && (
                            <View style={styles.infoItem}>
                                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                <View style={styles.infoContent}>
                                    <Text style={styles.infoLabel}>Processed</Text>
                                    <Text style={styles.infoValue}>
                                        {gradesService.formatRelativeTime(submission.processed_at)}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>

                {/* Quick Feedback Preview */}
                {typeof previewFeedback === 'string' && previewFeedback.trim().length > 0 && (
                    <View style={styles.previewSection}>
                        <Text style={styles.sectionTitle}>AI Feedback Preview</Text>
                        <Text style={styles.previewText} numberOfLines={3}>
                            {previewFeedback}
                        </Text>
                        <TouchableOpacity
                            style={styles.readMoreButton}
                            onPress={() => setActiveTab('feedback')}
                        >
                            <Text style={styles.readMoreText}>Read Full Feedback</Text>
                            <Ionicons name="arrow-forward" size={14} color="#3B82F6" />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    const renderFeedbackTab = () => {
        if (!submission) return null;

        return (
            <View style={styles.tabContent}>
                {submission.ai_feedback ? (
                    <View style={styles.feedbackSection}>
                        <Text style={styles.sectionTitle}>AI Feedback</Text>
                        <View style={styles.feedbackContent}>
                            <Text style={styles.feedbackText}>
                                {cleanAIText(submission.ai_feedback)}
                            </Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="chatbox-outline" size={48} color="#D1D5DB" />
                        <Text style={styles.emptyStateText}>No feedback available</Text>
                        <Text style={styles.emptyStateSubtext}>
                            This submission hasn't been processed yet
                        </Text>
                    </View>
                )}

                {submission.ai_strengths && (
                    <View style={styles.strengthsSection}>
                        <Text style={styles.sectionTitle}>Strengths</Text>
                        <View style={styles.strengthsContent}>
                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                            <Text style={styles.strengthsText}>
                                {(() => {
                                    try {
                                        // Parse JSON array from database
                                        const strengths = JSON.parse(submission.ai_strengths);
                                        if (Array.isArray(strengths)) {
                                            return strengths.map((s, i) => `${i + 1}. ${s}`).join('\n');
                                        }
                                    } catch {
                                        // Fallback to displaying as-is if not valid JSON
                                    }
                                    return submission.ai_strengths;
                                })()}
                            </Text>
                        </View>
                    </View>
                )}

                {submission.ai_corrections && (
                    <View style={styles.correctionsSection}>
                        <Text style={styles.sectionTitle}>Corrections</Text>
                        <View style={styles.correctionsContent}>
                            <Ionicons name="alert-circle" size={20} color="#F59E0B" />
                            <Text style={styles.correctionsText}>
                                {(() => {
                                    try {
                                        // Parse JSON array from database
                                        const corrections = JSON.parse(submission.ai_corrections);
                                        if (Array.isArray(corrections)) {
                                            return corrections.map((c, i) => `${i + 1}. ${c}`).join('\n');
                                        }
                                    } catch {
                                        // Fallback to displaying as-is if not valid JSON
                                    }
                                    return submission.ai_corrections;
                                })()}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    const renderImprovementsTab = () => {
        if (!submission) return null;

        return (
            <View style={styles.tabContent}>
                {submission.ai_improvements ? (
                    <View style={styles.improvementsSection}>
                        <Text style={styles.sectionTitle}>Suggestions for Improvement</Text>
                        <View style={styles.improvementsContent}>
                            <Ionicons name="bulb" size={20} color="#8B5CF6" />
                            <Text style={styles.improvementsText}>
                                {(() => {
                                    try {
                                        // Parse JSON array from database
                                        const improvements = JSON.parse(submission.ai_improvements);
                                        if (Array.isArray(improvements)) {
                                            return improvements.map((imp, i) => `${i + 1}. ${imp}`).join('\n');
                                        }
                                    } catch {
                                        // Fallback to displaying as-is if not valid JSON
                                    }
                                    return submission.ai_improvements;
                                })()}
                            </Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="bulb-outline" size={48} color="#D1D5DB" />
                        <Text style={styles.emptyStateText}>No improvements suggested</Text>
                        <Text style={styles.emptyStateSubtext}>
                            Great work! No specific improvements needed.
                        </Text>
                    </View>
                )}

                {/* Study Tips */}
                <View style={styles.studyTipsSection}>
                    <Text style={styles.sectionTitle}>Study Tips</Text>
                    <View style={styles.tipItem}>
                        <Ionicons name="book" size={16} color="#3B82F6" />
                        <Text style={styles.tipText}>Review the lesson material before retaking</Text>
                    </View>
                    <View style={styles.tipItem}>
                        <Ionicons name="people" size={16} color="#3B82F6" />
                        <Text style={styles.tipText}>Ask questions if you need clarification</Text>
                    </View>
                    <View style={styles.tipItem}>
                        <Ionicons name="repeat" size={16} color="#3B82F6" />
                        <Text style={styles.tipText}>Practice similar problems to strengthen understanding</Text>
                    </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionsSection}>
                    {/* Only show Review Lesson if we have a valid lesson_id */}
                    {submission.lesson_id && (
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => {
                                // Navigate back to lesson
                                navigation.navigate('LessonView', {
                                    courseId: submission.course_id,
                                    lessonId: submission.lesson_id,
                                    lessonTitle: 'Lesson',
                                    courseTitle: 'Course'
                                });
                            }}
                        >
                            <Ionicons name="book-outline" size={20} color="#FFFFFF" />
                            <Text style={styles.actionButtonText}>Review Lesson</Text>
                        </TouchableOpacity>
                    )}

                    {/* Show Review Course button if no lesson_id but has course_id */}
                    {!submission.lesson_id && submission.course_id && (
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => {
                                // Navigate to course details
                                navigation.navigate('CourseDetails', {
                                    courseId: submission.course_id,
                                    courseTitle: 'Course'
                                });
                            }}
                        >
                            <Ionicons name="book-outline" size={20} color="#FFFFFF" />
                            <Text style={styles.actionButtonText}>Review Course</Text>
                        </TouchableOpacity>
                    )}

                    {/* Retry Assignment Button - only show for assignments */}
                    {submission.assignment_id && (
                        <TouchableOpacity
                            style={[styles.actionButton, styles.retryButton]}
                            onPress={() => {
                                // Navigate to CourseAssignment screen to retry
                                navigation.navigate('CourseAssignment', {
                                    courseId: submission.course_id,
                                    courseTitle: 'Course',
                                    assignmentId: submission.assignment_id,
                                    startWorkflow: true
                                });
                            }}
                        >
                            <Ionicons name="refresh" size={20} color="#FFFFFF" />
                            <Text style={styles.actionButtonText}>Retry Assignment</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.actionButton, styles.actionButtonSecondary]}
                        onPress={() => {
                            // Navigate to practice using course/lesson/block context (no server session needed)
                            const fakeSessionId = Math.floor(Math.random() * 1_000_000);
                            navigation.navigate('StudySession', {
                                sessionId: fakeSessionId,
                                courseId: submission.course_id,
                                lessonId: submission.lesson_id || undefined,
                                blockId: submission.block_id || undefined,
                                lessonTitle: 'Practice Session',
                                courseTitle: 'Course'
                            });
                        }}
                    >
                        <Ionicons name="refresh-outline" size={20} color="#3B82F6" />
                        <Text style={[styles.actionButtonText, { color: '#3B82F6' }]}>
                            Practice More
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>Loading submission details...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!submission) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={48} color="#EF4444" />
                    <Text style={styles.errorText}>Submission not found</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.retryButtonText}>Go Back</Text>
                    </TouchableOpacity>
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
                <Text style={styles.headerTitle}>Grade Details</Text>
                <TouchableOpacity onPress={() => setShowFeedbackModal(true)}>
                    <Ionicons name="information-circle" size={24} color="#3B82F6" />
                </TouchableOpacity>
            </View>

            {/* Tab Navigation */}
            <View style={styles.tabNavigation}>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'overview' && styles.activeTab]}
                    onPress={() => setActiveTab('overview')}
                >
                    <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
                        Overview
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'feedback' && styles.activeTab]}
                    onPress={() => setActiveTab('feedback')}
                >
                    <Text style={[styles.tabText, activeTab === 'feedback' && styles.activeTabText]}>
                        Feedback
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'improvements' && styles.activeTab]}
                    onPress={() => setActiveTab('improvements')}
                >
                    <Text style={[styles.tabText, activeTab === 'improvements' && styles.activeTabText]}>
                        Improvements
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {activeTab === 'overview' && renderOverviewTab()}
                {activeTab === 'feedback' && renderFeedbackTab()}
                {activeTab === 'improvements' && renderImprovementsTab()}

                {/* Workflow Navigation Section */}
                <View style={styles.workflowSection}>
                    <View style={styles.workflowHeader}>
                        <Ionicons name="arrow-forward-circle" size={24} color="#007AFF" />
                        <Text style={styles.workflowTitle}>Continue Your Learning Journey</Text>
                    </View>
                    <Text style={styles.workflowDescription}>
                        {workflowContext.nextAction}
                    </Text>

                    {workflowContext.canContinue && (
                        <View style={styles.workflowActions}>
                            {nextAssignment && (
                                <TouchableOpacity
                                    style={styles.workflowButton}
                                    onPress={navigateToNextAssignment}
                                >
                                    <Text style={styles.workflowButtonText}>Next Assignment</Text>
                                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={[styles.workflowButton, styles.workflowButtonSecondary]}
                                onPress={navigateToCourseContent}
                            >
                                <Text style={[styles.workflowButtonText, styles.workflowButtonTextSecondary]}>
                                    Course Content
                                </Text>
                                <Ionicons name="book" size={16} color="#007AFF" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.continueButton}
                                onPress={continueWorkflowCycle}
                            >
                                <Text style={styles.continueButtonText}>Home</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
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
    },
    loadingText: {
        fontSize: 16,
        color: '#6B7280',
        marginTop: 12,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    errorText: {
        fontSize: 18,
        color: '#EF4444',
        marginTop: 12,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 20,
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: '#3B82F6',
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
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
    tabNavigation: {
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tabButton: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#3B82F6',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
    },
    activeTabText: {
        color: '#3B82F6',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    tabContent: {
        paddingVertical: 20,
    },
    scoreSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    scoreContainer: {
        marginBottom: 16,
    },
    scoreCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
    },
    scoreNumber: {
        fontSize: 32,
        fontWeight: 'bold',
    },
    scoreLetter: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 4,
    },
    performanceSection: {
        alignItems: 'center',
    },
    performanceLevel: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
    },
    performanceMessage: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    infoSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 16,
    },
    infoGrid: {
        gap: 12,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    infoContent: {
        marginLeft: 12,
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 14,
        color: '#1F2937',
        fontWeight: '500',
    },
    previewSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    previewText: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
        marginBottom: 12,
    },
    readMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
    },
    readMoreText: {
        fontSize: 14,
        color: '#3B82F6',
        fontWeight: '500',
        marginRight: 4,
    },
    feedbackSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    feedbackContent: {
        padding: 16,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
    },
    feedbackText: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
    },
    strengthsSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    strengthsContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        backgroundColor: '#ECFDF5',
        borderRadius: 12,
    },
    strengthsText: {
        flex: 1,
        fontSize: 14,
        color: '#065F46',
        lineHeight: 20,
        marginLeft: 12,
    },
    correctionsSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    correctionsContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        backgroundColor: '#FFFBEB',
        borderRadius: 12,
    },
    correctionsText: {
        flex: 1,
        fontSize: 14,
        color: '#92400E',
        lineHeight: 20,
        marginLeft: 12,
    },
    improvementsSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    improvementsContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        backgroundColor: '#F5F3FF',
        borderRadius: 12,
    },
    improvementsText: {
        flex: 1,
        fontSize: 14,
        color: '#5B21B6',
        lineHeight: 20,
        marginLeft: 12,
    },
    studyTipsSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    tipItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    tipText: {
        fontSize: 14,
        color: '#374151',
        marginLeft: 12,
        flex: 1,
    },
    actionsSection: {
        gap: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3B82F6',
        paddingVertical: 16,
        borderRadius: 12,
        gap: 8,
    },
    actionButtonSecondary: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#3B82F6',
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyStateText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#9CA3AF',
        marginTop: 12,
    },
    emptyStateSubtext: {
        fontSize: 14,
        color: '#D1D5DB',
        marginTop: 4,
        textAlign: 'center',
    },
    // Workflow Navigation Styles
    workflowSection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        margin: 16,
        marginTop: 24,
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
    workflowDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
        lineHeight: 20,
    },
    workflowActions: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    workflowButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
        minWidth: 120,
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
        minWidth: 80,
    },
    continueButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#495057',
        textAlign: 'center',
    },
});