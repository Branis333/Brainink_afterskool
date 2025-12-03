import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, Alert, Animated } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigatorNew';
import { useAuth } from '../context/AuthContext';
import { notesService, FlashcardsResponse } from '../services/notesService';

export type FlashcardsParams = {
    mode: 'objective';
    noteId: number;
    objectiveIndex: number; // 1- or 0-based accepted by backend
    title?: string;
    flashcardsPayload?: {
        count: number;
        flashcards: { front: string; back: string }[];
    };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList & { Flashcards: FlashcardsParams }, 'Flashcards'>;
type FlashcardsRouteProp = RouteProp<RootStackParamList & { Flashcards: FlashcardsParams }, 'Flashcards'>;

export const FlashcardsScreen: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<FlashcardsRouteProp>();
    const { token } = useAuth();

    const { title, flashcardsPayload, noteId, objectiveIndex } = route.params as FlashcardsParams;
    const [loading, setLoading] = useState<boolean>(false);
    const [cards, setCards] = useState<{ front: string; back: string }[]>(flashcardsPayload?.flashcards || []);
    const [index, setIndex] = useState<number>(0);
    const [showBack, setShowBack] = useState(false);
    const scale = useRef(new Animated.Value(1)).current;

    const colors = useMemo(
        () => [
            '#0F172A', '#065F46', '#0EA5E9', '#14B8A6', '#7C3AED', '#DB2777', '#EA580C', '#0891B2', '#4F46E5', '#059669', '#DC2626', '#7C2D12'
        ].sort(() => Math.random() - 0.5),
        []
    );

    useEffect(() => {
        (async () => {
            if (cards.length > 0) return;
            if (!token || !noteId) return;
            try {
                setLoading(true);
                const res: FlashcardsResponse = await notesService.generateObjectiveFlashcards(noteId, objectiveIndex, token, 8);
                setCards(res.flashcards || []);
            } catch (e: any) {
                Alert.alert('Flashcards', e?.message || 'Failed to load flashcards');
            } finally {
                setLoading(false);
            }
        })();
    }, [noteId, objectiveIndex, token]);

    useEffect(() => { setIndex(0); setShowBack(false); }, [cards]);

    const flipCard = () => {
        // Quick scale down, toggle, scale up
        Animated.sequence([
            Animated.timing(scale, { toValue: 0.9, duration: 100, useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
        setShowBack(!showBack);
    };

    const goNext = () => {
        if (index < cards.length - 1) {
            setIndex(index + 1);
            setShowBack(false);
        }
    };

    const goPrev = () => {
        if (index > 0) {
            setIndex(index - 1);
            setShowBack(false);
        }
    };

    const currentCard = cards[index];
    const cardColor = colors[index % colors.length];

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.header}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="close" size={24} color="#111" />
                </TouchableOpacity>
                <Text numberOfLines={1} style={styles.headerTitle}>{title || 'Flashcards'}</Text>
                <View style={styles.iconBtn} />
            </View>

            <View style={styles.content}>
                {loading ? (
                    <View style={{ alignItems: 'center', marginTop: 24 }}>
                        <ActivityIndicator size="large" color="#3B82F6" />
                    </View>
                ) : cards.length === 0 ? (
                    <Text style={styles.emptyText}>No flashcards to display.</Text>
                ) : (
                    <>
                        {/* Progress dots */}
                        <View style={styles.dotsRow}>
                            {cards.map((_, i) => (
                                <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
                            ))}
                        </View>

                        {/* Flip card */}
                        <View style={styles.cardWrapper}>
                            <Animated.View style={[styles.card, { backgroundColor: cardColor, transform: [{ scale }] }]}>
                                <TouchableOpacity activeOpacity={0.95} style={styles.cardTouchable} onPress={flipCard}>
                                    <Text style={styles.sideLabel}>{showBack ? 'BACK' : 'FRONT'}</Text>
                                    <Text style={styles.cardText}>{showBack ? currentCard.back : currentCard.front}</Text>
                                    <Text style={styles.tapHint}>Tap to flip</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        </View>

                        {/* Navigation */}
                        <View style={styles.navRow}>
                            <TouchableOpacity onPress={goPrev} disabled={index === 0} style={[styles.secondaryButton, index === 0 && styles.btnDisabled]}>
                                <Text style={[styles.secondaryButtonText, index === 0 && styles.btnDisabledText]}>Previous</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={goNext} disabled={index >= cards.length - 1} style={[styles.primaryButton, index >= cards.length - 1 && styles.btnDisabled]}>
                                <Text style={[styles.primaryButtonText, index >= cards.length - 1 && styles.btnDisabledText]}>Next</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomColor: '#EEE', borderBottomWidth: 1 },
    iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#111' },
    content: { padding: 16, gap: 12, flex: 1, justifyContent: 'center' },
    emptyText: { textAlign: 'center', marginTop: 24, color: '#666' },
    dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB', marginHorizontal: 3 },
    dotActive: { backgroundColor: '#3B82F6', width: 10, height: 10, borderRadius: 5 },
    cardWrapper: { height: 380, marginVertical: 8 },
    card: {
        flex: 1,
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
    },
    cardTouchable: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sideLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '700',
        fontSize: 12,
        letterSpacing: 2,
        marginBottom: 16,
    },
    cardText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '700',
        lineHeight: 30,
        textAlign: 'center',
        paddingHorizontal: 8,
    },
    tapHint: {
        color: 'rgba(255,255,255,0.5)',
        marginTop: 24,
        fontSize: 13,
        textAlign: 'center',
    },
    navRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
    primaryButton: { backgroundColor: '#3B82F6', borderRadius: 10, paddingVertical: 14, alignItems: 'center', flex: 1 },
    primaryButtonText: { color: '#FFFFFF', fontWeight: '600' },
    secondaryButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingVertical: 14, alignItems: 'center', flex: 1 },
    secondaryButtonText: { color: '#111827', fontWeight: '600' },
    btnDisabled: { opacity: 0.5 },
    btnDisabledText: { color: '#9CA3AF' },
});

export default FlashcardsScreen;
