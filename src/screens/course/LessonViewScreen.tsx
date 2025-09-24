/**
 * Lesson View Screen
 * Display individual lesson content with navigation and progress tracking
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
    CourseBlock,
    CourseWithBlocks,
    StudySession,
    StudentAssignment
} from '../../services/afterSchoolService';

type NavigationProp = NativeStackNavigationProp<any>;
type RouteProp_ = RouteProp<{
    params: {
        courseId: number;
        blockId: number;
        blockTitle: string;
        courseTitle: string;
    }
}>;

interface Props {
    navigation: NavigationProp;
    route: RouteProp_;
}

const { width } = Dimensions.get('window');

export const LessonViewScreen: React.FC<Props> = ({ navigation, route }) => {
    const { courseId, blockId, blockTitle, courseTitle } = route.params;
    const { token } = useAuth();

    const [block, setBlock] = useState<CourseBlock | null>(null);
    const [course, setCourse] = useState<CourseWithBlocks | null>(null);
    const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Load block data
    const loadBlockData = async (isRefresh: boolean = false) => {
        try {
            if (!isRefresh) setLoading(true);

            if (!token) {
                throw new Error('No authentication token available');
            }

            // Load block details, course data, and assignments in parallel
            const [blockData, courseData, assignmentsData] = await Promise.all([
                afterSchoolService.getCourseBlockDetails(courseId, blockId, token),
                afterSchoolService.getCourseWithBlocks(courseId, token),
                afterSchoolService.getCourseAssignments(courseId, token, { block_id: blockId }).catch(() => [])
            ]);

            setBlock(blockData);
            setCourse(courseData);
            setAssignments(assignmentsData);
        } catch (error) {
            console.error('Error loading lesson data:', error);
            Alert.alert(
                'Error',
                'Failed to load lesson details. Please try again.',
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
            loadBlockData();
        }, [courseId, blockId, token])
    );

    // Pull to refresh
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadBlockData(true);
    }, []);

    // Start study session for this block
    const startStudySession = async () => {
        try {
            if (!token || !block) return;

            const session = await afterSchoolService.startStudySession({
                course_id: courseId,
                block_id: blockId
            }, token);

            navigation.navigate('StudySession', {
                sessionId: session.id,
                courseId,
                blockId,
                blockTitle: block.title,
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

    // Navigate to previous block
    const navigateToPreviousBlock = () => {
        if (!course?.blocks) return;

        const sortedBlocks = [...course.blocks].sort((a, b) => a.week - b.week || a.block_number - b.block_number);
        const currentIndex = sortedBlocks.findIndex(b => b.id === blockId);
        const prevBlock = sortedBlocks[currentIndex - 1];

        if (prevBlock) {
            navigation.replace('LessonView', {
                courseId,
                blockId: prevBlock.id,
                blockTitle: prevBlock.title,
                courseTitle
            });
        }
    };

    // Navigate to next block
    const navigateToNextBlock = () => {
        if (!course?.blocks) return;

        const sortedBlocks = [...course.blocks].sort((a, b) => a.week - b.week || a.block_number - b.block_number);
        const currentIndex = sortedBlocks.findIndex(b => b.id === blockId);
        const nextBlock = sortedBlocks[currentIndex + 1];

        if (nextBlock) {
            navigation.replace('LessonView', {
                courseId,
                blockId: nextBlock.id,
                blockTitle: nextBlock.title,
                courseTitle
            });
        }
    };

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

    // Continue workflow to assignments
    const continueToAssignments = () => {
        const pendingAssignment = assignments.find(a => a.status === 'assigned');
        if (pendingAssignment) {
            navigateToAssignment(pendingAssignment);
        } else {
            // Navigate to course details to see all assignments
            navigateBackToCourse();
        }
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

    // Get current block index and navigation info
    const getCurrentBlockInfo = () => {
        if (!course?.blocks || !block) {
            return { currentIndex: -1, total: 0, hasPrevious: false, hasNext: false };
        }

        const sortedBlocks = [...course.blocks].sort((a, b) => a.week - b.week || a.block_number - b.block_number);
        const currentIndex = sortedBlocks.findIndex(b => b.id === blockId);

        return {
            currentIndex: currentIndex + 1, // 1-based for display
            total: sortedBlocks.length,
            hasPrevious: currentIndex > 0,
            hasNext: currentIndex < sortedBlocks.length - 1
        };
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
                        {blockTitle}
                    </Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading block...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!block) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Block Not Found</Text>
                </View>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Block not found</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => loadBlockData()}
                    >
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const blockInfo = getCurrentBlockInfo();

    // Render block header
    const renderBlockHeader = () => (
        <View style={styles.lessonHeaderContainer}>
            <View style={styles.breadcrumbContainer}>
                <TouchableOpacity onPress={navigateBackToCourse}>
                    <Text style={styles.breadcrumbCourse}>{courseTitle}</Text>
                </TouchableOpacity>
                <Text style={styles.breadcrumbSeparator}> / </Text>
                <Text style={styles.breadcrumbLesson}>Week {block.week} - Block {block.block_number}</Text>
            </View>

            <Text style={styles.lessonTitle}>{block.title}</Text>

            <View style={styles.lessonMetaContainer}>
                <View style={styles.lessonMeta}>
                    <Text style={styles.lessonMetaLabel}>Duration:</Text>
                    <Text style={styles.lessonMetaValue}>
                        {formatDuration(block.duration_minutes)}
                    </Text>
                </View>
                <View style={styles.lessonMeta}>
                    <Text style={styles.lessonMetaLabel}>Position:</Text>
                    <Text style={styles.lessonMetaValue}>
                        {blockInfo.currentIndex} of {blockInfo.total}
                    </Text>
                </View>
            </View>

            {/* Learning Objectives */}
            {block.learning_objectives && block.learning_objectives.length > 0 && (
                <View style={styles.objectivesContainer}>
                    <Text style={styles.objectivesTitle}>Learning Objectives</Text>
                    <Text style={styles.objectivesText}>{block.learning_objectives.join('\n• ')}</Text>
                </View>
            )}

            {/* Assignment Workflow Integration */}
            {assignments.length > 0 && (
                <View style={styles.assignmentSection}>
                    <Text style={styles.assignmentSectionTitle}>Assignments for this Block</Text>
                    <View style={styles.assignmentStats}>
                        <Text style={styles.assignmentCount}>
                            {assignments.filter(a => a.status === 'assigned').length} pending
                        </Text>
                        <Text style={styles.assignmentCount}>
                            {assignments.filter(a => a.status === 'submitted').length} submitted
                        </Text>
                        <Text style={styles.assignmentCount}>
                            {assignments.filter(a => a.status === 'graded').length} graded
                        </Text>
                    </View>
                    {assignments.some(a => a.status === 'assigned') && (
                        <TouchableOpacity
                            style={styles.continueWorkflowButton}
                            onPress={continueToAssignments}
                        >
                            <Text style={styles.continueWorkflowButtonText}>Continue to Assignments</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Start Study Session Button */}
            <TouchableOpacity
                style={styles.startStudyButton}
                onPress={startStudySession}
            >
                <Text style={styles.startStudyButtonText}>Start Study Session</Text>
            </TouchableOpacity>
        </View>
    );

    // Render block content
    const renderBlockContent = () => (
        <View style={styles.contentContainer}>
            <Text style={styles.contentTitle}>Block Content</Text>
            {block.content ? (
                <View style={styles.contentBody}>
                    <Text style={styles.contentText}>{block.content}</Text>
                </View>
            ) : (
                <View style={styles.noContentContainer}>
                    <Text style={styles.noContentText}>No content available</Text>
                    <Text style={styles.noContentSubtext}>
                        Content for this block will be added soon
                    </Text>
                </View>
            )}
        </View>
    );

    // Render block navigation
    const renderBlockNavigation = () => (
        <View style={styles.navigationContainer}>
            <TouchableOpacity
                style={[styles.navButton, !blockInfo.hasPrevious && styles.disabledNavButton]}
                onPress={navigateToPreviousBlock}
                disabled={!blockInfo.hasPrevious}
            >
                <Text style={[styles.navButtonText, !blockInfo.hasPrevious && styles.disabledNavButtonText]}>
                    ← Previous Block
                </Text>
            </TouchableOpacity>

            <View style={styles.progressIndicator}>
                <Text style={styles.progressText}>
                    {blockInfo.currentIndex}/{blockInfo.total}
                </Text>
            </View>

            <TouchableOpacity
                style={[styles.navButton, !blockInfo.hasNext && styles.disabledNavButton]}
                onPress={navigateToNextBlock}
                disabled={!blockInfo.hasNext}
            >
                <Text style={[styles.navButtonText, !blockInfo.hasNext && styles.disabledNavButtonText]}>
                    Next Block →
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
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {block.title}
                </Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {renderBlockHeader()}
                {renderBlockContent()}
            </ScrollView>

            {/* Fixed Navigation Footer */}
            {renderBlockNavigation()}
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
    lessonHeaderContainer: {
        backgroundColor: '#fff',
        padding: 20,
        marginBottom: 16,
    },
    breadcrumbContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    breadcrumbCourse: {
        fontSize: 14,
        color: '#007AFF',
        textDecorationLine: 'underline',
    },
    breadcrumbSeparator: {
        fontSize: 14,
        color: '#666',
    },
    breadcrumbLesson: {
        fontSize: 14,
        color: '#666',
    },
    lessonTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 16,
    },
    lessonMetaContainer: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    lessonMeta: {
        marginRight: 24,
    },
    lessonMetaLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 2,
    },
    lessonMetaValue: {
        fontSize: 14,
        color: '#1a1a1a',
        fontWeight: '600',
    },
    objectivesContainer: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    objectivesTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    objectivesText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    startStudyButton: {
        backgroundColor: '#007AFF',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    startStudyButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    contentContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginHorizontal: 20,
        marginBottom: 100, // Space for navigation footer
    },
    contentTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 16,
    },
    contentBody: {
        minHeight: 200,
    },
    contentText: {
        fontSize: 16,
        color: '#333',
        lineHeight: 24,
    },
    noContentContainer: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    noContentText: {
        fontSize: 16,
        color: '#666',
        marginBottom: 8,
    },
    noContentSubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
    navigationContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        paddingBottom: 32, // Extra padding for safe area
    },
    navButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        alignItems: 'center',
    },
    disabledNavButton: {
        backgroundColor: '#f0f0f0',
    },
    navButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    disabledNavButtonText: {
        color: '#999',
    },
    progressIndicator: {
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    progressText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
    },
    // Assignment workflow styles
    assignmentSection: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 16,
        marginVertical: 12,
    },
    assignmentSectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    assignmentStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 12,
    },
    assignmentCount: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    continueWorkflowButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    continueWorkflowButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});