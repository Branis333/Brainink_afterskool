/**
 * Uploads Management Screen
 * Comprehensive file management with filtering, search, sorting, and batch operations
 * Allows users to view, manage, and organize all their uploaded files
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    Modal,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigatorNew';
import { uploadsService, AISubmission } from '../../services/uploadsService';
import { useAuth } from '../../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'UploadsManagement'>;

interface UploadFilters {
    submissionType: string;
    status: string;
    scoreRange: string;
    dateRange: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
}

interface FilterOption {
    label: string;
    value: string;
}

export const UploadsManagementScreen: React.FC<Props> = ({ navigation }) => {
    const { token, user } = useAuth();
    const [submissions, setSubmissions] = useState<AISubmission[]>([]);
    const [filteredSubmissions, setFilteredSubmissions] = useState<AISubmission[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedSubmissions, setSelectedSubmissions] = useState<Set<number>>(new Set());
    const [showFilters, setShowFilters] = useState(false);

    const [filters, setFilters] = useState<UploadFilters>({
        submissionType: 'all',
        status: 'all',
        scoreRange: 'all',
        dateRange: 'all',
        sortBy: 'submitted_at',
        sortOrder: 'desc',
    });

    useEffect(() => {
        loadSubmissions();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [submissions, searchQuery, filters]);

    const loadSubmissions = async () => {
        if (!token) {
            Alert.alert('Error', 'Authentication required');
            return;
        }

        try {
            setIsLoading(true);

            // Load real user submissions data
            // Backend enforces limit <= 50
            const userSubmissions = await uploadsService.getUserRecentSubmissions(token, 50);
            setSubmissions(userSubmissions);

        } catch (error) {
            console.error('Error loading submissions:', error);
            Alert.alert('Error', 'Failed to load submissions');
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...submissions];

        // Apply text search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(submission =>
                (submission.original_filename?.toLowerCase().includes(query)) ||
                (submission.submission_type.toLowerCase().includes(query)) ||
                (submission.ai_feedback?.toLowerCase().includes(query))
            );
        }

        // Apply submission type filter
        if (filters.submissionType !== 'all') {
            filtered = filtered.filter(submission => submission.submission_type === filters.submissionType);
        }

        // Apply status filter
        if (filters.status !== 'all') {
            filtered = filtered.filter(submission => {
                switch (filters.status) {
                    case 'processed':
                        return submission.ai_processed;
                    case 'pending':
                        return !submission.ai_processed;
                    case 'needs_review':
                        return submission.requires_review;
                    case 'completed':
                        return submission.ai_processed && !submission.requires_review;
                    default:
                        return true;
                }
            });
        }

        // Apply score range filter
        if (filters.scoreRange !== 'all') {
            filtered = filtered.filter(submission => {
                if (!submission.ai_score) return filters.scoreRange === 'no_score';

                switch (filters.scoreRange) {
                    case 'excellent':
                        return submission.ai_score >= 90;
                    case 'good':
                        return submission.ai_score >= 80 && submission.ai_score < 90;
                    case 'average':
                        return submission.ai_score >= 60 && submission.ai_score < 80;
                    case 'needs_work':
                        return submission.ai_score < 60;
                    default:
                        return true;
                }
            });
        }

        // Apply date range filter
        if (filters.dateRange !== 'all') {
            const now = new Date();
            filtered = filtered.filter(submission => {
                const submissionDate = new Date(submission.submitted_at);
                const diffInDays = (now.getTime() - submissionDate.getTime()) / (1000 * 60 * 60 * 24);

                switch (filters.dateRange) {
                    case 'today':
                        return diffInDays < 1;
                    case 'week':
                        return diffInDays < 7;
                    case 'month':
                        return diffInDays < 30;
                    case 'older':
                        return diffInDays >= 30;
                    default:
                        return true;
                }
            });
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let aValue: any, bValue: any;

            switch (filters.sortBy) {
                case 'submitted_at':
                    aValue = new Date(a.submitted_at).getTime();
                    bValue = new Date(b.submitted_at).getTime();
                    break;
                case 'filename':
                    aValue = a.original_filename || '';
                    bValue = b.original_filename || '';
                    break;
                case 'score':
                    aValue = a.ai_score || 0;
                    bValue = b.ai_score || 0;
                    break;
                case 'type':
                    aValue = a.submission_type;
                    bValue = b.submission_type;
                    break;
                default:
                    return 0;
            }

            if (filters.sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        setFilteredSubmissions(filtered);
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadSubmissions();
    };

    const toggleSelection = (submissionId: number) => {
        const newSelection = new Set(selectedSubmissions);
        if (newSelection.has(submissionId)) {
            newSelection.delete(submissionId);
        } else {
            newSelection.add(submissionId);
        }
        setSelectedSubmissions(newSelection);
    };

    const selectAll = () => {
        const allIds = new Set(filteredSubmissions.map(s => s.id));
        setSelectedSubmissions(allIds);
    };

    const clearSelection = () => {
        setSelectedSubmissions(new Set());
    };

    const handleBulkDelete = () => {
        if (selectedSubmissions.size === 0) {
            Alert.alert('No Selection', 'Please select submissions to delete');
            return;
        }

        Alert.alert(
            'Delete Submissions',
            `Are you sure you want to delete ${selectedSubmissions.size} submission(s)?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        // Simulate delete operation
                        setSubmissions(prev => prev.filter(s => !selectedSubmissions.has(s.id)));
                        setSelectedSubmissions(new Set());
                        Alert.alert('Success', `${selectedSubmissions.size} submission(s) deleted`);
                    }
                },
            ]
        );
    };

    const handleBulkReprocess = () => {
        if (selectedSubmissions.size === 0) {
            Alert.alert('No Selection', 'Please select submissions to reprocess');
            return;
        }

        Alert.alert(
            'Reprocess Submissions',
            `Reprocess ${selectedSubmissions.size} submission(s) with AI?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reprocess',
                    onPress: () => {
                        Alert.alert('Processing', 'Submissions are being reprocessed...');
                        setSelectedSubmissions(new Set());
                    }
                },
            ]
        );
    };

    const formatTimeAgo = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

        if (diffInMinutes < 60) {
            return `${diffInMinutes}m ago`;
        } else if (diffInMinutes < 1440) {
            const hours = Math.floor(diffInMinutes / 60);
            return `${hours}h ago`;
        } else {
            const days = Math.floor(diffInMinutes / 1440);
            return `${days}d ago`;
        }
    };

    const getStatusColor = (submission: AISubmission): string => {
        return uploadsService.getSubmissionStatusColor(submission);
    };

    const getStatusText = (submission: AISubmission): string => {
        if (!submission.ai_processed) return 'Processing';
        if (submission.requires_review) return 'Needs Review';
        if (submission.ai_score !== undefined && submission.ai_score !== null) {
            return `${submission.ai_score}%`;
        }
        return 'Completed';
    };

    const getFileIcon = (fileType?: string): string => {
        if (!fileType) return '📄';
        if (fileType.startsWith('image/')) return '🖼️';
        if (fileType === 'application/pdf') return '📄';
        if (fileType.includes('word')) return '📝';
        return '📎';
    };

    const renderSubmissionItem = ({ item }: { item: AISubmission }) => (
        <TouchableOpacity
            style={[
                styles.submissionItem,
                selectedSubmissions.has(item.id) && styles.submissionItemSelected,
            ]}
            onPress={() => navigation.navigate('GradeDetails', {
                submissionId: item.id,
                submissionType: item.submission_type as any,
            })}
            onLongPress={() => toggleSelection(item.id)}
            activeOpacity={0.7}
        >
            <View style={styles.submissionHeader}>
                <View style={styles.submissionInfo}>
                    <Text style={styles.submissionIcon}>{getFileIcon(item.file_type)}</Text>
                    <View style={styles.submissionDetails}>
                        <Text style={styles.submissionFilename} numberOfLines={1}>
                            {item.original_filename || `Submission ${item.id}`}
                        </Text>
                        <Text style={styles.submissionMeta}>
                            {uploadsService.getSubmissionTypeDisplayName(item.submission_type)} • Session {item.session_id} • {formatTimeAgo(item.submitted_at)}
                        </Text>
                    </View>
                </View>

                <View style={styles.submissionActions}>
                    <View
                        style={[
                            styles.submissionStatus,
                            { backgroundColor: getStatusColor(item) + '20' },
                        ]}
                    >
                        <Text
                            style={[
                                styles.submissionStatusText,
                                { color: getStatusColor(item) },
                            ]}
                        >
                            {getStatusText(item)}
                        </Text>
                    </View>

                    {selectedSubmissions.size > 0 && (
                        <TouchableOpacity
                            style={[
                                styles.selectionButton,
                                selectedSubmissions.has(item.id) && styles.selectionButtonActive,
                            ]}
                            onPress={() => toggleSelection(item.id)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.selectionButtonText}>
                                {selectedSubmissions.has(item.id) ? '✓' : '○'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {typeof item.ai_feedback === 'string' && item.ai_feedback.trim().length > 0 && (
                <Text style={styles.submissionFeedback} numberOfLines={2}>
                    {item.ai_feedback}
                </Text>
            )}
        </TouchableOpacity>
    );

    const submissionTypeOptions: FilterOption[] = [
        { label: 'All Types', value: 'all' },
        { label: 'Homework', value: 'homework' },
        { label: 'Quiz', value: 'quiz' },
        { label: 'Practice', value: 'practice' },
        { label: 'Assessment', value: 'assessment' },
    ];

    const statusOptions: FilterOption[] = [
        { label: 'All Status', value: 'all' },
        { label: 'Processed', value: 'processed' },
        { label: 'Pending', value: 'pending' },
        { label: 'Needs Review', value: 'needs_review' },
        { label: 'Completed', value: 'completed' },
    ];

    const scoreRangeOptions: FilterOption[] = [
        { label: 'All Scores', value: 'all' },
        { label: 'Excellent (90-100%)', value: 'excellent' },
        { label: 'Good (80-89%)', value: 'good' },
        { label: 'Average (60-79%)', value: 'average' },
        { label: 'Needs Work (<60%)', value: 'needs_work' },
        { label: 'No Score', value: 'no_score' },
    ];

    const dateRangeOptions: FilterOption[] = [
        { label: 'All Time', value: 'all' },
        { label: 'Today', value: 'today' },
        { label: 'This Week', value: 'week' },
        { label: 'This Month', value: 'month' },
        { label: 'Older', value: 'older' },
    ];

    const sortOptions: FilterOption[] = [
        { label: 'Upload Date', value: 'submitted_at' },
        { label: 'Filename', value: 'filename' },
        { label: 'Score', value: 'score' },
        { label: 'Type', value: 'type' },
    ];

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Loading submissions...</Text>
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
                <Text style={styles.headerTitle}>Manage Uploads</Text>
                <Text style={styles.headerSubtitle}>
                    View and manage all your uploaded files
                </Text>
            </View>

            {/* Search and Filter Bar */}
            <View style={styles.searchFilterBar}>
                <View style={styles.searchContainer}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search files..."
                        placeholderTextColor="#9CA3AF"
                    />
                </View>
                <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => setShowFilters(true)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.filterButtonText}>⚙️ Filters</Text>
                </TouchableOpacity>
            </View>

            {/* Results Header */}
            <View style={styles.resultsHeader}>
                <Text style={styles.resultsCount}>
                    {filteredSubmissions.length} of {submissions.length} submissions
                </Text>
                {selectedSubmissions.size > 0 && (
                    <View style={styles.bulkActions}>
                        <Text style={styles.selectedCount}>
                            {selectedSubmissions.size} selected
                        </Text>
                        <TouchableOpacity
                            style={styles.bulkActionButton}
                            onPress={handleBulkReprocess}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.bulkActionText}>Reprocess</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.bulkActionButton, styles.bulkActionButtonDanger]}
                            onPress={handleBulkDelete}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.bulkActionTextDanger}>Delete</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.bulkActionButton}
                            onPress={clearSelection}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.bulkActionText}>Clear</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Submissions List */}
            <FlatList
                data={filteredSubmissions}
                renderItem={renderSubmissionItem}
                keyExtractor={(item) => item.id.toString()}
                style={styles.submissionsList}
                contentContainerStyle={styles.submissionsContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📁</Text>
                        <Text style={styles.emptyTitle}>No submissions found</Text>
                        <Text style={styles.emptySubtitle}>
                            {searchQuery || Object.values(filters).some(f => f !== 'all' && f !== 'submitted_at' && f !== 'desc')
                                ? 'Try adjusting your search or filters'
                                : 'Upload your first file to get started'
                            }
                        </Text>
                        {!searchQuery && !Object.values(filters).some(f => f !== 'all' && f !== 'submitted_at' && f !== 'desc') && (
                            <TouchableOpacity
                                style={styles.emptyAction}
                                onPress={() => navigation.navigate('FileUpload')}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.emptyActionText}>Upload File</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                }
            />

            {/* Selection Actions */}
            {selectedSubmissions.size === 0 && filteredSubmissions.length > 0 && (
                <View style={styles.floatingActions}>
                    <TouchableOpacity
                        style={styles.floatingButton}
                        onPress={selectAll}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.floatingButtonText}>Select All</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Filters Modal */}
            <Modal
                visible={showFilters}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowFilters(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Filter & Sort</Text>
                            <TouchableOpacity
                                onPress={() => setShowFilters(false)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.modalClose}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            {/* Submission Type Filter */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterLabel}>Submission Type</Text>
                                <View style={styles.filterOptions}>
                                    {submissionTypeOptions.map((option) => (
                                        <TouchableOpacity
                                            key={option.value}
                                            style={[
                                                styles.filterOption,
                                                filters.submissionType === option.value && styles.filterOptionActive,
                                            ]}
                                            onPress={() => setFilters(prev => ({ ...prev, submissionType: option.value }))}
                                            activeOpacity={0.7}
                                        >
                                            <Text
                                                style={[
                                                    styles.filterOptionText,
                                                    filters.submissionType === option.value && styles.filterOptionTextActive,
                                                ]}
                                            >
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Status Filter */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterLabel}>Status</Text>
                                <View style={styles.filterOptions}>
                                    {statusOptions.map((option) => (
                                        <TouchableOpacity
                                            key={option.value}
                                            style={[
                                                styles.filterOption,
                                                filters.status === option.value && styles.filterOptionActive,
                                            ]}
                                            onPress={() => setFilters(prev => ({ ...prev, status: option.value }))}
                                            activeOpacity={0.7}
                                        >
                                            <Text
                                                style={[
                                                    styles.filterOptionText,
                                                    filters.status === option.value && styles.filterOptionTextActive,
                                                ]}
                                            >
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Score Range Filter */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterLabel}>Score Range</Text>
                                <View style={styles.filterOptions}>
                                    {scoreRangeOptions.map((option) => (
                                        <TouchableOpacity
                                            key={option.value}
                                            style={[
                                                styles.filterOption,
                                                filters.scoreRange === option.value && styles.filterOptionActive,
                                            ]}
                                            onPress={() => setFilters(prev => ({ ...prev, scoreRange: option.value }))}
                                            activeOpacity={0.7}
                                        >
                                            <Text
                                                style={[
                                                    styles.filterOptionText,
                                                    filters.scoreRange === option.value && styles.filterOptionTextActive,
                                                ]}
                                            >
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Date Range Filter */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterLabel}>Date Range</Text>
                                <View style={styles.filterOptions}>
                                    {dateRangeOptions.map((option) => (
                                        <TouchableOpacity
                                            key={option.value}
                                            style={[
                                                styles.filterOption,
                                                filters.dateRange === option.value && styles.filterOptionActive,
                                            ]}
                                            onPress={() => setFilters(prev => ({ ...prev, dateRange: option.value }))}
                                            activeOpacity={0.7}
                                        >
                                            <Text
                                                style={[
                                                    styles.filterOptionText,
                                                    filters.dateRange === option.value && styles.filterOptionTextActive,
                                                ]}
                                            >
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Sort Options */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterLabel}>Sort By</Text>
                                <View style={styles.filterOptions}>
                                    {sortOptions.map((option) => (
                                        <TouchableOpacity
                                            key={option.value}
                                            style={[
                                                styles.filterOption,
                                                filters.sortBy === option.value && styles.filterOptionActive,
                                            ]}
                                            onPress={() => setFilters(prev => ({ ...prev, sortBy: option.value }))}
                                            activeOpacity={0.7}
                                        >
                                            <Text
                                                style={[
                                                    styles.filterOptionText,
                                                    filters.sortBy === option.value && styles.filterOptionTextActive,
                                                ]}
                                            >
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View style={styles.sortOrderContainer}>
                                    <TouchableOpacity
                                        style={[
                                            styles.sortOrderButton,
                                            filters.sortOrder === 'asc' && styles.sortOrderButtonActive,
                                        ]}
                                        onPress={() => setFilters(prev => ({ ...prev, sortOrder: 'asc' }))}
                                        activeOpacity={0.7}
                                    >
                                        <Text
                                            style={[
                                                styles.sortOrderText,
                                                filters.sortOrder === 'asc' && styles.sortOrderTextActive,
                                            ]}
                                        >
                                            ↑ Ascending
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.sortOrderButton,
                                            filters.sortOrder === 'desc' && styles.sortOrderButtonActive,
                                        ]}
                                        onPress={() => setFilters(prev => ({ ...prev, sortOrder: 'desc' }))}
                                        activeOpacity={0.7}
                                    >
                                        <Text
                                            style={[
                                                styles.sortOrderText,
                                                filters.sortOrder === 'desc' && styles.sortOrderTextActive,
                                            ]}
                                        >
                                            ↓ Descending
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.resetButton}
                                onPress={() => setFilters({
                                    submissionType: 'all',
                                    status: 'all',
                                    scoreRange: 'all',
                                    dateRange: 'all',
                                    sortBy: 'submitted_at',
                                    sortOrder: 'desc',
                                })}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.resetButtonText}>Reset Filters</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.applyButton}
                                onPress={() => setShowFilters(false)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.applyButtonText}>Apply Filters</Text>
                            </TouchableOpacity>
                        </View>
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
    searchFilterBar: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        paddingHorizontal: 12,
    },
    searchIcon: {
        fontSize: 16,
        marginRight: 8,
        color: '#6B7280',
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
        paddingVertical: 12,
    },
    filterButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    filterButtonText: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    resultsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F3F4F6',
    },
    resultsCount: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    bulkActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    selectedCount: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    bulkActionButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    bulkActionButtonDanger: {
        borderColor: '#EF4444',
    },
    bulkActionText: {
        fontSize: 12,
        color: '#374151',
        fontWeight: '500',
    },
    bulkActionTextDanger: {
        fontSize: 12,
        color: '#EF4444',
        fontWeight: '500',
    },
    submissionsList: {
        flex: 1,
    },
    submissionsContent: {
        padding: 16,
        paddingTop: 0,
    },
    submissionItem: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    submissionItemSelected: {
        borderColor: '#3B82F6',
        backgroundColor: '#EFF6FF',
    },
    submissionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    submissionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    submissionIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    submissionDetails: {
        flex: 1,
    },
    submissionFilename: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    submissionMeta: {
        fontSize: 14,
        color: '#6B7280',
    },
    submissionActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    submissionStatus: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    submissionStatusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    selectionButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    selectionButtonActive: {
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
    },
    selectionButtonText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: 'bold',
    },
    submissionFeedback: {
        fontSize: 14,
        color: '#374151',
        fontStyle: 'italic',
        marginTop: 4,
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
    floatingActions: {
        position: 'absolute',
        bottom: 20,
        right: 20,
    },
    floatingButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        paddingHorizontal: 20,
        paddingVertical: 12,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    floatingButtonText: {
        fontSize: 14,
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
        maxHeight: '80%',
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
    modalBody: {
        flex: 1,
        padding: 20,
    },
    filterSection: {
        marginBottom: 24,
    },
    filterLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    filterOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    filterOption: {
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    filterOptionActive: {
        backgroundColor: '#EFF6FF',
        borderColor: '#3B82F6',
    },
    filterOptionText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    filterOptionTextActive: {
        color: '#3B82F6',
        fontWeight: '600',
    },
    sortOrderContainer: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 8,
    },
    sortOrderButton: {
        flex: 1,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    sortOrderButtonActive: {
        backgroundColor: '#EFF6FF',
        borderColor: '#3B82F6',
    },
    sortOrderText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    sortOrderTextActive: {
        color: '#3B82F6',
        fontWeight: '600',
    },
    modalActions: {
        flexDirection: 'row',
        padding: 20,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    resetButton: {
        flex: 1,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
    },
    resetButtonText: {
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '600',
    },
    applyButton: {
        flex: 1,
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
    },
    applyButtonText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '600',
    },
});