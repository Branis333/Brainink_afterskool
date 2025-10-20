/**
 * Course Homepage Screen
 * Main dashboard showing enrolled courses, recent activity, and progress overview
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
    Alert,
    ActivityIndicator,
    FlatList,
    StatusBar,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { afterSchoolService, Course, StudentDashboard, StudentProgress } from '../services/afterSchoolService';
import { Ionicons } from '@expo/vector-icons';
import { TabBarWrapper } from '../components/TabBarWrapper';

type NavigationProp = NativeStackNavigationProp<any>;

interface Props {
    navigation: NavigationProp;
}

type CourseCategory = 'all' | 'in-progress' | 'completed' | 'beginner' | 'intermediate' | 'advanced';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.42; // Wider cards to match screenshot
const CARD_MARGIN = 10;

export const CourseHomepageScreen: React.FC<Props> = ({ navigation }) => {
    const { token, user } = useAuth();
    const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<CourseCategory>('all');
    const [statusBarStyle, setStatusBarStyle] = useState<'light-content' | 'dark-content'>('dark-content');

    // Load dashboard data
    const loadDashboard = async (isRefresh: boolean = false) => {
        try {
            if (!isRefresh) setLoading(true);

            if (!token) {
                throw new Error('No authentication token available');
            }

            const dashboardData = await afterSchoolService.getStudentDashboard(token);
            setDashboard(dashboardData);
            setLoadError(null);
        } catch (error) {
            console.error('Error loading dashboard:', error);

            // Check if it's a database connection error
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isDatabaseError = errorMessage.includes('Database connection error');

            // Save a simplified error for UI fallback instead of spamming Alerts on focus
            setLoadError(
                isDatabaseError
                    ? 'Unable to reach the server right now.'
                    : 'Failed to load your dashboard.'
            );
        } finally {
            setLoading(false);
            if (isRefresh) setRefreshing(false);
        }
    };

    // Load data on screen focus
    useFocusEffect(
        useCallback(() => {
            loadDashboard();
        }, [token])
    );

    // Pull to refresh
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadDashboard(true);
    }, []);

    // Navigate to course details
    const navigateToCourse = (course: Course) => {
        navigation.navigate('CourseDetails', { courseId: course.id, courseTitle: course.title });
    };

    // Navigate to course search
    const navigateToCourseSearch = () => {
        navigation.navigate('CourseSearch');
    };

    // Navigate to course progress
    const navigateToProgress = (courseId: number, courseTitle: string) => {
        navigation.navigate('CourseProgress', { courseId, courseTitle });
    };

    // Navigate directly to course assignments (New workflow)
    const navigateToAssignments = (course: Course) => {
        navigation.navigate('CourseAssignments', {
            courseId: course.id,
            courseTitle: course.title,
            enableWorkflow: true
        });
    };

    // Navigate to continue learning workflow
    const continueWorkflow = (course: Course) => {
        // This will take user to the next available assignment
        navigation.navigate('CourseDetails', {
            courseId: course.id,
            courseTitle: course.title,
            autoStartWorkflow: true
        });
    };

    // Get progress percentage for a course
    const getProgressPercentage = (courseId: number): number => {
        if (!dashboard?.progress_summary) return 0;
        const progress = dashboard.progress_summary.find(p => p.course_id === courseId);
        return progress?.completion_percentage || 0;
    };

    // Format study time
    const formatStudyTime = (minutes: number): string => {
        if (minutes < 60) {
            return `${minutes}m`;
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    };

    // Get workflow status for a course (New for workflow)
    const getWorkflowStatus = (courseId: number): {
        hasAvailableAssignments: boolean;
        nextAction: string;
        canContinue: boolean;
    } => {
        // This would be enhanced to check actual assignments from the dashboard
        // For now, return default workflow-ready state
        return {
            hasAvailableAssignments: true,
            nextAction: 'Continue Learning',
            canContinue: true
        };
    };

    // Filter courses by category
    const getFilteredCourses = (category: CourseCategory): Course[] => {
        if (!dashboard?.active_courses) return [];

        switch (category) {
            case 'all':
                return dashboard.active_courses;
            case 'in-progress':
                return dashboard.active_courses.filter(course => {
                    const progress = getProgressPercentage(course.id);
                    return progress > 0 && progress < 100;
                });
            case 'completed':
                return dashboard.active_courses.filter(course => {
                    const progress = getProgressPercentage(course.id);
                    return progress >= 100;
                });
            case 'beginner':
            case 'intermediate':
            case 'advanced':
                return dashboard.active_courses.filter(course =>
                    course.difficulty_level.toLowerCase() === category
                );
            default:
                return dashboard.active_courses;
        }
    };

    // Group courses by subject
    const getCoursesBySubject = (): { [key: string]: Course[] } => {
        if (!dashboard?.active_courses) return {};

        const grouped: { [key: string]: Course[] } = {};
        dashboard.active_courses.forEach(course => {
            const subject = course.subject || 'Other';
            if (!grouped[subject]) {
                grouped[subject] = [];
            }
            grouped[subject].push(course);
        });
        return grouped;
    };

    // Render loading state
    if (loading) {
        return (
            <SafeAreaView style={styles.fullscreenContainer} edges={['top', 'left', 'right']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#26D9CA" />
                    <Text style={styles.loadingText}>Loading your courses...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Render header section (inspired by screenshot 1)
    const renderHeader = () => (
        <View style={styles.headerContainer}>
            {/* Top Navigation Bar */}
            <View style={styles.topNav}>
                <TouchableOpacity style={styles.menuButton}>
                    <Ionicons name="menu" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerIcons}>
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => navigation.navigate('UploadsOverview')}
                    >
                        <Ionicons name="cloud-upload-outline" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => navigation.navigate('GradesOverview')}
                    >
                        <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Hero Section */}
            <View style={styles.heroSection}>
                <Text style={styles.heroTitle}>Find Your{'\n'}Favorite Course</Text>

                {/* Search Bar (transparent + blur) */}
                <TouchableOpacity onPress={navigateToCourseSearch} activeOpacity={0.8}>
                    <BlurView intensity={60} tint="light" style={styles.searchBarBlur}>
                        <View style={styles.searchBarInner}>
                            <Ionicons name="search-outline" size={20} color="#999" />
                            <Text style={styles.searchPlaceholder}>Search anything...</Text>
                            <TouchableOpacity style={styles.filterButton}>
                                <Ionicons name="options-outline" size={20} color="#26D9CA" />
                            </TouchableOpacity>
                        </View>
                    </BlurView>
                </TouchableOpacity>
            </View>
        </View>
    );

    // Render horizontal course card (carousel style)
    const renderHorizontalCourseCard = (course: Course, index: number) => {
        const progressPercentage = getProgressPercentage(course.id);
        const isCompleted = progressPercentage >= 100;

        return (
            <TouchableOpacity
                style={styles.horizontalCourseCard}
                onPress={() => navigateToCourse(course)}
                activeOpacity={0.8}
            >
                {/* Card Image - Display actual image if available, otherwise placeholder */}
                {course.image ? (
                    <Image
                        source={{ uri: `data:image/jpeg;base64,${course.image}` }}
                        style={styles.cardImagePlaceholder}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[styles.cardImagePlaceholder, { backgroundColor: getCardColor(index) }]}>
                        <Ionicons name="book-outline" size={28} color="white" />
                    </View>
                )}

                {/* Course Info */}
                <View style={styles.horizontalCardContent}>
                    <View style={styles.cardBadge}>
                        <Text style={styles.cardBadgeText}>
                            {course.difficulty_level ? course.difficulty_level.charAt(0).toUpperCase() + course.difficulty_level.slice(1) : 'Course'}
                        </Text>
                    </View>

                    <Text style={styles.horizontalCourseTitle} numberOfLines={2}>
                        {course.title || 'Untitled Course'}
                    </Text>

                    <Text style={styles.horizontalCourseSubject} numberOfLines={1}>
                        {course.subject || 'General'}
                    </Text>

                    {/* Meta Info */}
                    <View style={styles.horizontalMetaRow}>
                        <View style={styles.metaItem}>
                            <Ionicons name="star" size={14} color="#FFB800" />
                            <Text style={styles.metaText}>{progressPercentage >= 100 ? '5.0' : '4.9'}</Text>
                            <Text style={styles.metaSubtext}>
                                ({course.total_weeks || 8} weeks)
                            </Text>
                        </View>
                    </View>

                    <View style={styles.horizontalMetaRow}>
                        <View style={styles.metaItem}>
                            <Ionicons name="time-outline" size={14} color="#26D9CA" />
                            <Text style={styles.metaText}>{course.blocks_per_week || 2} blocks</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Ionicons name="calendar-outline" size={14} color="#26D9CA" />
                            <Text style={styles.metaText}>{course.total_weeks || 8} weeks</Text>
                        </View>
                    </View>

                    {/* Progress indicator */}
                    {progressPercentage > 0 && (
                        <View style={styles.miniProgressContainer}>
                            <View style={styles.miniProgressBar}>
                                <View style={[styles.miniProgressFill, { width: `${progressPercentage}%` }]} />
                            </View>
                            <Text style={styles.miniProgressText}>{Math.round(progressPercentage)}%</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    // Helper to get card color based on index
    const getCardColor = (index: number): string => {
        const colors = ['#7B68EE', '#26D9CA', '#FF8B94', '#4ECDC4', '#95E1D3', '#FFB6B9'];
        return colors[index % colors.length];
    };

    // Render category filter buttons
    const renderCategoryFilters = () => {
        const categories: { key: CourseCategory; label: string; icon: string }[] = [
            { key: 'all', label: 'All', icon: 'apps-outline' },
            { key: 'in-progress', label: 'In Progress', icon: 'hourglass-outline' },
            { key: 'completed', label: 'Completed', icon: 'checkmark-circle-outline' },
            { key: 'beginner', label: 'Beginner', icon: 'leaf-outline' },
            { key: 'intermediate', label: 'Intermediate', icon: 'trending-up-outline' },
            { key: 'advanced', label: 'Advanced', icon: 'rocket-outline' },
        ];

        return (
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
                contentContainerStyle={styles.categoryScrollContent}
            >
                {categories.map((category) => (
                    <TouchableOpacity
                        key={category.key}
                        style={[
                            styles.categoryButton,
                            selectedCategory === category.key && styles.categoryButtonActive
                        ]}
                        onPress={() => setSelectedCategory(category.key)}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={category.icon as any}
                            size={18}
                            color={selectedCategory === category.key ? '#fff' : '#26D9CA'}
                        />
                        <Text style={[
                            styles.categoryButtonText,
                            selectedCategory === category.key && styles.categoryButtonTextActive
                        ]}>
                            {category.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        );
    };

    // Render horizontal course carousel
    const renderCourseCarousel = (title: string, courses: Course[]) => {
        if (!courses.length) return null;

        return (
            <View style={styles.carouselSection}>
                <View style={styles.carouselHeader}>
                    <Text style={styles.carouselTitle}>{title}</Text>
                    <TouchableOpacity onPress={navigateToCourseSearch}>
                        <Text style={styles.seeAllText}>See all</Text>
                    </TouchableOpacity>
                </View>
                <FlatList
                    horizontal
                    data={courses}
                    renderItem={({ item, index }) => renderHorizontalCourseCard(item, index)}
                    keyExtractor={(item) => `course-${item.id}`}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.carouselContent}
                    snapToInterval={CARD_WIDTH + CARD_MARGIN}
                    decelerationRate="fast"
                />
            </View>
        );
    };

    // Render categories section (inspired by screenshot 1)
    const renderCategoriesSection = () => {
        const coursesBySubject = getCoursesBySubject();
        const subjects = Object.keys(coursesBySubject);

        if (subjects.length === 0) return null;

        return (
            <View style={styles.categoriesSection}>
                <View style={styles.carouselHeader}>
                    <Text style={styles.carouselTitle}>Categories</Text>
                    <TouchableOpacity onPress={navigateToCourseSearch}>
                        <Text style={styles.seeAllText}>See all</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.categoriesGrid}>
                    {subjects.slice(0, 4).map((subject, index) => (
                        <TouchableOpacity
                            key={subject}
                            style={[styles.categoryCard, { backgroundColor: getCategoryCardColor(index) }]}
                            onPress={navigateToCourseSearch}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.categoryCardTitle}>{subject}</Text>
                            <Text style={styles.categoryCardCount}>
                                {coursesBySubject[subject].length}+ courses
                            </Text>
                            <View style={styles.categoryCardIcon}>
                                <Ionicons name="arrow-forward" size={20} color="#1a1a1a" />
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    };

    // Get category card colors
    const getCategoryCardColor = (index: number): string => {
        const colors = ['#E8E5FF', '#FFEAA7', '#FFE5E5', '#D4F1F4'];
        return colors[index % colors.length];
    };

    // Render main content
    const renderMainContent = () => {
        if (loadError && !dashboard) {
            return (
                <View style={styles.emptyStateSection}>
                    <Ionicons name="cloud-offline-outline" size={64} color="#ccc" />
                    <Text style={styles.emptyStateText}>Dashboard Unavailable</Text>
                    <Text style={styles.emptyStateSubtext}>{loadError}</Text>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => loadDashboard()}
                    >
                        <Text style={styles.primaryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (!dashboard?.active_courses?.length) {
            return (
                <View style={styles.emptyStateSection}>
                    <Ionicons name="school-outline" size={64} color="#ccc" />
                    <Text style={styles.emptyStateText}>No courses enrolled</Text>
                    <Text style={styles.emptyStateSubtext}>Discover and enroll in courses to start learning</Text>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={navigateToCourseSearch}
                    >
                        <Text style={styles.primaryButtonText}>Find Courses</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        const filteredCourses = getFilteredCourses(selectedCategory);
        const coursesBySubject = getCoursesBySubject();
        const subjects = Object.keys(coursesBySubject);

        return (
            <>
                {/* Category Filters */}
                {renderCategoryFilters()}

                {/* Popular/Featured Courses Carousel */}
                {filteredCourses.length > 0 && renderCourseCarousel('Popular Courses', filteredCourses)}

                {/* Subject-based Carousels */}
                {subjects.map(subject => (
                    <React.Fragment key={subject}>
                        {renderCourseCarousel(subject, coursesBySubject[subject])}
                    </React.Fragment>
                ))}

                {/* Categories Grid Section */}
                {renderCategoriesSection()}

                {/* Quick Actions Section (inspired by screenshot 2) */}
                <View style={styles.quickActionsSection}>
                    <TouchableOpacity
                        style={styles.quickActionCard}
                        onPress={() => navigation.navigate('GradesOverview')}
                    >
                        <View style={[styles.quickActionIcon, { backgroundColor: '#FFE5E5' }]}>
                            <Ionicons name="trophy-outline" size={24} color="#FF6B6B" />
                        </View>
                        <Text style={styles.quickActionTitle}>My Grades</Text>
                        <Text style={styles.quickActionSubtext}>
                            Avg: {dashboard?.average_score ? `${Math.round(dashboard.average_score)}%` : 'N/A'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.quickActionCard}
                        onPress={navigateToCourseSearch}
                    >
                        <View style={[styles.quickActionIcon, { backgroundColor: '#E8F5E9' }]}>
                            <Ionicons name="add-circle-outline" size={24} color="#4CAF50" />
                        </View>
                        <Text style={styles.quickActionTitle}>New Course</Text>
                        <Text style={styles.quickActionSubtext}>Explore more</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.quickActionCard}
                        onPress={() => navigation.navigate('UploadsOverview')}
                    >
                        <View style={[styles.quickActionIcon, { backgroundColor: '#E3F2FD' }]}>
                            <Ionicons name="cloud-upload-outline" size={24} color="#2196F3" />
                        </View>
                        <Text style={styles.quickActionTitle}>Uploads</Text>
                        <Text style={styles.quickActionSubtext}>Manage files</Text>
                    </TouchableOpacity>
                </View>
            </>
        );
    };

    // Handle scroll event to change status bar
    const handleScroll = (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        // Change status bar style based on scroll position
        // If scrolled past the purple header (approx 300px), use dark status bar
        if (offsetY > 250) {
            setStatusBarStyle('dark-content');
        } else {
            setStatusBarStyle('light-content');
        }
    };

    return (
        <TabBarWrapper activeTab="home" showTabs={true}>
            <View style={styles.container}>
                <StatusBar
                    barStyle="dark-content"
                    backgroundColor="transparent"
                    translucent={true}
                    animated={true}
                />
                <ScrollView
                    style={styles.scrollView}
                    showsVerticalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#26D9CA"
                            colors={['#26D9CA']}
                        />
                    }
                    contentInsetAdjustmentBehavior="automatic"
                >
                    {renderHeader()}
                    {renderMainContent()}
                </ScrollView>

                {/* Subtle blur overlay for status bar area with gradient fade */}
                <View style={styles.statusBarBlurContainer} pointerEvents="none">
                    <BlurView
                        intensity={3}
                        tint="light"
                        style={styles.statusBarBlur}
                    />
                    {/* Multiple layers to create fade effect */}
                    <View style={[styles.blurFadeLayer, { bottom: 0, height: 15, opacity: 0.6 }]} />
                    <View style={[styles.blurFadeLayer, { bottom: 0, height: 10, opacity: 0.4 }]} />
                    <View style={[styles.blurFadeLayer, { bottom: 0, height: 5, opacity: 0.3 }]} />
                </View>
            </View>
        </TabBarWrapper>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    fullscreenContainer: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    scrollView: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    statusBarBlurContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
        zIndex: 999,
        overflow: 'hidden',
    },
    statusBarBlur: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
    },
    blurFadeLayer: {
        position: 'absolute',
        left: 0,
        right: 0,
        backgroundColor: '#ffffff02',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#FFFFFF',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },

    // Header Styles
    headerContainer: {
        backgroundColor: '#7B68EE',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        paddingTop: 20,
        paddingBottom: 30,
        paddingHorizontal: 20,
        marginTop: 10,
    },
    topNav: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    menuButton: {
        width: 40,
        height: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerIcons: {
        flexDirection: 'row',
        gap: 12,
    },
    iconButton: {
        width: 40,
        height: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroSection: {
        marginTop: 8,
    },
    heroTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 20,
        lineHeight: 38,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
    },
    searchBarBlur: {
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 12,
    },
    searchBarInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
        backgroundColor: 'rgba(255,255,255,0.4)',
        borderRadius: 16,
    },
    searchPlaceholder: {
        flex: 1,
        fontSize: 15,
        color: '#999',
    },
    filterButton: {
        width: 36,
        height: 36,
        backgroundColor: '#F0F0F0',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Category Filter Styles
    categoryScroll: {
        marginTop: 20,
        marginBottom: 8,
    },
    categoryScrollContent: {
        paddingHorizontal: 20,
        gap: 10,
    },
    categoryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#E8F8F7',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#26D9CA',
        gap: 6,
    },
    categoryButtonActive: {
        backgroundColor: '#26D9CA',
        borderColor: '#26D9CA',
    },
    categoryButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#26D9CA',
    },
    categoryButtonTextActive: {
        color: '#FFFFFF',
    },

    // Carousel Styles
    carouselSection: {
        marginTop: 24,
        marginBottom: 16,
    },
    carouselHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    carouselTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    seeAllText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#26D9CA',
    },
    carouselContent: {
        paddingHorizontal: 20,
        gap: CARD_MARGIN,
    },

    // Horizontal Course Card Styles
    horizontalCourseCard: {
        width: CARD_WIDTH,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    cardImagePlaceholder: {
        width: '100%',
        height: 85,
        justifyContent: 'center',
        alignItems: 'center',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        overflow: 'hidden',
    },
    horizontalCardContent: {
        padding: 8,
    },
    cardBadge: {
        backgroundColor: '#FFE9E0',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginBottom: 6,
    },
    cardBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FF6B35',
    },
    horizontalCourseTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 3,
        lineHeight: 15,
    },
    horizontalCourseSubject: {
        fontSize: 13,
        color: '#26D9CA',
        marginBottom: 6,
        fontWeight: '500',
    },
    horizontalMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 6,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    metaSubtext: {
        fontSize: 11,
        color: '#999',
    },
    miniProgressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    miniProgressBar: {
        flex: 1,
        height: 4,
        backgroundColor: '#E0E0E0',
        borderRadius: 2,
    },
    miniProgressFill: {
        height: '100%',
        backgroundColor: '#26D9CA',
        borderRadius: 2,
    },
    miniProgressText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#26D9CA',
    },

    // Categories Grid Section
    categoriesSection: {
        marginTop: 24,
        marginBottom: 16,
        paddingHorizontal: 20,
    },
    categoriesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    categoryCard: {
        width: (width - 52) / 2,
        padding: 16,
        borderRadius: 16,
        minHeight: 120,
        justifyContent: 'space-between',
    },
    categoryCardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    categoryCardCount: {
        fontSize: 12,
        color: '#666',
        marginBottom: 8,
    },
    categoryCardIcon: {
        width: 32,
        height: 32,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'flex-end',
    },

    // Quick Actions Section
    quickActionsSection: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 20,
        marginTop: 24,
        marginBottom: 32,
    },
    quickActionCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    quickActionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    quickActionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    quickActionSubtext: {
        fontSize: 11,
        color: '#999',
    },

    // Empty State
    emptyStateSection: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 32,
    },
    emptyStateText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1a1a1a',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyStateSubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    primaryButton: {
        backgroundColor: '#26D9CA',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
        minWidth: 160,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
    },

    // Legacy styles (kept for compatibility)
    welcomeContainer: {
        backgroundColor: '#007AFF',
        padding: 20,
        paddingTop: 10,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        marginBottom: 24,
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
    welcomeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
        paddingTop: 8,
    },
    welcomeText: {
        fontSize: 18,
        color: 'rgba(255, 255, 255, 0.9)',
        marginBottom: 6,
        fontWeight: '500',
    },
    userNameText: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.5,
    },
    gradesButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    gradesButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    headerButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    headerButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    headerButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 12,
        marginTop: 8,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statNumber: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
    },
    statLabel: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.9)',
        marginTop: 4,
        fontWeight: '500',
    },
    sectionContainer: {
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    browseButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#007AFF',
        borderRadius: 20,
    },
    browseButtonText: {
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
    completedCourseCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#28a745',
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
        marginBottom: 2,
    },
    courseTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    aiBadge: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
        marginLeft: 8,
    },
    aiBadgeText: {
        fontSize: 10,
        color: '#10b981',
        fontWeight: '600',
    },
    courseMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 2,
    },
    courseDifficulty: {
        fontSize: 12,
        color: '#666',
        textTransform: 'capitalize',
        flex: 1,
    },
    courseDuration: {
        fontSize: 11,
        color: '#888',
        textAlign: 'right',
        flex: 1,
    },
    courseActions: {
        alignItems: 'flex-end',
        gap: 6,
    },
    workflowButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#007AFF',
        borderRadius: 8,
    },
    workflowButtonText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '600',
    },
    progressButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#f0f0f0',
        borderRadius: 6,
    },
    progressButtonText: {
        fontSize: 12,
        color: '#007AFF',
        fontWeight: '600',
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    progressBar: {
        flex: 1,
        height: 6,
        backgroundColor: '#e0e0e0',
        borderRadius: 3,
        marginRight: 8,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#007AFF',
        borderRadius: 3,
    },
    completedProgressFill: {
        backgroundColor: '#28a745',
    },
    progressText: {
        fontSize: 12,
        color: '#666',
        minWidth: 35,
    },
    courseDescription: {
        fontSize: 13,
        color: '#666',
        lineHeight: 18,
        marginBottom: 8,
    },
    workflowIndicator: {
        backgroundColor: '#e8f5e8',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginBottom: 8,
        alignSelf: 'flex-start',
    },
    workflowIndicatorText: {
        fontSize: 11,
        color: '#28a745',
        fontWeight: '600',
    },
    statusContainer: {
        alignItems: 'flex-start',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#e3f2fd',
        borderRadius: 12,
    },
    completedBadge: {
        backgroundColor: '#e8f5e8',
    },
    statusText: {
        fontSize: 11,
        color: '#007AFF',
        fontWeight: '600',
    },
    completedStatusText: {
        color: '#28a745',
    },
    sessionCard: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    sessionInfo: {
        flex: 1,
    },
    sessionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 2,
    },
    sessionDetails: {
        fontSize: 12,
        color: '#666',
        marginBottom: 2,
    },
    sessionTime: {
        fontSize: 11,
        color: '#999',
    },
    scoreContainer: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#f0f8ff',
        borderRadius: 6,
    },
    scoreText: {
        fontSize: 12,
        color: '#007AFF',
        fontWeight: '600',
    },
    emptyStateContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    enrollButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: '#26D9CA',
        borderRadius: 12,
    },
    enrollButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});