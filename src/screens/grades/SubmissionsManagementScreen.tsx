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
    Modal,
    TextInput,
    FlatList
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
    StudySession
} from '../../services/gradesService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SubmissionWithDetails extends AISubmission {
    courseName?: string;
    lessonTitle?: string;
    sessionStarted?: string;
}

interface FilterOptions {
    status: 'all' | 'processed' | 'pending' | 'reviewed';
    type: 'all' | 'homework' | 'quiz' | 'practice' | 'assessment';
    courseId: number | null;
    sortBy: 'date' | 'score' | 'type';
    sortOrder: 'asc' | 'desc';
}

export const SubmissionsManagementScreen: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([]);
    const [filteredSubmissions, setFilteredSubmissions] = useState<SubmissionWithDetails[]>([]);
    const [sessions, setSessions] = useState<StudySession[]>([]);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState<FilterOptions>({
        status: 'all',
        type: 'all',
        courseId: null,
        sortBy: 'date',
        sortOrder: 'desc'
    });

    const loadSubmissionsData = async (isRefresh = false) => {
        if (!token) {
            Alert.alert('Error', 'Please log in to view submissions');
            return;
        }

        try {
            if (!isRefresh) setLoading(true);

            // Get all user sessions first (API max limit is 100)
            const userSessions = await gradesService.getUserSessions(token, { limit: 100 });
            setSessions(userSessions);

            // Get submissions for each session
            const allSubmissions: SubmissionWithDetails[] = [];

            for (const session of userSessions) {
                try {
                    const sessionSubmissions = await gradesService.getSessionSubmissions(session.id, token);

                    const submissionsWithDetails = sessionSubmissions.map(submission => ({
                        ...submission,
                        courseName: `Course ${session.course_id}`,
                        lessonTitle: `Lesson ${session.lesson_id}`,
                        sessionStarted: session.started_at
                    }));

                    allSubmissions.push(...submissionsWithDetails);
                } catch (error) {
                    console.warn(`Error loading submissions for session ${session.id}:`, error);
                }
            }

            // Sort submissions by date (newest first)
            allSubmissions.sort((a, b) =>
                new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
            );

            setSubmissions(allSubmissions);
            applyFilters(allSubmissions, filters, searchQuery);

        } catch (error) {
            console.error('Error loading submissions data:', error);
            Alert.alert('Error', 'Failed to load submissions. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const applyFilters = (
        submissionsList: SubmissionWithDetails[],
        currentFilters: FilterOptions,
        query: string
    ) => {
        let filtered = [...submissionsList];

        // Apply status filter
        if (currentFilters.status !== 'all') {
            filtered = filtered.filter(submission => {
                switch (currentFilters.status) {
                    case 'processed':
                        return submission.ai_processed && submission.ai_score !== null;
                    case 'pending':
                        return !submission.ai_processed || submission.ai_score === null;
                    case 'reviewed':
                        return submission.reviewed_by !== null;
                    default:
                        return true;
                }
            });
        }

        // Apply type filter
        if (currentFilters.type !== 'all') {
            filtered = filtered.filter(submission =>
                submission.submission_type === currentFilters.type
            );
        }

        // Apply course filter
        if (currentFilters.courseId !== null) {
            filtered = filtered.filter(submission =>
                submission.course_id === currentFilters.courseId
            );
        }

        // Apply search query
        if (query.trim()) {
            const lowercaseQuery = query.toLowerCase();
            filtered = filtered.filter(submission =>
                submission.submission_type.toLowerCase().includes(lowercaseQuery) ||
                submission.original_filename?.toLowerCase().includes(lowercaseQuery) ||
                submission.courseName?.toLowerCase().includes(lowercaseQuery) ||
                submission.lessonTitle?.toLowerCase().includes(lowercaseQuery)
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let comparison = 0;

            switch (currentFilters.sortBy) {
                case 'date':
                    comparison = new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
                    break;
                case 'score':
                    comparison = (a.ai_score || 0) - (b.ai_score || 0);
                    break;
                case 'type':
                    comparison = a.submission_type.localeCompare(b.submission_type);
                    break;
            }

            return currentFilters.sortOrder === 'desc' ? -comparison : comparison;
        });

        setFilteredSubmissions(filtered);
    };

    useFocusEffect(
        useCallback(() => {
            loadSubmissionsData();
        }, [token])
    );

    useEffect(() => {
        applyFilters(submissions, filters, searchQuery);
    }, [filters, searchQuery, submissions]);

    const onRefresh = () => {
        setRefreshing(true);
        loadSubmissionsData(true);
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

    const getStatusColor = (submission: SubmissionWithDetails) => {
        if (submission.reviewed_by) return '#8B5CF6'; // Purple for reviewed
        if (submission.ai_processed && submission.ai_score !== null) return '#10B981'; // Green for processed
        if (submission.requires_review) return '#F59E0B'; // Amber for needs review
        return '#6B7280'; // Gray for pending
    };

    const getStatusText = (submission: SubmissionWithDetails) => {
        if (submission.reviewed_by) return 'Reviewed';
        if (submission.ai_processed && submission.ai_score !== null) return 'Processed';
        if (submission.requires_review) return 'Needs Review';
        return 'Pending';
    };

    const getGradeColor = (score: number): string => {
        return gradesService.getScoreColor(score);
    };

    const handleSubmissionPress = (submission: SubmissionWithDetails) => {
        navigation.navigate('GradeDetails', {
            submissionId: submission.id,
            submissionType: submission.submission_type
        });
    };

    const renderFilterModal = () => (
        <Modal
            visible={showFilterModal}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowFilterModal(false)}
        >
            <SafeAreaView style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                        <Text style={styles.modalCancel}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>Filter Submissions</Text>
                    <TouchableOpacity
                        onPress={() => {
                            setFilters({
                                status: 'all',
                                type: 'all',
                                courseId: null,
                                sortBy: 'date',
                                sortOrder: 'desc'
                            });
                            setShowFilterModal(false);
                        }}
                    >
                        <Text style={styles.modalReset}>Reset</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalContent}>
                    {/* Status Filter */}
                    <View style={styles.filterSection}>
                        <Text style={styles.filterTitle}>Status</Text>
                        <View style={styles.filterOptions}>
                            {['all', 'processed', 'pending', 'reviewed'].map(status => (
                                <TouchableOpacity
                                    key={status}
                                    style={[
                                        styles.filterOption,
                                        filters.status === status && styles.activeFilterOption
                                    ]}
                                    onPress={() => setFilters(prev => ({ ...prev, status: status as any }))}
                                >
                                    <Text style={[
                                        styles.filterOptionText,
                                        filters.status === status && styles.activeFilterOptionText
                                    ]}>
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Type Filter */}
                    <View style={styles.filterSection}>
                        <Text style={styles.filterTitle}>Type</Text>
                        <View style={styles.filterOptions}>
                            {['all', 'homework', 'quiz', 'practice', 'assessment'].map(type => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.filterOption,
                                        filters.type === type && styles.activeFilterOption
                                    ]}
                                    onPress={() => setFilters(prev => ({ ...prev, type: type as any }))}
                                >
                                    <Text style={[
                                        styles.filterOptionText,
                                        filters.type === type && styles.activeFilterOptionText
                                    ]}>
                                        {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Sort By */}
                    <View style={styles.filterSection}>
                        <Text style={styles.filterTitle}>Sort By</Text>
                        <View style={styles.filterOptions}>
                            {[
                                { key: 'date', label: 'Date' },
                                { key: 'score', label: 'Score' },
                                { key: 'type', label: 'Type' }
                            ].map(sort => (
                                <TouchableOpacity
                                    key={sort.key}
                                    style={[
                                        styles.filterOption,
                                        filters.sortBy === sort.key && styles.activeFilterOption
                                    ]}
                                    onPress={() => setFilters(prev => ({ ...prev, sortBy: sort.key as any }))}
                                >
                                    <Text style={[
                                        styles.filterOptionText,
                                        filters.sortBy === sort.key && styles.activeFilterOptionText
                                    ]}>
                                        {sort.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Sort Order */}
                    <View style={styles.filterSection}>
                        <Text style={styles.filterTitle}>Sort Order</Text>
                        <View style={styles.filterOptions}>
                            {[
                                { key: 'desc', label: 'Newest First' },
                                { key: 'asc', label: 'Oldest First' }
                            ].map(order => (
                                <TouchableOpacity
                                    key={order.key}
                                    style={[
                                        styles.filterOption,
                                        filters.sortOrder === order.key && styles.activeFilterOption
                                    ]}
                                    onPress={() => setFilters(prev => ({ ...prev, sortOrder: order.key as any }))}
                                >
                                    <Text style={[
                                        styles.filterOptionText,
                                        filters.sortOrder === order.key && styles.activeFilterOptionText
                                    ]}>
                                        {order.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </ScrollView>

                <View style={styles.modalFooter}>
                    <TouchableOpacity
                        style={styles.applyButton}
                        onPress={() => setShowFilterModal(false)}
                    >
                        <Text style={styles.applyButtonText}>Apply Filters</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    );

    const renderSubmissionItem = ({ item }: { item: SubmissionWithDetails }) => (
        <TouchableOpacity
            style={styles.submissionItem}
            onPress={() => handleSubmissionPress(item)}
        >
            <View style={styles.submissionLeft}>
                <View style={styles.submissionIcon}>
                    <Ionicons
                        name={getSubmissionIcon(item.submission_type)}
                        size={20}
                        color="#3B82F6"
                    />
                </View>
                <View style={styles.submissionInfo}>
                    <Text style={styles.submissionTitle}>
                        {item.submission_type.charAt(0).toUpperCase() +
                            item.submission_type.slice(1)}
                    </Text>
                    <Text style={styles.submissionSubtitle}>
                        {item.courseName} • {item.lessonTitle}
                    </Text>
                    {item.original_filename && (
                        <Text style={styles.submissionFilename} numberOfLines={1}>
                            📎 {item.original_filename}
                        </Text>
                    )}
                    <Text style={styles.submissionDate}>
                        {new Date(item.submitted_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </Text>
                </View>
            </View>
            <View style={styles.submissionRight}>
                {item.ai_score !== null && item.ai_score !== undefined ? (
                    <View style={[styles.scoreContainer, {
                        backgroundColor: getGradeColor(item.ai_score) + '20'
                    }]}>
                        <Text style={[styles.scoreText, {
                            color: getGradeColor(item.ai_score)
                        }]}>
                            {Math.round(item.ai_score)}%
                        </Text>
                    </View>
                ) : (
                    <View style={[styles.statusContainer, {
                        backgroundColor: getStatusColor(item) + '20'
                    }]}>
                        <Text style={[styles.statusText, {
                            color: getStatusColor(item)
                        }]}>
                            {getStatusText(item)}
                        </Text>
                    </View>
                )}
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </View>
        </TouchableOpacity>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Submissions Found</Text>
            <Text style={styles.emptySubtitle}>
                {searchQuery || filters.status !== 'all' || filters.type !== 'all'
                    ? 'Try adjusting your filters or search query'
                    : 'Complete assignments to see your submissions here'
                }
            </Text>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>Loading submissions...</Text>
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
                <Text style={styles.headerTitle}>My Submissions</Text>
                <TouchableOpacity onPress={() => setShowFilterModal(true)}>
                    <Ionicons name="filter" size={24} color="#3B82F6" />
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                    <Ionicons name="search" size={20} color="#9CA3AF" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search submissions..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#9CA3AF"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Results Header */}
            <View style={styles.resultsHeader}>
                <Text style={styles.resultsCount}>
                    {filteredSubmissions.length} submission{filteredSubmissions.length !== 1 ? 's' : ''}
                </Text>
                {(filters.status !== 'all' || filters.type !== 'all' || searchQuery) && (
                    <TouchableOpacity
                        style={styles.clearFiltersButton}
                        onPress={() => {
                            setFilters({
                                status: 'all',
                                type: 'all',
                                courseId: null,
                                sortBy: 'date',
                                sortOrder: 'desc'
                            });
                            setSearchQuery('');
                        }}
                    >
                        <Text style={styles.clearFiltersText}>Clear All</Text>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={filteredSubmissions}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderSubmissionItem}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={renderEmptyState}
                contentContainerStyle={filteredSubmissions.length === 0 ? styles.emptyListContainer : undefined}
                showsVerticalScrollIndicator={false}
            />

            {renderFilterModal()}
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
    searchContainer: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#1F2937',
    },
    resultsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    resultsCount: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    clearFiltersButton: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#FEE2E2',
    },
    clearFiltersText: {
        fontSize: 12,
        color: '#DC2626',
        fontWeight: '500',
    },
    submissionItem: {
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    submissionLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    submissionIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#EBF5FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    submissionInfo: {
        flex: 1,
    },
    submissionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 2,
    },
    submissionSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 2,
    },
    submissionFilename: {
        fontSize: 12,
        color: '#9CA3AF',
        marginBottom: 2,
    },
    submissionDate: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    submissionRight: {
        alignItems: 'flex-end',
        gap: 8,
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
    statusContainer: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
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
    },
    // Modal styles
    modalContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalCancel: {
        fontSize: 16,
        color: '#6B7280',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
    },
    modalReset: {
        fontSize: 16,
        color: '#3B82F6',
        fontWeight: '500',
    },
    modalContent: {
        flex: 1,
        paddingHorizontal: 20,
    },
    filterSection: {
        marginVertical: 16,
    },
    filterTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 12,
    },
    filterOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    filterOption: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    activeFilterOption: {
        backgroundColor: '#EBF5FF',
        borderColor: '#3B82F6',
    },
    filterOptionText: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    activeFilterOptionText: {
        color: '#3B82F6',
    },
    modalFooter: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    applyButton: {
        backgroundColor: '#3B82F6',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    applyButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});