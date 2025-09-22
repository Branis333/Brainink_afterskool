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
    CourseLesson,
    CourseWithLessons,
    StudySession
} from '../../services/afterSchoolService';

type NavigationProp = NativeStackNavigationProp<any>;
type RouteProp_ = RouteProp<{
    params: {
        courseId: number;
        lessonId: number;
        lessonTitle: string;
        courseTitle: string;
    }
}>;

interface Props {
    navigation: NavigationProp;
    route: RouteProp_;
}

const { width } = Dimensions.get('window');

export const LessonViewScreen: React.FC<Props> = ({ navigation, route }) => {
    const { courseId, lessonId, lessonTitle, courseTitle } = route.params;
    const { token } = useAuth();

    const [lesson, setLesson] = useState<CourseLesson | null>(null);
    const [course, setCourse] = useState<CourseWithLessons | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Load lesson data
    const loadLessonData = async (isRefresh: boolean = false) => {
        try {
            if (!isRefresh) setLoading(true);

            if (!token) {
                throw new Error('No authentication token available');
            }

            // Load lesson details and course data in parallel
            const [lessonData, courseData] = await Promise.all([
                afterSchoolService.getLessonDetails(courseId, lessonId, token),
                afterSchoolService.getCourseDetails(courseId, token)
            ]);

            setLesson(lessonData);
            setCourse(courseData);
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
            loadLessonData();
        }, [courseId, lessonId, token])
    );

    // Pull to refresh
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadLessonData(true);
    }, []);

    // Start study session for this lesson
    const startStudySession = async () => {
        try {
            if (!token || !lesson) return;

            const session = await afterSchoolService.startStudySession({
                course_id: courseId,
                lesson_id: lessonId
            }, token);

            navigation.navigate('StudySession', {
                sessionId: session.id,
                courseId,
                lessonId,
                lessonTitle: lesson.title,
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

    // Navigate to previous lesson
    const navigateToPreviousLesson = () => {
        if (!course?.lessons) return;

        const currentIndex = course.lessons.findIndex(l => l.id === lessonId);
        const prevLesson = course.lessons[currentIndex - 1];

        if (prevLesson) {
            navigation.replace('LessonView', {
                courseId,
                lessonId: prevLesson.id,
                lessonTitle: prevLesson.title,
                courseTitle
            });
        }
    };

    // Navigate to next lesson
    const navigateToNextLesson = () => {
        if (!course?.lessons) return;

        const currentIndex = course.lessons.findIndex(l => l.id === lessonId);
        const nextLesson = course.lessons[currentIndex + 1];

        if (nextLesson) {
            navigation.replace('LessonView', {
                courseId,
                lessonId: nextLesson.id,
                lessonTitle: nextLesson.title,
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

    // Format duration
    const formatDuration = (minutes: number): string => {
        if (minutes < 60) {
            return `${minutes} min`;
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    };

    // Get current lesson index and navigation info
    const getCurrentLessonInfo = () => {
        if (!course?.lessons || !lesson) {
            return { currentIndex: -1, total: 0, hasPrevious: false, hasNext: false };
        }

        const sortedLessons = [...course.lessons].sort((a, b) => a.order_index - b.order_index);
        const currentIndex = sortedLessons.findIndex(l => l.id === lessonId);

        return {
            currentIndex: currentIndex + 1, // 1-based for display
            total: sortedLessons.length,
            hasPrevious: currentIndex > 0,
            hasNext: currentIndex < sortedLessons.length - 1
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
                        {lessonTitle}
                    </Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading lesson...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!lesson) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Lesson Not Found</Text>
                </View>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Lesson not found</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => loadLessonData()}
                    >
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const lessonInfo = getCurrentLessonInfo();

    // Render lesson header
    const renderLessonHeader = () => (
        <View style={styles.lessonHeaderContainer}>
            <View style={styles.breadcrumbContainer}>
                <TouchableOpacity onPress={navigateBackToCourse}>
                    <Text style={styles.breadcrumbCourse}>{courseTitle}</Text>
                </TouchableOpacity>
                <Text style={styles.breadcrumbSeparator}> / </Text>
                <Text style={styles.breadcrumbLesson}>Lesson {lesson.order_index}</Text>
            </View>

            <Text style={styles.lessonTitle}>{lesson.title}</Text>

            <View style={styles.lessonMetaContainer}>
                <View style={styles.lessonMeta}>
                    <Text style={styles.lessonMetaLabel}>Duration:</Text>
                    <Text style={styles.lessonMetaValue}>
                        {formatDuration(lesson.estimated_duration)}
                    </Text>
                </View>
                <View style={styles.lessonMeta}>
                    <Text style={styles.lessonMetaLabel}>Position:</Text>
                    <Text style={styles.lessonMetaValue}>
                        {lessonInfo.currentIndex} of {lessonInfo.total}
                    </Text>
                </View>
            </View>

            {/* Learning Objectives */}
            {lesson.learning_objectives && (
                <View style={styles.objectivesContainer}>
                    <Text style={styles.objectivesTitle}>Learning Objectives</Text>
                    <Text style={styles.objectivesText}>{lesson.learning_objectives}</Text>
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

    // Render lesson content
    const renderLessonContent = () => (
        <View style={styles.contentContainer}>
            <Text style={styles.contentTitle}>Lesson Content</Text>
            {lesson.content ? (
                <View style={styles.contentBody}>
                    <Text style={styles.contentText}>{lesson.content}</Text>
                </View>
            ) : (
                <View style={styles.noContentContainer}>
                    <Text style={styles.noContentText}>No content available</Text>
                    <Text style={styles.noContentSubtext}>
                        Content for this lesson will be added soon
                    </Text>
                </View>
            )}
        </View>
    );

    // Render lesson navigation
    const renderLessonNavigation = () => (
        <View style={styles.navigationContainer}>
            <TouchableOpacity
                style={[styles.navButton, !lessonInfo.hasPrevious && styles.disabledNavButton]}
                onPress={navigateToPreviousLesson}
                disabled={!lessonInfo.hasPrevious}
            >
                <Text style={[styles.navButtonText, !lessonInfo.hasPrevious && styles.disabledNavButtonText]}>
                    ← Previous Lesson
                </Text>
            </TouchableOpacity>

            <View style={styles.progressIndicator}>
                <Text style={styles.progressText}>
                    {lessonInfo.currentIndex}/{lessonInfo.total}
                </Text>
            </View>

            <TouchableOpacity
                style={[styles.navButton, !lessonInfo.hasNext && styles.disabledNavButton]}
                onPress={navigateToNextLesson}
                disabled={!lessonInfo.hasNext}
            >
                <Text style={[styles.navButtonText, !lessonInfo.hasNext && styles.disabledNavButtonText]}>
                    Next Lesson →
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
                    {lesson.title}
                </Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {renderLessonHeader()}
                {renderLessonContent()}
            </ScrollView>

            {/* Fixed Navigation Footer */}
            {renderLessonNavigation()}
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
});