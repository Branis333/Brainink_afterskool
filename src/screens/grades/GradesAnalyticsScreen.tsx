import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
    Alert,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigatorNew';
import { useAuth } from '../../context/AuthContext';
import {
    gradesService,
    LearningAnalytics,
    StudentProgress,
    StudySession
} from '../../services/gradesService';

const { width } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface AnalyticsData {
    analytics: LearningAnalytics;
    progress: StudentProgress[];
    recentSessions: StudySession[];
    weeklyData: Array<{
        day: string;
        sessions: number;
        score: number;
        studyTime: number;
    }>;
    coursePerformance: Array<{
        courseId: number;
        averageScore: number;
        completionRate: number;
        totalTime: number;
    }>;
}

export const GradesAnalyticsScreen: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<7 | 30 | 90>(30);
    const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'trends'>('overview');

    const loadAnalyticsData = async (isRefresh = false) => {
        if (!token) {
            Alert.alert('Error', 'Please log in to view analytics');
            return;
        }

        try {
            if (!isRefresh) setLoading(true);

            // Load analytics for selected period
            const analytics = await gradesService.getLearningAnalytics(token, selectedPeriod);

            // Load progress data
            const progress = await gradesService.getStudentProgress(token);

            // Load recent sessions for trends
            const recentSessions = await gradesService.getUserSessions(token, {
                limit: selectedPeriod === 7 ? 50 : selectedPeriod === 30 ? 100 : 100
            });

            // Generate weekly data for charts
            const weeklyData = generateWeeklyData(recentSessions, selectedPeriod);

            // Calculate course performance
            const coursePerformance = calculateCoursePerformance(progress, recentSessions);

            setAnalyticsData({
                analytics,
                progress,
                recentSessions,
                weeklyData,
                coursePerformance
            });

        } catch (error) {
            console.error('Error loading analytics data:', error);
            Alert.alert('Error', 'Failed to load analytics data. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const generateWeeklyData = (sessions: StudySession[], days: number) => {
        const data = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);

            const dayString = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

            const daySessions = sessions.filter(session => {
                const sessionDate = new Date(session.started_at);
                return sessionDate >= dayStart && sessionDate < dayEnd;
            });

            const averageScore = daySessions.length > 0
                ? daySessions.reduce((sum, s) => sum + (s.ai_score || 0), 0) / daySessions.length
                : 0;

            const totalTime = daySessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

            data.push({
                day: dayString,
                sessions: daySessions.length,
                score: Math.round(averageScore),
                studyTime: totalTime
            });
        }

        return data;
    };

    const calculateCoursePerformance = (progress: StudentProgress[], sessions: StudySession[]) => {
        return progress.map(courseProgress => {
            const courseSessions = sessions.filter(s => s.course_id === courseProgress.course_id);
            const totalTime = courseSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

            return {
                courseId: courseProgress.course_id,
                averageScore: courseProgress.average_score || 0,
                completionRate: courseProgress.completion_percentage,
                totalTime
            };
        });
    };

    useFocusEffect(
        useCallback(() => {
            loadAnalyticsData();
        }, [token, selectedPeriod])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadAnalyticsData(true);
    };

    const getGradeColor = (score: number): string => {
        return gradesService.getScoreColor(score);
    };

    const renderPeriodSelector = () => (
        <View style={styles.periodSelector}>
            {[7, 30, 90].map((period) => (
                <TouchableOpacity
                    key={period}
                    style={[
                        styles.periodButton,
                        selectedPeriod === period && styles.activePeriodButton
                    ]}
                    onPress={() => setSelectedPeriod(period as 7 | 30 | 90)}
                >
                    <Text style={[
                        styles.periodText,
                        selectedPeriod === period && styles.activePeriodText
                    ]}>
                        {period}d
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderOverviewTab = () => {
        if (!analyticsData) return null;

        const { analytics } = analyticsData;
        const formatted = gradesService.formatAnalyticsForDisplay(analytics);
        const encouragement = gradesService.shouldEncourageStudy(analytics);

        return (
            <View style={styles.tabContent}>
                {/* Key Metrics */}
                <View style={styles.metricsGrid}>
                    <View style={styles.metricCard}>
                        <Ionicons name="time" size={24} color="#3B82F6" />
                        <Text style={styles.metricValue}>{formatted.studyTimeFormatted}</Text>
                        <Text style={styles.metricLabel}>Total Study Time</Text>
                    </View>
                    <View style={styles.metricCard}>
                        <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                        <Text style={styles.metricValue}>{formatted.completionRate}%</Text>
                        <Text style={styles.metricLabel}>Completion Rate</Text>
                    </View>
                    <View style={styles.metricCard}>
                        <Ionicons name="trophy" size={24} color="#F59E0B" />
                        <Text style={styles.metricValue}>{formatted.averageScoreFormatted}</Text>
                        <Text style={styles.metricLabel}>Average Score</Text>
                    </View>
                    <View style={styles.metricCard}>
                        <Ionicons name="flame" size={24} color="#EF4444" />
                        <Text style={styles.metricValue}>{analytics.study_streak_days}d</Text>
                        <Text style={styles.metricLabel}>Study Streak</Text>
                    </View>
                </View>

                {/* Study Pattern */}
                <View style={styles.patternCard}>
                    <Text style={styles.cardTitle}>Study Pattern</Text>
                    <View style={styles.patternStats}>
                        <View style={styles.patternItem}>
                            <Text style={styles.patternValue}>{analytics.sessions_per_day.toFixed(1)}</Text>
                            <Text style={styles.patternLabel}>Sessions/Day</Text>
                        </View>
                        <View style={styles.patternItem}>
                            <Text style={styles.patternValue}>{analytics.total_sessions}</Text>
                            <Text style={styles.patternLabel}>Total Sessions</Text>
                        </View>
                        <View style={styles.patternItem}>
                            <Text style={styles.patternValue}>{analytics.completed_sessions}</Text>
                            <Text style={styles.patternLabel}>Completed</Text>
                        </View>
                    </View>
                </View>

                {/* Motivation Message */}
                <View style={[
                    styles.motivationCard,
                    { backgroundColor: encouragement.shouldEncourage ? '#FEF3C7' : '#ECFDF5' }
                ]}>
                    <Ionicons
                        name={encouragement.shouldEncourage ? "bulb" : "checkmark-circle"}
                        size={20}
                        color={encouragement.shouldEncourage ? "#D97706" : "#10B981"}
                    />
                    <Text style={[
                        styles.motivationText,
                        { color: encouragement.shouldEncourage ? "#92400E" : "#065F46" }
                    ]}>
                        {encouragement.message}
                    </Text>
                </View>

                {/* Streak Message */}
                <View style={styles.streakCard}>
                    <Text style={styles.cardTitle}>Study Streak</Text>
                    <Text style={styles.streakMessage}>
                        {formatted.streakMessage}
                    </Text>
                </View>
            </View>
        );
    };

    const renderPerformanceTab = () => {
        if (!analyticsData) return null;

        const { coursePerformance, progress } = analyticsData;

        return (
            <View style={styles.tabContent}>
                {/* Performance Summary */}
                <View style={styles.performanceCard}>
                    <Text style={styles.cardTitle}>Course Performance</Text>
                    {coursePerformance.map((course, index) => (
                        <View key={course.courseId} style={styles.coursePerformanceItem}>
                            <View style={styles.courseHeader}>
                                <Text style={styles.courseTitle}>Course {course.courseId}</Text>
                                <Text style={[
                                    styles.courseScore,
                                    { color: getGradeColor(course.averageScore) }
                                ]}>
                                    {Math.round(course.averageScore)}%
                                </Text>
                            </View>
                            <View style={styles.performanceMetrics}>
                                <View style={styles.performanceMetric}>
                                    <Text style={styles.metricTitle}>Completion</Text>
                                    <View style={styles.progressBarContainer}>
                                        <View
                                            style={[
                                                styles.progressBar,
                                                { width: `${course.completionRate}%` }
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.metricText}>{Math.round(course.completionRate)}%</Text>
                                </View>
                                <View style={styles.performanceMetric}>
                                    <Text style={styles.metricTitle}>Study Time</Text>
                                    <Text style={styles.metricText}>
                                        {gradesService.formatSessionDuration(course.totalTime)}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Score Distribution */}
                <View style={styles.distributionCard}>
                    <Text style={styles.cardTitle}>Score Distribution</Text>
                    <View style={styles.scoreDistribution}>
                        {['A', 'B', 'C', 'D', 'F'].map((grade, index) => {
                            const range = index === 0 ? [90, 100] :
                                index === 1 ? [80, 89] :
                                    index === 2 ? [70, 79] :
                                        index === 3 ? [60, 69] : [0, 59];

                            const count = coursePerformance.filter(c =>
                                c.averageScore >= range[0] && c.averageScore <= range[1]
                            ).length;

                            const percentage = coursePerformance.length > 0
                                ? (count / coursePerformance.length) * 100
                                : 0;

                            return (
                                <View key={grade} style={styles.gradeDistributionItem}>
                                    <Text style={styles.gradeLabel}>{grade}</Text>
                                    <View style={styles.gradeBar}>
                                        <View
                                            style={[
                                                styles.gradeBarFill,
                                                {
                                                    width: `${percentage}%`,
                                                    backgroundColor: getGradeColor(range[0] + 5)
                                                }
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.gradeCount}>{count}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>
            </View>
        );
    };

    const renderTrendsTab = () => {
        if (!analyticsData) return null;

        const { weeklyData } = analyticsData;

        return (
            <View style={styles.tabContent}>
                {/* Weekly Activity Chart */}
                <View style={styles.chartCard}>
                    <Text style={styles.cardTitle}>Weekly Activity</Text>
                    <View style={styles.chart}>
                        <View style={styles.chartData}>
                            {weeklyData.map((day, index) => (
                                <View key={index} style={styles.chartColumn}>
                                    <View style={styles.chartBar}>
                                        <View
                                            style={[
                                                styles.chartBarFill,
                                                {
                                                    height: `${Math.min(day.sessions * 10, 100)}%`,
                                                    backgroundColor: '#3B82F6'
                                                }
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.chartLabel}>{day.day}</Text>
                                </View>
                            ))}
                        </View>
                        <Text style={styles.chartDescription}>Daily study sessions</Text>
                    </View>
                </View>

                {/* Score Trends */}
                <View style={styles.trendCard}>
                    <Text style={styles.cardTitle}>Score Trends</Text>
                    <View style={styles.trendChart}>
                        {weeklyData.map((day, index) => (
                            <View key={index} style={styles.trendPoint}>
                                <View
                                    style={[
                                        styles.trendDot,
                                        { backgroundColor: getGradeColor(day.score) }
                                    ]}
                                />
                                <Text style={styles.trendValue}>{day.score || '--'}</Text>
                            </View>
                        ))}
                    </View>
                    <Text style={styles.chartDescription}>Average daily scores (%)</Text>
                </View>

                {/* Study Time Trends */}
                <View style={styles.studyTimeCard}>
                    <Text style={styles.cardTitle}>Study Time Distribution</Text>
                    <View style={styles.timeDistribution}>
                        {weeklyData.map((day, index) => (
                            <View key={index} style={styles.timeBar}>
                                <Text style={styles.dayLabel}>{day.day}</Text>
                                <View style={styles.timeBarContainer}>
                                    <View
                                        style={[
                                            styles.timeBarFill,
                                            { width: `${Math.min((day.studyTime / 120) * 100, 100)}%` }
                                        ]}
                                    />
                                </View>
                                <Text style={styles.timeValue}>
                                    {day.studyTime > 0 ? `${day.studyTime}m` : '0'}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>Loading analytics...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#1F2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Learning Analytics</Text>
                <TouchableOpacity onPress={() => { }}>
                    <Ionicons name="download" size={24} color="#3B82F6" />
                </TouchableOpacity>
            </View>

            {renderPeriodSelector()}

            {/* Tab Navigation */}
            <View style={styles.tabNavigation}>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'overview' && styles.activeTab]}
                    onPress={() => setActiveTab('overview')}
                >
                    <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
                        Overview
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'performance' && styles.activeTab]}
                    onPress={() => setActiveTab('performance')}
                >
                    <Text style={[styles.tabText, activeTab === 'performance' && styles.activeTabText]}>
                        Performance
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'trends' && styles.activeTab]}
                    onPress={() => setActiveTab('trends')}
                >
                    <Text style={[styles.tabText, activeTab === 'trends' && styles.activeTabText]}>
                        Trends
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                showsVerticalScrollIndicator={false}
            >
                {activeTab === 'overview' && renderOverviewTab()}
                {activeTab === 'performance' && renderPerformanceTab()}
                {activeTab === 'trends' && renderTrendsTab()}

                <View style={styles.bottomSpace} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
        color: '#6B7280',
        marginTop: 12,
    },
    header: {
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    periodSelector: {
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 8,
    },
    periodButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
    },
    activePeriodButton: {
        backgroundColor: '#3B82F6',
    },
    periodText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
    },
    activePeriodText: {
        color: '#FFFFFF',
    },
    tabNavigation: {
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tabButton: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#3B82F6',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
    },
    activeTabText: {
        color: '#3B82F6',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    tabContent: {
        paddingVertical: 20,
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    metricCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        width: (width - 56) / 2,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    metricValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1F2937',
        marginTop: 8,
    },
    metricLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
        textAlign: 'center',
    },
    patternCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 16,
    },
    patternStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    patternItem: {
        alignItems: 'center',
    },
    patternValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#3B82F6',
    },
    patternLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    motivationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    motivationText: {
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 8,
        flex: 1,
    },
    streakCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    streakMessage: {
        fontSize: 16,
        color: '#374151',
        textAlign: 'center',
    },
    performanceCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    coursePerformanceItem: {
        marginBottom: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    courseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    courseTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1F2937',
    },
    courseScore: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    performanceMetrics: {
        gap: 8,
    },
    performanceMetric: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    metricTitle: {
        fontSize: 14,
        color: '#6B7280',
        width: 80,
    },
    progressBarContainer: {
        flex: 1,
        height: 6,
        backgroundColor: '#E5E7EB',
        borderRadius: 3,
        marginHorizontal: 12,
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#3B82F6',
        borderRadius: 3,
    },
    metricText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
        width: 60,
        textAlign: 'right',
    },
    distributionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    scoreDistribution: {
        gap: 12,
    },
    gradeDistributionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    gradeLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1F2937',
        width: 20,
    },
    gradeBar: {
        flex: 1,
        height: 20,
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
    },
    gradeBarFill: {
        height: '100%',
        borderRadius: 10,
        minWidth: 2,
    },
    gradeCount: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        width: 30,
        textAlign: 'right',
    },
    chartCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    chart: {
        alignItems: 'center',
    },
    chartData: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 120,
        gap: 8,
        marginBottom: 12,
    },
    chartColumn: {
        flex: 1,
        alignItems: 'center',
    },
    chartBar: {
        width: 24,
        height: 80,
        backgroundColor: '#F3F4F6',
        borderRadius: 4,
        justifyContent: 'flex-end',
        marginBottom: 8,
    },
    chartBarFill: {
        backgroundColor: '#3B82F6',
        borderRadius: 4,
        minHeight: 2,
    },
    chartLabel: {
        fontSize: 12,
        color: '#6B7280',
    },
    chartDescription: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    trendCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    trendChart: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 20,
        marginBottom: 12,
    },
    trendPoint: {
        alignItems: 'center',
    },
    trendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginBottom: 8,
    },
    trendValue: {
        fontSize: 12,
        color: '#374151',
        fontWeight: '500',
    },
    studyTimeCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    timeDistribution: {
        gap: 8,
    },
    timeBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    dayLabel: {
        fontSize: 14,
        color: '#6B7280',
        width: 40,
    },
    timeBarContainer: {
        flex: 1,
        height: 16,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
    },
    timeBarFill: {
        height: '100%',
        backgroundColor: '#10B981',
        borderRadius: 8,
        minWidth: 2,
    },
    timeValue: {
        fontSize: 12,
        color: '#374151',
        fontWeight: '500',
        width: 40,
        textAlign: 'right',
    },
    bottomSpace: {
        height: 20,
    },
});