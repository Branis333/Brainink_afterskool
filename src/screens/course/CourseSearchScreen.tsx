/**
 * Course Search/Browse Screen
 * Browse available courses, filter by subject/difficulty, and enroll in new courses
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
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import {
    afterSchoolService,
    Course,
    CourseFilters,
    CourseListResponse,
    StudentAssignment
} from '../../services/afterSchoolService';

type NavigationProp = NativeStackNavigationProp<any>;

interface Props {
    navigation: NavigationProp;
}

const { width } = Dimensions.get('window');

export const CourseSearchScreen: React.FC<Props> = ({ navigation }) => {
    const { token } = useAuth();

    const [courses, setCourses] = useState<Course[]>([]);
    const [courseAssignments, setCourseAssignments] = useState<{ [key: number]: StudentAssignment[] }>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [selectedDifficulty, setSelectedDifficulty] = useState<string>('');
    const [selectedAgeRange, setSelectedAgeRange] = useState<string>('');
    const [sortBy, setSortBy] = useState<'title' | 'created_at' | 'difficulty'>('title');
    const [showFilters, setShowFilters] = useState(false);

    // Available filter options
    const subjects = afterSchoolService.getAvailableSubjects();
    const difficulties = afterSchoolService.getAvailableDifficultyLevels();
    const ageRanges = [
        { label: 'Early (3-6 years)', value: 'early' },
        { label: 'Middle (7-10 years)', value: 'middle' },
        { label: 'Late (11-16 years)', value: 'late' }
    ];
    const sortOptions = [
        { label: 'Title A-Z', value: 'title' },
        { label: 'Newest First', value: 'created_at' },
        { label: 'Difficulty', value: 'difficulty' }
    ];

    // Build filters for API call
    const buildFilters = (): CourseFilters => {
        const filters: CourseFilters = {
            active_only: true,
            sort_by: sortBy,
            sort_order: 'asc',
            limit: 50
        };

        if (searchText.trim()) {
            filters.search = searchText.trim();
        }

        if (selectedSubject) {
            filters.subject = selectedSubject;
        }

        if (selectedDifficulty) {
            filters.difficulty = selectedDifficulty as 'beginner' | 'intermediate' | 'advanced';
        }

        if (selectedAgeRange) {
            filters.age_range = selectedAgeRange as 'early' | 'middle' | 'late';
        }

        return filters;
    };

    // Load courses with filters
    const loadCourses = async (isRefresh: boolean = false) => {
        try {
            if (!isRefresh) setLoading(true);

            if (!token) {
                throw new Error('No authentication token available');
            }

            const filters = buildFilters();
            const response = await afterSchoolService.listCourses(token, filters);
            setCourses(response.courses);

            // Load assignment data for enrolled courses
            const assignmentPromises = response.courses
                .filter(course => course.id) // Only for courses we might be enrolled in
                .map(async (course) => {
                    try {
                        const assignments = await afterSchoolService.getCourseAssignments(course.id, token);
                        return { courseId: course.id, assignments };
                    } catch (error) {
                        // Silently handle cases where user isn't enrolled or no assignments exist
                        return { courseId: course.id, assignments: [] };
                    }
                });

            const assignmentResults = await Promise.all(assignmentPromises);
            const assignmentMap: { [key: number]: StudentAssignment[] } = {};
            assignmentResults.forEach(({ courseId, assignments }) => {
                assignmentMap[courseId] = assignments;
            });
            setCourseAssignments(assignmentMap);
        } catch (error) {
            console.error('Error loading courses:', error);
            Alert.alert(
                'Error',
                'Failed to load courses. Please try again.',
                [{ text: 'OK' }]
            );
        } finally {
            setLoading(false);
            if (isRefresh) setRefreshing(false);
        }
    };

    // Load data on screen focus and when filters change
    useFocusEffect(
        useCallback(() => {
            loadCourses();
        }, [token, searchText, selectedSubject, selectedDifficulty, selectedAgeRange, sortBy])
    );

    // Pull to refresh
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadCourses(true);
    }, []);

    // Navigate to course details
    const navigateToCourse = (course: Course) => {
        navigation.navigate('CourseDetails', {
            courseId: course.id,
            courseTitle: course.title
        });
    };

    // Navigate directly to course assignment workflow
    const navigateToCourseAssignment = (course: Course, assignment: StudentAssignment) => {
        navigation.navigate('CourseAssignment', {
            courseId: course.id,
            assignmentId: assignment.assignment_id,
            assignmentTitle: `Assignment ${assignment.assignment_id}`
        });
    };

    // Navigate to course progress
    const navigateToCourseProgress = (course: Course) => {
        navigation.navigate('CourseProgress', {
            courseId: course.id,
            courseTitle: course.title
        });
    };

    // Get assignment status for display
    const getAssignmentStatus = (course: Course) => {
        const assignments = courseAssignments[course.id] || [];
        const assigned = assignments.filter(a => a.status === 'assigned').length;
        const submitted = assignments.filter(a => a.status === 'submitted').length;
        const graded = assignments.filter(a => a.status === 'graded').length;

        return { total: assignments.length, assigned, submitted, graded };
    };

    // Clear all filters
    const clearFilters = () => {
        setSearchText('');
        setSelectedSubject('');
        setSelectedDifficulty('');
        setSelectedAgeRange('');
        setSortBy('title');
    };

    // Get active filter count
    const getActiveFilterCount = (): number => {
        let count = 0;
        if (searchText.trim()) count++;
        if (selectedSubject) count++;
        if (selectedDifficulty) count++;
        if (selectedAgeRange) count++;
        return count;
    };

    // Render search header
    const renderSearchHeader = () => (
        <View style={styles.searchHeader}>
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search courses..."
                    placeholderTextColor="#999"
                    value={searchText}
                    onChangeText={setSearchText}
                />
                <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => setShowFilters(!showFilters)}
                >
                    <Text style={styles.filterButtonText}>
                        Filters {getActiveFilterCount() > 0 && `(${getActiveFilterCount()})`}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // Render filters panel
    const renderFiltersPanel = () => {
        if (!showFilters) return null;

        return (
            <View style={styles.filtersPanel}>
                {/* Subject Filter */}
                <View style={styles.filterSection}>
                    <Text style={styles.filterSectionTitle}>Subject</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.filterOptions}>
                            <TouchableOpacity
                                style={[styles.filterOption, !selectedSubject && styles.filterOptionActive]}
                                onPress={() => setSelectedSubject('')}
                            >
                                <Text style={[styles.filterOptionText, !selectedSubject && styles.filterOptionActiveText]}>
                                    All
                                </Text>
                            </TouchableOpacity>
                            {subjects.map((subject) => (
                                <TouchableOpacity
                                    key={subject}
                                    style={[styles.filterOption, selectedSubject === subject && styles.filterOptionActive]}
                                    onPress={() => setSelectedSubject(subject === selectedSubject ? '' : subject)}
                                >
                                    <Text style={[styles.filterOptionText, selectedSubject === subject && styles.filterOptionActiveText]}>
                                        {subject}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                </View>

                {/* Difficulty Filter */}
                <View style={styles.filterSection}>
                    <Text style={styles.filterSectionTitle}>Difficulty</Text>
                    <View style={styles.filterOptions}>
                        <TouchableOpacity
                            style={[styles.filterOption, !selectedDifficulty && styles.filterOptionActive]}
                            onPress={() => setSelectedDifficulty('')}
                        >
                            <Text style={[styles.filterOptionText, !selectedDifficulty && styles.filterOptionActiveText]}>
                                All
                            </Text>
                        </TouchableOpacity>
                        {difficulties.map((difficulty) => (
                            <TouchableOpacity
                                key={difficulty}
                                style={[styles.filterOption, selectedDifficulty === difficulty && styles.filterOptionActive]}
                                onPress={() => setSelectedDifficulty(difficulty === selectedDifficulty ? '' : difficulty)}
                            >
                                <Text style={[styles.filterOptionText, selectedDifficulty === difficulty && styles.filterOptionActiveText]}>
                                    {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Age Range Filter */}
                <View style={styles.filterSection}>
                    <Text style={styles.filterSectionTitle}>Age Range</Text>
                    <View style={styles.filterOptions}>
                        <TouchableOpacity
                            style={[styles.filterOption, !selectedAgeRange && styles.filterOptionActive]}
                            onPress={() => setSelectedAgeRange('')}
                        >
                            <Text style={[styles.filterOptionText, !selectedAgeRange && styles.filterOptionActiveText]}>
                                All Ages
                            </Text>
                        </TouchableOpacity>
                        {ageRanges.map((range) => (
                            <TouchableOpacity
                                key={range.value}
                                style={[styles.filterOption, selectedAgeRange === range.value && styles.filterOptionActive]}
                                onPress={() => setSelectedAgeRange(range.value === selectedAgeRange ? '' : range.value)}
                            >
                                <Text style={[styles.filterOptionText, selectedAgeRange === range.value && styles.filterOptionActiveText]}>
                                    {range.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Sort Options */}
                <View style={styles.filterSection}>
                    <Text style={styles.filterSectionTitle}>Sort By</Text>
                    <View style={styles.filterOptions}>
                        {sortOptions.map((option) => (
                            <TouchableOpacity
                                key={option.value}
                                style={[styles.filterOption, sortBy === option.value && styles.filterOptionActive]}
                                onPress={() => setSortBy(option.value as typeof sortBy)}
                            >
                                <Text style={[styles.filterOptionText, sortBy === option.value && styles.filterOptionActiveText]}>
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Clear Filters Button */}
                {getActiveFilterCount() > 0 && (
                    <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
                        <Text style={styles.clearFiltersButtonText}>Clear All Filters</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    // Render course card
    const renderCourseCard = (course: Course) => (
        <TouchableOpacity
            key={course.id}
            style={styles.courseCard}
            onPress={() => navigateToCourse(course)}
            activeOpacity={0.7}
        >
            <View style={styles.courseHeader}>
                <View style={styles.courseInfo}>
                    <Text style={styles.courseTitle} numberOfLines={2}>
                        {course.title}
                    </Text>
                    <Text style={styles.courseSubject}>{course.subject}</Text>
                    <View style={styles.courseMetaRow}>
                        <Text style={styles.courseDifficulty}>
                            {course.difficulty_level.charAt(0).toUpperCase() + course.difficulty_level.slice(1)}
                        </Text>
                        <Text style={styles.courseAgeRange}>
                            Ages {course.age_min}-{course.age_max}
                        </Text>
                    </View>
                </View>
                <View style={styles.enrollButton}>
                    <Text style={styles.enrollButtonText}>View</Text>
                </View>
            </View>

            {/* Course Description */}
            {typeof course.description === 'string' && course.description.trim().length > 0 && (
                <Text style={styles.courseDescription} numberOfLines={3}>
                    {course.description}
                </Text>
            )}

            {/* Assignment Workflow Status */}
            {(() => {
                const assignmentStatus = getAssignmentStatus(course);
                if (assignmentStatus.total > 0) {
                    return (
                        <View style={styles.workflowSection}>
                            <Text style={styles.workflowTitle}>Assignment Progress</Text>
                            <View style={styles.workflowStats}>
                                <View style={styles.workflowStatItem}>
                                    <Text style={styles.workflowStatValue}>{assignmentStatus.assigned}</Text>
                                    <Text style={styles.workflowStatLabel}>Pending</Text>
                                </View>
                                <View style={styles.workflowStatItem}>
                                    <Text style={styles.workflowStatValue}>{assignmentStatus.submitted}</Text>
                                    <Text style={styles.workflowStatLabel}>Submitted</Text>
                                </View>
                                <View style={styles.workflowStatItem}>
                                    <Text style={styles.workflowStatValue}>{assignmentStatus.graded}</Text>
                                    <Text style={styles.workflowStatLabel}>Graded</Text>
                                </View>
                            </View>
                            <View style={styles.workflowActions}>
                                {assignmentStatus.assigned > 0 && (
                                    <TouchableOpacity
                                        style={styles.workflowButton}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            const nextAssignment = (courseAssignments[course.id] || [])
                                                .find(a => a.status === 'assigned');
                                            if (nextAssignment) {
                                                navigateToCourseAssignment(course, nextAssignment);
                                            }
                                        }}
                                    >
                                        <Text style={styles.workflowButtonText}>Continue Workflow</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={styles.progressButton}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        navigateToCourseProgress(course);
                                    }}
                                >
                                    <Text style={styles.progressButtonText}>View Progress</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                }
                return null;
            })()}

            {/* Course Stats */}
            <View style={styles.courseStats}>
                <Text style={styles.courseStatText}>
                    Created: {new Date(course.created_at).toLocaleDateString()}
                </Text>
                <Text style={styles.courseStatText}>
                    {course.is_active ? '🟢 Active' : '🔴 Inactive'}
                </Text>
            </View>
        </TouchableOpacity>
    );

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
                    <Text style={styles.headerTitle}>Browse Courses</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading courses...</Text>
                </View>
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
                <Text style={styles.headerTitle}>Browse Courses</Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                stickyHeaderIndices={[0]}
            >
                <View style={styles.stickyHeader}>
                    {renderSearchHeader()}
                    {renderFiltersPanel()}
                </View>

                <View style={styles.contentContainer}>
                    {/* Results Summary */}
                    <View style={styles.resultsSummary}>
                        <Text style={styles.resultsText}>
                            {courses.length} course{courses.length !== 1 ? 's' : ''} found
                        </Text>
                        {getActiveFilterCount() > 0 && (
                            <Text style={styles.filtersActiveText}>
                                {getActiveFilterCount()} filter{getActiveFilterCount() !== 1 ? 's' : ''} active
                            </Text>
                        )}
                    </View>

                    {/* Courses List */}
                    {courses.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No courses found</Text>
                            <Text style={styles.emptySubtext}>
                                {getActiveFilterCount() > 0
                                    ? 'Try adjusting your search filters'
                                    : 'New courses will appear here when available'
                                }
                            </Text>
                            {getActiveFilterCount() > 0 && (
                                <TouchableOpacity
                                    style={styles.clearFiltersEmptyButton}
                                    onPress={clearFilters}
                                >
                                    <Text style={styles.clearFiltersEmptyButtonText}>Clear Filters</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : (
                        courses.map(renderCourseCard)
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
    stickyHeader: {
        backgroundColor: '#f8f9fa',
    },
    searchHeader: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    searchInput: {
        flex: 1,
        height: 40,
        backgroundColor: '#f8f9fa',
        borderRadius: 20,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#333',
    },
    filterButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#007AFF',
        borderRadius: 20,
    },
    filterButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    filtersPanel: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    filterSection: {
        marginBottom: 16,
    },
    filterSectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    filterOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    filterOption: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#f8f9fa',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#dee2e6',
    },
    filterOptionActive: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    filterOptionText: {
        fontSize: 12,
        color: '#495057',
    },
    filterOptionActiveText: {
        color: '#fff',
    },
    clearFiltersButton: {
        alignSelf: 'center',
        paddingHorizontal: 20,
        paddingVertical: 8,
        backgroundColor: '#6c757d',
        borderRadius: 16,
        marginTop: 8,
    },
    clearFiltersButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
    },
    resultsSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    resultsText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    filtersActiveText: {
        fontSize: 12,
        color: '#007AFF',
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
        marginBottom: 20,
    },
    clearFiltersEmptyButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#007AFF',
        borderRadius: 8,
    },
    clearFiltersEmptyButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    courseCard: {
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
    courseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    courseInfo: {
        flex: 1,
        marginRight: 12,
    },
    courseTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    courseSubject: {
        fontSize: 14,
        color: '#007AFF',
        marginBottom: 4,
    },
    courseMetaRow: {
        flexDirection: 'row',
        gap: 12,
    },
    courseDifficulty: {
        fontSize: 12,
        color: '#666',
        textTransform: 'capitalize',
    },
    courseAgeRange: {
        fontSize: 12,
        color: '#666',
    },
    enrollButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#007AFF',
        borderRadius: 8,
    },
    enrollButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    courseDescription: {
        fontSize: 13,
        color: '#666',
        lineHeight: 18,
        marginBottom: 8,
    },
    courseStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    courseStatText: {
        fontSize: 11,
        color: '#999',
    },
    // Workflow-specific styles
    workflowSection: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
    },
    workflowTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    workflowStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 12,
    },
    workflowStatItem: {
        alignItems: 'center',
    },
    workflowStatValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    workflowStatLabel: {
        fontSize: 10,
        color: '#666',
        marginTop: 2,
    },
    workflowActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    workflowButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        flex: 1,
        marginRight: 8,
    },
    workflowButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    progressButton: {
        backgroundColor: '#f8f9fa',
        borderColor: '#007AFF',
        borderWidth: 1,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        flex: 1,
    },
    progressButtonText: {
        color: '#007AFF',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
});