/**
 * My Courses Screen
 * Display enrolled courses with In Progress and Completed filters
 * Grid layout matching the search screen design
 */

import React, { useState, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import {
    afterSchoolService,
    Course,
    StudentAssignment,
    StudentProgress
} from '../../services/afterSchoolService';
import { TabBarWrapper } from '../../components/TabBarWrapper';
import { Ionicons } from '@expo/vector-icons';

type NavigationProp = NativeStackNavigationProp<any>;

interface Props {
    navigation: NavigationProp;
}

type CourseFilter = 'in-progress' | 'completed';

const { width } = Dimensions.get('window');
const GRID_COLS = 2;
const GRID_MARGIN = 20;
const CARD_WIDTH = (width - GRID_MARGIN * 2 - 12) / GRID_COLS;

// Color palette for course placeholders (same as search screen)
const PLACEHOLDER_COLORS = [
    '#FFB366', // Orange
    '#66B2FF', // Blue
    '#99FF99', // Green
    '#FFCC99', // Light Orange
    '#CC99FF', // Purple
    '#99FFCC', // Teal
    '#FF99CC', // Pink
    '#FFFF99', // Yellow
];

// Subject to icon mapping (same as search screen)
const SUBJECT_ICONS: { [key: string]: string } = {
    'English': 'book',
    'Math': 'calculator',
    'Science': 'flask',
    'History': 'globe',
    'Art': 'brush',
    'Music': 'musical-note',
    'PE': 'body',
    'Technology': 'laptop',
    'default': 'school'
};

export const MyCoursesScreen: React.FC<Props> = ({ navigation }) => {
    const { token } = useAuth();

    const [courses, setCourses] = useState<Course[]>([]);
    const [courseProgress, setCourseProgress] = useState<{ [key: number]: StudentProgress }>({});
    const [courseAssignments, setCourseAssignments] = useState<{ [key: number]: StudentAssignment[] }>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState<CourseFilter>('in-progress');

    // Load enrolled courses with progress
    const loadMyCourses = async (isRefresh: boolean = false) => {
        try {
            if (!isRefresh) setLoading(true);

            if (!token) {
                throw new Error('No authentication token available');
            }

            // Get student dashboard which includes enrolled courses
            // My Courses should only show truly enrolled courses via dedicated endpoint
            const dashboard = await afterSchoolService.getMyCourses(token);
            let enrolledCourses = dashboard.active_courses || [];

            // Build progress map from dashboard summary
            const progressMap: { [key: number]: StudentProgress } = {};
            if (dashboard.progress_summary) {
                dashboard.progress_summary.forEach(progress => {
                    progressMap[progress.course_id] = progress;
                });
            }

            // Load assignments for each course
            const assignmentMap: { [key: number]: StudentAssignment[] } = {};
            for (const course of enrolledCourses) {
                try {
                    // Get course assignments
                    const assignments = await afterSchoolService.getCourseAssignments(course.id, token);
                    assignmentMap[course.id] = assignments;
                } catch (error) {
                    // Silently handle errors for individual courses
                    console.error(`Error loading assignments for course ${course.id}:`, error);
                }
            }

            // Safety: filter out any course with zero student assignments
            // (in case backend state is inconsistent)
            enrolledCourses = enrolledCourses.filter(c => (assignmentMap[c.id]?.length || 0) > 0);

            setCourses(enrolledCourses);
            setCourseProgress(progressMap);
            setCourseAssignments(assignmentMap);
        } catch (error) {
            console.error('Error loading enrolled courses:', error);
            Alert.alert(
                'Error',
                'Failed to load your courses. Please try again.',
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
            loadMyCourses();
        }, [token])
    );

    // Pull to refresh
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadMyCourses(true);
    }, []);

    // Navigate to course details
    const navigateToCourse = (course: Course) => {
        navigation.navigate('CourseDetails', {
            courseId: course.id,
            courseTitle: course.title
        });
    };

    // Get completion percentage for a course
    const getCourseCompletion = (courseId: number): number => {
        const progress = courseProgress[courseId];
        if (!progress) return 0;
        return progress.completion_percentage || 0;
    };

    // Check if course is completed
    const isCourseCompleted = (courseId: number): boolean => {
        return getCourseCompletion(courseId) >= 100;
    };

    // Get assignment status for display
    const getAssignmentStatus = (course: Course) => {
        const assignments = courseAssignments[course.id] || [];
        const assigned = assignments.filter(a => a.status === 'assigned').length;
        const submitted = assignments.filter(a => a.status === 'submitted').length;
        const graded = assignments.filter(a => a.status === 'graded').length;

        return { total: assignments.length, assigned, submitted, graded };
    };

    // Filter courses based on selected filter
    const getFilteredCourses = (): Course[] => {
        return courses.filter(course => {
            const isCompleted = isCourseCompleted(course.id);

            if (selectedFilter === 'completed') {
                return isCompleted;
            } else {
                // in-progress: not completed
                return !isCompleted;
            }
        });
    };

    // Get placeholder color based on course ID
    const getPlaceholderColor = (courseId: number | undefined): string => {
        if (!courseId) return PLACEHOLDER_COLORS[0];
        return PLACEHOLDER_COLORS[courseId % PLACEHOLDER_COLORS.length];
    };

    // Get subject icon
    const getSubjectIcon = (subject: string): string => {
        return SUBJECT_ICONS[subject] || SUBJECT_ICONS['default'];
    };

    // Render course card with image placeholder
    const renderCourseGridCard = (course: Course) => {
        const placeholderColor = getPlaceholderColor(course.id);
        const subjectIcon = getSubjectIcon(course.subject);
        const assignmentStatus = getAssignmentStatus(course);
        const completion = getCourseCompletion(course.id);

        return (
            <TouchableOpacity
                key={course.id}
                style={[styles.courseGridCard, { width: CARD_WIDTH }]}
                onPress={() => navigateToCourse(course)}
                activeOpacity={0.85}
            >
                {/* Image - Display actual image if available, otherwise placeholder */}
                {course.image ? (
                    <View style={styles.imagePlaceholderContainer}>
                        <Image
                            source={{ uri: `data:image/jpeg;base64,${course.image}` }}
                            style={styles.coursePlaceholder}
                            resizeMode="cover"
                        />
                        {/* Completion Badge */}
                        {completion >= 100 && (
                            <View style={styles.completionBadge}>
                                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                            </View>
                        )}
                    </View>
                ) : (
                    <View
                        style={[
                            styles.coursePlaceholder,
                            { backgroundColor: placeholderColor }
                        ]}
                    >
                        <Ionicons
                            name={subjectIcon as any}
                            size={48}
                            color="rgba(255, 255, 255, 0.7)"
                        />
                        {/* Completion Badge */}
                        {completion >= 100 && (
                            <View style={styles.completionBadge}>
                                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                            </View>
                        )}
                    </View>
                )}

                {/* Course Info */}
                <View style={styles.courseGridInfo}>
                    <Text style={styles.courseGridTitle} numberOfLines={2}>
                        {course.title}
                    </Text>
                    <Text style={styles.courseGridSubject}>
                        {course.subject}
                    </Text>

                    {/* Progress Bar */}
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { width: `${completion}%` }
                                ]}
                            />
                        </View>
                        <Text style={styles.progressText}>{Math.round(completion)}%</Text>
                    </View>

                    {/* Stats if has assignments */}
                    {assignmentStatus.total > 0 && (
                        <View style={styles.courseGridStats}>
                            <View style={styles.statItem}>
                                <Text style={styles.statNumber}>{assignmentStatus.assigned}</Text>
                                <Text style={styles.statLabel}>Pending</Text>
                            </View>
                            <View style={styles.statItem}>
                                <Text style={styles.statNumber}>{assignmentStatus.submitted}</Text>
                                <Text style={styles.statLabel}>Submitted</Text>
                            </View>
                            <View style={styles.statItem}>
                                <Text style={styles.statNumber}>{assignmentStatus.graded}</Text>
                                <Text style={styles.statLabel}>Graded</Text>
                            </View>
                        </View>
                    )}

                    {/* Continue Button */}
                    <TouchableOpacity
                        style={styles.courseGridViewButton}
                        onPress={() => navigateToCourse(course)}
                    >
                        <Text style={styles.courseGridViewButtonText}>
                            {completion >= 100 ? 'Review' : 'Continue'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    // Render loading state
    if (loading) {
        return (
            <TabBarWrapper activeTab="courses" showTabs={true}>
                <SafeAreaView style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>My Courses</Text>
                    </View>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#007AFF" />
                        <Text style={styles.loadingText}>Loading your courses...</Text>
                    </View>
                </SafeAreaView>
            </TabBarWrapper>
        );
    }

    const filteredCourses = getFilteredCourses();

    return (
        <TabBarWrapper activeTab="courses" showTabs={true}>
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>My Courses</Text>
                </View>

                {/* Filter Buttons */}
                <View style={styles.filterButtonsContainer}>
                    <TouchableOpacity
                        style={[
                            styles.filterTab,
                            selectedFilter === 'in-progress' && styles.filterTabActive
                        ]}
                        onPress={() => setSelectedFilter('in-progress')}
                    >
                        <Text
                            style={[
                                styles.filterTabText,
                                selectedFilter === 'in-progress' && styles.filterTabTextActive
                            ]}
                        >
                            In Progress
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.filterTab,
                            selectedFilter === 'completed' && styles.filterTabActive
                        ]}
                        onPress={() => setSelectedFilter('completed')}
                    >
                        <Text
                            style={[
                                styles.filterTabText,
                                selectedFilter === 'completed' && styles.filterTabTextActive
                            ]}
                        >
                            Completed
                        </Text>
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.scrollView}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >
                    {/* Content */}
                    <View style={styles.contentContainer}>
                        {/* Results Summary */}
                        <View style={styles.resultsSummary}>
                            <Text style={styles.resultsText}>
                                {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
                            </Text>
                        </View>

                        {/* Grid Layout */}
                        {filteredCourses.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons
                                    name={selectedFilter === 'completed' ? 'checkmark-done-circle-outline' : 'school-outline'}
                                    size={64}
                                    color="#ddd"
                                />
                                <Text style={styles.emptyText}>
                                    {selectedFilter === 'completed'
                                        ? 'No completed courses yet'
                                        : 'No courses in progress'
                                    }
                                </Text>
                                <Text style={styles.emptySubtext}>
                                    {selectedFilter === 'completed'
                                        ? 'Complete your first course to see it here'
                                        : 'Start learning to see your progress'
                                    }
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.gridContainer}>
                                {filteredCourses.map(renderCourseGridCard)}
                            </View>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </TabBarWrapper>
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
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
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
    filterButtonsContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    filterTab: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        alignItems: 'center',
    },
    filterTabActive: {
        backgroundColor: '#007AFF',
    },
    filterTabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    filterTabTextActive: {
        color: '#fff',
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        paddingBottom: 40,
    },
    resultsSummary: {
        marginBottom: 16,
    },
    resultsText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
    // Grid Card Styles
    courseGridCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
        marginBottom: 12,
    },
    coursePlaceholder: {
        width: '100%',
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    imagePlaceholderContainer: {
        width: '100%',
        height: 140,
        position: 'relative',
        overflow: 'hidden',
    },
    completionBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 4,
    },
    courseGridInfo: {
        padding: 12,
    },
    courseGridTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 4,
        lineHeight: 18,
    },
    courseGridSubject: {
        fontSize: 12,
        color: '#007AFF',
        fontWeight: '600',
        marginBottom: 8,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    progressBar: {
        flex: 1,
        height: 6,
        backgroundColor: '#f0f0f0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#007AFF',
        borderRadius: 3,
    },
    progressText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#007AFF',
        minWidth: 32,
        textAlign: 'right',
    },
    courseGridStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        marginBottom: 8,
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    statLabel: {
        fontSize: 9,
        color: '#999',
        marginTop: 2,
    },
    courseGridViewButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 8,
        borderRadius: 6,
        alignItems: 'center',
    },
    courseGridViewButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
});
