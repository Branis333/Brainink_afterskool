import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Voice from '@react-native-voice/voice';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../context/AuthContext';
import {
    aiTutorService,
    CheckpointResponse,
    CheckpointSubmissionPayload,
    MessagePayload,
    StartSessionPayload,
    TutorCheckpointPrompt,
    TutorInteraction,
    TutorSessionSnapshot,
    TutorSessionState,
    TutorTurn,
} from '../services/aiTutorService';
import { ttsAdapter } from '../utils/ttsAdapter';

interface Props {
    visible: boolean;
    onClose: () => void;
    courseId: number;
    courseTitle?: string;
    blockId?: number;
    lessonId?: number;
    lessonTitle?: string;
    persona?: string;
}

interface UploadState {
    status: 'idle' | 'capturing' | 'captured' | 'uploading' | 'reviewing';
    photoUri?: string;
    feedback?: CheckpointResponse['ai_feedback'];
    score?: number;
}

const voiceLocale = Platform.select({ ios: 'en-US', android: 'en-US' });

const isTtsAvailable = ttsAdapter.isAvailable();
const supportsTtsEvents = ttsAdapter.supportsEvents();

const detectVoiceAvailability = () => {
    const voiceAny = Voice as any;
    if (!voiceAny) return false;
    const hasNativeModule = Boolean(
        voiceAny._nativeModule || voiceAny._voiceModule || voiceAny.VoiceModule || voiceAny.voiceModule
    );
    return Boolean(
        hasNativeModule &&
        typeof voiceAny.start === 'function' &&
        typeof voiceAny.stop === 'function'
    );
};

