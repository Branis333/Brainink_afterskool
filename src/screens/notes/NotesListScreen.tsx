/**
 * Notes List Screen
 * Main screen showing all user's notes with filtering and search capabilities
 * Design inspired by CourseHomepageScreen
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
    Modal,
    TextInput,
    Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { notesService, StudentNote, NotesStatistics } from '../../services/notesService';
import { Ionicons } from '@expo/vector-icons';

type NavigationProp = NativeStackNavigationProp<any>;

interface Props {
    navigation: NavigationProp;
}

const { width } = Dimensions.get('window');

export const NotesListScreen: React.FC<Props> = ({ navigation }) => {
    const { token, user } = useAuth();
    const [notes, setNotes] = useState<StudentNote[]>([]);
    const [statistics, setStatistics] = useState<NotesStatistics | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState<'all' | 'starred' | 'subject'>('all');
    const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

    // Search state
    const [searchModalVisible, setSearchModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<StudentNote[] | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const [isSearchMode, setIsSearchMode] = useState(false);
    const [sortBy, setSortBy] = useState<'recent' | 'title' | 'subject'>('recent');

    // Load notes data
    const loadNotes = async (isRefresh: boolean = false) => {
        try {
            if (!isRefresh) setLoading(true);

            if (!token) {
                throw new Error('No authentication token available');
            }

            // Load notes based on filter
            let notesData;
            if (selectedFilter === 'starred') {
                const response = await notesService.getStarredNotes(token);
                notesData = response.notes;
            } else if (selectedFilter === 'subject' && selectedSubject) {
                const response = await notesService.getNotesBySubject(selectedSubject, token);
                notesData = response.notes;
            } else {
                const response = await notesService.getUserNotes(token);
                notesData = response.notes;
            }

            setNotes(notesData);

            // Load statistics
            const stats = await notesService.getUserStatistics(token);
            setStatistics(stats);

        } catch (error) {
            console.error('Error loading notes:', error);
            Alert.alert('Error', 'Failed to load your notes. Please try again.');
        } finally {
            setLoading(false);
            if (isRefresh) setRefreshing(false);
        }
    };

    // Load data on screen focus
    useFocusEffect(
        useCallback(() => {
            loadNotes();
        }, [token, selectedFilter, selectedSubject])
    );

    // Pull to refresh
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadNotes(true);
    }, [selectedFilter, selectedSubject]);

    // Handle search
    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            Alert.alert('Validation Error', 'Please enter a search query');
            return;
        }

        try {
            setSearchLoading(true);
            if (!token) {
                throw new Error('No authentication token');
            }

            const results = await notesService.searchNotes(
                searchQuery,
                token,
                sortBy,
                100,
                0
            );

            setSearchResults(results.notes);
            setIsSearchMode(true);
            console.log(`✅ Found ${results.total} notes`);
        } catch (error) {
            console.error('Search error:', error);
            Alert.alert('Search Error', 'Failed to search notes. Please try again.');
        } finally {
            setSearchLoading(false);
        }
    };

    // Clear search
    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults(null);
        setIsSearchMode(false);
        setSortBy('recent');
    };

    // Close search modal
    const closeSearchModal = () => {
        setSearchModalVisible(false);
        clearSearch();
        Keyboard.dismiss();
    };

    // Navigate to note details
    const navigateToNoteDetails = (note: StudentNote) => {
        navigation.navigate('NoteDetails', { noteId: note.id });
    };

    // Navigate to upload new note
    const navigateToUploadNote = () => {
        navigation.navigate('UploadNote');
    };

    // Navigate back to home
    const navigateToHome = () => {
        navigation.navigate('MainTabs');
    };

    // Toggle starred status
    const toggleStarred = async (note: StudentNote) => {
        try {
            await notesService.toggleStarred(note.id, note.is_starred, token!);
            // Refresh notes list
            loadNotes(true);
        } catch (error) {
            console.error('Error toggling starred:', error);
            Alert.alert('Error', 'Failed to update note');
        }
    };

    // Get unique subjects from statistics
    const getSubjects = (): string[] => {
        if (!statistics?.subject_distribution) return [];
        return Object.keys(statistics.subject_distribution);
    };

    // Get color for subject badge
    const getSubjectColor = (index: number): string => {
        const colors = ['#007AFF', '#28a745', '#FF9500', '#FF3B30', '#5856D6', '#FF2D55'];
        return colors[index % colors.length];
    };

    // Format date
    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Render loading state
    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#7C5CFF" />
                <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#7C5CFF" />
                        <Text style={styles.loadingText}>Loading your notes...</Text>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    // Render individual note card
    const renderNoteCard = ({ item: note }: { item: StudentNote }) => (
        <TouchableOpacity
            style={styles.noteCard}
            onPress={() => navigateToNoteDetails(note)}
            activeOpacity={0.8}
        >
            <View style={styles.noteCardHeader}>
                <View style={styles.noteCardLeft}>
                    <Ionicons
                        name={note.ai_processed ? "document-text" : "document-outline"}
                        size={24}
                        color={note.ai_processed ? "#28a745" : "#666"}
                    />
                </View>
                <View style={styles.noteCardContent}>
                    <Text style={styles.noteTitle} numberOfLines={2}>
                        {note.title}
                    </Text>
                    {note.subject && (
                        <View style={styles.subjectBadge}>
                            <Text style={styles.subjectBadgeText}>{note.subject}</Text>
                        </View>
                    )}
                    {note.summary && (
                        <Text style={styles.noteSummary} numberOfLines={2}>
                            {note.summary}
                        </Text>
                    )}
                    <View style={styles.noteMetaRow}>
                        <Text style={styles.noteDate}>
                            {formatDate(note.created_at)}
                        </Text>
                        <View style={styles.noteStats}>
                            <Ionicons name="images-outline" size={14} color="#999" />
                            <Text style={styles.noteStatsText}>{note.total_images}</Text>
                        </View>
                    </View>
                </View>
                <TouchableOpacity
                    style={styles.starButton}
                    onPress={() => toggleStarred(note)}
                    activeOpacity={0.6}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons
                        name={note.is_starred ? "star" : "star-outline"}
                        size={24}
                        color={note.is_starred ? "#FF9500" : "#999"}
                    />
                </TouchableOpacity>
            </View>

            {note.ai_processed && (
                <View style={styles.aiProcessedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#28a745" />
                    <Text style={styles.aiProcessedText}>AI Analyzed</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    // Render empty state
    const renderEmptyState = () => (
        <View style={styles.emptyStateContainer}>
            <Ionicons name="document-text-outline" size={80} color="#ccc" />
            <Text style={styles.emptyStateTitle}>No Notes Yet</Text>
            <Text style={styles.emptyStateText}>
                Start uploading your school notes to get AI-powered analysis and insights
            </Text>
            <TouchableOpacity
                style={styles.uploadButton}
                onPress={navigateToUploadNote}
            >
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.uploadButtonText}>Upload Your First Note</Text>
            </TouchableOpacity>
        </View>
    );

    // Main return
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#7C5CFF" />

            <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
                {/* Scrollable Content */}
                <ScrollView
                    style={styles.scrollContainer}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#7C5CFF"
                        />
                    }
                >
                    {/* Navigation Buttons at Top of Scrollable Content */}
                    <View style={styles.backButtonContainer}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={navigateToHome}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                        </TouchableOpacity>

                        <View style={styles.actionButtonsContainer}>
                            <TouchableOpacity
                                style={styles.searchButton}
                                onPress={() => setSearchModalVisible(true)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="search" size={20} color="#FFFFFF" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.uploadIconButton}
                                onPress={navigateToUploadNote}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="add" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Achievement Cards Section with Blur Effect */}
                    <View style={styles.achievementSectionWrapper}>
                        <View style={styles.achievementSection}>
                            {statistics && (
                                <View style={styles.statsGrid}>
                                    <View style={styles.statsRow}>
                                        {/* Total Notes - Purple */}
                                        <View style={[styles.achievementCard, { backgroundColor: '#C8B5FF' }]}>
                                            <View style={styles.achievementIconContainer}>
                                                <Ionicons name="document-text-outline" size={20} color="#7C5CFF" />
                                            </View>
                                            <Text style={styles.achievementLabel}>Total Notes</Text>
                                            <Text style={styles.achievementValue}>{statistics.total_notes}</Text>
                                        </View>

                                        {/* AI Analyzed - Green */}
                                        <View style={[styles.achievementCard, { backgroundColor: '#C8F5D5' }]}>
                                            <View style={styles.achievementIconContainer}>
                                                <Ionicons name="sparkles-outline" size={20} color="#34C759" />
                                            </View>
                                            <Text style={styles.achievementLabel}>AI Analyzed</Text>
                                            <Text style={styles.achievementValue}>{statistics.processed_notes}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.statsRow}>
                                        {/* Starred - Orange */}
                                        <View style={[styles.achievementCard, { backgroundColor: '#FFD5B5' }]}>
                                            <View style={styles.achievementIconContainer}>
                                                <Ionicons name="star-outline" size={20} color="#FF9500" />
                                            </View>
                                            <Text style={styles.achievementLabel}>Starred</Text>
                                            <Text style={styles.achievementValue}>
                                                {notes.filter(n => n.is_starred).length}
                                            </Text>
                                        </View>

                                        {/* Recent (last 7 days) - Gray/Purple */}
                                        <View style={[styles.achievementCard, { backgroundColor: '#E5E5EA' }]}>
                                            <View style={styles.achievementIconContainer}>
                                                <Ionicons name="time-outline" size={20} color="#8E8E93" />
                                            </View>
                                            <Text style={styles.achievementLabel}>Recent</Text>
                                            <Text style={styles.achievementValue}>
                                                {notes.filter(n => {
                                                    const noteDate = new Date(n.created_at);
                                                    const weekAgo = new Date();
                                                    weekAgo.setDate(weekAgo.getDate() - 7);
                                                    return noteDate >= weekAgo;
                                                }).length}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Notes List */}
                    <View style={styles.notesListContainer}>
                        {isSearchMode && (
                            <View style={styles.searchHeaderContainer}>
                                <View style={styles.searchHeaderRow}>
                                    <View>
                                        <Text style={styles.searchHeaderTitle}>Search Results</Text>
                                        <Text style={styles.searchHeaderSubtitle}>
                                            "{searchQuery}" - {searchResults?.length || 0} results
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.clearSearchButton}
                                        onPress={clearSearch}
                                    >
                                        <Ionicons name="close-circle" size={24} color="#7C5CFF" />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.sortOptionsRow}>
                                    {(['recent', 'title', 'subject'] as const).map((option) => (
                                        <TouchableOpacity
                                            key={option}
                                            style={[
                                                styles.sortOption,
                                                sortBy === option && styles.sortOptionActive,
                                            ]}
                                            onPress={() => setSortBy(option)}
                                        >
                                            <Text
                                                style={[
                                                    styles.sortOptionText,
                                                    sortBy === option && styles.sortOptionTextActive,
                                                ]}
                                            >
                                                {option.charAt(0).toUpperCase() + option.slice(1)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {(isSearchMode ? searchResults : notes).length === 0 ? (
                            renderEmptyState()
                        ) : (
                            (isSearchMode ? searchResults : notes)?.map((note) => (
                                <View key={note.id.toString()}>
                                    {renderNoteCard({ item: note })}
                                </View>
                            ))
                        )}
                    </View>
                </ScrollView>

                {/* Search Modal */}
                <Modal
                    visible={searchModalVisible}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={closeSearchModal}
                >
                    <SafeAreaView style={styles.searchModalContainer}>
                        <View style={styles.searchSimpleHeader}>
                            <Text style={styles.searchSimpleTitle}>Search</Text>
                            <TouchableOpacity
                                onPress={closeSearchModal}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={24} color="#1a1a1a" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchInputContainer}>
                            <Ionicons name="search" size={20} color="#999" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by title, subject, or keywords..."
                                placeholderTextColor="#ccc"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onSubmitEditing={handleSearch}
                                returnKeyType="search"
                                editable={!searchLoading}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => setSearchQuery('')}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Ionicons name="close-circle" size={20} color="#999" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {isSearchMode && (
                            <View style={styles.searchSortContainer}>
                                <Text style={styles.searchSortLabel}>Sort by:</Text>
                                <View style={styles.searchSortOptions}>
                                    {(['recent', 'title', 'subject'] as const).map((option) => (
                                        <TouchableOpacity
                                            key={option}
                                            style={[
                                                styles.searchSortOption,
                                                sortBy === option && styles.searchSortOptionActive,
                                            ]}
                                            onPress={() => setSortBy(option)}
                                        >
                                            <Text
                                                style={[
                                                    styles.searchSortOptionText,
                                                    sortBy === option && styles.searchSortOptionTextActive,
                                                ]}
                                            >
                                                {option.charAt(0).toUpperCase() + option.slice(1)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        <TouchableOpacity
                            style={styles.searchSubmitButton}
                            onPress={handleSearch}
                            disabled={searchLoading || !searchQuery.trim()}
                            activeOpacity={0.8}
                        >
                            {searchLoading ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="search" size={20} color="#FFFFFF" />
                                    <Text style={styles.searchSubmitButtonText}>Search</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {isSearchMode && searchResults && (
                            <View style={styles.searchResultsInfo}>
                                <Text style={styles.searchResultsText}>
                                    Found {searchResults.length} note{searchResults.length !== 1 ? 's' : ''}
                                </Text>
                            </View>
                        )}

                        <ScrollView style={styles.searchResultsList} showsVerticalScrollIndicator={false}>
                            {isSearchMode && searchResults ? (
                                searchResults.length === 0 ? (
                                    <View style={styles.noResultsContainer}>
                                        <Ionicons name="search-outline" size={60} color="#ccc" />
                                        <Text style={styles.noResultsTitle}>No Results Found</Text>
                                        <Text style={styles.noResultsText}>
                                            Try different keywords or check your spelling
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={styles.searchResultsContainer}>
                                        {searchResults.map((note) => (
                                            <TouchableOpacity
                                                key={note.id.toString()}
                                                style={styles.searchResultItem}
                                                onPress={() => {
                                                    closeSearchModal();
                                                    navigateToNoteDetails(note);
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <View style={styles.searchResultItemContent}>
                                                    <Text style={styles.searchResultTitle} numberOfLines={2}>
                                                        {note.title}
                                                    </Text>
                                                    {note.subject && (
                                                        <Text style={styles.searchResultSubject}>
                                                            {note.subject}
                                                        </Text>
                                                    )}
                                                    {note.summary && (
                                                        <Text
                                                            style={styles.searchResultSummary}
                                                            numberOfLines={2}
                                                        >
                                                            {note.summary}
                                                        </Text>
                                                    )}
                                                    <Text style={styles.searchResultDate}>
                                                        {formatDate(note.created_at)}
                                                    </Text>
                                                </View>
                                                <Ionicons
                                                    name="chevron-forward"
                                                    size={20}
                                                    color="#999"
                                                />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )
                            ) : (
                                <View style={styles.searchPlaceholder}>
                                    <Ionicons name="search-outline" size={60} color="#ccc" />
                                    <Text style={styles.searchPlaceholderText}>
                                        Enter a search query to find your notes
                                    </Text>
                                </View>
                            )}
                        </ScrollView>
                    </SafeAreaView>
                </Modal>

                {/* Floating Action Button */}
                <TouchableOpacity
                    style={styles.fab}
                    onPress={navigateToUploadNote}
                    activeOpacity={0.8}
                >
                    <Ionicons name="add" size={32} color="#FFFFFF" />
                </TouchableOpacity>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fcfcfcff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fcfcfcff',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
    safeArea: {
        flex: 1,
        backgroundColor: '#eae9f0ff',
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 100,
    },
    backButtonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 12,
    },
    actionButtonsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(151, 150, 150, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadIconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(151, 150, 150, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    achievementSectionWrapper: {
        marginTop: 12,
        marginHorizontal: 12,
        marginBottom: 12,
    },
    achievementSection: {
        backgroundColor: 'rgba(125, 92, 255, 0.4)',
        paddingTop: 16,
        paddingBottom: 16,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: '#7C5CFF',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.6,
        shadowRadius: 24,
        elevation: 15,
        overflow: 'visible',
    },
    statsGrid: {
        paddingHorizontal: 16,
    },
    statsRow: {
        flexDirection: 'row',
        marginBottom: 8,
        gap: 8,
    },
    achievementCard: {
        flex: 1,
        borderRadius: 16,
        padding: 12,
        minHeight: 90,
        justifyContent: 'space-between',
    },
    achievementIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    achievementLabel: {
        fontSize: 11,
        color: '#666',
        fontWeight: '500',
        marginBottom: 2,
    },
    achievementValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    notesListContainer: {
        padding: 16,
        paddingTop: 12,
    },
    noteCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        overflow: 'hidden',
    },
    noteCardHeader: {
        flexDirection: 'row',
        padding: 16,
    },
    noteCardLeft: {
        marginRight: 12,
        justifyContent: 'flex-start',
    },
    noteCardContent: {
        flex: 1,
    },
    noteTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    subjectBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#E3F2FD',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 8,
    },
    subjectBadgeText: {
        fontSize: 12,
        color: '#007AFF',
        fontWeight: '600',
    },
    noteSummary: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
        marginBottom: 8,
    },
    noteMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    noteDate: {
        fontSize: 12,
        color: '#999',
    },
    noteStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    noteStatsText: {
        fontSize: 12,
        color: '#999',
    },
    starButton: {
        padding: 8,
    },
    aiProcessedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 6,
    },
    aiProcessedText: {
        fontSize: 12,
        color: '#28a745',
        fontWeight: '600',
    },
    emptyStateContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingVertical: 60,
    },
    emptyStateTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginTop: 24,
        marginBottom: 12,
    },
    emptyStateText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#7C5CFF',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    uploadButtonText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#7C5CFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },

    // ===============================
    // SEARCH BUTTON STYLES
    // ===============================
    searchButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(151, 150, 150, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 8,
    },

    // ===============================
    // SEARCH MODAL STYLES
    // ===============================
    searchModalContainer: {
        flex: 1,
        backgroundColor: '#fcfcfcff',
        paddingTop: 25,
    },
    searchModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 0,
        paddingVertical: 0,
        backgroundColor: '#7d5cff05',
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,

    },
    searchModalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#000000ff',
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginTop: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        marginRight: 8,
        fontSize: 16,
        color: '#1a1a1a',
    },
    searchSortContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    searchSortLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    searchSortOptions: {
        flexDirection: 'row',
        gap: 8,
    },
    searchSortOption: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#F0F0F0',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    searchSortOptionActive: {
        backgroundColor: '#7C5CFF',
        borderColor: '#7C5CFF',
    },
    searchSortOptionText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#666',
    },
    searchSortOptionTextActive: {
        color: '#FFFFFF',
    },
    searchSubmitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#7C5CFF',
        marginHorizontal: 16,
        marginTop: 12,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    searchSubmitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    searchResultsInfo: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
    },
    searchResultsText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#7C5CFF',
    },
    searchResultsList: {
        flex: 1,
        paddingHorizontal: 0,
    },
    searchResultsContainer: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 20,
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 12,
        marginBottom: 8,
        borderRadius: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#7C5CFF',
    },
    searchResultItemContent: {
        flex: 1,
    },
    searchResultTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    searchResultSubject: {
        fontSize: 13,
        fontWeight: '500',
        color: '#007AFF',
        marginBottom: 4,
    },
    searchResultSummary: {
        fontSize: 13,
        color: '#666',
        lineHeight: 18,
        marginBottom: 4,
    },
    searchResultDate: {
        fontSize: 12,
        color: '#999',
    },
    noResultsContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingVertical: 60,
    },
    noResultsTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1a1a1a',
        marginTop: 16,
        marginBottom: 8,
    },
    noResultsText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
    },
    searchPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingVertical: 60,
    },
    searchPlaceholderText: {
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
        marginTop: 16,
        lineHeight: 22,
    },
    searchHeaderContainer: {
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 12,
        borderRadius: 12,
    },
    searchHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    searchHeaderTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    searchHeaderSubtitle: {
        fontSize: 13,
        color: '#666',
        marginTop: 2,
    },
    clearSearchButton: {
        padding: 4,
    },
    sortOptionsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    sortOption: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    sortOptionActive: {
        backgroundColor: '#7C5CFF',
        borderColor: '#7C5CFF',
    },
    sortOptionText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#666',
    },
    sortOptionTextActive: {
        color: '#FFFFFF',
    },
    searchSimpleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fcfcfcff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    searchSimpleTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1a1a1a',
    },
});
