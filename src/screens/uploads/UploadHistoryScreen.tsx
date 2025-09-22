/**
 * Upload History Screen
 * Timeline-based view of all upload activities with detailed logs and historical analysis
 * Shows chronological history of uploads with statistics and filtering capabilities
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    RefreshControl,
    Modal,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigatorNew';
import { uploadsService, AISubmission } from '../../services/uploadsService';
import { useAuth } from '../../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'UploadHistory'>;

interface HistoryEntry {
    id: string;
    date: Date;
    submission: AISubmission;
    action: 'uploaded' | 'processed' | 'graded' | 'reviewed' | 'reprocessed';
    actionDescription: string;
}

interface HistoryGroup {
    date: string;
    entries: HistoryEntry[];
    totalUploads: number;
    averageScore: number;
    totalSize: number;
}

interface HistoryStats {
    totalUploads: number;
    totalSize: number;
    averageScore: number;
    mostActiveDay: string;
    favoriteSubmissionType: string;
    uploadStreak: number;
    bestScore: number;
    improvementTrend: 'up' | 'down' | 'stable';
}

interface DateFilter {
    period: 'all' | 'today' | 'week' | 'month' | '3months' | '6months' | 'year';
    label: string;
}

export const UploadHistoryScreen: React.FC<Props> = ({ navigation }) => {
    const { token, user } = useAuth();
    const [historyGroups, setHistoryGroups] = useState<HistoryGroup[]>([]);
    const [historyStats, setHistoryStats] = useState<HistoryStats>({
        totalUploads: 0,
        totalSize: 0,
        averageScore: 0,
        mostActiveDay: 'Monday',
        favoriteSubmissionType: 'homework',
        uploadStreak: 0,
        bestScore: 0,
        improvementTrend: 'stable',
    });
    const [selectedPeriod, setSelectedPeriod] = useState<DateFilter['period']>('month');
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const dateFilters: DateFilter[] = [
        { period: 'all', label: 'All Time' },
        { period: 'today', label: 'Today' },
        { period: 'week', label: 'This Week' },
        { period: 'month', label: 'This Month' },
        { period: '3months', label: 'Last 3 Months' },
        { period: '6months', label: 'Last 6 Months' },
        { period: 'year', label: 'This Year' },
    ];

    useEffect(() => {
        loadUploadHistory();
    }, [selectedPeriod]);

    const loadUploadHistory = async () => {
        if (!token) {
            Alert.alert('Error', 'Authentication required');
            return;
        }

        try {
            setIsLoading(true);

            // Load real user submissions with larger limit for history
            const allSubmissions = await uploadsService.getUserRecentSubmissions(token, 100);

            const filteredSubmissions = filterSubmissionsByPeriod(allSubmissions, selectedPeriod);
            const grouped = groupSubmissionsByDate(filteredSubmissions);
            const stats = calculateHistoryStats(filteredSubmissions);

            setHistoryGroups(grouped);
            setHistoryStats(stats);

        } catch (error) {
            console.error('Error loading upload history:', error);
            Alert.alert('Error', 'Failed to load upload history');
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const filterSubmissionsByPeriod = (submissions: AISubmission[], period: DateFilter['period']): AISubmission[] => {
        const now = new Date();
        let cutoffDate: Date;

        switch (period) {
            case 'today':
                cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case '3months':
                cutoffDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                break;
            case '6months':
                cutoffDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
                break;
            case 'year':
                cutoffDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                return submissions;
        }

        return submissions.filter(submission =>
            new Date(submission.submitted_at) >= cutoffDate
        );
    };

    const groupSubmissionsByDate = (submissions: AISubmission[]): HistoryGroup[] => {
        const groups = new Map<string, HistoryEntry[]>();

        submissions.forEach(submission => {
            const submissionDate = new Date(submission.submitted_at);
            const dateKey = submissionDate.toISOString().split('T')[0];

            // Create entries for different actions
            const entries: HistoryEntry[] = [];

            // Upload entry
            entries.push({
                id: `${submission.id}-upload`,
                date: submissionDate,
                submission,
                action: 'uploaded',
                actionDescription: `Uploaded ${submission.original_filename}`,
            });

            // Processing entry
            if (submission.processed_at) {
                entries.push({
                    id: `${submission.id}-processed`,
                    date: new Date(submission.processed_at),
                    submission,
                    action: 'processed',
                    actionDescription: 'AI processing completed',
                });
            }

            // Grading entry
            if (submission.ai_score !== undefined && submission.ai_score !== null) {
                entries.push({
                    id: `${submission.id}-graded`,
                    date: new Date(submission.processed_at || submission.submitted_at),
                    submission,
                    action: 'graded',
                    actionDescription: `Received score: ${submission.ai_score}%`,
                });
            }

            // Review entry
            if (submission.reviewed_at) {
                entries.push({
                    id: `${submission.id}-reviewed`,
                    date: new Date(submission.reviewed_at),
                    submission,
                    action: 'reviewed',
                    actionDescription: 'Manual review completed',
                });
            }

            entries.forEach(entry => {
                const entryDateKey = entry.date.toISOString().split('T')[0];
                if (!groups.has(entryDateKey)) {
                    groups.set(entryDateKey, []);
                }
                groups.get(entryDateKey)!.push(entry);
            });
        });

        // Convert to array and calculate group statistics
        const groupArray: HistoryGroup[] = Array.from(groups.entries())
            .map(([dateKey, entries]) => {
                const uniqueSubmissions = Array.from(new Set(entries.map(e => e.submission.id)))
                    .map(id => entries.find(e => e.submission.id === id)!.submission);

                const totalSize = uniqueSubmissions.reduce((sum, sub) => {
                    // Estimate file size based on type
                    const estimatedSize = sub.file_type?.startsWith('image/') ? 1.5 * 1024 * 1024 : 2.5 * 1024 * 1024;
                    return sum + estimatedSize;
                }, 0);

                const scores = uniqueSubmissions
                    .map(sub => sub.ai_score)
                    .filter((score): score is number => score !== undefined && score !== null);

                const averageScore = scores.length > 0
                    ? scores.reduce((sum, score) => sum + score, 0) / scores.length
                    : 0;

                return {
                    date: dateKey,
                    entries: entries.sort((a, b) => b.date.getTime() - a.date.getTime()),
                    totalUploads: uniqueSubmissions.length,
                    averageScore,
                    totalSize,
                };
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return groupArray;
    };

    const calculateHistoryStats = (submissions: AISubmission[]): HistoryStats => {
        const totalUploads = submissions.length;
        const totalSize = submissions.reduce((sum, sub) => {
            const estimatedSize = sub.file_type?.startsWith('image/') ? 1.5 * 1024 * 1024 : 2.5 * 1024 * 1024;
            return sum + estimatedSize;
        }, 0);

        const scores = submissions
            .map(sub => sub.ai_score)
            .filter((score): score is number => score !== undefined && score !== null);

        const averageScore = scores.length > 0
            ? scores.reduce((sum, score) => sum + score, 0) / scores.length
            : 0;

        const bestScore = scores.length > 0 ? Math.max(...scores) : 0;

        // Calculate most active day
        const dayCount = new Map<string, number>();
        submissions.forEach(sub => {
            const dayName = new Date(sub.submitted_at).toLocaleDateString('en-US', { weekday: 'long' });
            dayCount.set(dayName, (dayCount.get(dayName) || 0) + 1);
        });
        const mostActiveDay = Array.from(dayCount.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Monday';

        // Calculate favorite submission type
        const typeCount = new Map<string, number>();
        submissions.forEach(sub => {
            typeCount.set(sub.submission_type, (typeCount.get(sub.submission_type) || 0) + 1);
        });
        const favoriteSubmissionType = Array.from(typeCount.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'homework';

        // Calculate upload streak (consecutive days with uploads)
        const uploadDates = Array.from(new Set(
            submissions.map(sub => new Date(sub.submitted_at).toISOString().split('T')[0])
        )).sort();

        let uploadStreak = 0;
        let currentStreak = 1;
        for (let i = 1; i < uploadDates.length; i++) {
            const prevDate = new Date(uploadDates[i - 1]);
            const currDate = new Date(uploadDates[i]);
            const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

            if (diffDays === 1) {
                currentStreak++;
            } else {
                uploadStreak = Math.max(uploadStreak, currentStreak);
                currentStreak = 1;
            }
        }
        uploadStreak = Math.max(uploadStreak, currentStreak);

        // Calculate improvement trend
        let improvementTrend: 'up' | 'down' | 'stable' = 'stable';
        if (scores.length >= 3) {
            const recentScores = scores.slice(-3);
            const earlierScores = scores.slice(0, -3);
            if (earlierScores.length > 0) {
                const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
                const earlierAvg = earlierScores.reduce((sum, score) => sum + score, 0) / earlierScores.length;

                if (recentAvg > earlierAvg + 5) {
                    improvementTrend = 'up';
                } else if (recentAvg < earlierAvg - 5) {
                    improvementTrend = 'down';
                }
            }
        }

        return {
            totalUploads,
            totalSize,
            averageScore,
            mostActiveDay,
            favoriteSubmissionType,
            uploadStreak,
            bestScore,
            improvementTrend,
        };
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadUploadHistory();
    };

    const toggleGroupExpansion = (dateKey: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(dateKey)) {
            newExpanded.delete(dateKey);
        } else {
            newExpanded.add(dateKey);
        }
        setExpandedGroups(newExpanded);
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric'
            });
        }
    };

    const formatTime = (date: Date): string => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    };

    const getActionIcon = (action: HistoryEntry['action']): string => {
        switch (action) {
            case 'uploaded':
                return '📤';
            case 'processed':
                return '⚙️';
            case 'graded':
                return '📊';
            case 'reviewed':
                return '👀';
            case 'reprocessed':
                return '🔄';
            default:
                return '📄';
        }
    };

    const getActionColor = (action: HistoryEntry['action']): string => {
        switch (action) {
            case 'uploaded':
                return '#3B82F6';
            case 'processed':
                return '#8B5CF6';
            case 'graded':
                return '#10B981';
            case 'reviewed':
                return '#F59E0B';
            case 'reprocessed':
                return '#EF4444';
            default:
                return '#6B7280';
        }
    };

    const getTrendIcon = (trend: HistoryStats['improvementTrend']): string => {
        switch (trend) {
            case 'up':
                return '📈';
            case 'down':
                return '📉';
            default:
                return '➡️';
        }
    };

    const getTrendColor = (trend: HistoryStats['improvementTrend']): string => {
        switch (trend) {
            case 'up':
                return '#10B981';
            case 'down':
                return '#EF4444';
            default:
                return '#6B7280';
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading upload history...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Upload History</Text>
                <Text style={styles.headerSubtitle}>
                    View your complete upload timeline and statistics
                </Text>
            </View>

            {/* Statistics Summary */}
            <View style={styles.statsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{historyStats.totalUploads}</Text>
                        <Text style={styles.statLabel}>Total Uploads</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>
                            {uploadsService.formatFileSize(historyStats.totalSize)}
                        </Text>
                        <Text style={styles.statLabel}>Data Uploaded</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{historyStats.averageScore.toFixed(1)}%</Text>
                        <Text style={styles.statLabel}>Average Score</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{historyStats.bestScore}%</Text>
                        <Text style={styles.statLabel}>Best Score</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{historyStats.uploadStreak}</Text>
                        <Text style={styles.statLabel}>Upload Streak</Text>
                    </View>
                </ScrollView>
            </View>

            {/* Insights */}
            <View style={styles.insightsContainer}>
                <Text style={styles.insightsTitle}>Quick Insights</Text>
                <View style={styles.insightsList}>
                    <View style={styles.insightItem}>
                        <Text style={styles.insightIcon}>📅</Text>
                        <Text style={styles.insightText}>Most active day: {historyStats.mostActiveDay}</Text>
                    </View>
                    <View style={styles.insightItem}>
                        <Text style={styles.insightIcon}>⭐</Text>
                        <Text style={styles.insightText}>
                            Favorite type: {uploadsService.getSubmissionTypeDisplayName(historyStats.favoriteSubmissionType)}
                        </Text>
                    </View>
                    <View style={styles.insightItem}>
                        <Text style={styles.insightIcon}>{getTrendIcon(historyStats.improvementTrend)}</Text>
                        <Text
                            style={[
                                styles.insightText,
                                { color: getTrendColor(historyStats.improvementTrend) }
                            ]}
                        >
                            Performance trend: {historyStats.improvementTrend === 'up' ? 'Improving' :
                                historyStats.improvementTrend === 'down' ? 'Declining' : 'Stable'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Period Filter */}
            <View style={styles.filterContainer}>
                <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => setShowFilters(true)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.filterButtonText}>
                        📅 {dateFilters.find(f => f.period === selectedPeriod)?.label}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Timeline */}
            <ScrollView
                style={styles.timelineContainer}
                contentContainerStyle={styles.timelineContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
            >
                {historyGroups.map((group) => (
                    <View key={group.date} style={styles.timelineGroup}>
                        <TouchableOpacity
                            style={styles.timelineGroupHeader}
                            onPress={() => toggleGroupExpansion(group.date)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.timelineGroupInfo}>
                                <Text style={styles.timelineGroupDate}>{formatDate(group.date)}</Text>
                                <Text style={styles.timelineGroupStats}>
                                    {group.totalUploads} upload{group.totalUploads !== 1 ? 's' : ''} •
                                    {uploadsService.formatFileSize(group.totalSize)} •
                                    {group.averageScore > 0 ? `${group.averageScore.toFixed(1)}% avg` : 'No scores'}
                                </Text>
                            </View>
                            <Text style={styles.expandIcon}>
                                {expandedGroups.has(group.date) ? '▼' : '▶'}
                            </Text>
                        </TouchableOpacity>

                        {expandedGroups.has(group.date) && (
                            <View style={styles.timelineEntries}>
                                {group.entries.map((entry, index) => (
                                    <TouchableOpacity
                                        key={entry.id}
                                        style={styles.timelineEntry}
                                        onPress={() => navigation.navigate('GradeDetails', {
                                            submissionId: entry.submission.id,
                                            submissionType: entry.submission.submission_type as any,
                                        })}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.timelineEntryLine}>
                                            <View
                                                style={[
                                                    styles.timelineEntryDot,
                                                    { backgroundColor: getActionColor(entry.action) },
                                                ]}
                                            >
                                                <Text style={styles.timelineEntryIcon}>
                                                    {getActionIcon(entry.action)}
                                                </Text>
                                            </View>
                                            {index < group.entries.length - 1 && <View style={styles.timelineConnector} />}
                                        </View>
                                        <View style={styles.timelineEntryContent}>
                                            <Text style={styles.timelineEntryAction}>{entry.actionDescription}</Text>
                                            <Text style={styles.timelineEntryTime}>{formatTime(entry.date)}</Text>
                                            {entry.action === 'graded' && entry.submission.ai_score && (
                                                <View
                                                    style={[
                                                        styles.scoreChip,
                                                        { backgroundColor: uploadsService.getSubmissionStatusColor(entry.submission) + '20' },
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.scoreChipText,
                                                            { color: uploadsService.getSubmissionStatusColor(entry.submission) },
                                                        ]}
                                                    >
                                                        {entry.submission.ai_score}%
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                ))}

                {historyGroups.length === 0 && (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📋</Text>
                        <Text style={styles.emptyTitle}>No upload history</Text>
                        <Text style={styles.emptySubtitle}>
                            {selectedPeriod === 'all'
                                ? 'Upload your first file to start building history'
                                : 'No uploads found for the selected period'
                            }
                        </Text>
                        {selectedPeriod === 'all' && (
                            <TouchableOpacity
                                style={styles.emptyAction}
                                onPress={() => navigation.navigate('FileUpload')}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.emptyActionText}>Upload File</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Period Filter Modal */}
            <Modal
                visible={showFilters}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowFilters(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Time Period</Text>
                            <TouchableOpacity
                                onPress={() => setShowFilters(false)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.modalClose}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={dateFilters}
                            keyExtractor={(item) => item.period}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.periodOption,
                                        selectedPeriod === item.period && styles.periodOptionActive,
                                    ]}
                                    onPress={() => {
                                        setSelectedPeriod(item.period);
                                        setShowFilters(false);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text
                                        style={[
                                            styles.periodOptionText,
                                            selectedPeriod === item.period && styles.periodOptionTextActive,
                                        ]}
                                    >
                                        {item.label}
                                    </Text>
                                    {selectedPeriod === item.period && (
                                        <Text style={styles.periodOptionCheck}>✓</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
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
        backgroundColor: '#F9FAFB',
    },
    loadingText: {
        fontSize: 16,
        color: '#6B7280',
    },
    header: {
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginBottom: 12,
    },
    backButtonText: {
        fontSize: 16,
        color: '#3B82F6',
        fontWeight: '500',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#6B7280',
    },
    statsContainer: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    statsScroll: {
        paddingHorizontal: 16,
    },
    statCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 16,
        marginRight: 12,
        alignItems: 'center',
        minWidth: 100,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    statNumber: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
    },
    insightsContainer: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    insightsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    insightsList: {
        gap: 8,
    },
    insightItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    insightIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    insightText: {
        fontSize: 14,
        color: '#374151',
        flex: 1,
    },
    filterContainer: {
        backgroundColor: '#F3F4F6',
        padding: 16,
    },
    filterButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignSelf: 'flex-start',
    },
    filterButtonText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    timelineContainer: {
        flex: 1,
    },
    timelineContent: {
        padding: 16,
    },
    timelineGroup: {
        marginBottom: 20,
    },
    timelineGroupHeader: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 8,
    },
    timelineGroupInfo: {
        flex: 1,
    },
    timelineGroupDate: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    timelineGroupStats: {
        fontSize: 14,
        color: '#6B7280',
    },
    expandIcon: {
        fontSize: 16,
        color: '#9CA3AF',
        fontWeight: 'bold',
    },
    timelineEntries: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
    },
    timelineEntry: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    timelineEntryLine: {
        alignItems: 'center',
        marginRight: 12,
    },
    timelineEntryDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    timelineEntryIcon: {
        fontSize: 12,
    },
    timelineConnector: {
        width: 2,
        flex: 1,
        backgroundColor: '#E5E7EB',
        marginTop: 4,
    },
    timelineEntryContent: {
        flex: 1,
        paddingTop: 4,
    },
    timelineEntryAction: {
        fontSize: 16,
        fontWeight: '500',
        color: '#111827',
        marginBottom: 4,
    },
    timelineEntryTime: {
        fontSize: 14,
        color: '#6B7280',
    },
    scoreChip: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginTop: 4,
    },
    scoreChipText: {
        fontSize: 12,
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 48,
        paddingHorizontal: 32,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
    },
    emptyAction: {
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        paddingHorizontal: 24,
        paddingVertical: 12,
    },
    emptyActionText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    modalClose: {
        fontSize: 20,
        color: '#6B7280',
        fontWeight: 'bold',
    },
    periodOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    periodOptionActive: {
        backgroundColor: '#EFF6FF',
    },
    periodOptionText: {
        fontSize: 16,
        color: '#374151',
        fontWeight: '500',
    },
    periodOptionTextActive: {
        color: '#3B82F6',
        fontWeight: '600',
    },
    periodOptionCheck: {
        fontSize: 16,
        color: '#3B82F6',
        fontWeight: 'bold',
    },
});