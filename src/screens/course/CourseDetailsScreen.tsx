/**
 * Course Details Screen
 * Shows comprehensive course information, lessons, progress, and actions
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
    afterSchoolService,
    CourseWithLessons,
    CourseLesson,
    StudentProgress,
    CourseBlock,
    StudentAssignment,
    UnifiedCourse,
    CourseAssignment
} from '../../services/afterSchoolService';
import { gradesService } from '../../services/gradesService';

type NavigationProp = NativeStackNavigationProp<any>;
type RouteProp_ = RouteProp<{ params: { courseId: number; courseTitle: string } }>;

interface Props {
    navigation: NavigationProp;
    route: RouteProp_;
}

const { width } = Dimensions.get('window');

export const CourseDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
    const { courseId, courseTitle } = route.params;
    const { token } = useAuth();

    const [course, setCourse] = useState<UnifiedCourse | null>(null);
    const [blocks, setBlocks] = useState<CourseBlock[]>([]);
    const [progress, setProgress] = useState<StudentProgress | null>(null);
    const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
    const [rawAssignments, setRawAssignments] = useState<CourseAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingAssignments, setLoadingAssignments] = useState(false);
    const [enrolling, setEnrolling] = useState(false);
    const [isEnrolled, setIsEnrolled] = useState(false); // explicit enrollment UI flag
    const [activeTab, setActiveTab] = useState<'lessons' | 'progress' | 'assignments'>('lessons');
    const [activeLessonSessions, setActiveLessonSessions] = useState<Record<number, { id: number, status: string }>>({}); // lessonId -> {sessionId, status}
    const [activeBlockSessions, setActiveBlockSessions] = useState<Record<number, { id: number, status: string }>>({}); // blockId -> {sessionId, status}
    const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({}); // weekNumber -> isExpanded
    const [selectedWeek, setSelectedWeek] = useState<number>(1); // For horizontal week selection

    // Load course data
    const inFlightRef = React.useRef<Promise<void> | null>(null);
    const refreshTsRef = useRef<number | undefined>(undefined);

    const loadCourseData = async (isRefresh: boolean = false) => {
        try {
            if (!isRefresh) setLoading(true);

            if (!token) {
                throw new Error('No authentication token available');
            }
            if (inFlightRef.current) {
                return; // prevent duplicate load
            }
            inFlightRef.current = (async () => {
                // Load unified course & progress in parallel
                const [courseData, progressData] = await Promise.all([
                    afterSchoolService.getUnifiedCourse(courseId, token, {
                        include_stats: true,
                        include_progress: true
                    }),
                    afterSchoolService.getStudentProgress(courseId, token).catch(() => null)
                ]);

                setCourse(courseData);
                const blocksArray = Array.isArray(courseData.blocks) ? courseData.blocks : [];
                setBlocks(blocksArray);

                // Initialize selectedWeek with the first week if not already set
                if (blocksArray.length > 0 && !selectedWeek) {
                    const firstWeek = Math.min(...blocksArray.map(b => b.week || 1));
                    setSelectedWeek(firstWeek);
                }

                setProgress(progressData);
                // NOTE: Do NOT set isEnrolled based on progress data alone - progress can exist for non-enrolled users
                // Enrollment should only be determined by StudentAssignment presence (checked in loadAssignments)
                try {
                    await detectActiveSessions(courseData, progressData);
                } catch (e) {
                    console.warn('Active session detection skipped', e);
                }
                // Lightweight enrollment detection: if user has any assignments for this course, consider enrolled
                try {
                    const myAssignments = await afterSchoolService.getMyAssignments(token, { course_id: courseId, limit: 1 });
                    if (Array.isArray(myAssignments) && myAssignments.length > 0) {
                        setIsEnrolled(true);
                    } else {
                        setIsEnrolled(false);
                    }
                } catch (e) {
                    // If this check fails, do not assume enrollment
                    setIsEnrolled(false);
                }
            })();
            await inFlightRef.current;
        } catch (error) {
            console.error('Error loading course data:', error);
            Alert.alert(
                'Error',
                'Failed to load course details. Please try again.',
                [{ text: 'OK' }]
            );
        } finally {
            setLoading(false);
            if (isRefresh) setRefreshing(false);
            inFlightRef.current = null;
        }
    };

    // Load assignments for the course
    const loadAssignments = async () => {
        if (!token) return;

        try {
            setLoadingAssignments(true);
            const [studentSpecific, definitions] = await Promise.all([
                afterSchoolService.getCourseAssignments(courseId, token).catch(() => []),
                afterSchoolService.getCourseAssignmentDefinitions(courseId, token).catch(() => [])
            ]);
            setAssignments(studentSpecific);
            setRawAssignments(definitions);
            if (studentSpecific.length > 0) setIsEnrolled(true);
        } catch (error) {
            console.error('Error loading assignments:', error);
        } finally {
            setLoadingAssignments(false);
        }
    };

    // Enroll in course
    const handleEnroll = async () => {
        if (!token) return;
        if (enrolling) return;
        // If we already have progress or assignments, assume enrolled
        if (isEnrolled || assignments.length > 0) return;
        try {
            setEnrolling(true);
            const res = await afterSchoolService.enrollInCourse(courseId, token);
            Alert.alert('Enrollment', res?.message || 'You have been enrolled in this course.');
            // Immediately reflect enrollment before heavy reloads
            setIsEnrolled(true);
            await Promise.all([
                loadCourseData(true),
                loadAssignments(),
            ]);
            setActiveTab('assignments');
        } catch (e: any) {
            const msg = (e && e.message) || 'Failed to enroll in this course. Please try again.';
            if (msg.toLowerCase().includes('already enrolled')) {
                // Force a refresh anyway
                setIsEnrolled(true);
                await Promise.all([loadCourseData(true), loadAssignments()]);
            } else {
                Alert.alert('Error', msg);
            }
        } finally {
            setEnrolling(false);
        }
    };

    // Load data on screen focus
    useFocusEffect(
        useCallback(() => {
            loadCourseData();
        }, [courseId, token])
    );

    // Force refresh if caller sets a new refreshTs param
    useEffect(() => {
        const ts = (route.params as any)?.refreshTs as number | undefined;
        if (ts && ts !== refreshTsRef.current) {
            refreshTsRef.current = ts;
            loadCourseData(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [route.params]);

    // Load assignments when assignments tab is activated
    const onTabChange = (tab: 'lessons' | 'progress' | 'assignments') => {
        setActiveTab(tab);
        if (tab === 'assignments' && assignments.length === 0) {
            loadAssignments();
        }
    };

    // Detect active sessions for lessons & blocks
    const detectActiveSessions = async (courseData?: UnifiedCourse | null, progressData?: StudentProgress | null) => {
        if (!token) return;
        const targetCourse = courseData || course;
        if (!targetCourse) return;
        try {
            const lessonMap: Record<number, { id: number, status: string }> = {};
            const blockMap: Record<number, { id: number, status: string }> = {};

            // Derive lesson completion from progress if available
            if (progressData && Array.isArray(targetCourse.lessons)) {
                const completedCount = Math.max(0, progressData.lessons_completed || 0);
                const sortedLessons = [...targetCourse.lessons].sort((a, b) => a.order_index - b.order_index);
                sortedLessons.forEach((lesson, idx) => {
                    if (idx < completedCount) {
                        lessonMap[lesson.id] = { id: lesson.id, status: 'completed' };
                    }
                });
            }

            // Derive block completion from blocks progress endpoint (grades service)
            try {
                const blocksProgress = await afterSchoolService.getCourseBlocksProgress(targetCourse.id, token);
                const completedBlocks = (blocksProgress?.blocks || []).filter(b => b.is_completed);
                completedBlocks.forEach(b => {
                    blockMap[b.block_id] = { id: b.block_id, status: 'completed' };
                });
            } catch (e) {
                // If blocks progress not available, skip silently
            }

            setActiveLessonSessions(lessonMap);
            setActiveBlockSessions(blockMap);
        } catch (e) {
            console.warn('detectActiveSessions error', e);
        }
    };

    // Pull to refresh
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadCourseData(true);
    }, []);

    // Navigate to lesson
    const navigateToLesson = (lesson: CourseLesson) => {
        navigation.navigate('LessonView', {
            courseId,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            courseTitle
        });
    };

    // Start study session (mark-done model: navigate without creating server session)
    const startStudySession = async (lesson: CourseLesson) => {
        try {
            if (!token) return;
            const localSessionId = activeLessonSessions[lesson.id]?.id || Math.floor(Math.random() * 1_000_000);
            if (!activeLessonSessions[lesson.id]) {
                setActiveLessonSessions(prev => ({ ...prev, [lesson.id]: { id: localSessionId, status: 'in_progress' } }));
            }
            navigation.navigate('StudySession', {
                sessionId: localSessionId,
                courseId,
                lessonId: lesson.id,
                lessonTitle: lesson.title,
                courseTitle
            });
        } catch (error) {
            console.error('Error navigating to study session:', error);
            Alert.alert('Error', 'Failed to open study session. Please try again.', [{ text: 'OK' }]);
        }
    };

    // Navigate to assignments
    const navigateToAssignments = () => {
        navigation.navigate('CourseAssignments', {
            courseId,
            courseTitle
        });
    };

    // Navigate to progress details
    const navigateToProgress = () => {
        navigation.navigate('CourseProgress', {
            courseId,
            courseTitle
        });
    };

    // Navigate to assignment workflow
    const resolveAssignmentDefinition = useCallback(
        (assignment: StudentAssignment): CourseAssignment | undefined => {
            if (assignment?.assignment) {
                return assignment.assignment as CourseAssignment;
            }
            return rawAssignments.find(def => def.id === assignment.assignment_id);
        },
        [rawAssignments]
    );

    const getAssignmentTitle = useCallback(
        (assignment: StudentAssignment): string => {
            const meta = resolveAssignmentDefinition(assignment);
            if (meta?.title) {
                return meta.title;
            }
            return `Assignment #${assignment.assignment_id}`;
        },
        [resolveAssignmentDefinition]
    );

    const getAssignmentDescription = useCallback(
        (assignment: StudentAssignment): string | undefined => {
            const meta = resolveAssignmentDefinition(assignment);
            return meta?.description || undefined;
        },
        [resolveAssignmentDefinition]
    );

    const getAssignmentDuration = useCallback(
        (assignment: StudentAssignment): number | undefined => {
            const meta = resolveAssignmentDefinition(assignment);
            return meta?.duration_minutes ?? undefined;
        },
        [resolveAssignmentDefinition]
    );

    const navigateToAssignment = (assignment: StudentAssignment) => {
        navigation.navigate('CourseAssignment', {
            courseId,
            assignmentId: assignment.assignment_id,
            assignmentTitle: getAssignmentTitle(assignment),
            courseTitle
        });
    };

    // Start assignment workflow directly
    const startAssignmentWorkflow = (assignment: StudentAssignment) => {
        navigation.navigate('CourseAssignment', {
            courseId,
            assignmentId: assignment.assignment_id,
            assignmentTitle: getAssignmentTitle(assignment),
            courseTitle,
            startWorkflow: true
        });
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

    // Render loading state
    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.courseHeaderContainer}>
                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            style={styles.backIconButton}
                            onPress={() => navigation.goBack()}
                        >
                            <Ionicons name="chevron-back" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#7B68EE" />
                    <Text style={styles.loadingText}>Loading course details...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!course) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.courseHeaderContainer}>
                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            style={styles.backIconButton}
                            onPress={() => navigation.goBack()}
                        >
                            <Ionicons name="chevron-back" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.newCourseTitle}>Course Not Found</Text>
                </View>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Course not found</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => loadCourseData()}
                    >
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // Render course header
    const renderCourseHeader = () => (
        <View style={styles.courseHeaderContainer}>
            {/* Back Button Only */}
            <View style={styles.headerActions}>
                <TouchableOpacity
                    style={styles.backIconButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="chevron-back" size={24} color="#333" />
                </TouchableOpacity>
            </View>

            {/* Course Title */}
            <Text style={styles.newCourseTitle}>{course.title}</Text>

            {/* Course Subtitle/Description */}
            <Text style={styles.courseSubtitle}>
                {typeof course.description === 'string' && course.description.trim().length > 0
                    ? course.description
                    : `Learn ${course.subject} with interactive lessons and assignments`}
            </Text>

            {/* Course Tags */}
            <View style={styles.courseTags}>
                <View style={styles.difficultyTag}>
                    <Text style={styles.tagText}>
                        {course.difficulty_level.charAt(0).toUpperCase() + course.difficulty_level.slice(1)}
                    </Text>
                </View>
                <View style={styles.ageTag}>
                    <Text style={styles.tagText}>
                        {course.age_min}-{course.age_max} years
                    </Text>
                </View>
            </View>

            {/* Course Image - Display actual image if available, otherwise placeholder */}
            <View style={styles.courseImageContainer}>
                {course?.image ? (
                    <Image
                        source={{ uri: `data:image/jpeg;base64,${course.image}` }}
                        style={styles.courseImagePlaceholder}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[styles.courseImagePlaceholder, { backgroundColor: '#7B68EE' }]}>
                        <Ionicons name="library" size={60} color="#FFFFFF" />
                    </View>
                )}
            </View>

            {/* Enroll Button */}
            <View style={styles.enrollSection}>
                {isEnrolled || assignments.length > 0 ? (
                    <TouchableOpacity style={styles.enrolledButton}>
                        <Text style={styles.enrolledButtonText}>Enrolled</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={handleEnroll}
                        disabled={enrolling}
                        style={[styles.enrollNowButton, enrolling && { opacity: 0.7 }]}
                    >
                        <Text style={styles.enrollNowButtonText}>
                            {enrolling ? 'Enrolling…' : 'Enroll'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    // Render tab navigation
    const hasLessons = !!course.lessons?.length;
    const hasBlocks = blocks.length > 0;

    const renderTabNavigation = () => (
        <View style={styles.modernTabContainer}>
            <TouchableOpacity
                style={[styles.modernTab, activeTab === 'lessons' && styles.modernTabActive]}
                onPress={() => onTabChange('lessons')}
            >
                <Text numberOfLines={1} style={[styles.modernTabText, activeTab === 'lessons' && styles.modernTabTextActive]}>
                    {hasLessons ? 'Chapters' : hasBlocks ? 'Modules' : 'Chapters'}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.modernTab, activeTab === 'assignments' && styles.modernTabActive]}
                onPress={() => onTabChange('assignments')}
            >
                <Text numberOfLines={1} style={[styles.modernTabText, activeTab === 'assignments' && styles.modernTabTextActive]}>
                    Assignments
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.modernTab, activeTab === 'progress' && styles.modernTabActive]}
                onPress={() => onTabChange('progress')}
            >
                <Text numberOfLines={1} style={[styles.modernTabText, activeTab === 'progress' && styles.modernTabTextActive]}>
                    Progress
                </Text>
            </TouchableOpacity>
        </View>
    );

    // Render lesson card
    const renderLessonCard = (lesson: CourseLesson, index: number) => {
        const isCompleted = progress ? index < progress.lessons_completed : false;
        const isAvailable = progress ? index <= progress.lessons_completed : index === 0;

        return (
            <View style={[styles.lessonCard, !isAvailable && styles.lockedLessonCard]}>
                <View style={styles.lessonHeader}>
                    <View style={styles.lessonInfo}>
                        <Text style={styles.lessonOrder}>Lesson {lesson.order_index}</Text>
                        <Text style={[styles.lessonTitle, !isAvailable && styles.disabledText]}>
                            {lesson.title}
                        </Text>
                        <Text style={[styles.lessonDuration, !isAvailable && styles.disabledText]}>
                            {formatDuration(lesson.estimated_duration)}
                        </Text>
                        {typeof lesson.learning_objectives === 'string' && lesson.learning_objectives.trim().length > 0 && (
                            <Text style={[styles.lessonObjectives, !isAvailable && styles.disabledText]} numberOfLines={2}>
                                {lesson.learning_objectives}
                            </Text>
                        )}
                    </View>
                    <View style={styles.lessonActions}>
                        {isCompleted && (
                            <View style={styles.completedBadge}>
                                <Text style={styles.completedBadgeText}>✓</Text>
                            </View>
                        )}
                        {!isAvailable && (
                            <View style={styles.lockedBadge}>
                                <Text style={styles.lockedBadgeText}>🔒</Text>
                            </View>
                        )}
                    </View>
                </View>

                {isAvailable && (
                    <View style={styles.lessonButtonContainer}>
                        <TouchableOpacity
                            style={styles.viewLessonButton}
                            onPress={() => navigateToLesson(lesson)}
                        >
                            <Text style={styles.viewLessonButtonText}>View Lesson</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.startStudyButton}
                            onPress={() => startStudySession(lesson)}
                        >
                            <Text style={styles.startStudyButtonText}>
                                {activeLessonSessions[lesson.id]
                                    ? activeLessonSessions[lesson.id].status === 'completed'
                                        ? 'Review Session'
                                        : 'Continue Session'
                                    : 'Start Study'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    // Render lessons tab content
    // Toggle week expansion
    const toggleWeek = (weekNumber: number) => {
        setExpandedWeeks(prev => ({
            ...prev,
            [weekNumber]: !prev[weekNumber]
        }));
    };

    // Group blocks by week
    const getBlocksByWeek = () => {
        const blocksByWeek: Record<number, CourseBlock[]> = {};
        blocks.forEach(block => {
            if (!blocksByWeek[block.week]) {
                blocksByWeek[block.week] = [];
            }
            blocksByWeek[block.week].push(block);
        });
        // Sort blocks within each week
        Object.keys(blocksByWeek).forEach(week => {
            blocksByWeek[Number(week)].sort((a, b) => a.block_number - b.block_number);
        });
        return blocksByWeek;
    };

    const renderLessonsContent = () => {
        // If lessons exist, show them
        if (hasLessons) {
            return (
                <View style={styles.contentContainer}>
                    {course.lessons
                        .sort((a, b) => a.order_index - b.order_index)
                        .map((lesson, index) => (
                            <View key={`lesson-${lesson.id}`}>
                                {renderLessonCard(lesson, index)}
                            </View>
                        ))}
                </View>
            );
        }

        // Fallback: show blocks organized by weeks with horizontal scrolling
        if (hasBlocks) {
            const blocksByWeek = getBlocksByWeek();
            const weeks = Object.keys(blocksByWeek).map(Number).sort((a, b) => a - b);
            const currentSelectedWeek = selectedWeek || weeks[0] || 1;
            const selectedWeekBlocks = blocksByWeek[currentSelectedWeek] || [];

            return (
                <View style={styles.contentContainer}>
                    {/* Horizontal Week Selector */}
                    <View style={styles.horizontalWeekContainer}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.weekScrollContent}
                        >
                            {weeks.map(weekNumber => {
                                const weekBlocks = blocksByWeek[weekNumber];
                                const completedBlocks = weekBlocks.filter(b =>
                                    activeBlockSessions[b.id]?.status === 'completed'
                                ).length;
                                const totalBlocks = weekBlocks.length;
                                const isSelected = currentSelectedWeek === weekNumber;
                                const progressPercent = totalBlocks > 0 ? (completedBlocks / totalBlocks) * 100 : 0;

                                return (
                                    <TouchableOpacity
                                        key={`week-${weekNumber}`}
                                        style={[
                                            styles.weekPill,
                                            isSelected && styles.weekPillSelected
                                        ]}
                                        onPress={() => setSelectedWeek(weekNumber)}
                                    >
                                        <Text style={[
                                            styles.weekPillText,
                                            isSelected && styles.weekPillTextSelected
                                        ]}>
                                            week {weekNumber}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Selected Week's Blocks */}
                    <View style={styles.weekBlocksContainer}>
                        {selectedWeekBlocks.map((block, idx) => (
                            <View key={`block-${block.id}`}>
                                {renderBlockCard(block, idx)}
                            </View>
                        ))}
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No content available</Text>
                <Text style={styles.emptySubtext}>Lessons or modules will appear here when added</Text>
            </View>
        );
    };

    const startBlockSession = async (block: CourseBlock) => {
        try {
            if (!token) return;
            if (activeBlockSessions[block.id]) {
                navigation.navigate('StudySession', {
                    sessionId: activeBlockSessions[block.id].id,
                    courseId,
                    blockId: block.id,
                    blockTitle: block.title,
                    courseTitle
                });
                return;
            }
            const localSessionId = activeBlockSessions[block.id]?.id || Math.floor(Math.random() * 1_000_000);
            if (!activeBlockSessions[block.id]) {
                setActiveBlockSessions(prev => ({ ...prev, [block.id]: { id: localSessionId, status: 'in_progress' } }));
            }
            navigation.navigate('StudySession', {
                sessionId: localSessionId,
                courseId,
                blockId: block.id,
                blockTitle: block.title,
                courseTitle
            });
        } catch (error) {
            console.error('Error opening module study session:', error);
            Alert.alert('Error', 'Failed to open module study session.');
        }
    };

    const renderBlockCard = (block: CourseBlock, index: number) => {
        return (
            <View style={styles.lessonCard}>
                <View style={styles.lessonHeader}>
                    <View style={styles.lessonInfo}>
                        <Text style={styles.lessonOrder}>Week {block.week} • Module {block.block_number}</Text>
                        <Text style={styles.lessonTitle}>{block.title}</Text>
                        <Text style={styles.lessonDuration}>{formatDuration(block.duration_minutes)}</Text>
                        {Array.isArray(block.learning_objectives) && block.learning_objectives.length > 0 && (
                            <Text style={styles.lessonObjectives} numberOfLines={2}>
                                {block.learning_objectives.join('; ')}
                            </Text>
                        )}
                    </View>
                </View>
                <View style={styles.lessonButtonContainer}>
                    <TouchableOpacity
                        style={[
                            styles.startStudyButton,
                            activeBlockSessions[block.id]?.status === 'completed' && { backgroundColor: '#10B981' }
                        ]}
                        onPress={() => startBlockSession(block)}
                    >
                        <Text style={styles.startStudyButtonText}>
                            {activeBlockSessions[block.id]?.status === 'completed'
                                ? 'Review Module'
                                : activeBlockSessions[block.id]
                                    ? 'Continue Study'
                                    : 'Start Study'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    // Render progress tab content
    const renderProgressContent = () => {
        if (!progress) {
            return (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No progress data</Text>
                    <Text style={styles.emptySubtext}>Start studying to track your progress</Text>
                </View>
            );
        }

        return (
            <View style={styles.contentContainer}>
                <View style={styles.progressDetailCard}>
                    <Text style={styles.progressDetailTitle}>Study Statistics</Text>
                    <View style={styles.progressDetailGrid}>
                        <View style={styles.progressDetailItem}>
                            <Text style={styles.progressDetailValue}>{progress.sessions_count}</Text>
                            <Text style={styles.progressDetailLabel}>Study Sessions</Text>
                        </View>
                        <View style={styles.progressDetailItem}>
                            <Text style={styles.progressDetailValue}>{formatDuration(progress.total_study_time)}</Text>
                            <Text style={styles.progressDetailLabel}>Total Time</Text>
                        </View>
                        <View style={styles.progressDetailItem}>
                            <Text style={styles.progressDetailValue}>
                                {gradesService.formatRelativeTime(progress.started_at)}
                            </Text>
                            <Text style={styles.progressDetailLabel}>Started</Text>
                        </View>
                        <View style={styles.progressDetailItem}>
                            <Text style={styles.progressDetailValue}>
                                {gradesService.formatRelativeTime(progress.last_activity)}
                            </Text>
                            <Text style={styles.progressDetailLabel}>Last Activity</Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    // Get assignment status display
    const getAssignmentStatusDisplay = (assignment: StudentAssignment) => {
        switch (assignment.status) {
            case 'assigned':
                return { text: 'New Assignment', color: '#007AFF', bgColor: '#E3F2FD' };
            case 'submitted':
                return { text: 'Submitted', color: '#FF9500', bgColor: '#FFF3E0' };
            case 'graded':
                return { text: 'Completed', color: '#28A745', bgColor: '#E8F5E8' };
            default:
                return { text: 'Unknown', color: '#666', bgColor: '#F5F5F5' };
        }
    };

    // Render assignment card
    const renderAssignmentCard = (assignment: StudentAssignment) => {
        const statusDisplay = getAssignmentStatusDisplay(assignment);
        const isCompleted = assignment.status === 'graded';
        const canStartWorkflow = assignment.status === 'assigned';

        return (
            <View style={styles.assignmentWorkflowCard}>
                <View style={styles.assignmentHeader}>
                    <View style={styles.assignmentInfo}>
                        <Text style={styles.assignmentWorkflowTitle}>{getAssignmentTitle(assignment)}</Text>
                        <Text style={styles.assignmentDescription}>
                            {getAssignmentDescription(assignment) || 'No description available yet.'}
                        </Text>
                        <View style={styles.assignmentMeta}>
                            <Text style={styles.assignmentMetaText}>
                                Due: {new Date(assignment.due_date).toLocaleDateString()}
                            </Text>
                            {getAssignmentDuration(assignment) && (
                                <Text style={styles.assignmentMetaText}>
                                    • {getAssignmentDuration(assignment)} min
                                </Text>
                            )}
                        </View>
                    </View>
                    <View style={[styles.assignmentStatus, { backgroundColor: statusDisplay.bgColor }]}>
                        <Text style={[styles.assignmentStatusText, { color: statusDisplay.color }]}>
                            {statusDisplay.text}
                        </Text>
                    </View>
                </View>

                <View style={styles.assignmentActions}>
                    {canStartWorkflow && (
                        <TouchableOpacity
                            style={styles.startWorkflowButton}
                            onPress={() => startAssignmentWorkflow(assignment)}
                        >
                            <Text style={styles.startWorkflowButtonText}>Start Assignment</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={isCompleted ? styles.viewResultsButton : styles.viewDetailsButton}
                        onPress={() => navigateToAssignment(assignment)}
                    >
                        <Text style={isCompleted ? styles.viewResultsButtonText : styles.viewDetailsButtonText}>
                            {isCompleted ? 'View Results' : 'View Details'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {assignment.status === 'graded' && assignment.grade !== undefined && (
                    <View style={styles.gradeDisplay}>
                        <Text style={styles.gradeText}>Grade: {assignment.grade}%</Text>
                        {assignment.feedback && (
                            <Text style={styles.feedbackText} numberOfLines={2}>
                                {assignment.feedback}
                            </Text>
                        )}
                    </View>
                )}
            </View>
        );
    };

    // Render assignments tab content
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

    const renderAssignmentsContent = () => {
        if (loadingAssignments) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading assignments...</Text>
                </View>
            );
        }

        const hasStudent = assignments.length > 0;
        const hasDefinitions = rawAssignments.length > 0;

        if (!hasStudent && !hasDefinitions) {
            return (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No assignments available</Text>
                    <Text style={styles.emptySubtext}>Your instructor hasn't added assignments yet.</Text>
                </View>
            );
        }
        // Always show available definitions section. Filter out ones already assigned to avoid duplication.
        const assignedDefinitionIds = new Set(
            assignments
                .map(a => (a.assignment?.id ?? a.assignment_id))
                .filter(id => typeof id === 'number')
        );
        const availableDefinitionAdapters = hasDefinitions
            ? rawAssignments
                .filter(def => !assignedDefinitionIds.has(def.id))
                .map(adaptDefinition)
            : [];

        return (
            <View style={styles.contentContainer}>
                <View style={styles.assignmentWorkflowInfo}>
                    <Text style={styles.workflowInfoTitle}>📚 Assignment Workflow</Text>
                    <Text style={styles.workflowInfoText}>
                        Read course → Complete assignment → Upload images → Auto-grade → View results
                    </Text>
                </View>
                {hasStudent && (
                    <View style={{ marginBottom: 16 }}>
                        <Text style={styles.sectionHeading}>Your Assigned Work ({assignments.length})</Text>
                        {assignments.map((a, idx) => {
                            const safeKey = a?.id ?? a?.assignment_id ?? a?.assignment?.id ?? `idx-${idx}`;
                            return (
                                <View key={`student-assignment-${safeKey}`}>
                                    {renderAssignmentCard(a)}
                                </View>
                            );
                        })}
                    </View>
                )}
                {hasDefinitions && (
                    <View style={{ marginBottom: 8 }}>
                        <Text style={styles.sectionHeading}>Available Assignments ({availableDefinitionAdapters.length})</Text>
                        {availableDefinitionAdapters.length > 0 ? (
                            availableDefinitionAdapters.map((a, idx) => {
                                const safeKey = a?.id ?? a?.assignment_id ?? a?.assignment?.id ?? `idx-${idx}`;
                                return (
                                    <View key={`available-assignment-${safeKey}`}>
                                        {renderAssignmentCard(a)}
                                    </View>
                                );
                            })
                        ) : (
                            <Text style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                                All available assignments have already been assigned to you.
                            </Text>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {renderCourseHeader()}
                {renderTabNavigation()}
                {activeTab === 'lessons' && renderLessonsContent()}
                {activeTab === 'progress' && renderProgressContent()}
                {activeTab === 'assignments' && renderAssignmentsContent()}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FC',
    },
    scrollView: {
        flex: 1,
    },
    sectionHeading: {
        fontSize: 16,
        fontWeight: '600',
        color: '#222',
        marginBottom: 6
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

    // New Modern Course Header Styles
    courseHeaderContainer: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 24,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    headerActions: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        marginBottom: 20,
    },
    backIconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8F9FC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    actionIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8F9FC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    newCourseTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginBottom: 12,
        textAlign: 'center',
    },
    courseSubtitle: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    courseTags: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 24,
    },
    difficultyTag: {
        backgroundColor: '#E8F8F7',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    ageTag: {
        backgroundColor: '#FFF3E0',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    tagText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#333',
    },
    courseImageContainer: {
        alignItems: 'center',
        marginBottom: 24,
        paddingHorizontal: 0,
    },
    courseImagePlaceholder: {
        width: '100%',
        height: 200,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        marginHorizontal: 0,
    },
    enrollSection: {
        marginTop: 8,
    },
    enrollNowButton: {
        backgroundColor: '#7B68EE',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#7B68EE',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    enrollNowButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    enrolledButton: {
        backgroundColor: '#34C759',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    enrolledButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },

    // Modern Tab Navigation Styles
    modernTabContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        marginHorizontal: 12, // give the tabs a bit more width
        marginVertical: 16,
        borderRadius: 12,
        padding: 4,
        gap: 6, // spacing between tabs
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    modernTab: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    modernTabActive: {
        backgroundColor: '#34C759',
    },
    modernTabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8E8E93',
    },
    modernTabTextActive: {
        color: '#FFFFFF',
    },

    // Content Styles
    contentContainer: {
        paddingHorizontal: 20,
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
    progressTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 12,
    },
    progressStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    progressStat: {
        alignItems: 'center',
    },
    progressStatValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    progressStatLabel: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    progressBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    progressBar: {
        flex: 1,
        height: 8,
        backgroundColor: '#e0e0e0',
        borderRadius: 4,
        marginRight: 12,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#007AFF',
        borderRadius: 4,
    },
    progressDetailsButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#007AFF',
        borderRadius: 6,
    },
    progressDetailsButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    descriptionContainer: {
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    descriptionText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    enrollButton: {
        paddingVertical: 12,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        alignItems: 'center',
    },
    enrollButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
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

    // Week organization styles
    weekSection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    weekHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f8f9fa',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    weekHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    weekIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    weekIcon: {
        fontSize: 20,
    },
    weekTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 2,
    },
    weekSubtitle: {
        fontSize: 13,
        color: '#666',
    },
    weekHeaderRight: {
        paddingLeft: 12,
    },
    expandIcon: {
        fontSize: 16,
        color: '#666',
    },
    weekContent: {
        padding: 12,
        paddingTop: 8,
    },
    // Horizontal week selector styles
    horizontalWeekContainer: {
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 12,
        marginBottom: 16,
        borderRadius: 12,
        marginHorizontal: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    weekScrollContent: {
        paddingHorizontal: 4,
        gap: 8,
    },
    weekPill: {
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 25,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 6,
        minWidth: 100,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    weekPillSelected: {
        backgroundColor: '#7B68EE',
        shadowColor: '#7B68EE',
        shadowOpacity: 0.3,
    },
    weekPillText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        textAlign: 'center',
    },
    weekPillTextSelected: {
        color: '#FFFFFF',
    },
    weekBlocksContainer: {
        paddingHorizontal: 16,
    },
    lessonCard: {
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
    lockedLessonCard: {
        backgroundColor: '#f5f5f5',
        opacity: 0.7,
    },
    lessonHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    lessonInfo: {
        flex: 1,
    },
    lessonOrder: {
        fontSize: 12,
        color: '#007AFF',
        fontWeight: '600',
        marginBottom: 4,
    },
    lessonTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    lessonDuration: {
        fontSize: 12,
        color: '#666',
        marginBottom: 8,
    },
    lessonObjectives: {
        fontSize: 13,
        color: '#666',
        lineHeight: 18,
    },
    disabledText: {
        color: '#999',
    },
    lessonActions: {
        alignItems: 'center',
    },
    completedBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#28a745',
        alignItems: 'center',
        justifyContent: 'center',
    },
    completedBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    lockedBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#ccc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    lockedBadgeText: {
        fontSize: 12,
    },
    lessonButtonContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    viewLessonButton: {
        flex: 1,
        paddingVertical: 10,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        alignItems: 'center',
    },
    viewLessonButtonText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '600',
    },
    startStudyButton: {
        flex: 1,
        paddingVertical: 10,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        alignItems: 'center',
    },
    startStudyButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    progressDetailCard: {
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
    progressDetailTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 16,
    },
    progressDetailGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    progressDetailItem: {
        width: '50%',
        alignItems: 'center',
        paddingVertical: 12,
    },
    progressDetailValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#007AFF',
        marginBottom: 4,
    },
    progressDetailLabel: {
        fontSize: 12,
        color: '#666',
    },
    assignmentCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    assignmentTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    assignmentDescription: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
        marginBottom: 16,
    },
    viewAssignmentsButton: {
        paddingVertical: 12,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        alignItems: 'center',
    },
    viewAssignmentsButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    // Workflow styles
    assignmentWorkflowInfo: {
        backgroundColor: '#E3F2FD',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    workflowInfoTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    workflowInfoText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    assignmentWorkflowCard: {
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
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    assignmentInfo: {
        flex: 1,
        marginRight: 12,
    },
    assignmentWorkflowTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    assignmentMeta: {
        flexDirection: 'row',
        marginTop: 4,
    },
    assignmentMetaText: {
        fontSize: 12,
        color: '#666',
        marginRight: 8,
    },
    assignmentStatus: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    assignmentStatusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    assignmentActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    startWorkflowButton: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        alignItems: 'center',
    },
    startWorkflowButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    viewDetailsButton: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        alignItems: 'center',
    },
    viewDetailsButtonText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '600',
    },
    viewResultsButton: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: '#28A745',
        borderRadius: 8,
        alignItems: 'center',
    },
    viewResultsButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    gradeDisplay: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
        marginTop: 12,
    },
    gradeText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#28A745',
        marginBottom: 4,
    },
    feedbackText: {
        fontSize: 12,
        color: '#666',
        lineHeight: 16,
    },
});