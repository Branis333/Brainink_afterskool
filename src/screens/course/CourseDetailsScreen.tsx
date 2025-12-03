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
    Modal,
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
import { progressService, ProgressDigest } from '../../services/progressService';

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
    const [courseDigest, setCourseDigest] = useState<ProgressDigest | null>(null);
    const [digestUpdating, setDigestUpdating] = useState(false);
    const [lockModalVisible, setLockModalVisible] = useState(false);
    const [lockModalAssignment, setLockModalAssignment] = useState<EnrichedAssignment | null>(null);

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
                // Load unified course, progress, and course digest in parallel
                const [courseData, progressData, digestData] = await Promise.all([
                    afterSchoolService.getUnifiedCourse(courseId, token, {
                        include_stats: true,
                        include_progress: true
                    }),
                    afterSchoolService.getStudentProgress(courseId, token).catch(() => null),
                    progressService.getCourseDigest(courseId, token).catch(() => null)
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
                setCourseDigest(digestData);
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

    // Open grade details for the latest submission of an assignment
    const openGradeDetails = async (assignment: StudentAssignment) => {
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
                    'No results yet',
                    'We could not find a graded submission yet. Please try again shortly.'
                );
            }
        } catch (e) {
            Alert.alert('Error', 'Unable to open grade details right now.');
        }
    };

    // Lock modal helpers
    const showLockModal = (assignment: EnrichedAssignment) => {
        setLockModalAssignment(assignment);
        setLockModalVisible(true);
    };
    const hideLockModal = () => {
        setLockModalVisible(false);
        setLockModalAssignment(null);
    };
    const goToRequiredAssignment = () => {
        if (!lockModalAssignment?.required_assignment_id) {
            hideLockModal();
            return;
        }
        const requiredId = lockModalAssignment.required_assignment_id;
        hideLockModal();
        navigation.navigate('CourseAssignment', {
            courseId,
            assignmentId: requiredId,
            assignmentTitle: `Assignment #${requiredId}`,
            courseTitle
        });
    };

    // Handle press on a minimal row with branching logic
    const handleAssignmentPress = (assignment: EnrichedAssignment) => {
        const { locked, passed, failed } = computeAssignmentState(assignment);
        if (locked) {
            showLockModal(assignment);
            return;
        }
        if (passed || failed) {
            // Both passed and attempted-but-not-passed go to grade details
            openGradeDetails(assignment);
            return;
        }
        // Ready to view details/start
        navigateToAssignment(assignment);
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

    // Helpers and derived maps (hoisted before early returns to satisfy Hooks rules)
    const getBlockDefinitionsSorted = (blockId: number): CourseAssignment[] => {
        const defs = rawAssignments.filter(d => (d.block_id ?? 0) === blockId);
        // Sort by created_at then id as fallback to maintain curriculum order
        return defs.sort((x, y) => {
            const tx = x.created_at ? new Date(x.created_at).getTime() : 0;
            const ty = y.created_at ? new Date(y.created_at).getTime() : 0;
            if (tx !== ty) return tx - ty;
            return (x.id ?? 0) - (y.id ?? 0);
        });
    };

    // Precompute previous-definition map per block to ensure stable curriculum order
    const prevDefinitionMap = React.useMemo(() => {
        const map: Record<number, number | null> = {}; // definitionId -> previousDefinitionId|null
        const byId: Set<number> = new Set(rawAssignments.map(d => d.id));
        const blocksSet = new Set(rawAssignments.map(d => d.block_id).filter(Boolean) as number[]);
        blocksSet.forEach(bId => {
            const sorted = getBlockDefinitionsSorted(bId);
            sorted.forEach((def, idx) => {
                const prev = idx > 0 ? sorted[idx - 1].id : null;
                if (byId.has(def.id)) {
                    map[def.id] = prev;
                }
            });
        });
        return map;
    }, [rawAssignments]);

    const studentAssignmentByDefinitionId = React.useMemo(() => {
        const m: Record<number, StudentAssignment> = {};
        assignments.forEach(sa => {
            const defId = sa.assignment?.id ?? sa.assignment_id;
            if (defId) m[defId] = sa;
        });
        return m;
    }, [assignments]);

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
                <View style={styles.contentContainer}>
                    {/* Course Progress Digest (top card) */}
                    <View style={styles.progressDigestCard}>
                        <Text style={styles.progressDigestTitle}>Course Progress</Text>
                        {courseDigest ? (
                            <>
                                <Text style={styles.progressDigestSummary}>{courseDigest.summary}</Text>
                                <View style={styles.progressDigestMetaRow}>
                                    <Text style={styles.progressDigestMeta}>
                                        {new Date(courseDigest.period_start).toLocaleDateString()} - {new Date(courseDigest.period_end).toLocaleDateString()}
                                    </Text>
                                    <Text style={styles.progressDigestMeta}>• {courseDigest.assignments_count} items</Text>
                                    {typeof courseDigest.avg_grade === 'number' && (
                                        <Text style={styles.progressDigestMeta}>• {courseDigest.avg_grade.toFixed(1)}% avg</Text>
                                    )}
                                </View>
                            </>
                        ) : (
                            <Text style={styles.progressDigestSummaryMuted}>
                                No course progress yet. Tap Update to generate.
                            </Text>
                        )}
                        <TouchableOpacity
                            style={styles.progressDigestUpdateButton}
                            onPress={async () => {
                                if (!token) return;
                                try {
                                    setDigestUpdating(true);
                                    const updated = await progressService.generateCourseDigest(courseId, token);
                                    setCourseDigest(updated);
                                } catch (e) {
                                    Alert.alert('Error', 'Failed to update course progress.');
                                } finally {
                                    setDigestUpdating(false);
                                }
                            }}
                            disabled={digestUpdating}
                        >
                            {digestUpdating ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                                <Text style={styles.progressDigestUpdateButtonText}>Update progress</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No progress data</Text>
                        <Text style={styles.emptySubtext}>Start studying to track your progress</Text>
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.contentContainer}>
                {/* Course Progress Digest (top card) */}
                <View style={styles.progressDigestCard}>
                    <Text style={styles.progressDigestTitle}>Course Progress</Text>
                    {courseDigest ? (
                        <>
                            <Text style={styles.progressDigestSummary}>{courseDigest.summary}</Text>
                            <View style={styles.progressDigestMetaRow}>
                                <Text style={styles.progressDigestMeta}>
                                    {new Date(courseDigest.period_start).toLocaleDateString()} - {new Date(courseDigest.period_end).toLocaleDateString()}
                                </Text>
                                <Text style={styles.progressDigestMeta}>• {courseDigest.assignments_count} items</Text>
                                {typeof courseDigest.avg_grade === 'number' && (
                                    <Text style={styles.progressDigestMeta}>• {courseDigest.avg_grade.toFixed(1)}% avg</Text>
                                )}
                            </View>
                        </>
                    ) : (
                        <Text style={styles.progressDigestSummaryMuted}>
                            No course progress yet. Tap Update to generate.
                        </Text>
                    )}
                    <TouchableOpacity
                        style={styles.progressDigestUpdateButton}
                        onPress={async () => {
                            if (!token) return;
                            try {
                                setDigestUpdating(true);
                                const updated = await progressService.generateCourseDigest(courseId, token);
                                setCourseDigest(updated);
                            } catch (e) {
                                Alert.alert('Error', 'Failed to update course progress.');
                            } finally {
                                setDigestUpdating(false);
                            }
                        }}
                        disabled={digestUpdating}
                    >
                        {digestUpdating ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                            <Text style={styles.progressDigestUpdateButtonText}>Update progress</Text>
                        )}
                    </TouchableOpacity>
                </View>

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

    // --- Minimal Assignment Row (Updated UI) ---
    const PASS_THRESHOLD = 80;
    interface EnrichedAssignment extends StudentAssignment { locked?: boolean; required_assignment_id?: number | null; }

    const isBlockLocked = (a: EnrichedAssignment): { locked: boolean; blockId?: number } => {
        // Prefer nested assignment.block_id, fall back to course-level definition.block_id
        const def = resolveAssignmentDefinition(a as unknown as StudentAssignment);
        const blockId = (a.assignment?.block_id ?? (a as any)?.block_id ?? def?.block_id) as number | undefined;
        if (!blockId) return { locked: false };
        const status = activeBlockSessions[blockId]?.status;
        // Lock when correlating module is not completed
        const locked = status !== 'completed';
        return { locked, blockId };
    };

    // Helpers for previous-assignment gating
    const getAssignmentBlockId = (a: EnrichedAssignment): number | undefined => {
        const def = resolveAssignmentDefinition(a as unknown as StudentAssignment);
        return (a.assignment?.block_id ?? (a as any)?.block_id ?? def?.block_id) as number | undefined;
    };

    // (hoisted) getBlockDefinitionsSorted, prevDefinitionMap, and studentAssignmentByDefinitionId

    const isStudentPassed = (sa?: StudentAssignment | null): boolean => {
        if (!sa) return false;
        const g = typeof sa.grade === 'number' ? sa.grade : undefined;
        if (sa.status === 'passed') return true;
        if (g !== undefined && g >= PASS_THRESHOLD) return true;
        return false;
    };

    const computeAssignmentState = (a: EnrichedAssignment) => {
        const blockGate = isBlockLocked(a);
        const def = resolveAssignmentDefinition(a as unknown as StudentAssignment);
        const currentDefId = def?.id ?? a.assignment_id;
        const blockId = getAssignmentBlockId(a);

        // Try precomputed previous; if missing, fall back to sorted-by-block resolution
        let prevDefId = currentDefId ? prevDefinitionMap[currentDefId] : null as number | null | undefined;
        if (prevDefId === undefined && currentDefId && blockId) {
            const sorted = getBlockDefinitionsSorted(blockId);
            const idx = sorted.findIndex(d => d.id === currentDefId);
            prevDefId = idx > 0 ? sorted[idx - 1].id : null;
        }

        // Also consider backend-declared prerequisite if provided
        const backendReqId = (a as any)?.required_assignment_id as number | undefined;
        const candidatePrevIds: number[] = [];
        if (typeof prevDefId === 'number') candidatePrevIds.push(prevDefId);
        if (typeof backendReqId === 'number' && !candidatePrevIds.includes(backendReqId)) candidatePrevIds.push(backendReqId);

        let prevLocked = false;
        let prevDef: CourseAssignment | undefined = undefined;
        for (const pid of candidatePrevIds) {
            const pDef = rawAssignments.find(d => d.id === pid);
            const pStudent = pDef ? studentAssignmentByDefinitionId[pDef.id] : undefined;
            const passed = isStudentPassed(pStudent);
            if (!passed) {
                prevLocked = true;
                prevDef = pDef || prevDef; // prefer the first unmet prerequisite for UI text
                break;
            }
        }

        // Prefer backend lock flag when present, and lock if module incomplete or prev unmet
        const locked = !!a.locked || blockGate.locked || prevLocked;
        const gradeVal = typeof a.grade === 'number' ? a.grade : undefined;
        const passed = a.status === 'passed' || (gradeVal !== undefined && gradeVal >= PASS_THRESHOLD);
        const attempted = ['submitted', 'graded', 'needs_retry', 'failed', 'passed'].includes(a.status);
        const failed = attempted && !passed && (a.status === 'failed' || a.status === 'needs_retry' || (gradeVal !== undefined && gradeVal < PASS_THRESHOLD));
        let icon: { name: string; color: string } = { name: 'document-text-outline', color: '#6B7280' };
        if (locked) icon = { name: 'lock-closed', color: '#6B7280' };
        else if (passed) icon = { name: 'checkmark-circle', color: '#10B981' };
        else if (failed) icon = { name: 'alert-circle', color: '#EF4444' };
        const statusText = locked ? 'Locked' : passed ? 'Completed' : failed ? 'Needs Retry' : a.status === 'assigned' ? 'Assigned' : 'In Progress';
        return { locked, passed, failed, icon, statusText, gradeVal, blockGate, prevGate: { locked: prevLocked, prevDef } };
    };

    const formatShortDate = (iso: string) => {
        try {
            const d = new Date(iso);
            return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
        } catch { return ''; }
    };

    const renderMinimalAssignmentRow = (assignment: EnrichedAssignment, idx: number) => {
        const state = computeAssignmentState(assignment);
        const title = getAssignmentTitle(assignment);
        const due = formatShortDate(assignment.due_date);
        const duration = getAssignmentDuration(assignment);
        const gradeDisplay = state.gradeVal !== undefined ? `${state.gradeVal.toFixed(1)}%` : '—';
        const showNote = state.failed || state.locked;
        const noteText = state.failed
            ? "You didn't pass this item"
            : state.locked
                ? (state.prevGate?.locked && state.prevGate.prevDef
                    ? `Complete "${state.prevGate.prevDef.title}" to unlock`
                    : (assignment.required_assignment_id
                        ? `Unlock by completing #${assignment.required_assignment_id}`
                        : (state.blockGate.blockId
                            ? 'Complete the module to unlock'
                            : 'Prerequisite incomplete')))
                : '';
        return (
            <TouchableOpacity
                key={`assign-row-${assignment.assignment_id}-${idx}`}
                style={[styles.assignmentRow, state.locked && styles.assignmentRowLocked]}
                onPress={() => handleAssignmentPress(assignment)}
            >
                <View style={styles.assignmentRowIconWrap}>
                    {state.locked ? (
                        <TouchableOpacity onPress={() => showLockModal(assignment)} activeOpacity={0.7}>
                            <View style={styles.lockIconBadge}>
                                <Ionicons name="lock-closed" size={16} color="#6B7280" />
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <Ionicons name={state.icon.name as any} size={22} color={state.icon.color} />
                    )}
                </View>
                <View style={styles.assignmentRowContent}>
                    <View style={styles.assignmentRowTop}>
                        <Text style={styles.assignmentRowTitle} numberOfLines={1}>{title}</Text>
                        <Text style={[styles.assignmentRowGrade, state.passed && { color: '#10B981' }, state.failed && { color: '#EF4444' }]}>{gradeDisplay}</Text>
                    </View>
                    <View style={styles.assignmentRowMetaLine}>
                        <Text style={styles.assignmentRowMeta} numberOfLines={1}>
                            {state.statusText}
                            {due ? ` · Due ${due}` : ''}
                            {duration ? ` · ${duration} min` : ''}
                        </Text>
                    </View>
                    {showNote && (
                        <Text style={styles.assignmentRowNote} numberOfLines={1}>{noteText}</Text>
                    )}
                </View>
            </TouchableOpacity>
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
                        {assignments.map((a, idx) => renderMinimalAssignmentRow(a as EnrichedAssignment, idx))}
                    </View>
                )}
                {hasDefinitions && (
                    <View style={{ marginBottom: 8 }}>
                        <Text style={styles.sectionHeading}>Available Assignments ({availableDefinitionAdapters.length})</Text>
                        {availableDefinitionAdapters.length > 0 ? (
                            availableDefinitionAdapters.map((a, idx) => renderMinimalAssignmentRow(a as EnrichedAssignment, idx))
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

            {/* Lock Modal */}
            <Modal
                visible={lockModalVisible}
                transparent
                animationType="fade"
                onRequestClose={hideLockModal}
            >
                <View style={styles.lockModalOverlay}>
                    <View style={styles.lockModalCard}>
                        <View style={{ alignItems: 'center', marginBottom: 12 }}>
                            <Ionicons name="lock-closed" size={28} color="#6B7280" />
                        </View>
                        <Text style={styles.lockModalTitle}>Assignment Locked</Text>
                        <Text style={styles.lockModalText}>
                            {(() => {
                                if (!lockModalAssignment) return 'Please complete the required prerequisite to unlock this item.';
                                // Prefer specific prerequisite assignment if provided
                                if (lockModalAssignment.required_assignment_id) {
                                    return `Complete assignment #${lockModalAssignment.required_assignment_id} to unlock this item.`;
                                }
                                // Check dynamic gating reasons
                                const st = computeAssignmentState(lockModalAssignment as EnrichedAssignment);
                                if (st.prevGate?.locked && st.prevGate.prevDef) {
                                    return `Complete "${st.prevGate.prevDef.title}" to unlock this assignment.`;
                                }
                                const def = resolveAssignmentDefinition(lockModalAssignment as unknown as StudentAssignment);
                                const bId = (lockModalAssignment.assignment?.block_id ?? (lockModalAssignment as any)?.block_id ?? def?.block_id) as number | undefined;
                                if (bId) {
                                    const b = blocks.find(x => x.id === bId);
                                    if (b) {
                                        return `Complete Module ${b.block_number} • ${b.title} to unlock this assignment.`;
                                    }
                                    return 'Complete the related module to unlock this assignment.';
                                }
                                return 'Please complete the required prerequisite to unlock this item.';
                            })()}
                        </Text>
                        <View style={styles.lockModalActions}>
                            <TouchableOpacity style={styles.lockModalButton} onPress={hideLockModal}>
                                <Text style={styles.lockModalButtonText}>Close</Text>
                            </TouchableOpacity>
                            {lockModalAssignment?.required_assignment_id ? (
                                <TouchableOpacity style={styles.lockModalPrimaryButton} onPress={goToRequiredAssignment}>
                                    <Text style={styles.lockModalPrimaryButtonText}>View Required</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>
                </View>
            </Modal>
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
    // Course progress digest card
    progressDigestCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        borderLeftWidth: 4,
        borderLeftColor: '#10B981',
    },
    progressDigestTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    progressDigestSummary: {
        fontSize: 14,
        color: '#111827',
        lineHeight: 20,
        marginBottom: 10,
    },
    progressDigestSummaryMuted: {
        fontSize: 14,
        color: '#6B7280',
        fontStyle: 'italic',
        marginBottom: 10,
    },
    progressDigestMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
    },
    progressDigestMeta: {
        fontSize: 12,
        color: '#6B7280',
    },
    progressDigestUpdateButton: {
        alignSelf: 'flex-end',
        backgroundColor: '#10B981',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    progressDigestUpdateButtonText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
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
    // Minimal Assignment Rows
    assignmentRow: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 10,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    assignmentRowLocked: {
        opacity: 0.75,
    },
    assignmentRowIconWrap: {
        width: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    lockIconBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    assignmentRowContent: {
        flex: 1,
    },
    assignmentRowTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    assignmentRowTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1F2937',
        flex: 1,
        paddingRight: 8,
    },
    assignmentRowGrade: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
        minWidth: 54,
        textAlign: 'right',
    },
    assignmentRowMetaLine: {
        marginBottom: 2,
    },
    assignmentRowMeta: {
        fontSize: 12,
        color: '#6B7280',
    },
    assignmentRowNote: {
        fontSize: 11,
        color: '#EF4444',
    },
    // Lock modal styles
    lockModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    lockModalCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    lockModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 8,
    },
    lockModalText: {
        fontSize: 14,
        color: '#4B5563',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 16,
    },
    lockModalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
    },
    lockModalButton: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
    },
    lockModalButtonText: {
        color: '#374151',
        fontWeight: '600',
    },
    lockModalPrimaryButton: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: '#10B981',
        borderRadius: 8,
    },
    lockModalPrimaryButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
});