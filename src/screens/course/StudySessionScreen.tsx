/**
 * Study Session Screen
 * Active study session interface with lesson content, progress tracking, and session controls
 */

import React, { useState, useEffect, useCallback, useRef, ReactNode, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Dimensions,
    Modal,
    Linking,
    Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
    afterSchoolService,
    StudySession,
    CourseLesson,
    CourseBlock,
    CourseWithLessons,
    CourseWithBlocks,
    StudentAssignment
} from '../../services/afterSchoolService';

type NavigationProp = NativeStackNavigationProp<any>;
type RouteProp_ = RouteProp<{
    params: {
        sessionId: number;
        courseId: number;
        lessonId?: number;  // Optional for lesson-based
        blockId?: number;   // Optional for block-based
        lessonTitle?: string;
        blockTitle?: string;
        courseTitle: string;
    }
}>;

interface Props {
    navigation: NavigationProp;
    route: RouteProp_;
}

interface StudySection {
    id: string;
    title: string;
    icon: string;
    content: ReactNode;
}

const { width, height } = Dimensions.get('window');

export const StudySessionScreen: React.FC<Props> = ({ navigation, route }) => {
    const { sessionId, courseId, lessonId, blockId, lessonTitle, blockTitle, courseTitle } = route.params;
    const { token } = useAuth();

    const [session, setSession] = useState<StudySession | null>(null);
    const [lesson, setLesson] = useState<CourseLesson | null>(null);
    const [block, setBlock] = useState<CourseBlock | null>(null);
    const [course, setCourse] = useState<CourseWithLessons | CourseWithBlocks | null>(null);
    const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [markingDone, setMarkingDone] = useState(false);
    const [expandedVideoIndex, setExpandedVideoIndex] = useState<number | null>(null);
    const [isAlreadyCompleted, setIsAlreadyCompleted] = useState(false);
    const [isMenuVisible, setMenuVisible] = useState(false);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

    const scrollViewRef = useRef<ScrollView>(null);

    // Load content data (mark-done model - no session required)
    const loadSessionData = async () => {
        try {
            setLoading(true);

            if (!token) {
                throw new Error('No authentication token available');
            }

            // Load content directly without requiring a session
            if (blockId) {
                // Block-based content
                const [blockData, courseData, assignmentsData] = await Promise.all([
                    afterSchoolService.getCourseBlockDetails(courseId, blockId, token),
                    afterSchoolService.getCourseWithBlocks(courseId, token),
                    afterSchoolService.getCourseAssignments(courseId, token, { block_id: blockId }).catch(() => [])
                ]);
                setBlock(blockData);
                setCourse(courseData);
                setAssignments(assignmentsData);

                // Check completion status for this block
                try {
                    const blocksProgress = await afterSchoolService.getCourseBlocksProgress(courseId, token);
                    const me = (blocksProgress?.blocks || []).find(b => b.block_id === blockId);
                    setIsAlreadyCompleted(!!me?.is_completed);
                } catch (_) {
                    setIsAlreadyCompleted(false);
                }

                // Create a mock session object for UI compatibility
                setSession({
                    id: sessionId,
                    user_id: 0, // Will be filled by backend
                    course_id: courseId,
                    lesson_id: lessonId,
                    block_id: blockId,
                    completion_percentage: 0, // Will be updated by mark-done actions
                    started_at: new Date().toISOString(),
                    status: 'active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            } else if (lessonId) {
                // Lesson-based content
                const [lessonData, courseData] = await Promise.all([
                    afterSchoolService.getLessonDetails(courseId, lessonId, token),
                    afterSchoolService.getCourseDetails(courseId, token)
                ]);
                setLesson(lessonData);
                setCourse(courseData);
                setAssignments([]);

                // Create a mock session object for UI compatibility
                setSession({
                    id: sessionId,
                    user_id: 0, // Will be filled by backend
                    course_id: courseId,
                    lesson_id: lessonId,
                    block_id: blockId,
                    completion_percentage: 0, // Will be updated by mark-done actions
                    started_at: new Date().toISOString(),
                    status: 'active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('Error loading session data:', error);
            Alert.alert(
                'Error',
                'Failed to load study session. Please try again.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } finally {
            setLoading(false);
        }
    };



    // Load data on screen focus
    useFocusEffect(
        useCallback(() => {
            loadSessionData();
        }, [sessionId, token])
    );

    // Handle back button press
    const handleBackPress = () => {
        navigation.goBack();
    };

    // Mark block/lesson as done
    const markAsDone = async () => {
        try {
            setMarkingDone(true);

            if (!token || !blockId) {
                Alert.alert('Error', 'Missing required information to mark as done.');
                return;
            }

            await afterSchoolService.markStudySessionDone(blockId, courseId, token);
            // Immediately reflect completed state
            setIsAlreadyCompleted(true);

            // When leaving this screen, ensure callers can force-refresh
            const refreshTs = Date.now();

            Alert.alert(
                'Success!',
                'You have successfully completed this study session.',
                [
                    {
                        text: 'Continue to Assignments',
                        onPress: () => {
                            continueToAssignments();
                            // Also push a refresh hint for CourseDetails (and Progress if opened next)
                            navigation.navigate('CourseDetails', { courseId, courseTitle, refreshTs });
                        },
                        style: 'default'
                    },
                    {
                        text: 'Back to Course',
                        onPress: () => navigation.navigate('CourseDetails', { courseId, courseTitle, refreshTs }),
                        style: 'default'
                    }
                ]
            );
        } catch (error) {
            console.error('Error marking study session as done:', error);
            Alert.alert(
                'Error',
                'Failed to mark study session as done. Please try again.',
                [{ text: 'OK' }]
            );
        } finally {
            setMarkingDone(false);
        }
    };

    // Navigate to assignment workflow
    const navigateToAssignment = (assignment: StudentAssignment) => {
        navigation.navigate('CourseAssignment', {
            courseId,
            courseTitle,
            assignmentId: assignment.assignment_id,
            assignmentTitle: assignment.assignment?.title || `Assignment ${assignment.assignment_id}`,
            startWorkflow: true  // Automatically start the workflow
        });
    };

    // Continue to assignments after completing session
    const continueToAssignments = () => {
        // Get block-specific pending assignments if we have a blockId
        const blockAssignments = blockId
            ? assignments.filter(a => {
                const assignmentBlockId = a.assignment?.block_id || (a as any).block_id;
                return assignmentBlockId === blockId && a.status === 'assigned';
            })
            : assignments.filter(a => a.status === 'assigned');

        const pendingAssignment = blockAssignments[0];

        if (pendingAssignment) {
            navigateToAssignment(pendingAssignment);
        } else {
            // If no block-specific assignments, navigate to course assignments page
            navigation.navigate('CourseAssignment', {
                courseId,
                courseTitle
            });
        }
    };

    // Mark lesson/block as completed
    const markContentCompleted = () => {
        markAsDone();
    };

    // Format time
    const formatTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

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

    // Render video resources
    const renderVideoResources = () => {
        console.log('🎬 renderVideoResources called (Study Session)');
        console.log('🎬 block.resources:', block?.resources);

        if (!block?.resources || block.resources.length === 0) {
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
                                    <Text style={styles.videoIcon}>🎬</Text>
                                </View>
                                <View style={styles.videoInfo}>
                                    <Text style={styles.videoTitle} numberOfLines={2}>
                                        {resource.title}
                                    </Text>
                                    {resource.search_query && !isExpanded && (
                                        <Text style={styles.videoQuery} numberOfLines={1}>
                                            🔍 {resource.search_query}
                                        </Text>
                                    )}
                                </View>
                                <View style={styles.videoToggleContainer}>
                                    <Text style={styles.videoToggleText}>
                                        {isExpanded ? 'Close' : 'Watch'}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Embedded Video Player */}
                            {isExpanded && videoId && (
                                <View style={styles.videoPlayerContainer}>
                                    <View style={styles.videoPlayerWrapper}>
                                        <WebView
                                            style={styles.videoPlayer}
                                            source={{ uri: `https://www.youtube.com/embed/${videoId}` }}
                                            allowsFullscreenVideo={true}
                                            javaScriptEnabled={true}
                                            domStorageEnabled={true}
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

    // Render article resources
    const renderArticleResources = () => {
        console.log('📚 renderArticleResources called (Study Session)');
        console.log('📚 block.resources:', block?.resources);

        if (!block?.resources || block.resources.length === 0) {
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
                <Text style={styles.resourcesSectionTitle}>� Related Links</Text>
                <Text style={styles.resourcesSectionSubtitle}>
                    Explore these resources for deeper understanding
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

    const relevantAssignments = useMemo(() => {
        if (!assignments || assignments.length === 0) {
            return [];
        }

        if (blockId) {
            return assignments.filter((a) => {
                const assignmentBlockId = a.assignment?.block_id || (a as any).block_id;
                return assignmentBlockId === blockId;
            });
        }

        return assignments;
    }, [assignments, blockId]);

    const renderAssignmentsSection = () => {
        const statusRank: Record<string, number> = {
            assigned: 0,
            in_progress: 1,
            submitted: 2,
            graded: 3,
        };

        const sortedAssignments = [...relevantAssignments].sort((a, b) => {
            const rankA = statusRank[a.status as keyof typeof statusRank] ?? 4;
            const rankB = statusRank[b.status as keyof typeof statusRank] ?? 4;
            return rankA - rankB;
        });

        if (sortedAssignments.length === 0) {
            return (
                <View style={styles.assignmentsCard}>
                    <Text style={styles.assignmentsTitle}>Assignments & Exercises</Text>
                    <Text style={styles.assignmentsSubtitle}>
                        No assignments have been assigned for this section yet. Check back later for new exercises.
                    </Text>
                    <TouchableOpacity
                        style={styles.assignmentsAllButton}
                        onPress={async () => {
                            try {
                                if (!token) throw new Error('No authentication token');
                                const one = await afterSchoolService.getOneAssignment(courseId, token, { block_id: blockId, lesson_id: lessonId, prefer_status: 'assigned' });
                                const pickedId = one?.assignment?.id;
                                if (pickedId) {
                                    navigation.navigate('CourseAssignment', { courseId, courseTitle, assignmentId: pickedId, startWorkflow: true });
                                    return;
                                }
                            } catch (e: any) {
                                // Fallback: open filtered list
                                console.log('ℹ️ getOneAssignment failed, falling back to list:', e?.message || e);
                            }
                            navigation.navigate('CourseAssignment', { courseId, courseTitle, lessonId, blockId });
                        }}
                    >
                        <Text style={styles.assignmentsAllButtonText}>Browse Course Assignments</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.assignmentsCard}>
                <Text style={styles.assignmentsTitle}>Assignments & Exercises</Text>
                <Text style={styles.assignmentsSubtitle}>
                    Use these tasks to practice what you've learned in this section.
                </Text>
                {sortedAssignments.map((assignment) => {
                    const title = assignment.assignment?.title || `Assignment ${assignment.assignment_id}`;
                    const statusLabel = assignment.status?.replace(/_/g, ' ') ?? 'unknown';
                    const isPending = assignment.status === 'assigned';

                    return (
                        <TouchableOpacity
                            key={assignment.assignment_id}
                            style={[styles.assignmentRow, isPending && styles.assignmentRowPending]}
                            onPress={() => navigateToAssignment(assignment)}
                        >
                            <View style={styles.assignmentIconContainer}>
                                <Text style={styles.assignmentIcon}>📝</Text>
                            </View>
                            <View style={styles.assignmentInfo}>
                                <Text style={styles.assignmentTitle}>{title}</Text>
                                <Text style={styles.assignmentStatusText}>
                                    Status: {statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.assignmentAction,
                                    isPending ? styles.assignmentActionPrimary : styles.assignmentActionSecondary,
                                ]}
                            >
                                {isPending ? 'Start' : 'Review'}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
                <TouchableOpacity
                    style={styles.assignmentsAllButton}
                    onPress={() => navigation.navigate('CourseAssignment', { courseId, courseTitle })}
                >
                    <Text style={styles.assignmentsAllButtonText}>View All Assignments</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const sections = useMemo<StudySection[]>(() => {
        const items: StudySection[] = [];

        if (block?.learning_objectives?.length || lesson?.learning_objectives) {
            items.push({
                id: 'learning-objectives',
                title: 'Learning Objectives',
                icon: '🎯',
                content: (
                    <View style={styles.objectivesCard}>
                        <Text style={styles.objectivesTitle}>Learning Objectives</Text>
                        {block?.learning_objectives?.length ? (
                            <Text style={styles.objectivesText}>• {block.learning_objectives.join('\n• ')}</Text>
                        ) : (
                            <Text style={styles.objectivesText}>{lesson?.learning_objectives}</Text>
                        )}
                    </View>
                )
            });
        }

        items.push({
            id: 'course-content',
            title: block ? 'Block Content' : 'Lesson Content',
            icon: '📘',
            content: (
                <View style={styles.lessonContentCard}>
                    <Text style={styles.lessonContentTitle}>
                        {block ? 'Block Content' : 'Lesson Content'}
                    </Text>
                    {(block?.content || lesson?.content) ? (
                        <Text style={styles.lessonContentText}>
                            {block?.content || lesson?.content}
                        </Text>
                    ) : (
                        <View style={styles.noContentContainer}>
                            <Text style={styles.noContentText}>No content available</Text>
                            <Text style={styles.noContentSubtext}>
                                Content for this {block ? 'block' : 'lesson'} will be added soon
                            </Text>
                        </View>
                    )}
                </View>
            )
        });

        const videoSection = renderVideoResources();
        if (videoSection) {
            items.push({
                id: 'video-resources',
                title: 'Video Resources',
                icon: '🎥',
                content: videoSection
            });
        }

        const linksSection = renderArticleResources();
        if (linksSection) {
            items.push({
                id: 'related-links',
                title: 'Related Links',
                icon: '🔗',
                content: linksSection
            });
        }

        items.push({
            id: 'assignments',
            title: 'Assignments & Exercises',
            icon: '📝',
            content: renderAssignmentsSection()
        });

        items.push({
            id: 'study-tips',
            title: 'Study Tips',
            icon: '💡',
            content: (
                <View style={styles.tipsCard}>
                    <Text style={styles.tipsTitle}>Study Tips</Text>
                    <Text style={styles.tipsText}>
                        • Take notes while studying{'\n'}
                        • Ask questions if you don't understand{'\n'}
                        • Practice what you learn{'\n'}
                        • Take breaks when needed{'\n'}
                        • Review the material after completing
                    </Text>
                </View>
            )
        });

        return items;
    }, [block, lesson, expandedVideoIndex, relevantAssignments]);

    useEffect(() => {
        if (sections.length === 0) {
            if (activeSectionId !== null) {
                setActiveSectionId(null);
            }
            return;
        }

        if (!activeSectionId || !sections.some(section => section.id === activeSectionId)) {
            setActiveSectionId(sections[0].id);
        }
    }, [sections, activeSectionId]);

    useEffect(() => {
        if (!activeSectionId) {
            return;
        }

        requestAnimationFrame(() => {
            scrollViewRef.current?.scrollTo({ y: 0, animated: false });
        });
    }, [activeSectionId]);

    // Render loading state
    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading study session...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!session || (!lesson && !block)) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Session not found</Text>
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

    // Render session header
    const renderSessionHeader = () => {
        const primaryTitle = blockTitle || lessonTitle || 'Study Session';

        return (
            <View style={styles.sessionHeader}>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.backIconButton}
                        onPress={handleBackPress}
                    >
                        <Ionicons name="chevron-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.menuIconButton}
                        onPress={() => setMenuVisible(true)}
                    >
                        <Ionicons name="menu" size={24} color="#333" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    // Render session footer (simplified)
    const renderSessionFooter = () => (
        <View style={styles.sessionFooter}>
            {/* Session Info */}
            <View style={styles.footerSessionInfo}>
                <View style={styles.footerTitleRow}>
                    <Text style={styles.footerSessionTitle} numberOfLines={1}>
                        {blockTitle || lessonTitle}
                    </Text>
                </View>
                <Text style={styles.footerSessionSubtitle} numberOfLines={1}>{courseTitle}</Text>
                {assignments.length > 0 && (
                    <Text style={styles.footerAssignmentIndicator}>
                        {assignments.filter(a => a.status === 'assigned').length} assignments pending
                    </Text>
                )}
            </View>

            {/* Mark as Done Button */}
            <View style={styles.sessionControls}>
                <TouchableOpacity
                    style={[
                        styles.controlButton,
                        styles.completeButton,
                        isAlreadyCompleted && { backgroundColor: '#10B981' }
                    ]}
                    onPress={markContentCompleted}
                    disabled={markingDone || isAlreadyCompleted}
                >
                    {isAlreadyCompleted ? (
                        <Text style={styles.controlButtonText}>Done</Text>
                    ) : markingDone ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.controlButtonText}>Mark as Done</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Workflow Integration */}
            {assignments.length > 0 && (() => {
                const blockAssignments = blockId
                    ? assignments.filter(a => {
                        const assignmentBlockId = a.assignment?.block_id || (a as any).block_id;
                        return assignmentBlockId === blockId && a.status === 'assigned';
                    })
                    : assignments.filter(a => a.status === 'assigned');

                if (blockAssignments.length === 0) return null;

                return (
                    <View style={styles.workflowSection}>
                        <Text style={styles.workflowTitle}>Ready for Assignments</Text>
                        <TouchableOpacity
                            style={styles.workflowButton}
                            onPress={continueToAssignments}
                        >
                            <Text style={styles.workflowButtonText}>
                                Continue to Assignment{blockAssignments.length > 1 ? 's' : ''} ({blockAssignments.length} pending)
                            </Text>
                        </TouchableOpacity>
                    </View>
                );
            })()}
        </View>
    );

    // Render content (lesson or block) with paginated sections
    const renderContentBody = () => {
        if (sections.length === 0) {
            return (
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.contentScrollView}
                    contentContainerStyle={styles.emptyStateContainer}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.emptyStateCard}>
                        <Text style={styles.emptyStateTitle}>Content coming soon</Text>
                        <Text style={styles.emptyStateSubtitle}>
                            We're still preparing materials for this study session. Please check back later.
                        </Text>
                    </View>
                </ScrollView>
            );
        }

        const activeSection =
            sections.find(section => section.id === activeSectionId) ?? sections[0];
        const currentIndex = sections.findIndex(section => section.id === activeSection.id);
        const previousSection = currentIndex > 0 ? sections[currentIndex - 1] : null;
        const nextSection = currentIndex < sections.length - 1 ? sections[currentIndex + 1] : null;

        return (
            <ScrollView
                ref={scrollViewRef}
                style={styles.contentScrollView}
                contentContainerStyle={styles.pagedContentContainer}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.sectionIntroCard}>
                    <Text style={styles.sectionIntroBadge}>
                        {currentIndex + 1} of {sections.length}
                    </Text>
                    <Text style={styles.sectionIntroTitle}>
                        {activeSection.icon} {activeSection.title}
                    </Text>
                </View>
                {activeSection.content}
                <View style={styles.sectionPagerControls}>
                    {previousSection ? (
                        <TouchableOpacity
                            style={[styles.pagerButton, styles.pagerButtonSecondary]}
                            onPress={() => setActiveSectionId(previousSection.id)}
                        >
                            <Text style={styles.pagerButtonText}>
                                ← {previousSection.title}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.pagerButtonSpacer} />
                    )}
                    {nextSection ? (
                        <TouchableOpacity
                            style={[styles.pagerButton, styles.pagerButtonPrimary]}
                            onPress={() => setActiveSectionId(nextSection.id)}
                        >
                            <Text style={[styles.pagerButtonText, styles.pagerButtonTextPrimary]}>
                                {nextSection.title} →
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.pagerButtonSpacer} />
                    )}
                </View>
                <View style={{ height: 80 }} />
            </ScrollView>
        );
    };



    return (
        <SafeAreaView style={styles.container}>
            <Modal
                visible={isMenuVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
            >
                <View style={styles.menuOverlay}>
                    <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)} />
                    <View style={styles.sideMenuContainer}>
                        <View style={styles.sideMenuHeader}>
                            <TouchableOpacity onPress={() => setMenuVisible(false)}>
                                <Text style={styles.sideMenuClose}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.sideMenuCourseInfo}>
                            <Text style={styles.sideMenuCourseTitle} numberOfLines={1}>{courseTitle}</Text>
                            <Text style={styles.sideMenuLessonTitle} numberOfLines={2}>{blockTitle || lessonTitle}</Text>
                        </View>
                        <Text style={styles.sideMenuSectionTitle}>Course Outline</Text>
                        <View style={styles.sideMenuItemsWrapper}>
                            {sections.map((section, index) => {
                                const isActive = section.id === activeSectionId;
                                const isLast = index === sections.length - 1;
                                return (
                                    <TouchableOpacity
                                        key={section.id}
                                        style={[styles.sideMenuItem, isActive && styles.sideMenuItemActive]}
                                        onPress={() => {
                                            setActiveSectionId(section.id);
                                            setMenuVisible(false);
                                        }}
                                    >
                                        <View style={styles.sideMenuConnectorColumn}>
                                            <View style={[styles.sideMenuConnectorLine, isLast && styles.sideMenuConnectorLineHidden]} />
                                            <View style={[styles.sideMenuConnectorDot, isActive && styles.sideMenuConnectorDotActive]} />
                                        </View>
                                        <Text style={styles.sideMenuItemIndex}>{index + 1}.</Text>
                                        <View style={styles.sideMenuItemContent}>
                                            <Text
                                                style={[styles.sideMenuItemText, isActive && styles.sideMenuItemTextActive]}
                                                numberOfLines={1}
                                            >
                                                {section.icon} {section.title}
                                            </Text>
                                            {isActive && (
                                                <Text style={styles.sideMenuItemHint}>Currently viewing</Text>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                            {sections.length === 0 && (
                                <View style={styles.sideMenuEmptyState}>
                                    <Text style={styles.sideMenuEmptyStateText}>No sections available yet.</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
            {renderSessionHeader()}
            {renderContentBody()}
            {renderSessionFooter()}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
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
    sessionHeader: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    backIconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8F9FC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuIconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8F9FC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Footer styles (moved from header) - Minimized to 1/3 size
    sessionFooter: {
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingTop: 6,
        paddingBottom: 8,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 3,
    },
    footerSessionInfo: {
        marginBottom: 6,
    },
    footerTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 2,
    },
    footerSessionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1a1a1a',
        flex: 1,
        marginRight: 8,
    },
    footerSessionSubtitle: {
        fontSize: 10,
        color: '#999',
        marginBottom: 2,
    },
    footerAssignmentIndicator: {
        fontSize: 9,
        color: '#007AFF',
        fontWeight: '600',
        backgroundColor: '#E3F2FD',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginTop: 2,
    },
    sessionInfo: {
        flex: 1,
        marginRight: 16,
    },
    sessionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    sessionSubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    sessionTimer: {
        alignItems: 'center',
    },
    timerText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 2,
    },
    statusIndicator: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    progressBar: {
        flex: 1,
        height: 4,
        backgroundColor: '#e0e0e0',
        borderRadius: 2,
        marginRight: 6,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#007AFF',
        borderRadius: 2,
    },
    progressText: {
        fontSize: 11,
        color: '#1a1a1a',
        fontWeight: '600',
        minWidth: 30,
    },
    sessionControls: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 0,
    },
    controlButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    pauseButton: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#dee2e6',
    },
    progressButton: {
        backgroundColor: '#007AFF',
    },
    completeButton: {
        backgroundColor: '#28a745',
    },
    controlButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    pauseButtonText: {
        color: '#333',
    },
    contentScrollView: {
        flex: 1,
    },
    contentContainer: {
        padding: 20,
    },
    objectivesCard: {
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
    lessonContentCard: {
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
    lessonContentTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 12,
    },
    lessonContentText: {
        fontSize: 16,
        color: '#333',
        lineHeight: 24,
    },
    noContentContainer: {
        alignItems: 'center',
        paddingVertical: 40,
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
    tipsCard: {
        backgroundColor: '#e3f2fd',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    tipsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1976d2',
        marginBottom: 8,
    },
    tipsText: {
        fontSize: 14,
        color: '#1565c0',
        lineHeight: 20,
    },
    emptyStateContainer: {
        flexGrow: 1,
        padding: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyStateCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 8,
    },
    emptyStateSubtitle: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 20,
    },
    pagedContentContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    sectionIntroCard: {
        backgroundColor: '#DBEAFE',
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
    },
    sectionIntroBadge: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1D4ED8',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    sectionIntroTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1E3A8A',
    },
    sectionPagerControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 24,
        gap: 12,
    },
    pagerButton: {
        flex: 1,
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    pagerButtonSecondary: {
        backgroundColor: '#F1F5F9',
    },
    pagerButtonPrimary: {
        backgroundColor: '#2563EB',
    },
    pagerButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E3A8A',
    },
    pagerButtonTextPrimary: {
        color: '#fff',
    },
    pagerButtonSpacer: {
        flex: 1,
    },
    assignmentsCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
    },
    assignmentsTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 6,
    },
    assignmentsSubtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 16,
        lineHeight: 20,
    },
    assignmentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        marginBottom: 10,
    },
    assignmentRowPending: {
        backgroundColor: '#E0F2FE',
        borderWidth: 1,
        borderColor: '#38BDF8',
    },
    assignmentIconContainer: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#DBEAFE',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    assignmentIcon: {
        fontSize: 20,
    },
    assignmentInfo: {
        flex: 1,
    },
    assignmentTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 4,
    },
    assignmentStatusText: {
        fontSize: 12,
        color: '#6b7280',
        textTransform: 'capitalize',
    },
    assignmentAction: {
        fontSize: 13,
        fontWeight: '600',
    },
    assignmentActionPrimary: {
        color: '#2563EB',
    },
    assignmentActionSecondary: {
        color: '#64748B',
    },
    assignmentsAllButton: {
        marginTop: 8,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#1D4ED8',
        alignItems: 'center',
    },
    assignmentsAllButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    menuOverlay: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15, 23, 42, 0.35)',
    },
    menuBackdrop: {
        flex: 1,
    },
    sideMenuContainer: {
        width: Math.min(width * 0.78, 340),
        height: height * 0.6, // Half height
        backgroundColor: '#dee6ffff', // Purple theme color
        paddingVertical: 24,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 8,
        borderTopLeftRadius: 20,
        borderBottomLeftRadius: 20,
        paddingTop: 15,
        marginTop: height * 0.06,// Center vertically
    },
    sideMenuHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end', // Align close button to right
        alignItems: 'center',
        marginBottom: 16,
    },
    sideMenuClose: {
        fontSize: 25,
        color: '#070707ff', // White text for purple background
        padding: 4,
    },
    sideMenuCourseInfo: {
        marginBottom: 24,
    },
    sideMenuCourseTitle: {
        fontSize: 14,
        color: '#000000ff', // Light purple text
        marginBottom: 4,
    },
    sideMenuLessonTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000000ff', // White text for purple background
    },
    sideMenuSectionTitle: {
        fontSize: 13,
        color: '#000000ff', // Light purple text
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 12,
    },
    sideMenuItemsWrapper: {
        paddingBottom: 16,
    },
    sideMenuItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 8,
    },
    sideMenuItemActive: {
        backgroundColor: '#EEF2FF',
    },
    sideMenuItemIndex: {
        width: 24,
        fontSize: 14,
        fontWeight: '600',
        color: '#6366F1',
    },
    sideMenuItemContent: {
        flex: 1,
    },
    sideMenuItemText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1f2937',
    },
    sideMenuItemTextActive: {
        color: '#4338CA',
    },
    sideMenuItemHint: {
        marginTop: 4,
        fontSize: 12,
        color: '#6366F1',
    },
    sideMenuEmptyState: {
        paddingVertical: 24,
    },
    sideMenuEmptyStateText: {
        fontSize: 14,
        color: '#6b7280',
    },
    sideMenuConnectorColumn: {
        width: 18,
        alignItems: 'center',
        marginRight: 8,
    },
    sideMenuConnectorLine: {
        flex: 1,
        width: 2,
        backgroundColor: '#E5E7EB',
    },
    sideMenuConnectorLineHidden: {
        opacity: 0,
    },
    sideMenuConnectorDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#CBD5F5',
        marginTop: 4,
    },
    sideMenuConnectorDotActive: {
        backgroundColor: '#4338CA',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
        textAlign: 'center',
        marginBottom: 12,
    },
    modalMessage: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    modalButtons: {
        gap: 12,
    },
    modalButton: {
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#dee2e6',
    },
    abandonButton: {
        backgroundColor: '#6c757d',
        borderColor: '#6c757d',
    },
    completeButtonModal: {
        backgroundColor: '#28a745',
        borderColor: '#28a745',
    },
    modalButtonText: {
        fontSize: 16,
        color: '#495057',
        fontWeight: '600',
    },
    modalButtonTextWhite: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
    assignmentIndicator: {
        backgroundColor: '#FFF3CD',
        padding: 12,
        borderRadius: 8,
        marginVertical: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#FFC107',
    },
    workflowSection: {
        backgroundColor: '#F8F9FA',
        padding: 8,
        borderRadius: 8,
        marginTop: 6,
        borderWidth: 1,
        borderColor: '#DEE2E6',
    },
    workflowTitle: {
        fontSize: 10,
        fontWeight: '600',
        color: '#666',
        marginBottom: 4,
    },
    workflowButton: {
        backgroundColor: '#007bff',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        alignItems: 'center',
    },
    workflowButtonText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
    // Resource styles
    resourcesContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
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