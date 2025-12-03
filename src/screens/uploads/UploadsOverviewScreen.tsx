/**
 * Uploads Overview Screen
 * Main dashboard for all upload activities and file management
 * Shows statistics, recent uploads, quick actions, and navigation hub
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
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigatorNew';
import { uploadsService, AISubmission } from '../../services/uploadsService';
import { gradesService, StudentAssignment } from '../../services/gradesService';
import { useAuth } from '../../context/AuthContext';
import { progressService, ProgressDigest } from '../../services/progressService';

import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'UploadsOverview'>;

interface UploadStats {
    totalUploads: number;
    totalSizeUploaded: number;
    successfulUploads: number;
    pendingProcessing: number;
    averageScore: number;
    thisWeekUploads: number;
    thisMonthUploads: number;
}

interface QuickAction {
    id: string;
    title: string;
    subtitle: string;
    icon: string;
    color: string;
    action: () => void;
}

export const UploadsOverviewScreen: React.FC<Props> = ({ navigation }) => {
    const { token, user } = useAuth();
    const [uploadStats, setUploadStats] = useState<UploadStats>({
        totalUploads: 0,
        totalSizeUploaded: 0,
        successfulUploads: 0,
        pendingProcessing: 0,
        averageScore: 0,
        thisWeekUploads: 0,
        thisMonthUploads: 0,
    });
    const [recentUploads, setRecentUploads] = useState<AISubmission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [weeklyDigest, setWeeklyDigest] = useState<ProgressDigest | null>(null);
    const [isProgressUpdating, setIsProgressUpdating] = useState(false);

    const screenWidth = Dimensions.get('window').width;

    useEffect(() => {
        loadUploadsOverview();
    }, []);

    const loadUploadsOverview = async () => {
        if (!token) {
            Alert.alert('Error', 'Authentication required');
            return;
        }

        try {
            setIsLoading(true);

            // Load real user upload statistics
            const stats = await uploadsService.getUserUploadStats(token);
            setUploadStats(stats);

            // Load real recent uploads
            const recentSubmissions = await uploadsService.getUserRecentSubmissions(token, 5);
            setRecentUploads(recentSubmissions);

            // Removed: workflow/assignments context

            // Load current weekly digest (if any)
            try {
                const digest = await progressService.getWeeklyDigest(token);
                setWeeklyDigest(digest);
            } catch (e) {
                console.warn('Weekly digest fetch failed:', e);
                setWeeklyDigest(null);
            }

        } catch (error) {
            console.error('Error loading uploads overview:', error);
            Alert.alert('Error', 'Failed to load uploads overview. Please check your connection and try again.');
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadUploadsOverview();
    };

    const handleGenerateWeeklyDigest = async () => {
        if (!token) return;
        try {
            setIsProgressUpdating(true);
            const digest = await progressService.generateWeeklyDigest(token);
            setWeeklyDigest(digest);
            Alert.alert('Updated', 'Weekly progress has been refreshed.');
        } catch (e) {
            Alert.alert('Error', 'Failed to update weekly progress. Please try again.');
        } finally {
            setIsProgressUpdating(false);
        }
    };

    // Removed: workflow navigation helpers

    // Removed: quick actions list

    const formatFileSize = (bytes: number): string => {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };

    const parseBackendTimestamp = (value?: string | null): Date | null => {
        if (!value || typeof value !== 'string') {
            return null;
        }

        // Backend returns naive UTC timestamps (no timezone). Append 'Z' to treat as UTC.
        const hasTimezone = /[zZ]|[\+\-]\d{2}:?\d{2}$/.test(value);
        const normalised = hasTimezone ? value : `${value}Z`;

        const parsed = new Date(normalised);
        return isNaN(parsed.getTime()) ? null : parsed;
    };

    const formatTimeAgo = (dateString: string): string => {
        const date = parseBackendTimestamp(dateString);
        if (!date) {
            return 'Just now';
        }
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

        if (diffInMinutes <= 0) {
            return 'Just now';
        }

        if (diffInMinutes < 60) {
            return `${diffInMinutes} min ago`;
        } else if (diffInMinutes < 1440) {
            const hours = Math.floor(diffInMinutes / 60);
            return `${hours} hr${hours > 1 ? 's' : ''} ago`;
        } else {
            const days = Math.floor(diffInMinutes / 1440);
            return `${days} day${days > 1 ? 's' : ''} ago`;
        }
    };

    const getStatusColor = (submission: AISubmission): string => {
        if (!submission.ai_processed) return '#F59E0B'; // pending - amber
        if (submission.requires_review) return '#EF4444'; // needs review - red
        if (submission.ai_score && submission.ai_score >= 80) return '#10B981'; // good - green
        if (submission.ai_score && submission.ai_score >= 60) return '#F59E0B'; // average - amber
        return '#EF4444'; // poor - red
    };

    const getStatusText = (submission: AISubmission): string => {
        if (!submission.ai_processed) return 'Processing...';
        if (submission.requires_review) return 'Needs Review';
        if (submission.ai_score !== undefined && submission.ai_score !== null) {
            return `${submission.ai_score}%`;
        }
        return 'Completed';
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading uploads overview...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeContainer}>
            <ScrollView
                style={styles.container}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
            >
                {/* Minimal Back + Title */}
                <View style={styles.topActions}>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('MainTabs' as never)}
                        style={styles.backIconButton}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <Ionicons name="chevron-back" size={22} color="#111827" />
                    </TouchableOpacity>
                </View>
                <Text style={styles.pageTitle}>Grades</Text>

                {/* Weekly Progress Digest (Top-most card) */}
                <View style={styles.section}>
                    <View style={styles.progressCard}>
                        <Text style={styles.progressCardTitle}>Weekly Progress</Text>
                        {weeklyDigest ? (
                            <>
                                <Text style={styles.progressCardSummary}>{weeklyDigest.summary}</Text>
                                <View style={styles.progressCardMetaRow}>
                                    <Text style={styles.progressCardMeta}>
                                        {(() => {
                                            const start = weeklyDigest.period_start;
                                            const end = weeklyDigest.period_end;
                                            return `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`;
                                        })()}
                                    </Text>
                                    <Text style={styles.progressCardMeta}>• {weeklyDigest.assignments_count} items</Text>
                                    {typeof weeklyDigest.avg_grade === 'number' && (
                                        <Text style={styles.progressCardMeta}>• {weeklyDigest.avg_grade.toFixed(1)}% avg</Text>
                                    )}
                                </View>
                            </>
                        ) : (
                            <Text style={styles.progressCardSummaryMuted}>
                                No weekly progress yet. Tap Update to generate.
                            </Text>
                        )}
                        <TouchableOpacity
                            style={styles.progressUpdateButton}
                            onPress={handleGenerateWeeklyDigest}
                            disabled={isProgressUpdating}
                            activeOpacity={0.7}
                        >
                            {isProgressUpdating ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                                <Text style={styles.progressUpdateButtonText}>Update progress</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Statistics Cards */}
                <View style={styles.statsContainer}>
                    <View style={[styles.statCard, { width: (screenWidth - 48) / 2 }]}>
                        <Text style={styles.statNumber}>{uploadStats.totalUploads}</Text>
                        <Text style={styles.statLabel}>Total Uploads</Text>
                    </View>
                    <View style={[styles.statCard, { width: (screenWidth - 48) / 2 }]}>
                        <Text style={styles.statNumber}>
                            {formatFileSize(uploadStats.totalSizeUploaded)}
                        </Text>
                        <Text style={styles.statLabel}>Data Uploaded</Text>
                    </View>
                </View>

                <View style={styles.statsContainer}>
                    <View style={[styles.statCard, { width: (screenWidth - 48) / 2 }]}>
                        <Text style={styles.statNumber}>{uploadStats.averageScore.toFixed(1)}%</Text>
                        <Text style={styles.statLabel}>Average Score</Text>
                    </View>
                    <View style={[styles.statCard, { width: (screenWidth - 48) / 2 }]}>
                        <Text style={styles.statNumber}>{uploadStats.pendingProcessing}</Text>
                        <Text style={styles.statLabel}>Processing</Text>
                    </View>
                </View>

                {/* Removed: Assignment Workflow card */}

                {/* Removed: Quick Actions section */}

                {/* Recent Uploads */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent Uploads</Text>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('UploadHistory')}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.sectionLink}>View All</Text>
                        </TouchableOpacity>
                    </View>

                    {recentUploads.map((upload) => (
                        <TouchableOpacity
                            key={upload.id}
                            style={styles.uploadCard}
                            onPress={() => navigation.navigate('GradeDetails', {
                                submissionId: upload.id,
                                submissionType: upload.submission_type as any,
                            })}
                            activeOpacity={0.7}
                        >
                            <View style={styles.uploadHeader}>
                                <Text style={styles.uploadFilename} numberOfLines={1}>
                                    {upload.original_filename || `Submission ${upload.id}`}
                                </Text>
                                <View
                                    style={[
                                        styles.uploadStatus,
                                        { backgroundColor: getStatusColor(upload) + '20' },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.uploadStatusText,
                                            { color: getStatusColor(upload) },
                                        ]}
                                    >
                                        {getStatusText(upload)}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.uploadDetails}>
                                <Text style={styles.uploadType}>
                                    {uploadsService.getSubmissionTypeDisplayName(upload.submission_type)}
                                </Text>
                                <Text style={styles.uploadTime}>
                                    {formatTimeAgo(upload.submitted_at)}
                                </Text>
                            </View>

                            {typeof upload.ai_feedback === 'string' && upload.ai_feedback.trim().length > 0 && (
                                <Text style={styles.uploadFeedback} numberOfLines={2}>
                                    {upload.ai_feedback}
                                </Text>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Activity Summary */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Activity Summary</Text>
                    <View style={styles.activityContainer}>
                        <View style={styles.activityItem}>
                            <Text style={styles.activityNumber}>{uploadStats.thisWeekUploads}</Text>
                            <Text style={styles.activityLabel}>This Week</Text>
                        </View>
                        <View style={styles.activityItem}>
                            <Text style={styles.activityNumber}>{uploadStats.thisMonthUploads}</Text>
                            <Text style={styles.activityLabel}>This Month</Text>
                        </View>
                        <View style={styles.activityItem}>
                            <Text style={styles.activityNumber}>{uploadStats.successfulUploads}</Text>
                            <Text style={styles.activityLabel}>Successful</Text>
                        </View>
                    </View>
                </View>

                {/* Navigation Footer */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.footerButton}
                        onPress={() => navigation.navigate('UploadsManagement')}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.footerButtonText}>Manage All Uploads</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    topActions: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
        backgroundColor: 'transparent',
    },
    backIconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pageTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#111827',
        marginTop: 8,
        paddingHorizontal: 16,
        alignItems: 'center',
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
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    backButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        marginRight: 12,
    },
    backButtonText: {
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '500',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        flex: 1,
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#6B7280',
    },
    // Progress Digest Card Styles
    progressCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
        borderLeftWidth: 4,
        borderLeftColor: '#10B981',
    },
    progressCardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    progressCardSummary: {
        fontSize: 14,
        color: '#1F2937',
        lineHeight: 20,
        marginBottom: 10,
    },
    progressCardSummaryMuted: {
        fontSize: 14,
        color: '#6B7280',
        fontStyle: 'italic',
        marginBottom: 10,
    },
    progressCardMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
    },
    progressCardMeta: {
        fontSize: 12,
        color: '#6B7280',
    },
    progressUpdateButton: {
        alignSelf: 'flex-end',
        backgroundColor: '#10B981',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    progressUpdateButtonText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginTop: 16,
    },
    statCard: {
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    statNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    section: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    sectionLink: {
        fontSize: 14,
        color: '#3B82F6',
        fontWeight: '500',
    },
    quickActionsContainer: {
        gap: 12,
    },
    actionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    actionContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    actionText: {
        flex: 1,
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    actionSubtitle: {
        fontSize: 14,
        color: '#6B7280',
    },
    uploadCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    uploadHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    uploadFilename: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        flex: 1,
        marginRight: 8,
    },
    uploadStatus: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    uploadStatusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    uploadDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    uploadType: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    uploadTime: {
        fontSize: 14,
        color: '#6B7280',
    },
    uploadFeedback: {
        fontSize: 14,
        color: '#374151',
        fontStyle: 'italic',
        marginTop: 4,
    },
    activityContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    activityItem: {
        alignItems: 'center',
    },
    activityNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#3B82F6',
        marginBottom: 4,
    },
    activityLabel: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    footer: {
        margin: 16,
        marginTop: 32,
        marginBottom: 32,
    },
    footerButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    footerButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // Workflow Status Card Styles
    workflowCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6',
    },
    workflowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    workflowIcon: {
        fontSize: 24,
        marginRight: 8,
    },
    workflowTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
    },
    workflowStatus: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 16,
        lineHeight: 20,
    },
    workflowActions: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    workflowButton: {
        backgroundColor: '#3B82F6',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        flex: 1,
        minWidth: 120,
    },
    workflowButtonSecondary: {
        backgroundColor: '#EBF5FF',
        borderWidth: 1,
        borderColor: '#3B82F6',
    },
    workflowButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    workflowButtonTextSecondary: {
        color: '#3B82F6',
    },
    continueButton: {
        backgroundColor: '#F9FAFB',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        flex: 1,
        minWidth: 100,
    },
    continueButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        textAlign: 'center',
    },
});