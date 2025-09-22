import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    Alert,
    ActivityIndicator,
    FlatList,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigatorNew';
import { useAuth } from '../../context/AuthContext';
import {
    gradesService,
    AISubmission,
    StudySession,
    StudentProgress
} from '../../services/gradesService';

const { width } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface GradeHistoryItem extends AISubmission {
    courseName: string;
    lessonTitle: string;
    sessionDate: string;
}

interface TimelineGroup {
    date: string;
    items: GradeHistoryItem[];
}

interface StatsData {
    totalGrades: number;
    averageScore: number;
    improvementTrend: 'up' | 'down' | 'stable';
    bestSubject: string;
    recentImprovement: number;
}

export const GradeHistoryScreen: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [gradeHistory, setGradeHistory] = useState<GradeHistoryItem[]>([]);
    const [timelineGroups, setTimelineGroups] = useState<TimelineGroup[]>([]);
    const [stats, setStats] = useState<StatsData | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'semester' | 'all'>('month');
    const [viewMode, setViewMode] = useState<'timeline' | 'chart'>('timeline');

    const loadGradeHistory = async (isRefresh = false) => {
        if (!token) {
            Alert.alert('Error', 'Please log in to view grade history');
            return;
        }

        try {
            if (!isRefresh) setLoading(true);

            // Get all user sessions (API max limit is 100)
            const sessions = await gradesService.getUserSessions(token, { limit: 100 });

            // Get submissions for each session
            const allGrades: GradeHistoryItem[] = [];

            for (const session of sessions) {
                try {
                    const sessionSubmissions = await gradesService.getSessionSubmissions(session.id, token);

                    const processedSubmissions = sessionSubmissions
                        .filter(sub => sub.ai_processed && sub.ai_score !== null)
                        .map(submission => ({
                            ...submission,
                            courseName: `Course ${session.course_id}`,
                            lessonTitle: `Lesson ${session.lesson_id}`,
                            sessionDate: session.started_at
                        }));

                    allGrades.push(...processedSubmissions);
                } catch (error) {
                    console.warn(`Error loading submissions for session ${session.id}:`, error);
                }
            }

            // Sort by date (newest first)
            allGrades.sort((a, b) =>
                new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
            );

            // Filter by selected period
            const filteredGrades = filterByPeriod(allGrades, selectedPeriod);
            setGradeHistory(filteredGrades);

            // Group by date for timeline view
            const grouped = groupByDate(filteredGrades);
            setTimelineGroups(grouped);

            // Calculate statistics
            const statistics = calculateStats(filteredGrades);
            setStats(statistics);

        } catch (error) {
            console.error('Error loading grade history:', error);
            Alert.alert('Error', 'Failed to load grade history. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const filterByPeriod = (grades: GradeHistoryItem[], period: string): GradeHistoryItem[] => {
        if (period === 'all') return grades;

        const now = new Date();
        const cutoffDate = new Date();

        switch (period) {
            case 'week':
                cutoffDate.setDate(now.getDate() - 7);
                break;
            case 'month':
                cutoffDate.setMonth(now.getMonth() - 1);
                break;
            case 'semester':
                cutoffDate.setMonth(now.getMonth() - 6);
                break;
        }

        return grades.filter(grade =>
            new Date(grade.submitted_at) >= cutoffDate
        );
    };

    const groupByDate = (grades: GradeHistoryItem[]): TimelineGroup[] => {
        const groups: { [key: string]: GradeHistoryItem[] } = {};

        grades.forEach(grade => {
            const date = new Date(grade.submitted_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(grade);
        });

        return Object.entries(groups).map(([date, items]) => ({
            date,
            items: items.sort((a, b) =>
                new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
            )
        }));
    };

    const calculateStats = (grades: GradeHistoryItem[]): StatsData => {
        if (grades.length === 0) {
            return {
                totalGrades: 0,
                averageScore: 0,
                improvementTrend: 'stable',
                bestSubject: 'None',
                recentImprovement: 0
            };
        }

        const totalGrades = grades.length;
        const averageScore = grades.reduce((sum, grade) => sum + (grade.ai_score || 0), 0) / totalGrades;

        // Calculate improvement trend (compare first half vs second half)
        const midpoint = Math.floor(grades.length / 2);
        const recentGrades = grades.slice(0, midpoint);
        const olderGrades = grades.slice(midpoint);

        const recentAverage = recentGrades.length > 0
            ? recentGrades.reduce((sum, grade) => sum + (grade.ai_score || 0), 0) / recentGrades.length
            : 0;
        const olderAverage = olderGrades.length > 0
            ? olderGrades.reduce((sum, grade) => sum + (grade.ai_score || 0), 0) / olderGrades.length
            : 0;

        const improvement = recentAverage - olderAverage;
        let trend: 'up' | 'down' | 'stable' = 'stable';

        if (improvement > 5) trend = 'up';
        else if (improvement < -5) trend = 'down';

        // Find best performing subject (course)
        const courseScores: { [key: string]: number[] } = {};
        grades.forEach(grade => {
            if (!courseScores[grade.courseName]) {
                courseScores[grade.courseName] = [];
            }
            courseScores[grade.courseName].push(grade.ai_score || 0);
        });

        let bestSubject = 'None';
        let bestAverage = 0;

        Object.entries(courseScores).forEach(([course, scores]) => {
            const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
            if (average > bestAverage) {
                bestAverage = average;
                bestSubject = course;
            }
        });

        return {
            totalGrades,
            averageScore: Math.round(averageScore),
            improvementTrend: trend,
            bestSubject,
            recentImprovement: Math.round(improvement)
        };
    };

    useFocusEffect(
        useCallback(() => {
            loadGradeHistory();
        }, [token, selectedPeriod])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadGradeHistory(true);
    };

    const getGradeColor = (score: number): string => {
        return gradesService.getScoreColor(score);
    };

    const getSubmissionIcon = (type: string) => {
        switch (type) {
            case 'homework': return 'book';
            case 'quiz': return 'help-circle';
            case 'practice': return 'fitness';
            case 'assessment': return 'school';
            default: return 'document-text';
        }
    };

    const getTrendIcon = (trend: string) => {
        switch (trend) {
            case 'up': return 'trending-up';
            case 'down': return 'trending-down';
            default: return 'remove';
        }
    };

    const getTrendColor = (trend: string) => {
        switch (trend) {
            case 'up': return '#10B981';
            case 'down': return '#EF4444';
            default: return '#6B7280';
        }
    };

    const renderPeriodSelector = () => (
        <View style={styles.periodSelector}>
            {[
                { key: 'week', label: 'Week' },
                { key: 'month', label: 'Month' },
                { key: 'semester', label: 'Semester' },
                { key: 'all', label: 'All Time' }
            ].map((period) => (
                <TouchableOpacity
                    key={period.key}
                    style={[
                        styles.periodButton,
                        selectedPeriod === period.key && styles.activePeriodButton
                    ]}
                    onPress={() => setSelectedPeriod(period.key as any)}
                >
                    <Text style={[
                        styles.periodText,
                        selectedPeriod === period.key && styles.activePeriodText
                    ]}>
                        {period.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderStatsCard = () => {
        if (!stats) return null;

        return (
            <View style={styles.statsCard}>
                <Text style={styles.cardTitle}>Performance Summary</Text>
                <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{stats.totalGrades}</Text>
                        <Text style={styles.statLabel}>Total Grades</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: getGradeColor(stats.averageScore) }]}>
                            {stats.averageScore}%
                        </Text>
                        <Text style={styles.statLabel}>Average</Text>
                    </View>
                    <View style={styles.statItem}>
                        <View style={styles.trendContainer}>
                            <Ionicons
                                name={getTrendIcon(stats.improvementTrend)}
                                size={20}
                                color={getTrendColor(stats.improvementTrend)}
                            />
                            <Text style={[styles.trendValue, { color: getTrendColor(stats.improvementTrend) }]}>
                                {stats.recentImprovement > 0 ? '+' : ''}{stats.recentImprovement}%
                            </Text>
                        </View>
                        <Text style={styles.statLabel}>Trend</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue} numberOfLines={1}>
                            {stats.bestSubject.replace('Course ', 'C')}
                        </Text>
                        <Text style={styles.statLabel}>Best Subject</Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderGradeItem = (grade: GradeHistoryItem) => (
        <TouchableOpacity
            key={grade.id}
            style={styles.gradeItem}
            onPress={() => navigation.navigate('GradeDetails', {
                submissionId: grade.id,
                submissionType: grade.submission_type
            })}
        >
            <View style={styles.gradeItemLeft}>
                <View style={styles.gradeIcon}>
                    <Ionicons
                        name={getSubmissionIcon(grade.submission_type)}
                        size={16}
                        color="#3B82F6"
                    />
                </View>
                <View style={styles.gradeInfo}>
                    <Text style={styles.gradeTitle}>
                        {grade.submission_type.charAt(0).toUpperCase() +
                            grade.submission_type.slice(1)}
                    </Text>
                    <Text style={styles.gradeSubtitle}>
                        {grade.courseName} • {grade.lessonTitle}
                    </Text>
                    <Text style={styles.gradeTime}>
                        {new Date(grade.submitted_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </Text>
                </View>
            </View>
            <View style={styles.gradeItemRight}>
                <View style={[styles.scoreContainer, {
                    backgroundColor: getGradeColor(grade.ai_score || 0) + '20'
                }]}>
                    <Text style={[styles.scoreText, {
                        color: getGradeColor(grade.ai_score || 0)
                    }]}>
                        {Math.round(grade.ai_score || 0)}%
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
            </View>
        </TouchableOpacity>
    );

    const renderTimelineGroup = ({ item }: { item: TimelineGroup }) => (
        <View style={styles.timelineGroup}>
            <View style={styles.dateHeader}>
                <View style={styles.dateLine} />
                <Text style={styles.dateText}>{item.date}</Text>
                <View style={styles.dateLine} />
            </View>
            {item.items.map(grade => renderGradeItem(grade))}
        </View>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Grade History</Text>
            <Text style={styles.emptySubtitle}>
                Complete assignments to build your grade history.
            </Text>
            <TouchableOpacity
                style={styles.exploreButton}
                onPress={() => navigation.navigate('CourseHomepage')}
            >
                <Text style={styles.exploreButtonText}>Explore Courses</Text>
            </TouchableOpacity>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>Loading grade history...</Text>
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
                <Text style={styles.headerTitle}>Grade History</Text>
                <TouchableOpacity onPress={() => navigation.navigate('GradesAnalytics')}>
                    <Ionicons name="analytics" size={24} color="#3B82F6" />
                </TouchableOpacity>
            </View>

            {renderPeriodSelector()}

            <FlatList
                data={timelineGroups}
                keyExtractor={(item) => item.date}
                renderItem={renderTimelineGroup}
                ListHeaderComponent={renderStatsCard}
                ListEmptyComponent={renderEmptyState}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                contentContainerStyle={timelineGroups.length === 0 ? styles.emptyListContainer : undefined}
                showsVerticalScrollIndicator={false}
                style={styles.content}
            />
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
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
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
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    statsCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginTop: 20,
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
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
    },
    trendContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    trendValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    timelineGroup: {
        marginBottom: 24,
    },
    dateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    dateLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E5E7EB',
    },
    dateText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        marginHorizontal: 16,
        backgroundColor: '#F9FAFB',
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    gradeItem: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    gradeItemLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    gradeIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#EBF5FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    gradeInfo: {
        flex: 1,
    },
    gradeTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 2,
    },
    gradeSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 2,
    },
    gradeTime: {
        fontSize: 11,
        color: '#9CA3AF',
    },
    gradeItemRight: {
        alignItems: 'flex-end',
        gap: 4,
    },
    scoreContainer: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    scoreText: {
        fontSize: 14,
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyListContainer: {
        flexGrow: 1,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#374151',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 16,
        color: '#9CA3AF',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    exploreButton: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    exploreButtonText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '500',
    },
});