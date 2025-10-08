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
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
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
    const [expandedVideoIndex, setExpandedVideoIndex] = useState<number | null>(null);

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

            // Debug: Log resources
            console.log('📦 Block Data:', blockData);
            console.log('🎬 Resources:', blockData.resources);
            console.log('🎬 Resources length:', blockData.resources?.length);
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

    // Start study session for this block (mark-done model: navigate without creating server session)
    const startStudySession = async () => {
        try {
            if (!token || !block) return;
            const localSessionId = Math.floor(Math.random() * 1_000_000);
            navigation.navigate('StudySession', {
                sessionId: localSessionId,
                courseId,
                blockId,
                blockTitle: block.title,
                courseTitle
            });
        } catch (error) {
            console.error('Error opening study session:', error);
            Alert.alert('Error', 'Failed to open study session. Please try again.', [{ text: 'OK' }]);
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
                    <Text style={styles.objectivesTitle}>🎯 Learning Objectives</Text>
                    <Text style={styles.objectivesText}>• {block.learning_objectives.join('\n• ')}</Text>
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

    // Open URL in browser
    const openURL = async (url: string, title: string) => {
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                Alert.alert('Error', `Cannot open URL: ${title}`);
            }
        } catch (error) {
            console.error('Error opening URL:', error);
            Alert.alert('Error', 'Failed to open link');
        }
    };

    // Extract YouTube video ID from URL
    const getYouTubeVideoId = (url: string): string | null => {
        try {
            // Handle various YouTube URL formats
            const patterns = [
                /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
                /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/,
                /(?:https?:\/\/)?youtu\.be\/([^?]+)/,
                /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([^?]+)/
            ];

            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && match[1]) {
                    return match[1];
                }
            }
            return null;
        } catch (error) {
            console.error('Error extracting YouTube ID:', error);
            return null;
        }
    };

    // Toggle video player expansion
    const toggleVideoPlayer = (index: number) => {
        setExpandedVideoIndex(expandedVideoIndex === index ? null : index);
    };

    // Render video resources at the top
    const renderVideoResources = () => {
        console.log('🎬 renderVideoResources called');
        console.log('🎬 block.resources:', block?.resources);

        if (!block.resources || block.resources.length === 0) {
            console.log('❌ No resources found');
            return null;
        }

        const videoResources = block.resources.filter((r: any) => r.type === 'video');
        console.log('🎬 Video resources filtered:', videoResources);
        console.log('🎬 Video resources count:', videoResources.length);

        if (videoResources.length === 0) {
            console.log('❌ No video resources found');
            return null;
        }

        return (
            <View style={styles.resourcesContainer}>
                <Text style={styles.resourcesSectionTitle}>🎥 Video Resources</Text>
                <Text style={styles.resourcesSectionSubtitle}>
                    Watch these videos to learn more about this topic
                </Text>
                {videoResources.map((resource: any, index: number) => {
                    const videoId = getYouTubeVideoId(resource.url);
                    const isExpanded = expandedVideoIndex === index;

                    return (
                        <View key={index} style={styles.videoCard}>
                            {/* Video Header */}
                            <TouchableOpacity
                                style={styles.videoHeader}
                                onPress={() => toggleVideoPlayer(index)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.videoIconContainer}>
                                    <Text style={styles.videoIcon}>
                                        {isExpanded ? '▼' : '▶️'}
                                    </Text>
                                </View>
                                <View style={styles.videoInfo}>
                                    <Text style={styles.videoTitle} numberOfLines={isExpanded ? undefined : 2}>
                                        {resource.title}
                                    </Text>
                                    {resource.search_query && !isExpanded && (
                                        <Text style={styles.videoQuery} numberOfLines={1}>
                                            {resource.search_query}
                                        </Text>
                                    )}
                                </View>
                                <View style={styles.videoToggleContainer}>
                                    <Text style={styles.videoToggleText}>
                                        {isExpanded ? 'Close' : 'Play'}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Embedded Video Player */}
                            {isExpanded && videoId && (
                                <View style={styles.videoPlayerContainer}>
                                    <View style={styles.videoPlayerWrapper}>
                                        <WebView
                                            style={styles.videoPlayer}
                                            source={{
                                                uri: `https://www.youtube.com/embed/${videoId}?autoplay=0&modestbranding=1&rel=0`
                                            }}
                                            allowsFullscreenVideo={true}
                                            mediaPlaybackRequiresUserAction={false}
                                            javaScriptEnabled={true}
                                            domStorageEnabled={true}
                                            scrollEnabled={false}
                                        />
                                    </View>
                                    {resource.search_query && (
                                        <Text style={styles.videoQueryExpanded}>
                                            🔍 {resource.search_query}
                                        </Text>
                                    )}
                                </View>
                            )}

                            {/* Fallback: Open in Browser */}
                            {isExpanded && !videoId && (
                                <View style={styles.videoFallbackContainer}>
                                    <Text style={styles.videoFallbackText}>
                                        Video preview not available
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.videoFallbackButton}
                                        onPress={() => openURL(resource.url, resource.title)}
                                    >
                                        <Text style={styles.videoFallbackButtonText}>
                                            Open in Browser
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>
        );
    };

    // Render article resources at the bottom
    const renderArticleResources = () => {
        console.log('📚 renderArticleResources called');
        console.log('📚 block.resources:', block?.resources);

        if (!block.resources || block.resources.length === 0) {
            console.log('❌ No resources found for articles');
            return null;
        }

        const articleResources = block.resources.filter((r: any) => r.type === 'article');
        console.log('📚 Article resources filtered:', articleResources);
        console.log('📚 Article resources count:', articleResources.length);

        if (articleResources.length === 0) {
            console.log('❌ No article resources found');
            return null;
        }

        return (
            <View style={styles.resourcesContainer}>
                <Text style={styles.resourcesSectionTitle}>📚 Article Resources</Text>
                <Text style={styles.resourcesSectionSubtitle}>
                    Read these articles for deeper understanding
                </Text>
                {articleResources.map((resource: any, index: number) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.resourceCard}
                        onPress={() => openURL(resource.url, resource.title)}
                    >
                        <View style={styles.resourceIconContainer}>
                            <Text style={styles.resourceIcon}>📄</Text>
                        </View>
                        <View style={styles.resourceInfo}>
                            <Text style={styles.resourceTitle} numberOfLines={2}>
                                {resource.title}
                            </Text>
                            {resource.search_query && (
                                <Text style={styles.resourceQuery} numberOfLines={1}>
                                    {resource.search_query}
                                </Text>
                            )}
                        </View>
                        <Text style={styles.resourceArrow}>→</Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

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

    // Render assignment workflow section
    const renderAssignmentWorkflow = () => {
        if (assignments.length === 0) return null;

        return (
            <View style={styles.assignmentSection}>
                <Text style={styles.assignmentSectionTitle}>📝 Assignments for this Block</Text>
                <Text style={styles.assignmentSectionSubtitle}>
                    Complete the assignments below to test your understanding
                </Text>
                <View style={styles.assignmentStats}>
                    <View style={styles.assignmentStatItem}>
                        <Text style={styles.assignmentStatNumber}>
                            {assignments.filter(a => a.status === 'assigned').length}
                        </Text>
                        <Text style={styles.assignmentStatLabel}>Pending</Text>
                    </View>
                    <View style={styles.assignmentStatItem}>
                        <Text style={styles.assignmentStatNumber}>
                            {assignments.filter(a => a.status === 'submitted').length}
                        </Text>
                        <Text style={styles.assignmentStatLabel}>Submitted</Text>
                    </View>
                    <View style={styles.assignmentStatItem}>
                        <Text style={styles.assignmentStatNumber}>
                            {assignments.filter(a => a.status === 'graded').length}
                        </Text>
                        <Text style={styles.assignmentStatLabel}>Graded</Text>
                    </View>
                </View>
                {assignments.some(a => a.status === 'assigned') && (
                    <TouchableOpacity
                        style={styles.continueWorkflowButton}
                        onPress={continueToAssignments}
                    >
                        <Text style={styles.continueWorkflowButtonText}>Continue to Assignments ({assignments.filter(a => a.status === 'assigned').length} pending)</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

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
                {renderVideoResources()}
                {renderBlockContent()}
                {renderArticleResources()}
                {renderAssignmentWorkflow()}
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
        marginBottom: 8,
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
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 16,
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
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginTop: 20,
        marginBottom: 20,
        marginHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    assignmentSectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    assignmentSectionSubtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
    },
    assignmentStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 16,
        paddingVertical: 12,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
    },
    assignmentStatItem: {
        alignItems: 'center',
    },
    assignmentStatNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#007AFF',
        marginBottom: 4,
    },
    assignmentStatLabel: {
        fontSize: 12,
        color: '#666',
        textTransform: 'uppercase',
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
    // Resource styles
    resourcesContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginHorizontal: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    resourcesSectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    resourcesSectionSubtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
    },
    resourceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    resourceIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    resourceIcon: {
        fontSize: 24,
    },
    resourceInfo: {
        flex: 1,
        marginRight: 8,
    },
    resourceTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 4,
        lineHeight: 20,
    },
    resourceQuery: {
        fontSize: 12,
        color: '#666',
        fontStyle: 'italic',
    },
    resourceArrow: {
        fontSize: 20,
        color: '#007AFF',
        fontWeight: 'bold',
    },
    // Video player styles
    videoCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#007AFF',
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
    },
    videoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f8f9fa',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    videoIconContainer: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    videoIcon: {
        fontSize: 24,
    },
    videoInfo: {
        flex: 1,
        marginRight: 8,
    },
    videoTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 4,
        lineHeight: 22,
    },
    videoQuery: {
        fontSize: 12,
        color: '#666',
        fontStyle: 'italic',
    },
    videoToggleContainer: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#007AFF',
        borderRadius: 8,
    },
    videoToggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    videoPlayerContainer: {
        backgroundColor: '#000',
        padding: 12,
    },
    videoPlayerWrapper: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#000',
        borderWidth: 2,
        borderColor: '#007AFF',
    },
    videoPlayer: {
        flex: 1,
        backgroundColor: '#000',
    },
    videoQueryExpanded: {
        fontSize: 13,
        color: '#fff',
        marginTop: 12,
        paddingHorizontal: 4,
        fontStyle: 'italic',
    },
    videoFallbackContainer: {
        padding: 24,
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
    },
    videoFallbackText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 12,
        textAlign: 'center',
    },
    videoFallbackButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#007AFF',
        borderRadius: 8,
    },
    videoFallbackButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});