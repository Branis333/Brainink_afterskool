/**
 * Note Details Screen
 * Shows detailed information about a specific note including AI analysis results
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Dimensions,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { notesService, StudentNote } from '../../services/notesService';
import { Ionicons } from '@expo/vector-icons';

type NavigationProp = NativeStackNavigationProp<any>;
type RouteParams = RouteProp<{ params: { noteId: number } }, 'params'>;

interface Props {
    navigation: NavigationProp;
    route: RouteParams;
}

const { width } = Dimensions.get('window');

export const NoteDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
    const { token } = useAuth();
    const { noteId } = route.params;
    const [note, setNote] = useState<StudentNote | null>(null);
    const [loading, setLoading] = useState(true);

    // Load note details
    useEffect(() => {
        loadNoteDetails();
    }, [noteId]);

    const loadNoteDetails = async () => {
        try {
            setLoading(true);
            if (!token) throw new Error('No authentication token');

            const noteData = await notesService.getNoteById(noteId, token);
            setNote(noteData);
        } catch (error) {
            console.error('Error loading note details:', error);
            Alert.alert('Error', 'Failed to load note details');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    // Toggle starred
    const handleToggleStarred = async () => {
        if (!note || !token) return;

        try {
            await notesService.toggleStarred(note.id, note.is_starred, token);
            setNote({ ...note, is_starred: !note.is_starred });
        } catch (error) {
            console.error('Error toggling starred:', error);
            Alert.alert('Error', 'Failed to update note');
        }
    };

    // Delete note
    const handleDelete = () => {
        Alert.alert(
            'Delete Note',
            'Are you sure you want to delete this note? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            if (!token) return;
                            await notesService.deleteNote(noteId, token);
                            // Navigate back to notes list with success message
                            navigation.navigate('NotesList');
                            // Show toast-style alert after navigation
                            setTimeout(() => {
                                Alert.alert('✓ Deleted', 'Note deleted successfully');
                            }, 300);
                        } catch (error) {
                            console.error('Error deleting note:', error);
                            Alert.alert('Error', 'Failed to delete note');
                        }
                    },
                },
            ]
        );
    };

    // Format date
    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    // Render loading state
    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#7C5CFF" />
                <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#7C5CFF" />
                        <Text style={styles.loadingText}>Loading note details...</Text>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    if (!note) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#7C5CFF" />
                <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                    <View style={styles.loadingContainer}>
                        <Text style={styles.errorText}>Note not found</Text>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="light-content" backgroundColor="#7C5CFF" />

            {/* Pill-shaped Header */}
            <View style={styles.headerContainer}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Note Details</Text>
                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            style={styles.headerIconButton}
                            onPress={handleToggleStarred}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={note.is_starred ? 'star' : 'star-outline'}
                                size={24}
                                color={note.is_starred ? '#FFD700' : '#FFFFFF'}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.headerIconButton}
                            onPress={handleDelete}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {/* Title Card */}
                <View style={styles.titleCard}>
                    <Text style={styles.noteTitle}>{note.title}</Text>
                    {note.subject && (
                        <View style={styles.subjectBadge}>
                            <Ionicons name="bookmark" size={16} color="#007AFF" />
                            <Text style={styles.subjectText}>{note.subject}</Text>
                        </View>
                    )}
                    <View style={styles.metaInfo}>
                        <View style={styles.metaItem}>
                            <Ionicons name="calendar-outline" size={16} color="#666" />
                            <Text style={styles.metaText}>{formatDate(note.created_at)}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Ionicons name="images-outline" size={16} color="#666" />
                            <Text style={styles.metaText}>{note.total_images} images</Text>
                        </View>
                    </View>
                    {note.description && (
                        <Text style={styles.description}>{note.description}</Text>
                    )}
                </View>

                {/* AI Analysis Section */}
                {note.ai_processed ? (
                    <>
                        {/* Summary */}
                        {note.summary && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Ionicons name="document-text" size={24} color="#007AFF" />
                                    <Text style={styles.sectionTitle}>Summary</Text>
                                </View>
                                <View style={styles.sectionContent}>
                                    <Text style={styles.summaryText}>{note.summary}</Text>
                                </View>
                            </View>
                        )}

                        {/* Key Points - Horizontal Flash Cards */}
                        {note.key_points && note.key_points.length > 0 && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Ionicons name="checkmark-circle" size={24} color="#28a745" />
                                    <Text style={styles.sectionTitle}>Key Points</Text>
                                </View>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.flashCardsContainer}
                                >
                                    {note.key_points.map((point, index) => (
                                        <View key={index} style={styles.flashCard}>
                                            <View style={styles.flashCardHeader}>
                                                <View style={styles.flashCardNumber}>
                                                    <Text style={styles.flashCardNumberText}>{index + 1}</Text>
                                                </View>
                                                <Ionicons name="checkmark-circle" size={20} color="#28a745" />
                                            </View>
                                            <Text style={styles.flashCardText}>{point}</Text>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Main Topics */}
                        {note.main_topics && note.main_topics.length > 0 && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Ionicons name="bulb" size={24} color="#FF9500" />
                                    <Text style={styles.sectionTitle}>Main Topics</Text>
                                </View>
                                <View style={styles.topicsContainer}>
                                    {note.main_topics.map((topic, index) => (
                                        <View key={index} style={styles.topicChip}>
                                            <Text style={styles.topicText}>{topic}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Learning Concepts */}
                        {note.learning_concepts && note.learning_concepts.length > 0 && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Ionicons name="school" size={24} color="#5856D6" />
                                    <Text style={styles.sectionTitle}>Learning Concepts</Text>
                                </View>
                                <View style={styles.sectionContent}>
                                    {note.learning_concepts.map((concept, index) => (
                                        <View key={index} style={styles.conceptItem}>
                                            <Ionicons name="arrow-forward-circle" size={18} color="#5856D6" />
                                            <Text style={styles.conceptText}>{concept}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Study Questions */}
                        {note.questions_generated && note.questions_generated.length > 0 && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Ionicons name="help-circle" size={24} color="#FF3B30" />
                                    <Text style={styles.sectionTitle}>Study Questions</Text>
                                </View>
                                <View style={styles.sectionContent}>
                                    {note.questions_generated.map((question, index) => (
                                        <View key={index} style={styles.questionItem}>
                                            <Text style={styles.questionNumber}>Q{index + 1}</Text>
                                            <Text style={styles.questionText}>{question}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </>
                ) : (
                    <View style={styles.processingCard}>
                        <ActivityIndicator size="large" color="#26D9CA" />
                        <Text style={styles.processingTitle}>Processing Note</Text>
                        <Text style={styles.processingText}>
                            AI analysis is in progress. Please check back soon.
                        </Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
    errorText: {
        fontSize: 18,
        color: '#FF3B30',
        fontWeight: '600',
    },
    headerContainer: {
        backgroundColor: 'rgba(125, 92, 255, 0.16)',
        paddingBottom: 16,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
        flex: 1,
        textAlign: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    headerIconButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    titleCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    noteTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 12,
    },
    subjectBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#E3F2FD',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginBottom: 12,
        gap: 6,
    },
    subjectText: {
        fontSize: 14,
        color: '#007AFF',
        fontWeight: '600',
    },
    metaInfo: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 12,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    metaText: {
        fontSize: 14,
        color: '#666',
    },
    description: {
        fontSize: 15,
        color: '#444',
        lineHeight: 22,
        marginTop: 8,
    },
    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    sectionContent: {
        gap: 12,
    },
    summaryText: {
        fontSize: 15,
        color: '#444',
        lineHeight: 24,
    },
    bulletItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    bullet: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(125, 92, 255, 0.4)',
        marginTop: 8,
    },
    bulletText: {
        flex: 1,
        fontSize: 15,
        color: '#444',
        lineHeight: 22,
    },
    flashCardsContainer: {
        paddingVertical: 8,
        gap: 16,
    },
    flashCard: {
        backgroundColor: '#fffc5698',
        borderRadius: 16,
        padding: 20,
        width: width * 0.60,
        minHeight: 140,
        marginRight: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        borderLeftWidth: 4,
        borderLeftColor: 'rgba(125, 92, 255, 0.4)',
    },
    flashCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    flashCardNumber: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(125, 92, 255, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    flashCardNumberText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    flashCardText: {
        fontSize: 15,
        color: '#333',
        lineHeight: 22,
        fontWeight: '500',
    },
    topicsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    topicChip: {
        backgroundColor: '#FFF3E0',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    topicText: {
        fontSize: 14,
        color: '#FF9500',
        fontWeight: '600',
    },
    conceptItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    conceptText: {
        flex: 1,
        fontSize: 15,
        color: '#444',
        lineHeight: 22,
    },
    questionItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FFF5F5',
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
        gap: 12,
    },
    questionNumber: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#FF3B30',
        minWidth: 30,
    },
    questionText: {
        flex: 1,
        fontSize: 15,
        color: '#444',
        lineHeight: 22,
    },
    processingCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 40,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    processingTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginTop: 16,
        marginBottom: 8,
    },
    processingText: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
    },
});
