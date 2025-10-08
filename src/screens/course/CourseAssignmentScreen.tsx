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
import * as ImagePicker from 'expo-image-picker';
import {
    afterSchoolService,
    AISubmission,
    AISubmissionCreate,
    CourseWithLessons,
    StudentAssignment,
    CourseAssignment,
    AssignmentStatus,
    AssignmentGradeResult
} from '../../services/afterSchoolService';
import { uploadsService, UploadFile, AIProcessingResults } from '../../services/uploadsService';
import { gradesService } from '../../services/gradesService';

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
    // Raw assignment definitions (course-level, not user-specific)
    const [rawAssignments, setRawAssignments] = useState<CourseAssignment[]>([]);
    const [currentAssignment, setCurrentAssignment] = useState<StudentAssignment | null>(null);
    const [assignmentStatus, setAssignmentStatus] = useState<AssignmentStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'submitted'>('all');

    // Workflow states
    const [workflowActive, setWorkflowActive] = useState(false);
    const [workflowStep, setWorkflowStep] = useState<'instructions' | 'upload' | 'processing' | 'results'>('instructions');
    const [selectedImages, setSelectedImages] = useState<UploadFile[]>([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [grading, setGrading] = useState(false);
    const [results, setResults] = useState<AISubmission | null>(null);
    // Remember block/lesson context for backend requirements
    const [contextLessonId, setContextLessonId] = useState<number | undefined>(undefined);
    const [contextBlockId, setContextBlockId] = useState<number | undefined>(undefined);
    // Toggle to reveal technical feedback details when there's an issue
    const [showTechDetails, setShowTechDetails] = useState(false);

    // Sanitize raw AI feedback to avoid leaking provider/system errors to users (mirrors GradeDetails)
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

    // Identify when feedback suggests a processing issue rather than real grading
    const isProcessingIssue = useCallback((text?: string | null): boolean => {
        if (!text || typeof text !== 'string') return false;
        const t = text.toLowerCase();
        return (
            t.includes('error') ||
            t.includes('issue') ||
            t.includes('invalid') ||
            t.includes('pending') ||
            t.includes('failed to process') ||
            t.includes('try again') ||
            t.includes('overloaded')
        );
    }, []);

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

            // Load course assignments (student-specific) and raw assignment definitions (course-level)
            const [courseData, assignmentsData, definitions] = await Promise.all([
                afterSchoolService.getCourseDetails(courseId, token),
                afterSchoolService.getCourseAssignments(courseId, token),
                afterSchoolService.getCourseAssignmentDefinitions(courseId, token).catch(() => [])
            ]);

            setCourse(courseData);
            setAssignments(assignmentsData);
            setRawAssignments(definitions);

            // If a specific assignment is requested, only proceed if the student actually has it
            if (assignmentId) {
                const assignment = assignmentsData.find(a => a.assignment_id === assignmentId);
                if (assignment) {
                    setCurrentAssignment(assignment);

                    // Load assignment status for the current assignment (mark-done model)
                    const status = await afterSchoolService.getAssignmentStatus(assignmentId.toString(), token);
                    setAssignmentStatus(status); // Will be null if not found, which is handled gracefully
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

    // Build a set of assigned definition ids to prevent duplicates in Available section
    const assignedDefinitionIds = new Set(
        assignments
            .map(a => (a.assignment?.id ?? a.assignment_id))
            .filter(id => typeof id === 'number')
    );

    // Adapter to render course-level definitions using the same card component without pretending they are student-owned
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

    const availableDefinitionAdapters: StudentAssignment[] = (rawAssignments || [])
        .filter(def => !assignedDefinitionIds.has(def.id))
        .map(adaptDefinition);

    // Tab counts and filtering
    const pendingAssigned = assignments.filter(a => a.status === 'assigned');
    const submittedOrGraded = assignments.filter(a => a.status === 'submitted' || a.status === 'graded');
    const allCount = assignments.length + availableDefinitionAdapters.length;

    // Start assignment workflow
    const startAssignmentWorkflow = (assignment?: StudentAssignment) => {
        const targetAssignment = assignment || currentAssignment;
        if (!targetAssignment) return;

        setCurrentAssignment(targetAssignment);
        setWorkflowActive(true);
        setWorkflowStep('instructions');
        setSelectedImages([]);
        setResults(null);
        setContextLessonId(undefined);
        setContextBlockId(undefined);
    };

    // Retry assignment
    const retryAssignment = async () => {
        if (!currentAssignment || !token) return;

        try {
            setGrading(true);

            const result = await afterSchoolService.retryAssignment(currentAssignment.assignment_id.toString(), token);

            Alert.alert(
                'Assignment Reset',
                `Assignment retry initiated. You have ${result.grade_response.attempts_remaining} attempts remaining.`,
                [
                    {
                        text: 'Start Retry',
                        onPress: () => {
                            // Refresh assignment status and start workflow
                            loadAssignmentData();
                            startAssignmentWorkflow();
                        }
                    },
                    { text: 'Later', style: 'cancel' }
                ]
            );

        } catch (error) {
            console.error('Error retrying assignment:', error);
            Alert.alert(
                'Error',
                'Failed to retry assignment. Please try again.',
                [{ text: 'OK' }]
            );
        } finally {
            setGrading(false);
        }
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

    // Handle image selection with expo-image-picker (camera or library)
    const selectImages = async () => {
        try {
            // Ask user to choose source
            Alert.alert(
                'Add Photos',
                'Choose where to pick images from',
                [
                    {
                        text: 'Camera',
                        onPress: async () => {
                            const { status } = await ImagePicker.requestCameraPermissionsAsync();
                            if (status !== 'granted') {
                                Alert.alert('Permission required', 'Camera permission is needed to take photos.');
                                return;
                            }
                            const result = await ImagePicker.launchCameraAsync({
                                quality: 0.8,
                                base64: false,
                            });
                            if (!result.canceled && result.assets?.length) {
                                const newFiles = result.assets.map((asset, idx): UploadFile => ({
                                    uri: asset.uri,
                                    name: (asset as any).fileName || asset.uri.split('/').pop() || `photo_${Date.now()}_${idx}.jpg`,
                                    type: asset.mimeType || 'image/jpeg',
                                }));
                                setSelectedImages(prev => [...prev, ...newFiles]);
                            }
                        }
                    },
                    {
                        text: 'Photo Library',
                        onPress: async () => {
                            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                            if (status !== 'granted') {
                                Alert.alert('Permission required', 'Photo library permission is needed to select images.');
                                return;
                            }
                            const result = await ImagePicker.launchImageLibraryAsync({
                                allowsMultipleSelection: true,
                                quality: 0.8,
                                base64: false,
                            });
                            if (!result.canceled && result.assets?.length) {
                                const newFiles = result.assets.map((asset, idx): UploadFile => ({
                                    uri: asset.uri,
                                    name: (asset as any).fileName || asset.uri.split('/').pop() || `image_${Date.now()}_${idx}.jpg`,
                                    type: asset.mimeType || 'image/jpeg',
                                }));
                                setSelectedImages(prev => [...prev, ...newFiles]);
                            }
                        }
                    },
                    { text: 'Cancel', style: 'cancel' }
                ]
            );
        } catch (err) {
            console.error('Image selection error:', err);
            Alert.alert('Error', 'Failed to select images');
        }
    };

    // Start image upload and processing workflow (real backend integration)
    const startImageUpload = async () => {
        if (!currentAssignment || !token || selectedImages.length === 0) return;

        try {
            setWorkflowStep('processing');
            setUploadProgress(10);
            setGrading(true);

            // Determine appropriate block or lesson context for uploads
            const assignmentBlockId = (currentAssignment.assignment?.block_id ?? (currentAssignment as any)?.block_id) as number | undefined;
            const assignmentLessonId = (currentAssignment.assignment as any)?.lesson_id as number | undefined;
            let lessonIdToUse: number | undefined = assignmentLessonId;
            let blockIdToUse: number | undefined = assignmentBlockId;

            console.log('🧭 Block/Lesson resolution:', {
                assignmentBlockId,
                assignmentLessonId,
                hasCourseLessons: Array.isArray((course as any)?.lessons) && (course as any)?.lessons?.length > 0
            });

            // Prefer assignment's block_id if present
            if (!blockIdToUse && !lessonIdToUse) {
                // Fall back to first available lesson from course details
                const firstLesson = (course as any)?.lessons?.[0];
                if (firstLesson?.id) {
                    lessonIdToUse = firstLesson.id;
                } else {
                    // As a final fallback, try fetching blocks and use the first one
                    try {
                        const withBlocks = await afterSchoolService.getCourseWithBlocks(courseId, token);
                        if (withBlocks?.blocks?.length) {
                            blockIdToUse = withBlocks.blocks[0].id;
                        }
                    } catch (e) {
                        console.warn('Could not fetch course blocks for fallback:', e);
                    }
                }
            }

            // If we found a block but no lesson and the course has lessons, include the first lesson to satisfy backend constraints
            if (blockIdToUse && !lessonIdToUse) {
                const firstCourseLesson = (course as any)?.lessons?.[0];
                if (firstCourseLesson?.id) {
                    lessonIdToUse = firstCourseLesson.id;
                }
            }

            if (!lessonIdToUse && !blockIdToUse) {
                throw new Error('Cannot upload assignment: no lesson or block context found for this assignment.');
            }

            // Store context for upload workflow
            setContextLessonId(lessonIdToUse);
            setContextBlockId(blockIdToUse);
            console.log('✅ Ready for upload with context:', { courseId, lessonId: lessonIdToUse, blockId: blockIdToUse });

            // Map assignment type for API compatibility
            const assignmentType = currentAssignment.assignment?.assignment_type === 'project'
                ? 'assessment'
                : (currentAssignment.assignment?.assignment_type as any) || 'homework';

            // Validate images before upload
            const validation = uploadsService.validateImagesForWorkflow(selectedImages);
            if (!validation.valid) {
                throw new Error(validation.error || 'Invalid images selected');
            }

            // Upload images → PDF → AI processing
            setUploadProgress(40);
            const workflow = await uploadsService.uploadImagesForAssignmentWorkflow(
                courseId,
                currentAssignment.assignment_id,
                selectedImages,
                token,
                assignmentType,
                { lesson_id: lessonIdToUse, block_id: blockIdToUse }
            );

            setUploadProgress(80);

            // Use AI results from workflow
            const ai: AIProcessingResults | undefined = workflow.ai_processing;
            // Preserve undefined when score isn't available to avoid showing 0% incorrectly
            const aiScore = typeof ai?.ai_score === 'number' ? ai.ai_score : undefined;
            const aiFeedback = ai?.ai_feedback ?? '';
            const hasIssue = isProcessingIssue(aiFeedback);

            setResults({
                id: workflow.pdf_submission.submission_id || 0,
                user_id: 0,
                course_id: courseId,
                lesson_id: lessonIdToUse,
                block_id: blockIdToUse,
                submission_type: assignmentType,
                ai_processed: true,
                ai_score: aiScore as any,
                ai_feedback: aiFeedback,
                requires_review: false,
                submitted_at: new Date().toISOString(),
                processed_at: new Date().toISOString()
            } as any);

            // Reflect results in UI
            setWorkflowStep('results');
            setCurrentAssignment(prev => prev ? {
                ...prev,
                status: (aiScore != null && !hasIssue) ? 'graded' : 'submitted',
                grade: (aiScore != null && !hasIssue) ? aiScore : undefined,
                feedback: aiFeedback
            } : null);

        } catch (error) {
            console.error('Error uploading/processing images:', error);
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to upload images. Please try again.');
            setWorkflowStep('upload');
        } finally {
            setGrading(false);
            setUploadProgress(100);
        }
    };

    // Exit workflow
    const exitWorkflow = () => {
        setWorkflowActive(false);
        setWorkflowStep('instructions');
        setSelectedImages([]);
        setUploadProgress(0);
        setResults(null);
        setContextLessonId(undefined);
        setContextBlockId(undefined);

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

    // Convert backend status to frontend status for compatibility
    const mapBackendStatusToFrontend = (backendStatus: string, grade: number, canRetry: boolean) => {
        switch (backendStatus) {
            case 'passed':
                return 'passed';
            case 'needs_retry':
                return canRetry ? 'failed_can_retry' : 'failed_no_retry';
            case 'failed':
                return 'failed_no_retry';
            case 'submitted':
            case 'graded':
                // Check if passed based on grade
                return grade >= 80 ? 'passed' : (canRetry ? 'failed_can_retry' : 'failed_no_retry');
            case 'assigned':
                return 'not_attempted';
            default:
                return 'not_attempted';
        }
    };

    // Get assignment status display
    const getAssignmentStatusDisplay = (assignment: StudentAssignment) => {
        // Use new assignment status if available
        if (assignmentStatus && assignment.assignment_id.toString() === assignmentStatus.assignment.id.toString()) {
            const mappedStatus = mapBackendStatusToFrontend(
                assignmentStatus.student_assignment.status,
                assignmentStatus.student_assignment.grade,
                assignmentStatus.attempts_info.can_retry
            );
            const grade = assignmentStatus.student_assignment.grade;

            switch (mappedStatus) {
                case 'passed':
                    return { text: `✓ Passed (${grade}%)`, color: '#28A745', bgColor: '#E8F5E8' };
                case 'failed_can_retry':
                    return {
                        text: `Try Again (${grade}% - Need 80%)`,
                        color: '#856404',
                        bgColor: '#FFF3E0'
                    };
                case 'failed_no_retry':
                    return {
                        text: `Failed (${grade}% - Max attempts reached)`,
                        color: '#dc3545',
                        bgColor: '#FFEBEE'
                    };
                case 'not_attempted':
                    return { text: 'Ready to Start', color: '#007AFF', bgColor: '#E3F2FD' };
                default:
                    return { text: 'Unknown Status', color: '#666', bgColor: '#F5F5F5' };
            }
        }

        // Fallback to legacy status
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
                    All ({allCount})
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
                onPress={() => setActiveTab('pending')}
            >
                <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
                    Pending ({pendingAssigned.length})
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'submitted' && styles.activeTab]}
                onPress={() => setActiveTab('submitted')}
            >
                <Text style={[styles.tabText, activeTab === 'submitted' && styles.activeTabText]}>
                    Completed ({submittedOrGraded.length})
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

                            {currentAssignment.assignment?.description && (
                                <View style={styles.descriptionBlock}>
                                    <Text style={styles.instructionsText}>
                                        {currentAssignment.assignment.description}
                                    </Text>
                                </View>
                            )}

                            {currentAssignment.assignment?.instructions && (
                                <View style={styles.detailedInstructionsBlock}>
                                    <Text style={styles.detailedInstructionsTitle}>Detailed Instructions:</Text>
                                    <Text style={styles.detailedInstructionsText}>
                                        {currentAssignment.assignment.instructions}
                                    </Text>
                                </View>
                            )}

                            {!currentAssignment.assignment?.description && !currentAssignment.assignment?.instructions && (
                                <View style={styles.noInstructionsBlock}>
                                    <Text style={styles.noInstructionsText}>
                                        No specific instructions provided. Please complete the assignment based on the course materials.
                                    </Text>
                                </View>
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
                                            <Text key={index} style={styles.imageFileName}>{img.name}</Text>
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
                                            {typeof results.ai_score === 'number' && !isNaN(results.ai_score)
                                                ? `${Math.round(results.ai_score)}%`
                                                : '— Pending'}
                                        </Text>
                                    </View>

                                    {results.ai_feedback && (
                                        <View style={[
                                            styles.feedbackContainer,
                                            results.ai_feedback.toLowerCase().includes('error') ||
                                                results.ai_feedback.toLowerCase().includes('issue') ||
                                                results.ai_feedback.toLowerCase().includes('invalid')
                                                ? styles.feedbackErrorContainer
                                                : styles.feedbackContainer
                                        ]}>
                                            <Text style={[
                                                styles.feedbackTitle,
                                                results.ai_feedback.toLowerCase().includes('error') ||
                                                    results.ai_feedback.toLowerCase().includes('issue') ||
                                                    results.ai_feedback.toLowerCase().includes('invalid')
                                                    ? styles.feedbackErrorTitle
                                                    : styles.feedbackTitle
                                            ]}>
                                                {results.ai_feedback.toLowerCase().includes('error') ||
                                                    results.ai_feedback.toLowerCase().includes('issue') ||
                                                    results.ai_feedback.toLowerCase().includes('invalid')
                                                    ? '⚠️ Processing Issue'
                                                    : '🤖 AI Feedback'}
                                            </Text>
                                            {(() => {
                                                const raw = results.ai_feedback || '';
                                                const isIssue = raw.toLowerCase().includes('error') || raw.toLowerCase().includes('issue') || raw.toLowerCase().includes('invalid');
                                                const cleaned = cleanAIText(raw) || '';
                                                return (
                                                    <>
                                                        <Text style={[
                                                            styles.feedbackText,
                                                            isIssue ? styles.feedbackErrorText : styles.feedbackText
                                                        ]}>
                                                            {isIssue
                                                                ? 'We had trouble processing your submission. Your work is saved. You can retry now or continue learning; we\'ll grade it soon.'
                                                                : cleaned}
                                                        </Text>
                                                        {isIssue && cleaned && (
                                                            <TouchableOpacity onPress={() => setShowTechDetails(v => !v)} style={{ marginTop: 8 }}>
                                                                <Text style={{ color: '#007AFF', fontWeight: '600' }}>
                                                                    {showTechDetails ? 'Hide details' : 'View technical details'}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        )}
                                                        {isIssue && showTechDetails && (
                                                            <Text style={[styles.feedbackText, { marginTop: 6, color: '#555' }]}>
                                                                {cleaned}
                                                            </Text>
                                                        )}
                                                    </>
                                                );
                                            })()}
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
    const viewAssignmentResults = async (assignment: StudentAssignment) => {
        try {
            if (!token) return;
            const latest = await gradesService.findLatestSubmissionForAssignment(
                assignment.assignment_id,
                token
            );
            if (latest) {
                navigation.navigate('GradeDetails', {
                    submissionId: latest.id,
                    submissionType: latest.submission_type as any,
                });
            } else {
                Alert.alert(
                    'Results not found',
                    'We could not find a graded submission yet. Please try again shortly.'
                );
            }
        } catch (e) {
            Alert.alert('Error', 'Unable to open grade details right now.');
        }
    };

    const renderAssignmentCard = (assignment: StudentAssignment) => {
        const statusDisplay = getAssignmentStatusDisplay(assignment);
        const isCompleted = assignment.status === 'graded';
        const mappedStatus = assignmentStatus ? mapBackendStatusToFrontend(
            assignmentStatus.student_assignment.status,
            assignmentStatus.student_assignment.grade,
            assignmentStatus.attempts_info.can_retry
        ) : null;

        const canStart = assignment.status === 'assigned' ||
            mappedStatus === 'not_attempted' ||
            mappedStatus === 'failed_can_retry';
        const canRetry = mappedStatus === 'failed_can_retry';
        const isPassed = mappedStatus === 'passed';
        const hasMaxAttempts = mappedStatus === 'failed_no_retry';

        return (
            <View style={styles.assignmentCard}>
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
                    {(assignment.assignment?.instructions || assignment.assignment?.description) ? (
                        <Text style={styles.instructionsText}>
                            {assignment.assignment?.instructions || assignment.assignment?.description}
                        </Text>
                    ) : (
                        <Text style={[styles.instructionsText, styles.noInstructionsText]}>
                            No specific instructions provided for this assignment.
                        </Text>
                    )}
                </View>

                {isCompleted && assignment.feedback && (
                    <View style={[
                        styles.feedbackContainer,
                        assignment.feedback.toLowerCase().includes('error') ||
                            assignment.feedback.toLowerCase().includes('issue') ||
                            assignment.feedback.toLowerCase().includes('invalid')
                            ? styles.feedbackErrorContainer
                            : styles.feedbackContainer
                    ]}>
                        <Text style={[
                            styles.feedbackTitle,
                            assignment.feedback.toLowerCase().includes('error') ||
                                assignment.feedback.toLowerCase().includes('issue') ||
                                assignment.feedback.toLowerCase().includes('invalid')
                                ? styles.feedbackErrorTitle
                                : styles.feedbackTitle
                        ]}>
                            {assignment.feedback.toLowerCase().includes('error') ||
                                assignment.feedback.toLowerCase().includes('issue') ||
                                assignment.feedback.toLowerCase().includes('invalid')
                                ? '⚠️ Processing Issue'
                                : '✅ AI Feedback'}
                        </Text>
                        <Text style={[
                            styles.feedbackText,
                            assignment.feedback.toLowerCase().includes('error') ||
                                assignment.feedback.toLowerCase().includes('issue') ||
                                assignment.feedback.toLowerCase().includes('invalid')
                                ? styles.feedbackErrorText
                                : styles.feedbackText
                        ]}>
                            {assignment.feedback.toLowerCase().includes('error') ||
                                assignment.feedback.toLowerCase().includes('issue') ||
                                assignment.feedback.toLowerCase().includes('invalid')
                                ? 'There was a technical issue processing your submission. Your work has been saved and will be reviewed. Please try submitting again or contact support if needed.\n\nDetails: ' + assignment.feedback
                                : assignment.feedback}
                        </Text>
                    </View>
                )}

                {/* Assignment Status Details */}
                {assignmentStatus && (
                    <View style={styles.assignmentDetails}>
                        <View style={styles.assignmentDetailItem}>
                            <Text style={styles.assignmentDetailLabel}>Attempts:</Text>
                            <Text style={styles.assignmentDetailValue}>
                                {assignmentStatus.attempts_info.attempts_used}/3
                            </Text>
                        </View>
                        {assignmentStatus.student_assignment.grade !== undefined && (
                            <View style={styles.assignmentDetailItem}>
                                <Text style={styles.assignmentDetailLabel}>Best Score:</Text>
                                <Text style={[
                                    styles.assignmentDetailValue,
                                    {
                                        color: assignmentStatus.student_assignment.grade >= 80 ? '#28A745' : '#dc3545',
                                        fontWeight: 'bold'
                                    }
                                ]}>
                                    {assignmentStatus.student_assignment.grade}%
                                </Text>
                            </View>
                        )}
                        {/* Next attempt timing - using message field from backend */}
                        {assignmentStatus.message && !assignmentStatus.passing_grade && (
                            <View style={styles.assignmentDetailItem}>
                                <Text style={styles.assignmentDetailLabel}>Status:</Text>
                                <Text style={[styles.assignmentDetailValue, { color: '#856404' }]}>
                                    {assignmentStatus.message}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                <View style={styles.assignmentActions}>
                    {isPassed ? (
                        <TouchableOpacity
                            style={[styles.viewButton, { backgroundColor: '#E8F5E8' }]}
                            onPress={() => viewAssignmentResults(assignment)}
                        >
                            <Text style={[styles.viewButtonText, { color: '#28A745' }]}>
                                ✓ Completed - View Results
                            </Text>
                        </TouchableOpacity>
                    ) : hasMaxAttempts ? (
                        <TouchableOpacity
                            style={[styles.viewButton, { backgroundColor: '#FFEBEE', opacity: 0.7 }]}
                            disabled={true}
                        >
                            <Text style={[styles.viewButtonText, { color: '#dc3545' }]}>
                                Max Attempts Reached
                            </Text>
                        </TouchableOpacity>
                    ) : canRetry ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity
                                style={[styles.submitButton, { backgroundColor: '#FD7E14', flex: 1, marginRight: 8 }]}
                                onPress={retryAssignment}
                                disabled={grading}
                            >
                                {grading ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.submitButtonText}>Retry Assignment</Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.viewButton, { flex: 0.6 }]}
                                onPress={() => viewAssignmentResults(assignment)}
                            >
                                <Text style={styles.viewButtonText}>View Last</Text>
                            </TouchableOpacity>
                        </View>
                    ) : canStart ? (
                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={() => startAssignmentWorkflow(assignment)}
                        >
                            <Text style={styles.submitButtonText}>
                                {mappedStatus === 'not_attempted' ? 'Start Assignment' : 'Continue Assignment'}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.viewButton}
                            onPress={() => viewAssignmentResults(assignment)}
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
                    {/* ALL tab: show both sections, like CourseDetails */}
                    {activeTab === 'all' && (
                        <>
                            {assignments.length > 0 && (
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={styles.sectionHeading}>Your Assigned Work ({assignments.length})</Text>
                                    {assignments.map((a, idx) => (
                                        <React.Fragment key={`assigned-${a?.id ?? a?.assignment_id ?? idx}`}>
                                            {renderAssignmentCard(a)}
                                        </React.Fragment>
                                    ))}
                                </View>
                            )}
                            <View style={{ marginBottom: 8 }}>
                                <Text style={styles.sectionHeading}>Available Assignments ({availableDefinitionAdapters.length})</Text>
                                {availableDefinitionAdapters.length > 0 ? (
                                    availableDefinitionAdapters.map((a, idx) => (
                                        <React.Fragment key={`available-${a?.id ?? a?.assignment_id ?? idx}`}>
                                            {renderAssignmentCard(a)}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <Text style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                                        All available assignments have already been assigned to you.
                                    </Text>
                                )}
                            </View>
                            {allCount === 0 && (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No assignments available</Text>
                                    <Text style={styles.emptySubtext}>Your instructor hasn't added assignments yet.</Text>
                                </View>
                            )}
                        </>
                    )}

                    {/* PENDING tab: show only student-assigned items awaiting submission */}
                    {activeTab === 'pending' && (
                        <>
                            {pendingAssigned.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No pending assignments</Text>
                                    <Text style={styles.emptySubtext}>Everything is up to date. Check Available Assignments in All tab.</Text>
                                </View>
                            ) : (
                                pendingAssigned.map((a, idx) => (
                                    <React.Fragment key={`pending-${a?.id ?? a?.assignment_id ?? idx}`}>
                                        {renderAssignmentCard(a)}
                                    </React.Fragment>
                                ))
                            )}
                        </>
                    )}

                    {/* SUBMITTED/COMPLETED tab: show graded or submitted */}
                    {activeTab === 'submitted' && (
                        <>
                            {submittedOrGraded.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No completed assignments yet</Text>
                                    <Text style={styles.emptySubtext}>Finish an assignment to see results here.</Text>
                                </View>
                            ) : (
                                submittedOrGraded.map((a, idx) => (
                                    <React.Fragment key={`completed-${a?.id ?? a?.assignment_id ?? idx}`}>
                                        {renderAssignmentCard(a)}
                                    </React.Fragment>
                                ))
                            )}
                        </>
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
    sectionHeading: {
        fontSize: 16,
        fontWeight: '600',
        color: '#222',
        marginBottom: 6
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
    noInstructionsText: {
        fontStyle: 'italic',
        color: '#999',
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
    feedbackErrorContainer: {
        backgroundColor: '#ffebee',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#f44336',
    },
    feedbackErrorTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#d32f2f',
        marginBottom: 4,
    },
    feedbackErrorText: {
        fontSize: 13,
        color: '#c62828',
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
    descriptionBlock: {
        marginBottom: 16,
    },
    detailedInstructionsBlock: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    noInstructionsBlock: {
        backgroundColor: '#fff3cd',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#ffc107',
    },
    detailedInstructionsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    detailedInstructionsText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
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