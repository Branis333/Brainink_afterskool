import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet, SafeAreaView, StatusBar, Alert } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { quizService, PracticeQuiz, PracticeQuizQuestion } from '../services/quizServices';
import { RootStackParamList } from '../navigation/AppNavigatorNew';
import { useAuth } from '../context/AuthContext';


// Define a local param extension if not present in root navigator
type QuizScreenParams = {
    mode: 'assignment' | 'block' | 'note';
    id: number;
    title?: string;
};

// If RootStackParamList already has Quiz, it will merge; otherwise we cast
type NavigationProp = NativeStackNavigationProp<RootStackParamList & { Quiz: QuizScreenParams }, 'Quiz'>;
type QuizRouteProp = RouteProp<RootStackParamList & { Quiz: QuizScreenParams }, 'Quiz'>;

export const QuizScreen: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<QuizRouteProp>();
    const { token } = useAuth();

    const { mode, id, title } = route.params as QuizScreenParams;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [quiz, setQuiz] = useState<PracticeQuiz | null>(null);
    const [answers, setAnswers] = useState<Record<number, number | null>>({}); // questionId -> selected index
    const [reveal, setReveal] = useState<boolean>(false);

    const headerTitle = useMemo(() => {
        if (title) return title;
        switch (mode) {
            case 'assignment':
                return 'Assignment Practice Quiz';
            case 'block':
                return 'Module Practice Quiz';
            case 'note':
                return 'Notes Practice Quiz';
            default:
                return 'Practice Quiz';
        }
    }, [mode, title]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                if (!token) throw new Error('No authentication token');
                quizService.setAuthToken(token);
                let result: PracticeQuiz;
                if (mode === 'assignment') {
                    result = await quizService.generateAssignmentPracticeQuiz(id, { timeoutMs: 60000 });
                } else if (mode === 'block') {
                    result = await quizService.generateBlockPracticeQuiz(id, { timeoutMs: 60000 });
                } else {
                    result = await quizService.generateNotesPracticeQuiz(id, { timeoutMs: 60000 });
                }
                if (mounted) {
                    setQuiz(result);
                    // init answers map
                    const map: Record<number, number | null> = {};
                    (result.questions || []).forEach((q) => (map[q.id] = null));
                    setAnswers(map);
                }
            } catch (e: any) {
                console.error('Failed to load practice quiz:', e);
                if (mounted) setError(e?.message || 'Failed to load quiz');
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [mode, id, token]);

    const selectAnswer = (questionId: number, optionIndex: number) => {
        setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
    };

    const computeScore = () => {
        if (!quiz) return { correct: 0, total: 0 };
        let correct = 0;
        for (const q of quiz.questions) {
            if (answers[q.id] === q.correct_index) correct += 1;
        }
        return { correct, total: quiz.questions.length };
    };

    const onClose = () => navigation.goBack();
    const onDone = () => {
        // Optional confirm summary
        const { correct, total } = computeScore();
        Alert.alert('Practice Complete', `You answered ${correct} of ${total} correctly.`, [
            { text: 'OK', onPress: () => navigation.goBack() },
        ]);
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#3B82F6" />
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>Generating your practice quiz...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error || !quiz) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#3B82F6" />
                <View style={styles.center}>
                    <Ionicons name="alert-circle" size={48} color="#EF4444" />
                    <Text style={styles.errorText}>{error || 'Unable to load quiz'}</Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={onClose}>
                        <Text style={styles.primaryButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const { correct, total } = computeScore();

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#3B82F6" />
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                    <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {quiz.title || headerTitle}
                </Text>
                <TouchableOpacity onPress={onDone} style={styles.iconButton}>
                    <Ionicons name="checkmark" size={24} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Score summary and reveal button */}
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryText}>
                        Score: {correct}/{total}
                    </Text>
                    <TouchableOpacity
                        onPress={() => setReveal((r) => !r)}
                        style={[styles.secondaryButton, reveal && styles.secondaryButtonActive]}
                    >
                        <Ionicons name={reveal ? 'eye-off' : 'eye'} size={16} color={reveal ? '#1F2937' : '#3B82F6'} />
                        <Text style={[styles.secondaryButtonText, reveal && styles.secondaryButtonTextActive]}>
                            {reveal ? 'Hide Answers' : 'Reveal Answers'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {quiz.questions.map((q, idx) => (
                    <QuestionCard
                        key={q.id}
                        index={idx}
                        question={q}
                        selected={answers[q.id]}
                        reveal={reveal}
                        onSelect={(i) => selectAnswer(q.id, i)}
                    />
                ))}

                <View style={{ height: 24 }} />
                <TouchableOpacity style={styles.primaryButton} onPress={onDone}>
                    <Text style={styles.primaryButtonText}>Done</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const QuestionCard: React.FC<{
    index: number;
    question: PracticeQuizQuestion;
    selected: number | null | undefined;
    reveal: boolean;
    onSelect: (optionIndex: number) => void;
}> = ({ index, question, selected, reveal, onSelect }) => {
    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>{index + 1}</Text>
                </View>
                <Text style={styles.cardTitle}>Question {index + 1}</Text>
            </View>
            <Text style={styles.cardQuestion}>{question.question || '—'}</Text>

            <View style={{ marginTop: 12, gap: 8 }}>
                {question.options.map((opt, i) => {
                    const isSelected = selected === i;
                    const isCorrect = question.correct_index === i;
                    const showVerdict = reveal || (selected != null && isSelected);
                    const bg = isSelected ? '#EEF2FF' : '#FFFFFF';
                    const border = isSelected ? '#6366F1' : '#E5E7EB';
                    const verdictColor = isCorrect ? '#10B981' : '#EF4444';
                    return (
                        <TouchableOpacity
                            key={i}
                            style={[styles.option, { backgroundColor: bg, borderColor: border }]}
                            onPress={() => onSelect(i)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.optionRow}>
                                <View style={[styles.optionRadio, isSelected && styles.optionRadioSelected]} />
                                <Text style={styles.optionText}>{opt || '—'}</Text>
                                {showVerdict && (
                                    <Ionicons
                                        name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                                        size={18}
                                        color={verdictColor}
                                    />
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {(reveal || (selected != null && selected === question.correct_index)) && (
                <View style={styles.explanation}>
                    <Ionicons name="information-circle" size={16} color="#2563EB" />
                    <Text style={styles.explanationText}>{question.explanation || '—'}</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        height: 56,
        backgroundColor: '#3B82F6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
    },
    iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', flex: 1, textAlign: 'center' },
    content: { padding: 16 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    loadingText: { marginTop: 12, color: '#6B7280' },
    errorText: { marginTop: 12, color: '#EF4444', fontWeight: '600', textAlign: 'center' },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    summaryText: { fontSize: 14, color: '#374151', fontWeight: '600' },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
    cardBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(99,102,241,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardBadgeText: { color: '#4F46E5', fontWeight: '700' },
    cardTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
    cardQuestion: { fontSize: 16, color: '#111827' },
    option: {
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    optionRadio: {
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#9CA3AF',
    },
    optionRadioSelected: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
    optionText: { flex: 1, color: '#111827' },
    explanation: {
        marginTop: 12,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        padding: 10,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    explanationText: { flex: 1, color: '#1F2937' },
    primaryButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
    },
    primaryButtonText: { color: '#FFFFFF', fontWeight: '600' },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: '#3B82F6',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    secondaryButtonActive: {
        backgroundColor: '#E5E7EB',
        borderColor: '#9CA3AF',
    },
    secondaryButtonText: { color: '#3B82F6', fontWeight: '600' },
    secondaryButtonTextActive: { color: '#1F2937' },
});

export default QuizScreen;

