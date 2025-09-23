/**
 * Course Assignment Screen
 * View and submit assignments, homework, and quizzes with AI grading integration
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
    TextInput,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import {
    afterSchoolService,
    AISubmission,
    AISubmissionCreate,
    CourseWithLessons
} from '../../services/afterSchoolService';
import { uploadsService } from '../../services/uploadsService';

type NavigationProp = NativeStackNavigationProp<any>;
type RouteProp_ = RouteProp<{ params: { courseId: number; courseTitle: string } }>;

interface Props {
    navigation: NavigationProp;
    route: RouteProp_;
}

interface Assignment {
    id: string;
    title: string;
    description: string;
    type: 'homework' | 'quiz' | 'practice' | 'assessment';
    dueDate?: string;
    maxScore: number;
    instructions: string;
    isSubmitted: boolean;
    submission?: AISubmission;
}

export const CourseAssignmentScreen: React.FC<Props> = ({ navigation, route }) => {
    const { courseId, courseTitle } = route.params;
    const { token } = useAuth();

    const [course, setCourse] = useState<CourseWithLessons | null>(null);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [submissions, setSubmissions] = useState<AISubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'submitted'>('all');
    const [showSubmissionModal, setShowSubmissionModal] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
    const [submissionText, setSubmissionText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Mock assignments data (in real app, this would come from API)
    const mockAssignments: Assignment[] = [
        {
            id: '1',
            title: 'Reading Comprehension Exercise',
            description: 'Complete the reading passage and answer the questions',
            type: 'homework',
            dueDate: '2025-09-25',
            maxScore: 100,
            instructions: 'Read the provided text carefully and answer all questions. Show your work for full credit.',
            isSubmitted: false
        },
        {
            id: '2',
            title: 'Math Problem Set 1',
            description: 'Solve the arithmetic problems',
            type: 'practice',
            maxScore: 50,
            instructions: 'Complete all 10 problems. Use proper mathematical notation.',
            isSubmitted: false
        },
        {
            id: '3',
            title: 'Science Quiz',
            description: 'Multiple choice quiz on basic science concepts',
            type: 'quiz',
            dueDate: '2025-09-28',
            maxScore: 80,
            instructions: 'Choose the best answer for each question. You have 30 minutes to complete.',
            isSubmitted: false
        },
        {
            id: '4',
            title: 'Creative Writing Assignment',
            description: 'Write a short story',
            type: 'assessment',
            dueDate: '2025-09-30',
            maxScore: 100,
            instructions: 'Write a creative story of at least 200 words. Focus on character development and plot.',
            isSubmitted: false
        }
    ];

    // Load assignment data
    const loadAssignmentData = async (isRefresh: boolean = false) => {
        try {
            if (!isRefresh) setLoading(true);

            if (!token) {
                throw new Error('No authentication token available');
            }

            // Load course data (submissions would be loaded from API in real app)
            const courseData = await afterSchoolService.getCourseDetails(courseId, token);
            setCourse(courseData);

            // For demo purposes, using mock data
            // In real app, you would fetch actual assignments from API
            setAssignments(mockAssignments);
            setSubmissions([]); // Would fetch real submissions

        } catch (error) {
            console.error('Error loading assignment data:', error);
            Alert.alert(
                'Error',
                'Failed to load assignments. Please try again.',
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
            loadAssignmentData();
        }, [courseId, token])
    );

    // Pull to refresh
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadAssignmentData(true);
    }, []);

    // Filter assignments based on active tab
    const getFilteredAssignments = () => {
        switch (activeTab) {
            case 'pending':
                return assignments.filter(a => !a.isSubmitted);
            case 'submitted':
                return assignments.filter(a => a.isSubmitted);
            default:
                return assignments;
        }
    };

    // Open submission modal
    const openSubmissionModal = (assignment: Assignment) => {
        setSelectedAssignment(assignment);
        setSubmissionText('');
        setShowSubmissionModal(true);
    };

    // Submit assignment
    const submitAssignment = async () => {
        if (!selectedAssignment || !token || !submissionText.trim()) {
            Alert.alert('Error', 'Please provide your submission text.');
            return;
        }

        try {
            setSubmitting(true);

            // Create AI submission
            const submissionData: AISubmissionCreate = {
                course_id: courseId,
                lesson_id: 1, // Would be dynamic based on assignment
                session_id: 1, // Would be from current session
                submission_type: selectedAssignment.type
            };

            const submission = await afterSchoolService.createAISubmission(submissionData, token);

            // In real app, you would upload the text as a file or send it directly
            console.log('Submission created:', submission);

            // Update local state
            setAssignments(prev => prev.map(a =>
                a.id === selectedAssignment.id
                    ? { ...a, isSubmitted: true, submission }
                    : a
            ));

            setShowSubmissionModal(false);
            Alert.alert(
                'Success',
                'Your assignment has been submitted successfully!',
                [{ text: 'OK' }]
            );

        } catch (error) {
            console.error('Error submitting assignment:', error);
            Alert.alert(
                'Error',
                'Failed to submit assignment. Please try again.',
                [{ text: 'OK' }]
            );
        } finally {
            setSubmitting(false);
        }
    };

    // Get assignment type color
    const getAssignmentTypeColor = (type: string) => {
        switch (type) {
            case 'homework': return '#007AFF';
            case 'quiz': return '#FF9500';
            case 'practice': return '#28a745';
            case 'assessment': return '#dc3545';
            default: return '#666';
        }
    };

    // Format due date
    const formatDueDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffTime = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return 'Overdue';
        } else if (diffDays === 0) {
            return 'Due today';
        } else if (diffDays === 1) {
            return 'Due tomorrow';
        } else {
            return `Due in ${diffDays} days`;
        }
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
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>Assignments</Text>
                    </View>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading assignments...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Render tab navigation
    const renderTabNavigation = () => (
        <View style={styles.tabContainer}>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'all' && styles.activeTab]}
                onPress={() => setActiveTab('all')}
            >
                <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
                    All ({assignments.length})
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
                onPress={() => setActiveTab('pending')}
            >
                <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
                    Pending ({assignments.filter(a => !a.isSubmitted).length})
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'submitted' && styles.activeTab]}
                onPress={() => setActiveTab('submitted')}
            >
                <Text style={[styles.tabText, activeTab === 'submitted' && styles.activeTabText]}>
                    Submitted ({assignments.filter(a => a.isSubmitted).length})
                </Text>
            </TouchableOpacity>
        </View>
    );

    // Render assignment card
    const renderAssignmentCard = (assignment: Assignment) => (
        <View key={assignment.id} style={styles.assignmentCard}>
            <View style={styles.assignmentHeader}>
                <View style={styles.assignmentInfo}>
                    <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                    <Text style={styles.assignmentDescription}>{assignment.description}</Text>
                </View>
                <View style={styles.assignmentMeta}>
                    <View style={[styles.typeBadge, { backgroundColor: getAssignmentTypeColor(assignment.type) }]}>
                        <Text style={styles.typeBadgeText}>{assignment.type.toUpperCase()}</Text>
                    </View>
                    {assignment.isSubmitted && (
                        <View style={styles.submittedBadge}>
                            <Text style={styles.submittedBadgeText}>✓ Submitted</Text>
                        </View>
                    )}
                </View>
            </View>

            <View style={styles.assignmentDetails}>
                <View style={styles.assignmentDetailItem}>
                    <Text style={styles.assignmentDetailLabel}>Max Score:</Text>
                    <Text style={styles.assignmentDetailValue}>{assignment.maxScore} points</Text>
                </View>

                {Boolean(assignment.dueDate) && (
                    <View style={styles.assignmentDetailItem}>
                        <Text style={styles.assignmentDetailLabel}>Due Date:</Text>
                        <Text style={[
                            styles.assignmentDetailValue,
                            assignment.dueDate && new Date(assignment.dueDate) < new Date() && !assignment.isSubmitted
                                ? styles.overdueText : {}
                        ]}>
                            {formatDueDate(assignment.dueDate)}
                        </Text>
                    </View>
                )}

                {assignment.submission?.ai_score !== undefined && assignment.submission?.ai_score !== null && (
                    <View style={styles.assignmentDetailItem}>
                        <Text style={styles.assignmentDetailLabel}>Score:</Text>
                        <Text style={styles.scoreText}>
                            {Math.round(assignment.submission.ai_score)}%
                        </Text>
                    </View>
                )}
            </View>

            <View style={styles.instructionsContainer}>
                <Text style={styles.instructionsTitle}>Instructions:</Text>
                <Text style={styles.instructionsText} numberOfLines={3}>
                    {assignment.instructions}
                </Text>
            </View>

            {typeof assignment.submission?.ai_feedback === 'string' && assignment.submission?.ai_feedback.trim().length > 0 && (
                <View style={styles.feedbackContainer}>
                    <Text style={styles.feedbackTitle}>AI Feedback:</Text>
                    <Text style={styles.feedbackText} numberOfLines={3}>
                        {assignment.submission.ai_feedback}
                    </Text>
                </View>
            )}

            <View style={styles.assignmentActions}>
                {!assignment.isSubmitted ? (
                    <TouchableOpacity
                        style={styles.submitButton}
                        onPress={() => openSubmissionModal(assignment)}
                    >
                        <Text style={styles.submitButtonText}>Submit Assignment</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() => {/* Navigate to submission details */ }}
                    >
                        <Text style={styles.viewButtonText}>View Submission</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    // Render submission modal
    const renderSubmissionModal = () => (
        <Modal
            visible={showSubmissionModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowSubmissionModal(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Submit Assignment</Text>
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setShowSubmissionModal(false)}
                        >
                            <Text style={styles.modalCloseButtonText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    {selectedAssignment && (
                        <View style={styles.modalContent}>
                            <Text style={styles.modalAssignmentTitle}>
                                {selectedAssignment.title}
                            </Text>

                            <Text style={styles.modalInstructions}>
                                {selectedAssignment.instructions}
                            </Text>

                            <Text style={styles.submissionLabel}>Your Submission:</Text>
                            <TextInput
                                style={styles.submissionInput}
                                multiline
                                numberOfLines={8}
                                value={submissionText}
                                onChangeText={setSubmissionText}
                                placeholder="Type your answer here..."
                                placeholderTextColor="#999"
                            />

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => setShowSubmissionModal(false)}
                                    disabled={submitting}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.submitModalButton}
                                    onPress={submitAssignment}
                                    disabled={submitting || !submissionText.trim()}
                                >
                                    <Text style={styles.submitModalButtonText}>
                                        {submitting ? 'Submitting...' : 'Submit'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );

    const filteredAssignments = getFilteredAssignments();

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
                    <Text style={styles.headerTitle}>Assignments</Text>
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
                <View style={styles.contentContainer}>
                    {filteredAssignments.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No assignments found</Text>
                            <Text style={styles.emptySubtext}>
                                {activeTab === 'pending'
                                    ? 'All assignments have been submitted'
                                    : activeTab === 'submitted'
                                        ? 'No assignments submitted yet'
                                        : 'Assignments will appear here when available'
                                }
                            </Text>
                        </View>
                    ) : (
                        filteredAssignments.map(renderAssignmentCard)
                    )}
                </View>
            </ScrollView>

            {renderSubmissionModal()}
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
    assignmentCard: {
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
    assignmentTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    assignmentDescription: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    assignmentMeta: {
        alignItems: 'flex-end',
        gap: 8,
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    typeBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    submittedBadge: {
        backgroundColor: '#e8f5e8',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    submittedBadgeText: {
        color: '#28a745',
        fontSize: 10,
        fontWeight: '600',
    },
    assignmentDetails: {
        marginBottom: 12,
        gap: 8,
    },
    assignmentDetailItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    assignmentDetailLabel: {
        fontSize: 13,
        color: '#666',
    },
    assignmentDetailValue: {
        fontSize: 13,
        color: '#1a1a1a',
        fontWeight: '600',
    },
    overdueText: {
        color: '#dc3545',
    },
    scoreText: {
        color: '#007AFF',
        fontWeight: 'bold',
    },
    instructionsContainer: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    instructionsTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
        marginBottom: 4,
    },
    instructionsText: {
        fontSize: 13,
        color: '#333',
        lineHeight: 18,
    },
    feedbackContainer: {
        backgroundColor: '#e3f2fd',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    feedbackTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1976d2',
        marginBottom: 4,
    },
    feedbackText: {
        fontSize: 13,
        color: '#1565c0',
        lineHeight: 18,
    },
    assignmentActions: {
        alignItems: 'stretch',
    },
    submitButton: {
        backgroundColor: '#007AFF',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    viewButton: {
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#dee2e6',
    },
    viewButtonText: {
        color: '#495057',
        fontSize: 14,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    modalCloseButton: {
        padding: 4,
    },
    modalCloseButtonText: {
        fontSize: 24,
        color: '#666',
    },
    modalContent: {
        padding: 20,
    },
    modalAssignmentTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 12,
    },
    modalInstructions: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
        marginBottom: 20,
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 8,
    },
    submissionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    submissionInput: {
        borderWidth: 1,
        borderColor: '#dee2e6',
        borderRadius: 8,
        padding: 12,
        minHeight: 120,
        textAlignVertical: 'top',
        fontSize: 14,
        color: '#333',
        marginBottom: 20,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#dee2e6',
    },
    cancelButtonText: {
        color: '#495057',
        fontSize: 14,
        fontWeight: '600',
    },
    submitModalButton: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        alignItems: 'center',
    },
    submitModalButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});