/**
 * Course Search/Browse Screen
 * Browse available courses, filter by subject/difficulty, and enroll in new courses
 * Grid layout with image placeholders matching design
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
    FlatList,
    Image,
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
import { TabBarWrapper } from '../../components/TabBarWrapper';
import { Ionicons } from '@expo/vector-icons';

type NavigationProp = NativeStackNavigationProp<any>;

interface Props {
    navigation: NavigationProp;
}

const { width } = Dimensions.get('window');
const GRID_COLS = 2;
const GRID_MARGIN = 20;
const CARD_WIDTH = (width - GRID_MARGIN * 2 - 12) / GRID_COLS; // 12 is gap between columns

// Color palette for course placeholders
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

// Subject to icon mapping
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
                <Ionicons name="search" size={18} color="#999" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search courses..."
                    placeholderTextColor="#999"
                    value={searchText}
                    onChangeText={setSearchText}
                />
            </View>
        </View>
    );

    // Render filters panel (simplified for grid layout)
    const renderFiltersPanel = () => {
        return null; // Filters not needed for grid view - search is sufficient
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

        return (
            <TouchableOpacity
                key={course.id}
                style={[styles.courseGridCard, { width: CARD_WIDTH }]}
                onPress={() => navigateToCourse(course)}
                activeOpacity={0.85}
            >
                {/* Image - Display actual image if available, otherwise placeholder */}
                {course.image ? (
                    <Image
                        source={{ uri: `data:image/jpeg;base64,${course.image}` }}
                        style={styles.coursePlaceholder}
                        resizeMode="cover"
                    />
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

                    {/* Difficulty & Age Badge */}
                    <View style={styles.courseGridMeta}>
                        <View style={styles.difficultyBadge}>
                            <Text style={styles.difficultyBadgeText}>
                                {course.difficulty_level.charAt(0).toUpperCase() + course.difficulty_level.slice(1)}
                            </Text>
                        </View>
                    </View>

                    {/* Stats if enrolled */}
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

                    {/* View Button */}
                    <TouchableOpacity
                        style={styles.courseGridViewButton}
                        onPress={() => navigateToCourse(course)}
                    >
                        <Text style={styles.courseGridViewButtonText}>View</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    // Render loading state
    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.searchHeader}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="chevron-back" size={28} color="#1a1a1a" />
                    </TouchableOpacity>
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={18} color="#999" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search courses..."
                            placeholderTextColor="#999"
                            value={searchText}
                            onChangeText={setSearchText}
                        />
                    </View>
                    <TouchableOpacity style={styles.searchButton}>
                        <Text style={styles.searchButtonText}>Search</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading courses...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const filteredCourses = courses.filter(course => {
        const matchesSearch = !searchText.trim() ||
            course.title.toLowerCase().includes(searchText.toLowerCase()) ||
            course.subject.toLowerCase().includes(searchText.toLowerCase());
        return matchesSearch;
    });

    return (
        <TabBarWrapper activeTab="courses" showTabs={true}>
            <SafeAreaView style={styles.container}>
                {/* Search Header */}
                <View style={styles.searchHeader}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="chevron-back" size={28} color="#1a1a1a" />
                    </TouchableOpacity>
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={18} color="#999" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search courses..."
                            placeholderTextColor="#999"
                            value={searchText}
                            onChangeText={setSearchText}
                        />
                        {searchText.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchText('')}>
                                <Ionicons name="close-circle" size={20} color="#999" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity style={styles.searchButton}>
                        <Text style={styles.searchButtonText}>Search</Text>
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
                                {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''} found
                            </Text>
                        </View>

                        {/* Grid Layout */}
                        {filteredCourses.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="search" size={48} color="#ddd" />
                                <Text style={styles.emptyText}>No courses found</Text>
                                <Text style={styles.emptySubtext}>
                                    Try adjusting your search terms
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
    searchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: '#fff',
        gap: 10,
    },
    backButton: {
        padding: 4,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 44,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
    },
    searchButton: {
        paddingHorizontal: 8,
    },
    searchButtonText: {
        fontSize: 17,
        color: '#007AFF',
        fontWeight: '500',
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
    },
    coursePlaceholder: {
        width: '100%',
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
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
    courseGridMeta: {
        marginBottom: 8,
    },
    difficultyBadge: {
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    difficultyBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#666',
        textTransform: 'capitalize',
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