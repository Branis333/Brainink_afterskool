import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet, StatusBar, Alert } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/AppNavigatorNew';
import { notesService, ObjectiveQuizResponse, QuizQuestion, QuizSubmitRequest, QuizSubmitResponse } from '../../services/notesService';

type Params = { ObjectiveQuiz: { noteId: number; objectiveIndex: number; title?: string; quizPayload?: ObjectiveQuizResponse } };
type NavigationProp = NativeStackNavigationProp<RootStackParamList & Params, 'ObjectiveQuiz'>;
type RouteProps = RouteProp<RootStackParamList & Params, 'ObjectiveQuiz'>;

export default function ObjectiveQuizScreen() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<RouteProps>();
    const { token } = useAuth();

    const { noteId, objectiveIndex, title, quizPayload } = route.params;
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [quiz, setQuiz] = useState<ObjectiveQuizResponse | null>(quizPayload || null);
    const [answers, setAnswers] = useState<number[]>(quizPayload ? new Array(quizPayload.num_questions).fill(-1) : []);
    const [submitted, setSubmitted] = useState<QuizSubmitResponse | null>(null);
    const [currentIndex, setCurrentIndex] = useState<number>(0);

    const headerTitle = useMemo(() => title || (quiz?.objective ? `Quiz: ${quiz.objective}` : 'Objective Quiz'), [title, quiz]);

    useEffect(() => {
        if (quizPayload) {
            setQuiz(quizPayload);
            setAnswers(new Array(quizPayload.num_questions).fill(-1));
            setCurrentIndex(0);
        }
    }, [quizPayload]);

    const generateQuiz = async (forceRegenerate: boolean = false) => {
        if (!token) {
            setError('No auth token');
            return;
        }
        try {
            setError(null);
            setLoading(true);
            const res = await notesService.generateObjectiveQuiz(noteId, objectiveIndex, token, 5, forceRegenerate);
            setQuiz(res);
            setAnswers(new Array(res.num_questions).fill(-1));
            setCurrentIndex(0);
            setSubmitted(null);
        } catch (e: any) {
            const message = e?.message || (typeof e === 'string' ? e : 'Failed to generate objective quiz');
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const selectAnswer = (idx: number, optionIndex: number) => {
        setAnswers((prev) => {
            const copy = prev.slice();
            copy[idx] = optionIndex;
            return copy;
        });
    };

    const onSubmit = async () => {
        try {
            if (!token || !quiz) return;
            const payload: QuizSubmitRequest = {
                objective_index: objectiveIndex,
                questions: quiz.questions as QuizQuestion[],
                user_answers: answers.map((a) => (typeof a === 'number' && a >= 0 ? a : -1)),
            };
            const res = await notesService.submitObjectiveQuiz(noteId, payload, token);
            setSubmitted(res);
            Alert.alert('Quiz Submitted', `Score: ${res.correct_count}/${res.total_questions} (${Math.round(res.grade_percentage)}%)`);
        } catch (e: any) {
            const message = e?.message || (typeof e === 'string' ? e : 'Unable to submit quiz');
            Alert.alert('Submit Failed', message);
        }
    };

    const goNext = () => {
        if (!quiz) return;
        setCurrentIndex((i) => Math.min(i + 1, (quiz?.questions?.length || 1) - 1));
    };

    const goPrev = () => {
        setCurrentIndex((i) => Math.max(i - 1, 0));
    };

    const onClose = () => navigation.goBack();

    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#3B82F6" />
                <View style={styles.center}>
                    {error ? (
                        <>
                            <Ionicons name="alert-circle" size={48} color="#EF4444" />
                            <Text style={styles.errorText}>{error}</Text>
                            <TouchableOpacity style={styles.primaryButton} onPress={() => generateQuiz(true)}>
                                <Text style={styles.primaryButtonText}>Generate MCQ Quiz</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <ActivityIndicator size="large" color="#3B82F6" />
                            <Text style={styles.loadingText}>Preparing quiz…</Text>
                        </>
                    )}
                </View>
            </View>
        );
    }

    if (!quiz) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#3B82F6" />
                <View style={styles.center}>
                    <Ionicons name="school" size={48} color="#3B82F6" />
                    <Text style={styles.loadingText}>No MCQ quiz yet. Generate one to get started.</Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={() => generateQuiz(false)}>
                        <Text style={styles.primaryButtonText}>Generate MCQ Quiz</Text>
                    </TouchableOpacity>
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#3B82F6" />
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                    <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
                <View style={styles.iconButton} />
            </View>

            <View style={styles.content}>
                {/* Progress dots */}
                <View style={styles.dotsRow}>
                    {(quiz.questions || []).map((_, i) => (
                        <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
                    ))}
                </View>

                {/* Single question */}
                {quiz.questions[currentIndex] && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>{`Question ${currentIndex + 1}`}</Text>
                        <Text style={styles.cardQuestion}>{quiz.questions[currentIndex].question}</Text>
                        <View style={{ marginTop: 10 }}>
                            {quiz.questions[currentIndex].options.map((opt, i) => {
                                const isSelected = answers[currentIndex] === i;
                                return (
                                    <TouchableOpacity key={i} style={[styles.option, isSelected && styles.optionSelected]} onPress={() => selectAnswer(currentIndex, i)}>
                                        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{opt}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Navigation buttons */}
                <View style={styles.navRow}>
                    <TouchableOpacity disabled={currentIndex === 0} onPress={goPrev} style={[styles.secondaryButton, styles.navButton, currentIndex === 0 && styles.btnDisabled]}>
                        <Text style={[styles.secondaryButtonText, currentIndex === 0 && styles.btnDisabledText]}>Previous</Text>
                    </TouchableOpacity>
                    {currentIndex < (quiz.questions.length - 1) ? (
                        <TouchableOpacity onPress={goNext} style={[styles.primaryButton, styles.navButton]}>
                            <Text style={styles.primaryButtonText}>Next</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={onSubmit} style={[styles.primaryButton, styles.navButton]}>
                            <Text style={styles.primaryButtonText}>Submit</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {submitted && (
                    <View style={styles.summary}>
                        <Text style={styles.summaryText}>{`Score: ${submitted.correct_count}/${submitted.total_questions} (${Math.round(submitted.grade_percentage)}%)`}</Text>
                        {submitted.performance_summary ? <Text style={styles.summaryNote}>{submitted.performance_summary}</Text> : null}
                    </View>
                )}

                <TouchableOpacity style={[styles.primaryButton, styles.fullWidthButton, { marginTop: 12 }]} onPress={() => generateQuiz(true)}>
                    <Text style={styles.primaryButtonText}>Generate New MCQ Quiz</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

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
    content: { padding: 16, flex: 1 },
    dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16, gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },
    dotActive: { backgroundColor: '#3B82F6', width: 10, height: 10, borderRadius: 5 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    loadingText: { marginTop: 12, color: '#6B7280' },
    errorText: { marginTop: 12, color: '#EF4444', fontWeight: '600', textAlign: 'center' },
    card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
    cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 6 },
    cardQuestion: { fontSize: 16, color: '#111827' },
    option: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
    optionSelected: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
    optionText: { color: '#111827' },
    optionTextSelected: { color: '#4F46E5', fontWeight: '600' },
    summary: { padding: 12, backgroundColor: '#F3F4F6', borderRadius: 10, marginVertical: 8 },
    summaryText: { fontWeight: '700', color: '#111827' },
    summaryNote: { marginTop: 6, color: '#4B5563' },
    navRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, gap: 10 },
    primaryButton: { backgroundColor: '#3B82F6', borderRadius: 10, paddingVertical: 14, alignItems: 'center', paddingHorizontal: 12 },
    primaryButtonText: { color: '#FFFFFF', fontWeight: '600' },
    secondaryButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingVertical: 14, alignItems: 'center', paddingHorizontal: 12 },
    navButton: { flex: 1 },
    fullWidthButton: { alignSelf: 'stretch' },
    secondaryButtonText: { color: '#111827', fontWeight: '600' },
    btnDisabled: { opacity: 0.5 },
    btnDisabledText: { color: '#9CA3AF' },
});
