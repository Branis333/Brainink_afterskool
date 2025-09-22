/**
 * Upload Progress Screen
 * Real-time upload progress monitoring with queue management and error handling
 * Shows live upload status, allows retry operations, and manages upload queue
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
    ActivityIndicator,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigatorNew';
import { uploadsService, AISubmission } from '../../services/uploadsService';
import { useAuth } from '../../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'UploadProgress'>;

interface UploadQueueItem {
    id: string;
    filename: string;
    fileSize: number;
    submissionType: string;
    sessionId: number;
    status: 'queued' | 'uploading' | 'converting' | 'processing' | 'completed' | 'failed' | 'paused';
    progress: number;
    uploadedBytes: number;
    totalBytes: number;
    startTime?: Date;
    completedTime?: Date;
    error?: string;
    retryCount: number;
    maxRetries: number;
}

interface ProgressSummary {
    totalFiles: number;
    completedFiles: number;
    failedFiles: number;
    activeUploads: number;
    queuedFiles: number;
    totalProgress: number;
    uploadSpeed: number; // bytes per second
    estimatedTimeRemaining: number; // seconds
}

export const UploadProgressScreen: React.FC<Props> = ({ navigation }) => {
    const { token, user } = useAuth();
    const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
    const [progressSummary, setProgressSummary] = useState<ProgressSummary>({
        totalFiles: 0,
        completedFiles: 0,
        failedFiles: 0,
        activeUploads: 0,
        queuedFiles: 0,
        totalProgress: 0,
        uploadSpeed: 0,
        estimatedTimeRemaining: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all');
    const [showRetryModal, setShowRetryModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<UploadQueueItem | null>(null);

    useEffect(() => {
        loadUploadProgress();

        // Set up real-time updates
        const interval = setInterval(() => {
            updateProgressSummary();
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const loadUploadProgress = async () => {
        try {
            setIsLoading(true);

            // For real implementation, this would connect to a global upload manager
            // that tracks active uploads across the app. For now, show empty queue.
            const realQueue: UploadQueueItem[] = [];

            setUploadQueue(realQueue);
            updateProgressSummary(realQueue);

        } catch (error) {
            console.error('Error loading upload progress:', error);
            Alert.alert('Error', 'Failed to load upload progress');
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const updateProgressSummary = (queue?: UploadQueueItem[]) => {
        const currentQueue = queue || uploadQueue;

        const summary: ProgressSummary = {
            totalFiles: currentQueue.length,
            completedFiles: currentQueue.filter(item => item.status === 'completed').length,
            failedFiles: currentQueue.filter(item => item.status === 'failed').length,
            activeUploads: currentQueue.filter(item =>
                ['uploading', 'converting', 'processing'].includes(item.status)
            ).length,
            queuedFiles: currentQueue.filter(item => item.status === 'queued').length,
            totalProgress: 0,
            uploadSpeed: 0,
            estimatedTimeRemaining: 0,
        };

        // Calculate overall progress
        if (currentQueue.length > 0) {
            const totalProgress = currentQueue.reduce((sum, item) => sum + item.progress, 0);
            summary.totalProgress = totalProgress / currentQueue.length;
        }

        // Calculate upload speed for active uploads
        const activeUploads = currentQueue.filter(item =>
            item.status === 'uploading' && item.startTime
        );

        if (activeUploads.length > 0) {
            let totalSpeed = 0;
            activeUploads.forEach(item => {
                if (item.startTime) {
                    const elapsedSeconds = (Date.now() - item.startTime.getTime()) / 1000;
                    const speed = item.uploadedBytes / elapsedSeconds;
                    totalSpeed += speed;
                }
            });
            summary.uploadSpeed = totalSpeed;

            // Estimate time remaining
            const remainingBytes = currentQueue
                .filter(item => ['queued', 'uploading'].includes(item.status))
                .reduce((sum, item) => sum + (item.totalBytes - item.uploadedBytes), 0);

            if (summary.uploadSpeed > 0) {
                summary.estimatedTimeRemaining = remainingBytes / summary.uploadSpeed;
            }
        }

        setProgressSummary(summary);
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadUploadProgress();
    };

    const handleRetry = (item: UploadQueueItem) => {
        if (item.retryCount >= item.maxRetries) {
            Alert.alert(
                'Maximum Retries Reached',
                'This file has reached the maximum number of retry attempts. Please upload it again.',
                [
                    { text: 'OK', style: 'default' },
                    { text: 'Upload New', onPress: () => navigation.navigate('FileUpload') },
                ]
            );
            return;
        }

        Alert.alert(
            'Retry Upload',
            `Retry uploading ${item.filename}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Retry',
                    onPress: () => {
                        setUploadQueue(prev => prev.map(qItem =>
                            qItem.id === item.id
                                ? { ...qItem, status: 'queued', retryCount: qItem.retryCount + 1, error: undefined }
                                : qItem
                        ));
                        Alert.alert('Success', 'File added back to upload queue');
                    }
                },
            ]
        );
    };

    const handlePause = (item: UploadQueueItem) => {
        setUploadQueue(prev => prev.map(qItem =>
            qItem.id === item.id
                ? { ...qItem, status: 'paused' }
                : qItem
        ));
    };

    const handleResume = (item: UploadQueueItem) => {
        setUploadQueue(prev => prev.map(qItem =>
            qItem.id === item.id
                ? { ...qItem, status: 'uploading' }
                : qItem
        ));
    };

    const handleCancel = (item: UploadQueueItem) => {
        Alert.alert(
            'Cancel Upload',
            `Cancel uploading ${item.filename}? This action cannot be undone.`,
            [
                { text: 'Keep Upload', style: 'cancel' },
                {
                    text: 'Cancel Upload',
                    style: 'destructive',
                    onPress: () => {
                        setUploadQueue(prev => prev.filter(qItem => qItem.id !== item.id));
                        Alert.alert('Success', 'Upload cancelled');
                    }
                },
            ]
        );
    };

    const clearCompleted = () => {
        const completedCount = uploadQueue.filter(item => item.status === 'completed').length;

        if (completedCount === 0) {
            Alert.alert('No Completed Uploads', 'There are no completed uploads to clear');
            return;
        }

        Alert.alert(
            'Clear Completed',
            `Remove ${completedCount} completed upload(s) from the queue?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    onPress: () => {
                        setUploadQueue(prev => prev.filter(item => item.status !== 'completed'));
                        Alert.alert('Success', 'Completed uploads cleared');
                    }
                },
            ]
        );
    };

    const clearFailed = () => {
        const failedCount = uploadQueue.filter(item => item.status === 'failed').length;

        if (failedCount === 0) {
            Alert.alert('No Failed Uploads', 'There are no failed uploads to clear');
            return;
        }

        Alert.alert(
            'Clear Failed',
            `Remove ${failedCount} failed upload(s) from the queue?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    onPress: () => {
                        setUploadQueue(prev => prev.filter(item => item.status !== 'failed'));
                        Alert.alert('Success', 'Failed uploads cleared');
                    }
                },
            ]
        );
    };

    const formatFileSize = (bytes: number): string => {
        return uploadsService.formatFileSize(bytes);
    };

    const formatTime = (seconds: number): string => {
        if (seconds < 60) {
            return `${Math.round(seconds)}s`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            return `${minutes}m ${Math.round(seconds % 60)}s`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${hours}h ${minutes}m`;
        }
    };

    const formatSpeed = (bytesPerSecond: number): string => {
        if (bytesPerSecond < 1024) {
            return `${Math.round(bytesPerSecond)} B/s`;
        } else if (bytesPerSecond < 1024 * 1024) {
            return `${Math.round(bytesPerSecond / 1024)} KB/s`;
        } else {
            return `${Math.round(bytesPerSecond / (1024 * 1024) * 10) / 10} MB/s`;
        }
    };

    const getStatusColor = (status: UploadQueueItem['status']): string => {
        switch (status) {
            case 'queued':
                return '#6B7280';
            case 'uploading':
                return '#3B82F6';
            case 'converting':
                return '#8B5CF6';
            case 'processing':
                return '#F59E0B';
            case 'completed':
                return '#10B981';
            case 'failed':
                return '#EF4444';
            case 'paused':
                return '#F59E0B';
            default:
                return '#6B7280';
        }
    };

    const getStatusIcon = (status: UploadQueueItem['status']): string => {
        switch (status) {
            case 'queued':
                return '⏳';
            case 'uploading':
                return '⬆️';
            case 'converting':
                return '🔄';
            case 'processing':
                return '🤖';
            case 'completed':
                return '✅';
            case 'failed':
                return '❌';
            case 'paused':
                return '⏸️';
            default:
                return '❓';
        }
    };

    const getFilteredQueue = (): UploadQueueItem[] => {
        switch (selectedFilter) {
            case 'active':
                return uploadQueue.filter(item =>
                    ['queued', 'uploading', 'converting', 'processing', 'paused'].includes(item.status)
                );
            case 'completed':
                return uploadQueue.filter(item => item.status === 'completed');
            case 'failed':
                return uploadQueue.filter(item => item.status === 'failed');
            default:
                return uploadQueue;
        }
    };

    const renderQueueItem = (item: UploadQueueItem) => (
        <View key={item.id} style={styles.queueItem}>
            <View style={styles.itemHeader}>
                <View style={styles.itemInfo}>
                    <Text style={styles.itemIcon}>{getStatusIcon(item.status)}</Text>
                    <View style={styles.itemDetails}>
                        <Text style={styles.itemFilename} numberOfLines={1}>
                            {item.filename}
                        </Text>
                        <Text style={styles.itemMeta}>
                            {uploadsService.getSubmissionTypeDisplayName(item.submissionType)} •
                            Session {item.sessionId} • {formatFileSize(item.fileSize)}
                        </Text>
                    </View>
                </View>

                <View
                    style={[
                        styles.itemStatus,
                        { backgroundColor: getStatusColor(item.status) + '20' },
                    ]}
                >
                    <Text
                        style={[
                            styles.itemStatusText,
                            { color: getStatusColor(item.status) },
                        ]}
                    >
                        {item.status.toUpperCase()}
                    </Text>
                </View>
            </View>

            {/* Progress Bar */}
            {item.progress > 0 && (
                <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    width: `${item.progress}%`,
                                    backgroundColor: getStatusColor(item.status),
                                },
                            ]}
                        />
                    </View>
                    <Text style={styles.progressText}>{item.progress}%</Text>
                </View>
            )}

            {/* Upload Details */}
            {item.status === 'uploading' && item.startTime && (
                <View style={styles.uploadDetails}>
                    <Text style={styles.uploadDetailText}>
                        {formatFileSize(item.uploadedBytes)} / {formatFileSize(item.totalBytes)}
                    </Text>
                    {progressSummary.uploadSpeed > 0 && (
                        <Text style={styles.uploadDetailText}>
                            {formatSpeed(progressSummary.uploadSpeed)}
                        </Text>
                    )}
                </View>
            )}

            {/* Error Message */}
            {item.error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{item.error}</Text>
                    <Text style={styles.retryText}>
                        Retry {item.retryCount}/{item.maxRetries}
                    </Text>
                </View>
            )}

            {/* Action Buttons */}
            <View style={styles.itemActions}>
                {item.status === 'failed' && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.retryButton]}
                        onPress={() => handleRetry(item)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                )}

                {item.status === 'uploading' && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.pauseButton]}
                        onPress={() => handlePause(item)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.pauseButtonText}>Pause</Text>
                    </TouchableOpacity>
                )}

                {item.status === 'paused' && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.resumeButton]}
                        onPress={() => handleResume(item)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.resumeButtonText}>Resume</Text>
                    </TouchableOpacity>
                )}

                {['queued', 'uploading', 'paused'].includes(item.status) && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.cancelButton]}
                        onPress={() => handleCancel(item)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                )}

                {item.status === 'completed' && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.viewButton]}
                        onPress={() => navigation.navigate('GradeDetails', {
                            submissionId: parseInt(item.id),
                            submissionType: item.submissionType as any,
                        })}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.viewButtonText}>View Details</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Loading upload progress...</Text>
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
                <Text style={styles.headerTitle}>Upload Progress</Text>
                <Text style={styles.headerSubtitle}>
                    Monitor and manage your upload queue
                </Text>
            </View>

            {/* Progress Summary */}
            <View style={styles.summaryContainer}>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryNumber}>{progressSummary.totalFiles}</Text>
                    <Text style={styles.summaryLabel}>Total Files</Text>
                </View>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryNumber}>{progressSummary.activeUploads}</Text>
                    <Text style={styles.summaryLabel}>Active</Text>
                </View>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryNumber}>{progressSummary.completedFiles}</Text>
                    <Text style={styles.summaryLabel}>Completed</Text>
                </View>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryNumber}>{progressSummary.failedFiles}</Text>
                    <Text style={styles.summaryLabel}>Failed</Text>
                </View>
            </View>

            {/* Overall Progress */}
            {progressSummary.totalFiles > 0 && (
                <View style={styles.overallProgress}>
                    <View style={styles.overallProgressHeader}>
                        <Text style={styles.overallProgressLabel}>Overall Progress</Text>
                        <Text style={styles.overallProgressPercent}>
                            {Math.round(progressSummary.totalProgress)}%
                        </Text>
                    </View>
                    <View style={styles.overallProgressBar}>
                        <View
                            style={[
                                styles.overallProgressFill,
                                { width: `${progressSummary.totalProgress}%` },
                            ]}
                        />
                    </View>
                    {progressSummary.uploadSpeed > 0 && (
                        <View style={styles.overallProgressDetails}>
                            <Text style={styles.progressDetailText}>
                                Speed: {formatSpeed(progressSummary.uploadSpeed)}
                            </Text>
                            {progressSummary.estimatedTimeRemaining > 0 && (
                                <Text style={styles.progressDetailText}>
                                    ETA: {formatTime(progressSummary.estimatedTimeRemaining)}
                                </Text>
                            )}
                        </View>
                    )}
                </View>
            )}

            {/* Filter Tabs */}
            <View style={styles.filterTabs}>
                {[
                    { key: 'all', label: 'All', count: uploadQueue.length },
                    { key: 'active', label: 'Active', count: progressSummary.activeUploads + progressSummary.queuedFiles },
                    { key: 'completed', label: 'Completed', count: progressSummary.completedFiles },
                    { key: 'failed', label: 'Failed', count: progressSummary.failedFiles },
                ].map((filter) => (
                    <TouchableOpacity
                        key={filter.key}
                        style={[
                            styles.filterTab,
                            selectedFilter === filter.key && styles.filterTabActive,
                        ]}
                        onPress={() => setSelectedFilter(filter.key as any)}
                        activeOpacity={0.7}
                    >
                        <Text
                            style={[
                                styles.filterTabText,
                                selectedFilter === filter.key && styles.filterTabTextActive,
                            ]}
                        >
                            {filter.label} ({filter.count})
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Queue Actions */}
            <View style={styles.queueActions}>
                <TouchableOpacity
                    style={styles.queueActionButton}
                    onPress={clearCompleted}
                    activeOpacity={0.7}
                    disabled={progressSummary.completedFiles === 0}
                >
                    <Text style={[
                        styles.queueActionText,
                        progressSummary.completedFiles === 0 && styles.queueActionTextDisabled,
                    ]}>
                        Clear Completed
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.queueActionButton}
                    onPress={clearFailed}
                    activeOpacity={0.7}
                    disabled={progressSummary.failedFiles === 0}
                >
                    <Text style={[
                        styles.queueActionText,
                        progressSummary.failedFiles === 0 && styles.queueActionTextDisabled,
                    ]}>
                        Clear Failed
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Upload Queue */}
            <ScrollView
                style={styles.queueContainer}
                contentContainerStyle={styles.queueContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
            >
                {getFilteredQueue().map(renderQueueItem)}

                {getFilteredQueue().length === 0 && (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📥</Text>
                        <Text style={styles.emptyTitle}>
                            {selectedFilter === 'all'
                                ? 'No uploads in queue'
                                : `No ${selectedFilter} uploads`
                            }
                        </Text>
                        <Text style={styles.emptySubtitle}>
                            {selectedFilter === 'all'
                                ? 'Upload files to see progress here'
                                : `Switch to "All" to see other uploads`
                            }
                        </Text>
                        {selectedFilter === 'all' && (
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
        marginTop: 12,
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
    summaryContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
        backgroundColor: '#FFFFFF',
    },
    summaryCard: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    summaryNumber: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 2,
    },
    summaryLabel: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
    },
    overallProgress: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    overallProgressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    overallProgressLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    overallProgressPercent: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#3B82F6',
    },
    overallProgressBar: {
        height: 8,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    overallProgressFill: {
        height: '100%',
        backgroundColor: '#3B82F6',
        borderRadius: 4,
    },
    overallProgressDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    progressDetailText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    filterTabs: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    filterTab: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    filterTabActive: {
        borderBottomColor: '#3B82F6',
    },
    filterTabText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    filterTabTextActive: {
        color: '#3B82F6',
        fontWeight: '600',
    },
    queueActions: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        padding: 12,
        gap: 8,
    },
    queueActionButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    queueActionText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    queueActionTextDisabled: {
        color: '#9CA3AF',
    },
    queueContainer: {
        flex: 1,
    },
    queueContent: {
        padding: 16,
    },
    queueItem: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    itemInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    itemIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    itemDetails: {
        flex: 1,
    },
    itemFilename: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    itemMeta: {
        fontSize: 14,
        color: '#6B7280',
    },
    itemStatus: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    itemStatusText: {
        fontSize: 10,
        fontWeight: '700',
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
        backgroundColor: '#E5E7EB',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '600',
        minWidth: 35,
        textAlign: 'right',
    },
    uploadDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    uploadDetailText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    errorContainer: {
        backgroundColor: '#FEF2F2',
        borderRadius: 8,
        padding: 8,
        marginBottom: 8,
    },
    errorText: {
        fontSize: 14,
        color: '#DC2626',
        marginBottom: 2,
    },
    retryText: {
        fontSize: 12,
        color: '#6B7280',
        fontStyle: 'italic',
    },
    itemActions: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    actionButton: {
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
    },
    retryButton: {
        backgroundColor: '#EFF6FF',
        borderColor: '#3B82F6',
    },
    retryButtonText: {
        fontSize: 12,
        color: '#3B82F6',
        fontWeight: '600',
    },
    pauseButton: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
    },
    pauseButtonText: {
        fontSize: 12,
        color: '#F59E0B',
        fontWeight: '600',
    },
    resumeButton: {
        backgroundColor: '#ECFDF5',
        borderColor: '#10B981',
    },
    resumeButtonText: {
        fontSize: 12,
        color: '#10B981',
        fontWeight: '600',
    },
    cancelButton: {
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
    },
    cancelButtonText: {
        fontSize: 12,
        color: '#EF4444',
        fontWeight: '600',
    },
    viewButton: {
        backgroundColor: '#F3F4F6',
        borderColor: '#6B7280',
    },
    viewButtonText: {
        fontSize: 12,
        color: '#374151',
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
});