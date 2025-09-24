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
    CourseWithLessons,
    StudentAssignment,
    CourseAssignment
} from '../../services/afterSchoolService';
import { uploadsService } from '../../services/uploadsService';

type NavigationProp = NativeStackNavigationProp<any>;
type RouteProp_ = RouteProp<{
    params: {
        courseId: number;
        courseTitle: string;
        assignmentId?: number;
        assignmentTitle?: string;
        startWorkflow?: boolean;
    }
}>;

interface Props {
    navigation: NavigationProp;
    route: RouteProp_;
}

export const CourseAssignmentScreen: React.FC<Props> = ({ navigation, route }) => {
    const { courseId, courseTitle, assignmentId, assignmentTitle, startWorkflow } = route.params;
    const { token } = useAuth();

    const [course, setCourse] = useState<CourseWithLessons | null>(null);
    const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
    const [currentAssignment, setCurrentAssignment] = useState<StudentAssignment | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'submitted'>('all');

    // Workflow states
    const [workflowActive, setWorkflowActive] = useState(false);
    const [workflowStep, setWorkflowStep] = useState<'instructions' | 'upload' | 'processing' | 'results'>('instructions');
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [grading, setGrading] = useState(false);
    const [results, setResults] = useState<AISubmission | null>(null);

    // Initialize workflow if requested
    useEffect(() => {
        if (startWorkflow && assignmentId) {
            setWorkflowActive(true);
            setWorkflowStep('instructions');
        }
    }, [startWorkflow, assignmentId]);

    // Load assignment data
    const loadAssignmentData = async (isRefresh: boolean = false) => {
        try {
            if (!isRefresh) setLoading(true);

            if (!token) {
                throw new Error('No authentication token available');
            }

            // Load course assignments
            const [courseData, assignmentsData] = await Promise.all([
                afterSchoolService.getCourseDetails(courseId, token),
                afterSchoolService.getCourseAssignments(courseId, token)
            ]);

            setCourse(courseData);
            setAssignments(assignmentsData);

            // If a specific assignment is requested, only proceed if the student actually has it
            if (assignmentId) {
                const assignment = assignmentsData.find(a => a.assignment_id === assignmentId);
                if (assignment) {
                    setCurrentAssignment(assignment);
                } // else: silently ignore; user will see list without disruptive alert
            }

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
                return assignments.filter(a => a.status === 'assigned');
            case 'submitted':
                return assignments.filter(a => a.status === 'submitted' || a.status === 'graded');
            default:
                return assignments;
        }
    };

    // Start assignment workflow
    const startAssignmentWorkflow = (assignment?: StudentAssignment) => {
        const targetAssignment = assignment || currentAssignment;
        if (!targetAssignment) return;

        setCurrentAssignment(targetAssignment);
        setWorkflowActive(true);
        setWorkflowStep('instructions');
        setSelectedImages([]);
        setResults(null);
    };

    // Navigate to next workflow step
    const nextWorkflowStep = () => {
        switch (workflowStep) {
            case 'instructions':
                setWorkflowStep('upload');
                break;
            case 'upload':
                if (selectedImages.length > 0) {
                    startImageUpload();
                }
                break;
        }
    };

    // Handle image selection (placeholder - would integrate with image picker)
    const selectImages = async () => {
        // This would use react-native-image-picker or similar
        // For now, simulating image selection
        Alert.alert(
            'Image Upload',
            'In a real app, this would open the camera or photo library',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Simulate Upload', onPress: () => simulateImageUpload() }
            ]
        );
    };

    // Simulate image upload for demo
    const simulateImageUpload = () => {
        setSelectedImages(['image1.jpg', 'image2.jpg']);
    };

    // Start image upload and processing workflow
    const startImageUpload = async () => {
        if (!currentAssignment || !token || selectedImages.length === 0) return;

        try {
            setWorkflowStep('processing');
            setUploadProgress(0);

            // Simulate upload progress
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(progressInterval);
                        processSubmission();
                        return 100;
                    }
                    return prev + 10;
                });
            }, 200);

        } catch (error) {
            console.error('Error uploading images:', error);
            Alert.alert('Error', 'Failed to upload images. Please try again.');
            setWorkflowStep('upload');
        }
    };

    // Process submission and get AI grading
    const processSubmission = async () => {
        if (!currentAssignment || !token) return;

        try {
            setGrading(true);

            // Map assignment type for API compatibility
            const assignmentType = currentAssignment.assignment?.assignment_type === 'project'
                ? 'assessment'
                : currentAssignment.assignment?.assignment_type || 'homework';

            // In real implementation, would call the workflow service
            const submissionResult = await afterSchoolService.submitAssignmentWithImages(
                courseId,
                currentAssignment.assignment_id,
                1, // sessionId - would be from current session
                selectedImages, // Would be actual files
                token,
                assignmentType as 'homework' | 'quiz' | 'assessment' | 'practice'
            );

            // Extract results from the grading response
            const gradingResults = submissionResult.grading_results;
            setResults({
                id: 0,
                user_id: 0,
                course_id: courseId,
                lesson_id: 0,
                session_id: 1,
                submission_type: assignmentType,
                ai_processed: true,
                ai_score: gradingResults.ai_score || 0,
                ai_feedback: gradingResults.ai_feedback || '',
                requires_review: false,
                submitted_at: new Date().toISOString(),
                processed_at: new Date().toISOString()
            });

            setWorkflowStep('results');

            // Update assignment status
            setCurrentAssignment(prev => prev ? {
                ...prev,
                status: 'graded',
                grade: gradingResults.ai_score || 0,
                feedback: gradingResults.ai_feedback || ''
            } : null);

        } catch (error) {
            console.error('Error processing submission:', error);
            Alert.alert('Error', 'Failed to process submission. Please try again.');
            setWorkflowStep('upload');
        } finally {
            setGrading(false);
        }
    };

    // Exit workflow
    const exitWorkflow = () => {
        setWorkflowActive(false);
        setWorkflowStep('instructions');
        setSelectedImages([]);
        setUploadProgress(0);
        setResults(null);

        // Refresh assignments to show updated status
        loadAssignmentData(true);
    };

    // Get assignment type color
    const getAssignmentTypeColor = (type: string) => {
        switch (type) {
            case 'homework': return '#007AFF';
            case 'quiz': return '#FF9500';
            case 'project': return '#28a745';
            case 'assessment': return '#dc3545';
            default: return '#666';
        }
    };

    // Get assignment status display
    const getAssignmentStatusDisplay = (assignment: StudentAssignment) => {
        switch (assignment.status) {
            case 'assigned':
                return { text: 'Ready to Start', color: '#007AFF', bgColor: '#E3F2FD' };
            case 'submitted':
                return { text: 'Processing', color: '#FF9500', bgColor: '#FFF3E0' };
            case 'graded':
                return { text: 'Completed', color: '#28A745', bgColor: '#E8F5E8' };
            case 'overdue':
                return { text: 'Overdue', color: '#dc3545', bgColor: '#FFEBEE' };
            default:
                return { text: 'Unknown', color: '#666', bgColor: '#F5F5F5' };
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
                    Pending ({assignments.filter(a => a.status === 'assigned').length})
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'submitted' && styles.activeTab]}
                onPress={() => setActiveTab('submitted')}
            >
                <Text style={[styles.tabText, activeTab === 'submitted' && styles.activeTabText]}>
                    Completed ({assignments.filter(a => a.status === 'submitted' || a.status === 'graded').length})
                </Text>
            </TouchableOpacity>
        </View>
    );

    // Render workflow UI
    const renderWorkflowInterface = () => {
        if (!currentAssignment) return null;

        switch (workflowStep) {
            case 'instructions':
                return (
                    <View style={styles.workflowContainer}>
                        <View style={styles.workflowHeader}>
                            <Text style={styles.workflowTitle}>{currentAssignment.assignment?.title}</Text>
                            <TouchableOpacity
                                style={styles.workflowCloseButton}
                                onPress={exitWorkflow}
                            >
                                <Text style={styles.workflowCloseText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.workflowContent}>
                            <Text style={styles.workflowStepTitle}>📋 Assignment Instructions</Text>
                            <Text style={styles.instructionsText}>
                                {currentAssignment.assignment?.description}
                            </Text>

                            {currentAssignment.assignment?.instructions && (
                                <>
                                    <Text style={styles.detailedInstructionsTitle}>Detailed Instructions:</Text>
                                    <Text style={styles.detailedInstructionsText}>
                                        {currentAssignment.assignment.instructions}
                                    </Text>
                                </>
                            )}

                            <View style={styles.assignmentMetaInfo}>
                                <Text style={styles.metaText}>
                                    📊 Points: {currentAssignment.assignment?.points}
                                </Text>
                                <Text style={styles.metaText}>
                                    ⏱️ Estimated: {currentAssignment.assignment?.duration_minutes} min
                                </Text>
                                <Text style={styles.metaText}>
                                    📅 Due: {new Date(currentAssignment.due_date).toLocaleDateString()}
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={styles.nextStepButton}
                                onPress={nextWorkflowStep}
                            >
                                <Text style={styles.nextStepButtonText}>Ready to Submit ➔</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );

            case 'upload':
                return (
                    <View style={styles.workflowContainer}>
                        <View style={styles.workflowHeader}>
                            <Text style={styles.workflowTitle}>📸 Upload Your Work</Text>
                            <TouchableOpacity
                                style={styles.workflowCloseButton}
                                onPress={exitWorkflow}
                            >
                                <Text style={styles.workflowCloseText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.workflowContent}>
                            <Text style={styles.uploadInstructions}>
                                Take photos of your completed assignment. The system will automatically
                                convert them to PDF and grade your work using AI.
                            </Text>

                            <View style={styles.uploadArea}>
                                {selectedImages.length > 0 ? (
                                    <View style={styles.selectedImagesContainer}>
                                        <Text style={styles.selectedImagesText}>
                                            {selectedImages.length} image(s) selected ✓
                                        </Text>
                                        {selectedImages.map((img, index) => (
                                            <Text key={index} style={styles.imageFileName}>{img}</Text>
                                        ))}
                                    </View>
                                ) : (
                                    <View style={styles.noImagesContainer}>
                                        <Text style={styles.noImagesText}>No images selected</Text>
                                        <Text style={styles.noImagesSubtext}>
                                            Tap the button below to add photos
                                        </Text>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={styles.selectImagesButton}
                                    onPress={selectImages}
                                >
                                    <Text style={styles.selectImagesButtonText}>
                                        📷 {selectedImages.length > 0 ? 'Add More Photos' : 'Take Photos'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {selectedImages.length > 0 && (
                                <TouchableOpacity
                                    style={styles.submitWorkButton}
                                    onPress={nextWorkflowStep}
                                >
                                    <Text style={styles.submitWorkButtonText}>Submit for Grading ➔</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                );

            case 'processing':
                return (
                    <View style={styles.workflowContainer}>
                        <View style={styles.workflowHeader}>
                            <Text style={styles.workflowTitle}>⚡ Processing Your Work</Text>
                        </View>

                        <View style={styles.processingContent}>
                            <Text style={styles.processingTitle}>Processing Assignment...</Text>
                            <Text style={styles.processingDescription}>
                                We're converting your images to PDF and running AI analysis.
                                This usually takes a few moments.
                            </Text>

                            <View style={styles.progressContainer}>
                                <Text style={styles.progressText}>{uploadProgress}% Complete</Text>
                                <View style={styles.progressBar}>
                                    <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                                </View>
                            </View>

                            {grading && (
                                <View style={styles.gradingIndicator}>
                                    <ActivityIndicator size="large" color="#007AFF" />
                                    <Text style={styles.gradingText}>AI is grading your work...</Text>
                                </View>
                            )}
                        </View>
                    </View>
                );

            case 'results':
                return (
                    <View style={styles.workflowContainer}>
                        <View style={styles.workflowHeader}>
                            <Text style={styles.workflowTitle}>🎉 Assignment Complete!</Text>
                        </View>

                        <View style={styles.resultsContent}>
                            {results && (
                                <>
                                    <View style={styles.scoreContainer}>
                                        <Text style={styles.scoreLabel}>Your Score:</Text>
                                        <Text style={styles.scoreValue}>
                                            {results.ai_score ? Math.round(results.ai_score) : 0}%
                                        </Text>
                                    </View>

                                    {results.ai_feedback && (
                                        <View style={styles.feedbackContainer}>
                                            <Text style={styles.feedbackTitle}>AI Feedback:</Text>
                                            <Text style={styles.feedbackText}>{results.ai_feedback}</Text>
                                        </View>
                                    )}

                                    <View style={styles.nextStepsContainer}>
                                        <Text style={styles.nextStepsTitle}>What's Next?</Text>
                                        <Text style={styles.nextStepsText}>
                                            Great job! You can continue with the next lesson or try another assignment.
                                        </Text>
                                    </View>
                                </>
                            )}

                            <TouchableOpacity
                                style={styles.continueButton}
                                onPress={exitWorkflow}
                            >
                                <Text style={styles.continueButtonText}>Continue Learning ➔</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );

            default:
                return null;
        }
    };

    // Render assignment card
    const renderAssignmentCard = (assignment: StudentAssignment) => {
        const statusDisplay = getAssignmentStatusDisplay(assignment);
        const isCompleted = assignment.status === 'graded';
        const canStart = assignment.status === 'assigned';

        return (
            <View key={assignment.id} style={styles.assignmentCard}>
                <View style={styles.assignmentHeader}>
                    <View style={styles.assignmentInfo}>
                        <Text style={styles.assignmentTitle}>{assignment.assignment?.title}</Text>
                        <Text style={styles.assignmentDescription}>{assignment.assignment?.description}</Text>
                    </View>
                    <View style={styles.assignmentMeta}>
                        <View style={[styles.typeBadge, { backgroundColor: getAssignmentTypeColor(assignment.assignment?.assignment_type || '') }]}>
                            <Text style={styles.typeBadgeText}>{assignment.assignment?.assignment_type?.toUpperCase()}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusDisplay.bgColor }]}>
                            <Text style={[styles.statusBadgeText, { color: statusDisplay.color }]}>
                                {statusDisplay.text}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.assignmentDetails}>
                    <View style={styles.assignmentDetailItem}>
                        <Text style={styles.assignmentDetailLabel}>Max Score:</Text>
                        <Text style={styles.assignmentDetailValue}>{assignment.assignment?.points} points</Text>
                    </View>

                    <View style={styles.assignmentDetailItem}>
                        <Text style={styles.assignmentDetailLabel}>Due Date:</Text>
                        <Text style={[
                            styles.assignmentDetailValue,
                            new Date(assignment.due_date) < new Date() && assignment.status === 'assigned'
                                ? styles.overdueText : {}
                        ]}>
                            {formatDueDate(assignment.due_date)}
                        </Text>
                    </View>

                    {assignment.grade !== undefined && assignment.grade !== null && (
                        <View style={styles.assignmentDetailItem}>
                            <Text style={styles.assignmentDetailLabel}>Score:</Text>
                            <Text style={styles.scoreText}>
                                {Math.round(assignment.grade)}%
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.instructionsContainer}>
                    <Text style={styles.instructionsTitle}>Instructions:</Text>
                    <Text style={styles.instructionsText} numberOfLines={3}>
                        {assignment.assignment?.instructions || assignment.assignment?.description}
                    </Text>
                </View>

                {assignment.feedback && (
                    <View style={styles.feedbackContainer}>
                        <Text style={styles.feedbackTitle}>AI Feedback:</Text>
                        <Text style={styles.feedbackText} numberOfLines={3}>
                            {assignment.feedback}
                        </Text>
                    </View>
                )}

                <View style={styles.assignmentActions}>
                    {canStart ? (
                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={() => startAssignmentWorkflow(assignment)}
                        >
                            <Text style={styles.submitButtonText}>Start Assignment</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.viewButton}
                            onPress={() => {/* Navigate to submission details */ }}
                        >
                            <Text style={styles.viewButtonText}>
                                {isCompleted ? 'View Results' : 'View Details'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    const filteredAssignments = getFilteredAssignments();

    // If workflow is active, show only the workflow interface
    if (workflowActive) {
        return (
            <SafeAreaView style={styles.container}>
                {renderWorkflowInterface()}
            </SafeAreaView>
        );
    }

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
    // Workflow styles
    workflowContainer: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 20,
    },
    workflowHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    workflowTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
        flex: 1,
    },
    workflowCloseButton: {
        padding: 8,
        marginLeft: 16,
    },
    workflowCloseText: {
        fontSize: 18,
        color: '#666',
        fontWeight: 'bold',
    },
    workflowContent: {
        flex: 1,
    },
    workflowStepTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 16,
    },
    detailedInstructionsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginTop: 16,
        marginBottom: 8,
    },
    detailedInstructionsText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
        marginBottom: 16,
    },
    assignmentMetaInfo: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
    },
    metaText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    nextStepButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    nextStepButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    uploadInstructions: {
        fontSize: 16,
        color: '#666',
        lineHeight: 22,
        marginBottom: 24,
        textAlign: 'center',
    },
    uploadArea: {
        borderWidth: 2,
        borderColor: '#e0e0e0',
        borderStyle: 'dashed',
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        marginBottom: 20,
    },
    selectedImagesContainer: {
        alignItems: 'center',
    },
    selectedImagesText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#28A745',
        marginBottom: 8,
    },
    imageFileName: {
        fontSize: 12,
        color: '#666',
        marginVertical: 2,
    },
    noImagesContainer: {
        alignItems: 'center',
    },
    noImagesText: {
        fontSize: 16,
        color: '#999',
        marginBottom: 4,
    },
    noImagesSubtext: {
        fontSize: 14,
        color: '#ccc',
    },
    selectImagesButton: {
        backgroundColor: '#f0f0f0',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        marginTop: 16,
    },
    selectImagesButtonText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '600',
    },
    submitWorkButton: {
        backgroundColor: '#28A745',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    submitWorkButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    processingContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    processingTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 12,
        textAlign: 'center',
    },
    processingDescription: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 40,
    },
    progressContainer: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 30,
    },
    progressText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#007AFF',
        marginBottom: 12,
    },
    progressBar: {
        width: '100%',
        height: 8,
        backgroundColor: '#e0e0e0',
        borderRadius: 4,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#007AFF',
        borderRadius: 4,
    },
    gradingIndicator: {
        alignItems: 'center',
        marginTop: 20,
    },
    gradingText: {
        fontSize: 14,
        color: '#666',
        marginTop: 12,
    },
    resultsContent: {
        flex: 1,
        padding: 20,
    },
    scoreContainer: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        marginBottom: 24,
    },
    scoreLabel: {
        fontSize: 16,
        color: '#666',
        marginBottom: 8,
    },
    scoreValue: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#28A745',
    },
    nextStepsContainer: {
        backgroundColor: '#E3F2FD',
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
    },
    nextStepsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    nextStepsText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    continueButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 24,
    },
    continueButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginLeft: 8,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
});