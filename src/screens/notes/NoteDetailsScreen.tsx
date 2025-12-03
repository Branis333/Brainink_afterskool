/**
 * Note Details Screen
 * Shows detailed information about a specific note including AI analysis results
 */

import React, { useState, useEffect, useRef } from 'react';
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
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { notesService, StudentNote, ObjectiveItem } from '../../services/notesService';
import { Ionicons } from '@expo/vector-icons';

type NavigationProp = NativeStackNavigationProp<any>;
type RouteParams = RouteProp<{ params: { noteId: number } }, 'params'>;

interface Props {
    navigation: NavigationProp;
    route: RouteParams;
}

const { width } = Dimensions.get('window');

const OBJECTIVE_CARD_WIDTH = width * 0.75;
const OBJECTIVE_CARD_MARGIN = 0;
const OBJECTIVE_SNAP_INTERVAL = OBJECTIVE_CARD_WIDTH + OBJECTIVE_CARD_MARGIN;

export const NoteDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
    const { token } = useAuth();
    const { noteId } = route.params;
    const [note, setNote] = useState<StudentNote | null>(null);
    const [loading, setLoading] = useState(true);
    const objectivesScrollX = useRef(new Animated.Value(0)).current;

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
            <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
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
                            color={note.is_starred ? '#FFD700' : '#666'}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerIconButton}
                        onPress={handleDelete}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                    </TouchableOpacity>
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
                        {/* Objectives - Animated Carousel with Zoom Effect */}
                        {note.objectives && note.objectives.length > 0 && (
                            <LinearGradient
                                colors={['rgba(243, 240, 255, 0.9)', 'rgba(248, 246, 255, 0.7)', 'rgba(243, 240, 255, 0.9)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.objectivesSection}
                            >
                                <View style={styles.sectionHeader}>
                                    <Ionicons name="flag" size={24} color="#7C5CFF" />
                                    <Text style={styles.sectionTitle}>Objectives</Text>
                                    <Text style={styles.objectiveCount}>{note.objectives.length} total</Text>
                                </View>
                                <View style={styles.carouselContainer}>
                                    {/* Left fade gradient */}
                                    <LinearGradient
                                        colors={['rgba(243, 240, 255, 1)', 'rgba(243, 240, 255, 0.6)', 'rgba(243, 240, 255, 0)']}
                                        locations={[0, 0.5, 1]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.fadeGradientLeft}
                                        pointerEvents="none"
                                    />
                                    <Animated.ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.objectivesRow}
                                        snapToInterval={OBJECTIVE_SNAP_INTERVAL}
                                        decelerationRate="fast"
                                        onScroll={Animated.event(
                                            [{ nativeEvent: { contentOffset: { x: objectivesScrollX } } }],
                                            { useNativeDriver: true }
                                        )}
                                        scrollEventThrottle={16}
                                    >
                                        {note.objectives.map((obj: ObjectiveItem, index: number) => {
                                            const inputRange = [
                                                (index - 1) * OBJECTIVE_SNAP_INTERVAL,
                                                index * OBJECTIVE_SNAP_INTERVAL,
                                                (index + 1) * OBJECTIVE_SNAP_INTERVAL,
                                            ];
                                            const scale = objectivesScrollX.interpolate({
                                                inputRange,
                                                outputRange: [0.92, 1.0, 0.92],
                                                extrapolate: 'clamp',
                                            });
                                            const translateY = objectivesScrollX.interpolate({
                                                inputRange,
                                                outputRange: [8, -6, 8],
                                                extrapolate: 'clamp',
                                            });
                                            const cardOpacity = objectivesScrollX.interpolate({
                                                inputRange,
                                                outputRange: [0.6, 1, 0.6],
                                                extrapolate: 'clamp',
                                            });

                                            const horizontalInset = (width - OBJECTIVE_CARD_WIDTH) / 3.5 - OBJECTIVE_CARD_MARGIN / 2;

                                            return (
                                                <Animated.View
                                                    key={index}
                                                    style={[
                                                        styles.objectiveCardWrapper,
                                                        index === 0 && { marginLeft: horizontalInset },
                                                        index === note.objectives.length - 1 && { marginRight: horizontalInset },
                                                        {
                                                            transform: [{ scale }, { translateY }],
                                                            opacity: cardOpacity,
                                                        },
                                                    ]}
                                                >
                                                    <TouchableOpacity
                                                        activeOpacity={0.9}
                                                        style={styles.objectiveCard}
                                                        onPress={() => navigation.navigate('ObjectiveDetails', { noteId: note.id, objectiveIndex: index + 1 })}
                                                    >
                                                        <View style={styles.objectiveHeader}>
                                                            <View style={styles.objectiveNumber}>
                                                                <Text style={styles.objectiveNumberText}>{index + 1}</Text>
                                                            </View>
                                                            <View style={styles.objectiveArrow}>
                                                                <Ionicons name="arrow-forward" size={16} color="#FFF" />
                                                            </View>
                                                        </View>
                                                        <Text numberOfLines={2} style={styles.objectiveTitle}>{obj.objective}</Text>
                                                        {obj.summary ? (
                                                            <Text numberOfLines={3} style={styles.objectiveSummary}>{obj.summary}</Text>
                                                        ) : null}
                                                        <View style={styles.objectiveFooter}>
                                                            <View style={styles.objectiveAction}>
                                                                <Ionicons name="play-circle" size={16} color="#7C5CFF" />
                                                                <Text style={styles.objectiveActionText}>Start Learning</Text>
                                                            </View>
                                                        </View>
                                                    </TouchableOpacity>
                                                </Animated.View>
                                            );
                                        })}
                                    </Animated.ScrollView>
                                    {/* Right fade gradient */}
                                    <LinearGradient
                                        colors={['rgba(243, 240, 255, 0)', 'rgba(243, 240, 255, 0.6)', 'rgba(243, 240, 255, 1)']}
                                        locations={[0, 0.5, 1]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.fadeGradientRight}
                                        pointerEvents="none"
                                    />
                                </View>
                            </LinearGradient>
                        )}
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
                                {/* Generate Practice Quiz (Notes-based) */}
                                <TouchableOpacity
                                    style={{
                                        marginTop: 16,
                                        backgroundColor: '#3B82F6',
                                        paddingVertical: 14,
                                        borderRadius: 12,
                                        alignItems: 'center',
                                        flexDirection: 'row',
                                        justifyContent: 'center',
                                        gap: 8,
                                    }}
                                    onPress={() =>
                                        Alert.alert(
                                            'Practice Quiz',
                                            'Please open an objective to generate a focused quiz.',
                                        )
                                    }
                                >
                                    <Ionicons name="help-circle" size={20} color="#FFFFFF" />
                                    <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Generate Practice Quiz</Text>
                                </TouchableOpacity>
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
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
        flex: 1,
        textAlign: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    headerIconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
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
    objectivesSection: {
        borderRadius: 20,
        padding: 20,
        paddingBottom: 0,
        marginBottom: 16,
        shadowColor: '#7C5CFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 5,
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
    carouselContainer: {
        position: 'relative',
        overflow: 'hidden',
        marginHorizontal: -20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    fadeGradientLeft: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 30,
        zIndex: 10,
    },
    fadeGradientRight: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 30,
        zIndex: 10,
    },
    objectivesRow: {
        paddingVertical: 24,
        alignItems: 'center',
    },
    objectiveCardWrapper: {
        width: OBJECTIVE_CARD_WIDTH,
        marginRight: OBJECTIVE_CARD_MARGIN,
        justifyContent: 'center',
    },
    objectiveCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        minHeight: 180,
        shadowColor: '#7C5CFF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(124, 92, 255, 0.1)',
    },
    objectiveHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    objectiveNumber: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#7C5CFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#7C5CFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    objectiveNumberText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
    objectiveArrow: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(124, 92, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    objectiveTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginBottom: 8, lineHeight: 24 },
    objectiveSummary: { fontSize: 14, color: '#666', lineHeight: 21, marginBottom: 12 },
    objectiveFooter: {
        marginTop: 'auto',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(124, 92, 255, 0.1)',
    },
    objectiveAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    objectiveActionText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#7C5CFF',
    },
    objectiveCount: {
        fontSize: 13,
        color: '#999',
        marginLeft: 'auto',
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