const AITutorOverlay: React.FC<Props> = ({
    visible,
    onClose,
    courseId,
    blockId,
    lessonId,
    courseTitle,
    lessonTitle,
    persona,
}) => {
    const { token } = useAuth();

    const [session, setSession] = useState<TutorSessionSnapshot | null>(null);
    const [tutorTurn, setTutorTurn] = useState<TutorTurn | null>(null);
    const [interactions, setInteractions] = useState<TutorInteraction[]>([]);

    const [initializing, setInitializing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingRequest, setPendingRequest] = useState(false);
    const [inputText, setInputText] = useState('');
    const [listening, setListening] = useState(false);
    const [partialTranscript, setPartialTranscript] = useState('');
    const [ttsSpeaking, setTtsSpeaking] = useState(false);
    const [voiceOperational, setVoiceOperational] = useState<boolean>(() => detectVoiceAvailability());

    const [checkpointState, setCheckpointState] = useState<UploadState>({ status: 'idle' });
    const [showCamera, setShowCamera] = useState(false);
    const [cameraType, setCameraType] = useState<'back' | 'front'>('back');
    const cameraRef = useRef<any>(null);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const fallbackTtsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const outstandingCheckpoint = useMemo(() => tutorTurn?.checkpoint ?? null, [tutorTurn]);

    const resetOverlayState = useCallback(() => {
        setSession(null);
        setTutorTurn(null);
        setInteractions([]);
        setInputText('');
        setListening(false);
        setPartialTranscript('');
        setCheckpointState({ status: 'idle' });
        setShowCamera(false);
        setTtsSpeaking(false);
        setError(null);
        setVoiceOperational(detectVoiceAvailability());
    }, []);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (isTtsAvailable) {
                ttsAdapter.stop();
            }
            if (detectVoiceAvailability()) {
                if (typeof Voice.destroy === 'function') {
                    Voice.destroy().catch(() => undefined);
                }
                if (typeof Voice.removeAllListeners === 'function') {
                    Voice.removeAllListeners();
                }
            }
            if (fallbackTtsTimeoutRef.current) {
                clearTimeout(fallbackTtsTimeoutRef.current);
                fallbackTtsTimeoutRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!isTtsAvailable) {
            console.warn('TTS engine unavailable; narration will be text-only.');
            return;
        }

        ttsAdapter.setDefaultRate(0.52, true);
        ttsAdapter.setDucking(true);

        if (!supportsTtsEvents) {
            return () => undefined;
        }

        const handleStart = () => setTtsSpeaking(true);
        const handleFinish = () => setTtsSpeaking(false);
        const handleCancel = () => setTtsSpeaking(false);

        ttsAdapter.addEventListener('tts-start', handleStart);
        ttsAdapter.addEventListener('tts-finish', handleFinish);
        ttsAdapter.addEventListener('tts-cancel', handleCancel);

        return () => {
            ttsAdapter.removeEventListener('tts-start', handleStart);
            ttsAdapter.removeEventListener('tts-finish', handleFinish);
            ttsAdapter.removeEventListener('tts-cancel', handleCancel);
        };
    }, []);

    // Speak new tutor narration whenever it changes
    useEffect(() => {
        if (!visible || !tutorTurn?.narration || !isTtsAvailable) {
            if (!supportsTtsEvents) {
                setTtsSpeaking(false);
            }
            return;
        }

        setTtsSpeaking(true);
        ttsAdapter.stop();
        ttsAdapter.speak(tutorTurn.narration, {
            rate: 0.52,
        });

        if (!supportsTtsEvents) {
            if (fallbackTtsTimeoutRef.current) {
                clearTimeout(fallbackTtsTimeoutRef.current);
            }
            const estimatedMs = Math.max(3500, tutorTurn.narration.split(' ').length * 450);
            fallbackTtsTimeoutRef.current = setTimeout(() => {
                setTtsSpeaking(false);
                fallbackTtsTimeoutRef.current = null;
            }, estimatedMs);
            return () => {
                if (fallbackTtsTimeoutRef.current) {
                    clearTimeout(fallbackTtsTimeoutRef.current);
                    fallbackTtsTimeoutRef.current = null;
                }
            };
        }
    }, [isTtsAvailable, supportsTtsEvents, tutorTurn?.narration, visible]);

    const initialiseSession = useCallback(async () => {
        if (!token) {
            setError('You must be logged in to use AI Tutor mode.');
            return;
        }

        setInitializing(true);
        setError(null);

        const payload: StartSessionPayload = {
            course_id: courseId,
        };
        if (lessonId) payload.lesson_id = lessonId;
        if (blockId) payload.block_id = blockId;
        if (persona) payload.persona = persona;

        try {
            const response = await aiTutorService.startSession(token, payload);
            setSession(response.session || null);
            setTutorTurn(response.tutor_turn || null);
            setInteractions(Array.isArray(response.interactions) ? response.interactions : []);
        } catch (err) {
            console.error('Failed to start AI tutor session', err);
            setError(err instanceof Error ? err.message : 'Failed to start AI tutor session');
        } finally {
            setInitializing(false);
        }
    }, [token, courseId, lessonId, blockId, persona]);

    useEffect(() => {
        if (visible) {
            initialiseSession();
        } else {
            resetOverlayState();
        }
    }, [visible, initialiseSession, resetOverlayState]);

    const appendTutorState = useCallback((state: TutorSessionState) => {
        setSession(state.session || null);
        setTutorTurn(state.tutor_turn || null);
        setInteractions(Array.isArray(state.interactions) ? state.interactions : []);
    }, []);

    const handleSendMessage = useCallback(async (message: string, inputType: MessagePayload['input_type'] = 'text') => {
        if (!token || !session?.session_id || pendingRequest) {
            return;
        }

        const trimmed = message.trim();
        if (!trimmed) {
            return;
        }

        setPendingRequest(true);
        setInputText('');
        setPartialTranscript('');

        try {
            const response = await aiTutorService.sendMessage(token, session.session_id, {
                input_type: inputType,
                message: trimmed,
            });
            appendTutorState(response);
        } catch (err) {
            console.error('Failed to send message', err);
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to deliver your message.');
        } finally {
            setPendingRequest(false);
        }
    }, [appendTutorState, pendingRequest, session?.session_id, token]);

    // Voice listeners
    useEffect(() => {
        if (!voiceOperational || !Voice) {
            console.warn('Voice recognition unavailable; microphone button will be disabled.');
            return;
        }

        const hasNativeModule = detectVoiceAvailability();
        if (!hasNativeModule) {
            if (voiceOperational) {
                setVoiceOperational(false);
            }
            return;
        }

        const onStart = () => setListening(true);
        const onEnd = () => setListening(false);
        const onResults = (event: any) => {
            const spoken = event.value?.[0];
            if (spoken) {
                setPartialTranscript('');
                setInputText(spoken);
                handleSendMessage(spoken, 'voice');
            }
        };
        const onPartialResults = (event: any) => {
            const partial = event.value?.[0];
            if (partial) {
                setPartialTranscript(partial);
            }
        };
        const onError = (event: any) => {
            console.warn('Voice recognition error', event.error);
            setListening(false);
            setPartialTranscript('');
        };

        let listenersAttached = false;

        if (Voice) {
            try {
                Voice.onSpeechStart = onStart;
                Voice.onSpeechEnd = onEnd;
                Voice.onSpeechResults = onResults;
                Voice.onSpeechPartialResults = onPartialResults;
                Voice.onSpeechError = onError;
                listenersAttached = true;
            } catch (err) {
                console.warn('Voice listeners unavailable; disabling microphone support.', err);
                setVoiceOperational(false);
                setListening(false);
                setPartialTranscript('');
                return () => undefined;
            }
        }

        return () => {
            if (!Voice) {
                return;
            }
            if (listenersAttached) {
                if (typeof Voice.destroy === 'function') {
                    Voice.destroy().catch(() => undefined);
                }
                if (typeof Voice.removeAllListeners === 'function') {
                    Voice.removeAllListeners();
                }
            }
        };
    }, [handleSendMessage, voiceOperational]);

    const handleComprehensionChoice = useCallback((choice: string, index: number) => {
        const payload: MessagePayload = {
            input_type: 'button',
            message: choice,
            choice_index: index,
        };
        if (!token || !session?.session_id || pendingRequest) return;
        setPendingRequest(true);
        aiTutorService.sendMessage(token, session.session_id, payload)
            .then(appendTutorState)
            .catch((err) => {
                console.error('Failed to send comprehension response', err);
                Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send response.');
            })
            .finally(() => setPendingRequest(false));
    }, [appendTutorState, pendingRequest, session?.session_id, token]);

    const ensureCameraPermission = useCallback(async () => {
        if (cameraPermission?.granted) {
            return true;
        }
        const permission = await requestCameraPermission();
        return permission?.granted ?? false;
    }, [cameraPermission?.granted, requestCameraPermission]);

    const handleOpenCamera = useCallback(async () => {
        const granted = await ensureCameraPermission();
        if (!granted) {
            Alert.alert('Camera permission needed', 'Please grant camera access to submit your work.');
            return;
        }
        setShowCamera(true);
        setCheckpointState((prev) => ({ ...prev, status: 'capturing' }));
    }, [ensureCameraPermission]);

    const handleCapturePhoto = useCallback(async () => {
        try {
            const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8, base64: false });
            if (photo?.uri) {
                setCheckpointState((prev) => ({ ...prev, status: 'captured', photoUri: photo.uri }));
                setShowCamera(false);
            }
        } catch (err) {
            console.error('Failed to capture photo', err);
            Alert.alert('Capture failed', 'Please try capturing the photo again.');
        }
    }, []);

    const handleSubmitCheckpoint = useCallback(async (notes?: string) => {
        if (!token || !session?.session_id || !outstandingCheckpoint) return;

        const payload: CheckpointSubmissionPayload = {
            checkpoint_type: outstandingCheckpoint.checkpoint_type || 'photo',
        };
        if (notes) payload.notes = notes;

        if (checkpointState.photoUri) {
            payload.file_uri = checkpointState.photoUri;
            payload.file_name = `checkpoint-${Date.now()}.jpg`;
            payload.mime_type = 'image/jpeg';
        }

        setCheckpointState((prev) => ({ ...prev, status: 'uploading' }));
        try {
            const response = await aiTutorService.submitCheckpoint(token, session.session_id, payload);
            setCheckpointState({
                status: 'reviewing',
                feedback: response.ai_feedback,
                score: response.score,
                photoUri: checkpointState.photoUri,
            });

            // Fetch the follow-up tutor response
            const state = await aiTutorService.getSession(token, session.session_id);
            appendTutorState(state);
            setCheckpointState({ status: 'idle' });
        } catch (err) {
            console.error('Failed to submit checkpoint', err);
            setCheckpointState((prev) => ({ ...prev, status: 'captured' }));
            Alert.alert('Upload failed', err instanceof Error ? err.message : 'Unable to submit your work right now.');
        }
    }, [appendTutorState, checkpointState.photoUri, outstandingCheckpoint, session?.session_id, token]);

    const handleCompleteSession = useCallback(() => {
        if (!token || !session?.session_id) {
            onClose();
            return;
        }

        aiTutorService.completeSession(token, session.session_id)
            .catch((err) => console.error('Failed to complete session', err))
            .finally(() => {
                onClose();
            });
    }, [onClose, session?.session_id, token]);

    const startListening = useCallback(async () => {
        if (!voiceOperational) {
            Alert.alert('Voice unavailable', 'Speech recognition is not available in this environment.');
            return;
        }
        try {
            setPartialTranscript('');
            await Voice.start(voiceLocale || 'en-US');
        } catch (err) {
            console.error('Voice start failed', err);
            Alert.alert('Voice unavailable', 'Unable to start voice recognition right now.');
        }
    }, [voiceOperational]);

    const stopListening = useCallback(async () => {
        if (!voiceOperational) {
            return;
        }
        try {
            await Voice.stop();
            setListening(false);
        } catch (err) {
            console.error('Voice stop failed', err);
        }
    }, [voiceOperational]);

    const renderTranscript = useMemo(() => (
        <View style={styles.transcriptContainer}>
            <ScrollView contentContainerStyle={styles.transcriptScrollContent}>
                {interactions.map((item) => (
                    <View
                        key={`${item.id}-${item.turn_index}-${item.speaker}`}
                        style={[styles.messageBubble, item.speaker === 'tutor' ? styles.tutorBubble : styles.learnerBubble]}
                    >
                        <Text style={styles.messageRole}>{item.speaker === "tutor" ? 'Tutor' : 'You'}</Text>
                        <Text style={styles.messageText}>{item.content}</Text>
                        <Text style={styles.messageTimestamp}>{new Date(item.created_at).toLocaleTimeString()}</Text>
                    </View>
                ))}
                {pendingRequest && (
                    <View style={[styles.messageBubble, styles.tutorBubble]}>
                        <Text style={styles.messageRole}>Tutor</Text>
                        <Text style={styles.messageText}>Thinking…</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    ), [interactions, pendingRequest]);

    const renderComprehensionCheck = () => {
        if (!tutorTurn?.comprehension_check) return null;
        const isString = typeof tutorTurn.comprehension_check === 'string';
        const cc = tutorTurn.comprehension_check;
        
        if (isString) {
            return (
                <View style={styles.checkContainer}>
                    <Text style={styles.checkTitle}>Quick Check</Text>
                    <Text style={styles.checkQuestion}>{cc as string}</Text>
                </View>
            );
        }

        const checkObj = cc as any;
        const { question, choices, hint } = checkObj;
        return (
            <View style={styles.checkContainer}>
                <Text style={styles.checkTitle}>Quick Check</Text>
                <Text style={styles.checkQuestion}>{question}</Text>
                {choices?.map((choice, idx) => (
                    <TouchableOpacity
                        key={choice}
                        style={styles.choiceButton}
                        disabled={pendingRequest}
                        onPress={() => handleComprehensionChoice(choice, idx)}
                    >
                        <Text style={styles.choiceLabel}>{choice}</Text>
                    </TouchableOpacity>
                ))}
                {hint && <Text style={styles.checkHint}>{hint}</Text>}
            </View>
        );
    };

    const renderCheckpointCard = () => {
        if (!outstandingCheckpoint?.required) return null;

        return (
            <View style={styles.checkpointCard}>
                <Text style={styles.checkpointTitle}>{outstandingCheckpoint.title || 'Checkpoint'}</Text>
                {outstandingCheckpoint.instructions && (
                    <Text style={styles.checkpointDescription}>{outstandingCheckpoint.instructions}</Text>
                )}
                {Array.isArray(outstandingCheckpoint.tips) && (
                    <View style={styles.checkpointTips}>
                        {outstandingCheckpoint.tips.map((tip) => (
                            <Text key={tip} style={styles.checkpointTipItem}>• {tip}</Text>
                        ))}
                    </View>
                )}

                {checkpointState.photoUri && (
                    <Image source={{ uri: checkpointState.photoUri }} style={styles.photoPreview} />
                )}

                <View style={styles.checkpointActions}>
                    <TouchableOpacity style={styles.secondaryButton} onPress={handleOpenCamera}>
                        <Text style={styles.secondaryButtonText}>
                            {checkpointState.photoUri ? 'Retake Photo' : 'Open Camera'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.primaryButton, checkpointState.status === 'uploading' && styles.disabledButton]}
                        disabled={checkpointState.status === 'uploading'}
                        onPress={() => handleSubmitCheckpoint()}
                    >
                        {checkpointState.status === 'uploading' ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.primaryButtonText}>Submit</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    if (!visible) {
        return null;
    }

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <View style={styles.overlayContainer}>
                <KeyboardAvoidingView
                    style={styles.overlayInner}
                    behavior={Platform.select({ ios: 'padding', android: undefined })}
                >
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.headerSubtitle}>{courseTitle}</Text>
                            <Text style={styles.headerTitle}>{lessonTitle || 'AI Tutor Mode'}</Text>
                        </View>
                        <TouchableOpacity style={styles.closeButton} onPress={handleCompleteSession}>
                            <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>

                    {initializing ? (
                        <View style={styles.centerContent}>
                            <ActivityIndicator size="large" color="#2563EB" />
                            <Text style={styles.centerText}>Summoning your tutor…</Text>
                        </View>
                    ) : error ? (
                        <View style={styles.centerContent}>
                            <Text style={styles.errorText}>{error}</Text>
                            <TouchableOpacity style={styles.primaryButton} onPress={initialiseSession}>
                                <Text style={styles.primaryButtonText}>Retry</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            {renderTranscript}

                            <View style={styles.tutorCard}>
                                <Text style={styles.tutorLabel}>Tutor says</Text>
                                <ScrollView style={styles.tutorNarrationScroll}>
                                    <Text style={styles.tutorNarration}>{tutorTurn?.narration || '…'}</Text>
                                </ScrollView>
                                <View style={styles.tutorControls}>
                                    <TouchableOpacity
                                        style={styles.secondaryButton}
                                        onPress={() => {
                                            if (!isTtsAvailable) {
                                                Alert.alert('Voice unavailable', 'Text-to-speech is not available in this environment.');
                                                return;
                                            }
                                            if (!tutorTurn?.narration) {
                                                return;
                                            }
                                            if (ttsSpeaking) {
                                                ttsAdapter.stop();
                                                setTtsSpeaking(false);
                                                if (fallbackTtsTimeoutRef.current) {
                                                    clearTimeout(fallbackTtsTimeoutRef.current);
                                                    fallbackTtsTimeoutRef.current = null;
                                                }
                                            } else {
                                                setTtsSpeaking(true);
                                                ttsAdapter.stop();
                                                ttsAdapter.speak(tutorTurn.narration, { rate: 0.52 });
                                                if (!supportsTtsEvents) {
                                                    if (fallbackTtsTimeoutRef.current) {
                                                        clearTimeout(fallbackTtsTimeoutRef.current);
                                                    }
                                                    const estimatedMs = Math.max(3500, tutorTurn.narration.split(' ').length * 450);
                                                    fallbackTtsTimeoutRef.current = setTimeout(() => {
                                                        setTtsSpeaking(false);
                                                        fallbackTtsTimeoutRef.current = null;
                                                    }, estimatedMs);
                                                }
                                            }
                                        }}
                                    >
                                        <Text style={styles.secondaryButtonText}>{ttsSpeaking ? 'Pause Voice' : 'Play Voice'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {renderComprehensionCheck()}
                            {renderCheckpointCard()}

                            <View style={styles.footer}>
                                <View style={styles.voiceStatus}>
                                    {listening ? (
                                        <Text style={styles.voiceStatusText}>Listening… {partialTranscript}</Text>
                                    ) : !voiceOperational ? (
                                        <Text style={styles.voiceStatusText}>Voice input unavailable on this device build.</Text>
                                    ) : null}
                                </View>
                                <View style={styles.inputRow}>
                                    <TouchableOpacity
                                        style={[
                                            styles.micButton,
                                            listening && styles.micButtonActive,
                                            (!voiceOperational || pendingRequest) && styles.disabledButton,
                                        ]}
                                        disabled={!voiceOperational || pendingRequest}
                                        onPressIn={startListening}
                                        onPressOut={stopListening}
                                    >
                                        <Text style={styles.micIcon}>🎤</Text>
                                    </TouchableOpacity>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="Ask the tutor or share an answer…"
                                        value={inputText}
                                        editable={!pendingRequest}
                                        onChangeText={setInputText}
                                        onSubmitEditing={() => handleSendMessage(inputText, 'text')}
                                        returnKeyType="send"
                                    />
                                    <TouchableOpacity
                                        style={[styles.sendButton, pendingRequest && styles.disabledButton]}
                                        disabled={pendingRequest}
                                        onPress={() => handleSendMessage(inputText, 'text')}
                                    >
                                        <Text style={styles.sendButtonText}>Send</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </>
                    )}
                </KeyboardAvoidingView>

                {showCamera && (
                    <View style={styles.cameraOverlay}>
                        <CameraView
                            ref={(ref) => {
                                cameraRef.current = ref;
                            }}
                            style={styles.cameraView}
                            facing={cameraType}
                        >
                            <View style={styles.cameraControls}>
                                <TouchableOpacity
                                    style={styles.cameraControlButton}
                                    onPress={() => setCameraType((prev) => (prev === 'back' ? 'front' : 'back'))}
                                >
                                    <Text style={styles.cameraControlText}>Flip</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.cameraControlButton, styles.cameraCaptureButton]}
                                    onPress={handleCapturePhoto}
                                >
                                    <Text style={styles.cameraControlText}>Capture</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.cameraControlButton}
                                    onPress={() => {
                                        setShowCamera(false);
                                        setCheckpointState((prev) => ({ ...prev, status: prev.photoUri ? 'captured' : 'idle' }));
                                    }}
                                >
                                    <Text style={styles.cameraControlText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </CameraView>
                    </View>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlayContainer: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    overlayInner: {
        flex: 1,
        paddingTop: Platform.select({ ios: 60, android: 40 }),
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#CBD5F5',
        marginBottom: 4,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    closeButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#1E3A8A',
        borderRadius: 12,
    },
    closeButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    centerText: {
        marginTop: 16,
        color: '#E2E8F0',
        fontSize: 16,
    },
    errorText: {
        color: '#F87171',
        textAlign: 'center',
        marginBottom: 20,
        fontSize: 16,
    },
    transcriptContainer: {
        flex: 1,
        backgroundColor: '#111827',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 16,
        paddingHorizontal: 16,
    },
    transcriptScrollContent: {
        paddingBottom: 32,
    },
    messageBubble: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
    },
    tutorBubble: {
        backgroundColor: 'rgba(79, 70, 229, 0.2)',
        borderColor: 'rgba(129, 140, 248, 0.4)',
        borderWidth: 1,
    },
    learnerBubble: {
        backgroundColor: 'rgba(14, 165, 233, 0.2)',
        borderColor: 'rgba(14, 165, 233, 0.4)',
        borderWidth: 1,
        alignSelf: 'flex-end',
    },
    messageRole: {
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: '#A5B4FC',
        marginBottom: 6,
    },
    messageText: {
        color: '#F8FAFC',
        fontSize: 15,
        lineHeight: 22,
    },
    messageTimestamp: {
        color: '#94A3B8',
        fontSize: 11,
        marginTop: 8,
    },
    tutorCard: {
        backgroundColor: '#1E293B',
        marginTop: -24,
        padding: 20,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    tutorLabel: {
        color: '#A5B4FC',
        fontSize: 12,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    tutorNarrationScroll: {
        maxHeight: 140,
        marginBottom: 12,
    },
    tutorNarration: {
        color: '#E2E8F0',
        fontSize: 16,
        lineHeight: 24,
    },
    tutorControls: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    checkContainer: {
        backgroundColor: '#1F2937',
        borderRadius: 16,
        marginHorizontal: 20,
        marginTop: 12,
        padding: 16,
    },
    checkTitle: {
        color: '#A5B4FC',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    checkQuestion: {
        color: '#F8FAFC',
        fontSize: 16,
        marginBottom: 12,
    },
    choiceButton: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: 'rgba(79, 70, 229, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(129, 140, 248, 0.4)',
        marginBottom: 8,
    },
    choiceLabel: {
        color: '#E0E7FF',
        fontSize: 15,
    },
    checkHint: {
        color: '#94A3B8',
        fontSize: 13,
        marginTop: 8,
    },
    checkpointCard: {
        backgroundColor: '#15213B',
        borderRadius: 18,
        marginHorizontal: 20,
        marginTop: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: 'rgba(96, 165, 250, 0.3)',
    },
    checkpointTitle: {
        color: '#BFDBFE',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    checkpointDescription: {
        color: '#E5E7EB',
        fontSize: 15,
        marginBottom: 12,
        lineHeight: 22,
    },
    checkpointTips: {
        marginBottom: 14,
    },
    checkpointTipItem: {
        color: '#93C5FD',
        fontSize: 14,
        marginBottom: 4,
    },
    photoPreview: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        marginBottom: 12,
        backgroundColor: '#0F172A',
    },
    checkpointActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    primaryButton: {
        flex: 1,
        backgroundColor: '#2563EB',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    secondaryButton: {
        flex: 1,
        backgroundColor: 'rgba(37, 99, 235, 0.18)',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(129, 140, 248, 0.3)',
    },
    secondaryButtonText: {
        color: '#BFDBFE',
        fontSize: 14,
        fontWeight: '600',
    },
    disabledButton: {
        opacity: 0.5,
    },
    footer: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#0B1220',
    },
    voiceStatus: {
        minHeight: 20,
        marginBottom: 6,
    },
    voiceStatusText: {
        color: '#E0E7FF',
        fontSize: 13,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111827',
        borderRadius: 16,
        padding: 6,
    },
    micButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        marginRight: 8,
    },
    micButtonActive: {
        backgroundColor: '#2563EB',
    },
    micIcon: {
        fontSize: 20,
        color: '#E0E7FF',
    },
    textInput: {
        flex: 1,
        color: '#E2E8F0',
        paddingVertical: 10,
        paddingHorizontal: 12,
        fontSize: 15,
    },
    sendButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#2563EB',
        borderRadius: 12,
    },
    sendButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    cameraOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraView: {
        width: '100%',
        height: '100%',
    },
    cameraControls: {
        position: 'absolute',
        bottom: 40,
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    cameraControlButton: {
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 30,
    },
    cameraCaptureButton: {
        backgroundColor: '#F97316',
    },
    cameraControlText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    sideMenuConnectorColumn: {
        display: 'none',
    },
});

export default AITutorOverlay;
