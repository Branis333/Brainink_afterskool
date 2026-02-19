import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioRecorder,
    useAudioRecorderState,
} from 'expo-audio';

import { useAuth } from '../../context/AuthContext';
import { KanaLearningSession, kanaServices } from '../../services/kanaServices';

type Props = {
    navigation: any;
};

export const KanaScreen: React.FC<Props> = () => {
    const insets = useSafeAreaInsets();
    const { token } = useAuth();

    const [questionInput, setQuestionInput] = useState('');
    const [session, setSession] = useState<KanaLearningSession | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [isContinuing, setIsContinuing] = useState(false);
    const [isClarifying, setIsClarifying] = useState(false);
    const [isAudioSubmitting, setIsAudioSubmitting] = useState(false);
    const [recordingMode, setRecordingMode] = useState<'main' | 'clarify' | null>(null);
    const [questionImage, setQuestionImage] = useState<{ base64: string; mime: string; name?: string } | null>(null);
    const [latestClarifyReply, setLatestClarifyReply] = useState<string | null>(null);

    const slideAnim = useRef(new Animated.Value(0)).current;
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(audioRecorder);
    const isRecording = !!recorderState?.isRecording;

    const currentStep = session?.current_step;
    const stepLabel = useMemo(() => {
        if (!session || !currentStep) return '';
        return `Step ${currentStep.step_number}/${session.total_steps}`;
    }, [session, currentStep]);

    useEffect(() => {
        if (!session?.current_step) return;
        slideAnim.setValue(24);
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
        }).start();
    }, [session?.current_step_index, session?.current_step?.step_number, slideAnim]);

    const startLearning = useCallback(async () => {
        const question = questionInput.trim();
        if (!question) return;

        setIsStarting(true);
        try {
            const next = await kanaServices.startSession(
                {
                    question,
                    route: 'Kana',
                    screen_context: 'step-learning',
                    metadata: { surface: 'mobile-app' },
                    image_base64: questionImage?.base64,
                    image_mime: questionImage?.mime,
                },
                token ?? undefined
            );
            setSession(next);
            setQuestionImage(null);
            setLatestClarifyReply(null);
            Keyboard.dismiss();
        } catch (error: any) {
            Alert.alert('Kana', error?.message || 'Unable to start this lesson right now.');
        } finally {
            setIsStarting(false);
        }
    }, [questionImage?.base64, questionImage?.mime, questionInput, token]);

    const continueStep = useCallback(async () => {
        if (!session?.session_id || isContinuing) return;
        setIsContinuing(true);
        try {
            const next = await kanaServices.continueStep(session.session_id, token ?? undefined);
            setSession(next);
        } catch (error: any) {
            Alert.alert('Kana', error?.message || 'Could not continue to the next step.');
        } finally {
            setIsContinuing(false);
        }
    }, [isContinuing, session?.session_id, token]);

    const runAutoClarify = useCallback(async () => {
        if (!session?.session_id || isClarifying) return;

        setIsClarifying(true);
        try {
            const result = await kanaServices.clarifyStep(
                session.session_id,
                {
                    message: 'Please clarify this current step in simpler terms with one concrete example.',
                },
                token ?? undefined
            );
            setSession(result.session);
            setLatestClarifyReply(result.clarify_reply || null);
            Keyboard.dismiss();
        } catch (error: any) {
            Alert.alert('Kana', error?.message || 'Clarify failed. Please try again.');
        } finally {
            setIsClarifying(false);
        }
    }, [isClarifying, session?.session_id, token]);

    const pickImage = useCallback(async () => {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                Alert.alert('Kana', 'Media library permission is required to attach images.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.7,
                base64: true,
            });

            if (result.canceled || !result.assets?.length) return;
            const asset = result.assets[0];
            if (!asset.base64) {
                Alert.alert('Kana', 'Unable to read selected image. Please try another one.');
                return;
            }

            const image = {
                base64: asset.base64,
                mime: asset.mimeType || 'image/jpeg',
                name: asset.fileName || 'kana-image.jpg',
            };
            setQuestionImage(image);
        } catch (error: any) {
            Alert.alert('Kana', error?.message || 'Could not attach image.');
        }
    }, []);

    const startRecording = useCallback(async (mode: 'main' | 'clarify') => {
        try {
            const permission = await requestRecordingPermissionsAsync();
            const granted = (permission as any)?.granted ?? (permission as any)?.status === 'granted';
            if (!granted) {
                Alert.alert('Kana', 'Microphone permission is required.');
                return;
            }

            await setAudioModeAsync({
                playsInSilentMode: true,
                allowsRecording: true,
            } as any);

            await audioRecorder.prepareToRecordAsync();
            audioRecorder.record();
            setRecordingMode(mode);
        } catch (error: any) {
            Alert.alert('Kana', error?.message || 'Could not start recording.');
        }
    }, [audioRecorder]);

    const stopRecordingAndSubmit = useCallback(async () => {
        try {
            await audioRecorder.stop();
            const uri = (audioRecorder as any)?.uri as string | undefined;
            await setAudioModeAsync({
                playsInSilentMode: true,
                allowsRecording: false,
            } as any);

            if (!uri) {
                Alert.alert('Kana', 'No audio captured.');
                return;
            }

            setIsAudioSubmitting(true);
            if (recordingMode !== 'clarify') {
                const next = await kanaServices.startSessionFromAudio(
                    {
                        audioUri: uri,
                        route: 'Kana',
                        screen_context: 'step-learning',
                        metadata: { surface: 'mobile-app', input_type: 'audio' },
                    },
                    token ?? undefined
                );
                setSession(next);
                setLatestClarifyReply(null);
            }
            Keyboard.dismiss();
        } catch (error: any) {
            Alert.alert('Kana', error?.message || 'Audio processing failed. Please try again.');
        } finally {
            setIsAudioSubmitting(false);
            setRecordingMode(null);
        }
    }, [audioRecorder, recordingMode, session?.session_id, token]);

    const handleMainMicPress = useCallback(() => {
        if (isAudioSubmitting) return;
        if (isRecording) {
            stopRecordingAndSubmit();
            return;
        }
        startRecording('main');
    }, [isAudioSubmitting, isRecording, startRecording, stopRecordingAndSubmit]);

    return (
        <View style={styles.root}>
            <View style={styles.bgBlobOne} />
            <View style={styles.bgBlobTwo} />
            <View style={styles.bgBlobThree} />

            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    style={styles.flex}
                    contentContainerStyle={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 88 }]}
                    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                    keyboardShouldPersistTaps="handled"
                    onScrollBeginDrag={() => Keyboard.dismiss()}
                    showsVerticalScrollIndicator={false}
                >
                    <BlurView intensity={45} tint="light" style={styles.headerCard}>
                        <Text style={styles.title}>Kana</Text>
                        <Text style={styles.subtitle}>Step-by-step learning with guided explanations</Text>
                    </BlurView>

                    <BlurView intensity={55} tint="light" style={styles.questionCard}>
                        <Text style={styles.promptLabel}>Ask Kana a question</Text>
                        <TextInput
                            value={questionInput}
                            onChangeText={setQuestionInput}
                            style={styles.questionInput}
                            multiline
                            placeholder="How do I solve this trigonometric equation?"
                            placeholderTextColor="#6b7280"
                            maxLength={1200}
                        />
                        {questionImage ? (
                            <View style={styles.attachmentPill}>
                                <Text style={styles.attachmentText}>Image attached</Text>
                                <Pressable onPress={() => setQuestionImage(null)} hitSlop={6}>
                                    <Ionicons name="close-circle" size={18} color="#374151" />
                                </Pressable>
                            </View>
                        ) : null}
                        <View style={styles.askActionsRow}>
                            <View style={styles.leftActionGroup}>
                                <Pressable onPress={pickImage} style={styles.iconButton}>
                                    <Ionicons name="image" size={18} color="#111827" />
                                </Pressable>
                                <Pressable onPress={handleMainMicPress} style={styles.iconButton}>
                                    {isAudioSubmitting && recordingMode === 'main' ? (
                                        <ActivityIndicator color="#111827" />
                                    ) : (
                                        <Ionicons name={isRecording && recordingMode === 'main' ? 'stop' : 'mic'} size={18} color="#111827" />
                                    )}
                                </Pressable>
                            </View>
                            <Pressable
                                onPress={startLearning}
                                disabled={isStarting || !questionInput.trim() || isAudioSubmitting}
                                style={[
                                    styles.sendButton,
                                    (!questionInput.trim() || isStarting || isAudioSubmitting) && styles.disabledButton,
                                ]}
                            >
                                {isStarting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.sendText}>Send</Text>}
                            </Pressable>
                        </View>
                    </BlurView>

                    {isRecording && recordingMode === 'main' ? (
                        <Text style={styles.recordingHint}>Recording... tap mic again to stop and send</Text>
                    ) : null}

                    {session && currentStep ? (
                        <Animated.View style={[styles.stepWrap, { transform: [{ translateY: slideAnim }] }]}>
                            <BlurView intensity={60} tint="light" style={styles.stepCard}>
                                <Text style={styles.stepMeta}>{stepLabel}</Text>
                                <Text style={styles.stepTitle}>{currentStep.title}</Text>
                                <Text style={styles.stepExplanation}>{currentStep.explanation}</Text>
                                <Text style={styles.stepCheck}>{currentStep.check_question}</Text>

                                <View style={styles.stepActionsRow}>
                                    <Pressable
                                        onPress={continueStep}
                                        disabled={isContinuing}
                                        style={[styles.continueBtn, isContinuing && styles.disabledButton]}
                                    >
                                        {isContinuing ? (
                                            <ActivityIndicator color="#ffffff" />
                                        ) : (
                                            <Text style={styles.continueText}>
                                                {session.completed ? 'Completed' : 'Continue'}
                                            </Text>
                                        )}
                                    </Pressable>
                                    <Pressable
                                        onPress={runAutoClarify}
                                        style={styles.clarifyBtn}
                                        disabled={session.completed || isClarifying}
                                    >
                                        {isClarifying ? (
                                            <ActivityIndicator color="#111827" />
                                        ) : (
                                            <Text style={styles.clarifyText}>Clarify</Text>
                                        )}
                                    </Pressable>
                                </View>

                                {latestClarifyReply ? (
                                    <View style={styles.autoClarifyCard}>
                                        <Text style={styles.autoClarifyTitle}>Kana Clarification</Text>
                                        <Text style={styles.autoClarifyText}>{latestClarifyReply}</Text>
                                    </View>
                                ) : null}
                            </BlurView>
                        </Animated.View>
                    ) : (
                        <BlurView intensity={42} tint="light" style={styles.placeholderCard}>
                            <Text style={styles.placeholderText}>Ask a question to start Step 1.</Text>
                        </BlurView>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#e5e7eb',
    },
    flex: {
        flex: 1,
    },
    container: {
        flexGrow: 1,
        paddingHorizontal: 16,
        gap: 12,
    },
    bgBlobOne: {
        position: 'absolute',
        top: 80,
        left: 12,
        width: 190,
        height: 190,
        borderRadius: 95,
        backgroundColor: 'rgba(167, 139, 250, 0.35)',
    },
    bgBlobTwo: {
        position: 'absolute',
        top: 220,
        right: 24,
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: 'rgba(45, 212, 191, 0.28)',
    },
    bgBlobThree: {
        position: 'absolute',
        bottom: 130,
        left: 70,
        width: 170,
        height: 170,
        borderRadius: 85,
        backgroundColor: 'rgba(251, 191, 36, 0.18)',
    },
    headerCard: {
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.65)',
        backgroundColor: 'rgba(255,255,255,0.28)',
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#111827',
    },
    subtitle: {
        marginTop: 4,
        fontSize: 13,
        color: '#374151',
    },
    questionCard: {
        borderRadius: 18,
        padding: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.65)',
        backgroundColor: 'rgba(255,255,255,0.26)',
    },
    promptLabel: {
        fontSize: 13,
        color: '#374151',
        marginBottom: 8,
        fontWeight: '700',
    },
    questionInput: {
        minHeight: 56,
        maxHeight: 120,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.68)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.75)',
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: '#111827',
    },
    askActionsRow: {
        marginTop: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    leftActionGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.75)',
    },
    sendButton: {
        minWidth: 102,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#7c5cf6',
    },
    sendText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 14,
    },
    attachmentPill: {
        marginTop: 8,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.8)',
    },
    attachmentText: {
        color: '#1f2937',
        fontWeight: '600',
        fontSize: 12,
    },
    recordingHint: {
        marginTop: 6,
        color: '#374151',
        fontSize: 12,
        textAlign: 'center',
    },
    autoClarifyCard: {
        marginTop: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.8)',
        backgroundColor: 'rgba(255,255,255,0.7)',
        padding: 12,
    },
    autoClarifyTitle: {
        color: '#111827',
        fontWeight: '700',
        marginBottom: 6,
        fontSize: 13,
    },
    autoClarifyText: {
        color: '#1f2937',
        lineHeight: 20,
        fontSize: 14,
    },
    stepWrap: {
        flex: 1,
    },
    stepCard: {
        flex: 1,
        borderRadius: 22,
        padding: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.7)',
        backgroundColor: 'rgba(255,255,255,0.32)',
    },
    stepMeta: {
        color: '#4b5563',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 8,
    },
    stepTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#111827',
    },
    stepExplanation: {
        marginTop: 10,
        fontSize: 16,
        lineHeight: 24,
        color: '#1f2937',
    },
    stepCheck: {
        marginTop: 10,
        color: '#4b5563',
        fontSize: 14,
    },
    stepActionsRow: {
        marginTop: 'auto',
        flexDirection: 'row',
        gap: 10,
        paddingTop: 14,
    },
    continueBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: '#7c5cf6',
        paddingVertical: 12,
    },
    continueText: {
        color: '#ffffff',
        fontWeight: '700',
    },
    clarifyBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.78)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.85)',
        paddingVertical: 12,
    },
    clarifyText: {
        color: '#111827',
        fontWeight: '700',
    },
    placeholderCard: {
        borderRadius: 18,
        padding: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.65)',
        backgroundColor: 'rgba(255,255,255,0.24)',
    },
    placeholderText: {
        color: '#374151',
        textAlign: 'center',
    },
    disabledButton: {
        opacity: 0.55,
    },
});

export default KanaScreen;

