import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    TextInput,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Animated,
    Easing,
    Keyboard,
    PanResponder,
    useWindowDimensions,
    Vibration,
} from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureScreen } from 'react-native-view-shot';
import { agentService, KanaMessage } from '../services/agentServices';
import { useAuth } from '../context/AuthContext';

type KanaContextValue = {
    isOpen: boolean;
    toggle: () => void;
    send: (text: string) => Promise<void>;
    transcribeAndSend: (audioUri: string) => Promise<void>;
    setRouteInfo: (route: string, screenContext?: string) => void;
    messages: KanaMessage[];
    isSending: boolean;
};

const KanaContext = createContext<KanaContextValue | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'kana_state_v1_';

export const KanaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { token, user } = useAuth();
    const insets = useSafeAreaInsets();
    const { width: screenW, height: screenH } = useWindowDimensions();

    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<KanaMessage[]>([]);
    const [sessionId, setSessionId] = useState<string | undefined>(undefined);
    const [isSending, setIsSending] = useState(false);
    const [route, setRoute] = useState<string>('');
    const [screenContext, setScreenContext] = useState<string>('');
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [dragging, setDragging] = useState(false);

    const slideAnim = useRef(new Animated.Value(0)).current;
    const fabPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const dragTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dragArmed = useRef(false);

    const storageKey = useMemo(() => `${STORAGE_KEY_PREFIX}${user?.id ?? 'anon'}`, [user?.id]);

    // Hydrate persisted state
    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem(storageKey);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    setMessages(parsed.messages ?? []);
                    setSessionId(parsed.sessionId ?? undefined);
                }
            } catch (e) {
                // ignore hydration errors
            }
        })();
    }, [storageKey]);

    // Persist on change
    useEffect(() => {
        (async () => {
            try {
                await AsyncStorage.setItem(
                    storageKey,
                    JSON.stringify({ messages, sessionId })
                );
            } catch (e) {
                // ignore persist errors
            }
        })();
    }, [messages, sessionId, storageKey]);

    // Animate panel open/close
    useEffect(() => {
        Animated.timing(slideAnim, {
            toValue: isOpen ? 1 : 0,
            duration: 200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
        }).start();
    }, [isOpen, slideAnim]);

    // Position FAB default a bit higher and adapt on dimension changes
    useEffect(() => {
        const defaultX = screenW - 84 - (insets.right || 0) - 12;
        const defaultY = screenH - 260 - (insets.bottom || 0); // lift above bottom bar
        fabPos.setValue({ x: defaultX, y: defaultY });
    }, [screenW, screenH, insets.bottom, insets.right, fabPos]);

    // Track keyboard height so the overlay lifts above it
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = (e: any) => {
            const height = e?.endCoordinates?.height || 0;
            setKeyboardHeight(height);
        };
        const onHide = () => setKeyboardHeight(0);

        const subShow = Keyboard.addListener(showEvent, onShow);
        const subHide = Keyboard.addListener(hideEvent, onHide);

        return () => {
            subShow?.remove();
            subHide?.remove();
        };
    }, []);

    // Pan responder for drag after long press
    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => dragArmed.current,
                onMoveShouldSetPanResponder: () => dragArmed.current,
                onPanResponderGrant: () => {
                    fabPos.setOffset({
                        x: (fabPos.x as any)._value,
                        y: (fabPos.y as any)._value,
                    });
                    fabPos.setValue({ x: 0, y: 0 });
                },
                onPanResponderMove: Animated.event([
                    null,
                    { dx: fabPos.x, dy: fabPos.y },
                ], { useNativeDriver: false }),
                onPanResponderRelease: () => {
                    fabPos.flattenOffset();
                    dragArmed.current = false;
                    setDragging(false);
                },
                onPanResponderTerminate: () => {
                    fabPos.flattenOffset();
                    dragArmed.current = false;
                    setDragging(false);
                },
            }),
        [fabPos]
    );

    const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

    const setRouteInfo = useCallback((name: string, ctx?: string) => {
        setRoute(name || '');
        if (ctx !== undefined) {
            setScreenContext(ctx);
        }
    }, []);

    const captureVisualContext = useCallback(async () => {
        try {
            const base64 = await captureScreen({
                format: 'jpg',
                quality: 0.35,
                result: 'base64',
            });
            if (!base64) return {};
            return {
                screen_capture: base64,
                screen_capture_mime: 'image/jpeg',
            };
        } catch (err) {
            return {};
        }
    }, []);

    const startNewChat = useCallback(() => {
        setSessionId(undefined);
        setMessages([]);
    }, []);

    const send = useCallback(
        async (text: string) => {
            const trimmed = text.trim();
            if (!trimmed) return;
            if (isSending) return;

            const optimisticTurn: KanaMessage = {
                role: 'user',
                content: trimmed,
                route,
                screen_context: screenContext,
                timestamp: new Date().toISOString(),
            };

            setMessages((prev) => [...prev, optimisticTurn]);
            setIsSending(true);

            try {
                const visual = await captureVisualContext();
                const payload = {
                    message: trimmed,
                    session_id: sessionId,
                    route,
                    screen_context: screenContext,
                    metadata: {
                        surface: 'mobile-app',
                        platform: Platform.OS,
                    },
                    history: !sessionId && messages.length ? messages : undefined,
                    screen_capture: visual.screen_capture,
                    screen_capture_mime: visual.screen_capture_mime,
                };
                const res = await agentService.chat(payload, token ?? undefined);
                setSessionId(res.session_id);
                setMessages(res.history || []);
            } catch (err: any) {
                const failure: KanaMessage = {
                    role: 'assistant',
                    content: err?.message || 'Kana had trouble responding. Try again.',
                    timestamp: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, failure]);
            } finally {
                setIsSending(false);
            }
        },
        [captureVisualContext, isSending, messages, route, screenContext, sessionId, token]
    );

    const transcribeAndSend = useCallback(
        async (audioUri: string) => {
            try {
                const transcriptRes = await agentService.transcribeAudio(audioUri, token ?? undefined);
                if (!transcriptRes?.transcript) {
                    throw new Error('No transcript returned');
                }
                await send(transcriptRes.transcript);
            } catch (err: any) {
                const failure: KanaMessage = {
                    role: 'assistant',
                    content: err?.message || 'Transcription failed. Try again.',
                    timestamp: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, failure]);
            }
        },
        [send, token]
    );

    const ctxValue: KanaContextValue = {
        isOpen,
        toggle,
        send,
        transcribeAndSend,
        setRouteInfo,
        messages,
        isSending,
    };

    const translateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [300, 0],
    });

    return (
        <KanaContext.Provider value={ctxValue}>
            {children}
            {/* Floating overlay rendered above navigation */}
            <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                <Animated.View
                    style={[
                        styles.fab,
                        {
                            transform: [{ translateX: fabPos.x }, { translateY: fabPos.y }],
                        },
                    ]}
                    {...panResponder.panHandlers}
                >
                    <BlurView intensity={55} tint="dark" style={styles.fabBlur}>
                        <Pressable
                            accessibilityLabel="Open Kana assistant"
                            onPressIn={() => {
                                dragTimer.current && clearTimeout(dragTimer.current);
                                dragTimer.current = setTimeout(() => {
                                    dragArmed.current = true;
                                    setDragging(true);
                                    Vibration.vibrate(20);
                                }, 700);
                            }}
                            onPressOut={() => {
                                if (dragTimer.current) {
                                    clearTimeout(dragTimer.current);
                                    dragTimer.current = null;
                                }
                                if (dragArmed.current || dragging) {
                                    // End drag mode after release
                                    dragArmed.current = false;
                                    setTimeout(() => setDragging(false), 120);
                                    return;
                                }
                                toggle();
                            }}
                            style={styles.fabPressable}
                        >
                            <Text style={styles.fabText}>{isOpen ? '×' : 'Kana'}</Text>
                        </Pressable>
                    </BlurView>
                </Animated.View>
                {isOpen && (
                    <Animated.View
                        pointerEvents="box-none"
                        style={[
                            styles.overlayWrapper,
                            {
                                paddingBottom:
                                    Math.max(insets.bottom, 12) + keyboardHeight + (keyboardHeight > 0 ? 0 : 72),
                                transform: [{ translateY }],
                            },
                        ]}
                    >
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                            style={styles.kanaCard}
                        >
                            <BlurView intensity={50} tint="dark" style={styles.blurLayer}>
                                <View style={styles.cardContent}>
                                    <KanaHeader onClose={toggle} onNewChat={startNewChat} route={route} />
                                    <KanaMessages messages={messages} />
                                    <KanaInput onSend={send} onTranscribe={transcribeAndSend} isSending={isSending} />
                                </View>
                            </BlurView>
                        </KeyboardAvoidingView>
                    </Animated.View>
                )}
            </View>
        </KanaContext.Provider>
    );
};

export const useKanaAgent = () => {
    const ctx = useContext(KanaContext);
    if (!ctx) throw new Error('useKanaAgent must be used within KanaProvider');
    return ctx;
};

// ------------------------------
// UI pieces
// ------------------------------

const KanaFab: React.FC<{ isOpen: boolean; toggle: () => void; insets: any }> = ({ isOpen, toggle, insets }) => {
    // Fab rendering moved into provider to access pan handlers
    return null;
};

const KanaHeader: React.FC<{ onClose: () => void; onNewChat: () => void; route: string }> = ({ onClose, onNewChat, route }) => {
    return (
        <View style={styles.header}>
            <View>
                <Text style={styles.title}>Kana</Text>
                <Text style={styles.subtitle}>{route ? `On ${route}` : 'Context-aware help'}</Text>
            </View>
            <View style={styles.headerActions}>
                <Pressable onPress={onNewChat} hitSlop={10} style={styles.newChatBtn}>
                    <Text style={styles.newChatText}>New chat</Text>
                </Pressable>
                <Pressable onPress={onClose} hitSlop={12}>
                    <Text style={styles.close}>Close</Text>
                </Pressable>
            </View>
        </View>
    );
};

const KanaMessages: React.FC<{ messages: KanaMessage[] }> = ({ messages }) => {
    const listRef = useRef<FlatList<KanaMessage>>(null);
    const { token } = useAuth();
    const listData = useMemo(() => [...messages].reverse(), [messages]);

    return (
        <FlatList
            ref={listRef}
            data={listData}
            inverted
            keyExtractor={(item, idx) => buildMessageKey(item, idx)}
            style={styles.messageListContainer}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
                item.role === 'assistant' ? (
                    <KanaAssistantBubble message={item} index={index} token={token ?? undefined} />
                ) : (
                    <View style={[styles.bubble, styles.bubbleUser]}>
                        <Text style={styles.bubbleTextUser}>{item.content}</Text>
                    </View>
                )
            )}
        />
    );
};

const KanaAssistantBubble: React.FC<{ message: KanaMessage; index: number; token?: string }> = ({ message, index, token }) => {
    const [ttsState, setTtsState] = useState<'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);
    const soundRef = useRef<Audio.Sound | null>(null);
    const audioUriRef = useRef<string | null>(null);
    const messageKey = useMemo(() => buildMessageKey(message, index), [message, index]);

    useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync().catch(() => null);
            }
            if (
                audioUriRef.current &&
                Platform.OS === 'web' &&
                typeof URL !== 'undefined' &&
                audioUriRef.current.startsWith('blob:')
            ) {
                URL.revokeObjectURL(audioUriRef.current);
            }
        };
    }, []);

    const ensureAudioFile = useCallback(async () => {
        if (audioUriRef.current) {
            return audioUriRef.current;
        }
        setError(null);
        setTtsState('loading');
        try {
            const result = await agentService.synthesizeSpeech(message.content, token);
            if (!result?.audio_base64) {
                throw new Error('Kana TTS returned an empty payload');
            }

            if (Platform.OS === 'web') {
                const decode = typeof atob === 'function' ? atob : null;
                if (!decode || typeof URL === 'undefined') {
                    throw new Error('Web runtime does not support in-browser audio playback');
                }

                const binary = decode(result.audio_base64);
                const byteNumbers = new Array(binary.length);
                for (let i = 0; i < binary.length; i += 1) {
                    byteNumbers[i] = binary.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: result.mime_type || 'audio/wav' });
                if (audioUriRef.current && audioUriRef.current.startsWith('blob:')) {
                    URL.revokeObjectURL(audioUriRef.current);
                }
                const objectUrl = URL.createObjectURL(blob);
                audioUriRef.current = objectUrl;
                setTtsState('ready');
                return objectUrl;
            }

            const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
            if (!baseDir) {
                throw new Error('Kana cannot access device storage for audio playback');
            }
            const fileUri = `${baseDir}kana-tts-${messageKey}.wav`;
            const base64Encoding = (FileSystem as any)?.EncodingType?.Base64 || ('base64' as FileSystem.EncodingType);
            await FileSystem.writeAsStringAsync(fileUri, result.audio_base64, {
                encoding: base64Encoding,
            });
            audioUriRef.current = fileUri;
            setTtsState('ready');
            return fileUri;
        } catch (err: any) {
            const msg = err?.message || 'Unable to generate audio right now';
            setError(msg);
            setTtsState('error');
            throw err;
        }
    }, [message.content, messageKey, token]);

    const ensureSound = useCallback(async () => {
        await ensureAudioFile();
        if (soundRef.current) {
            return soundRef.current;
        }

        await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
        });

        const { sound } = await Audio.Sound.createAsync(
            { uri: audioUriRef.current as string },
            { shouldPlay: false }
        );

        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
            if (!status.isLoaded) {
                return;
            }
            if (status.didJustFinish) {
                setTtsState('ready');
                soundRef.current?.setPositionAsync(0).catch(() => null);
            } else if (status.isPlaying) {
                setTtsState('playing');
            } else if (!status.isPlaying && status.positionMillis > 0) {
                setTtsState('paused');
            }
        });

        soundRef.current = sound;
        return sound;
    }, [ensureAudioFile]);

    const handlePlay = useCallback(async () => {
        try {
            const sound = await ensureSound();
            if (!sound) return;

            const status = await sound.getStatusAsync();
            if (status.isLoaded && status.didJustFinish) {
                await sound.setPositionAsync(0);
            }
            await sound.playAsync();
            setTtsState('playing');
        } catch (err: any) {
            setError(err?.message || 'Could not start playback');
            setTtsState('error');
        }
    }, [ensureSound]);

    const handlePause = useCallback(async () => {
        if (!soundRef.current) return;
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
            await soundRef.current.pauseAsync();
            setTtsState('paused');
        }
    }, []);

    const isPlaying = ttsState === 'playing';
    const isLoading = ttsState === 'loading';

    return (
        <View style={[styles.bubble, styles.bubbleAssistant]}>
            <Text style={styles.bubbleTextAssistant}>{message.content}</Text>
            <View style={styles.ttsControls}>
                <Pressable
                    onPress={handlePlay}
                    disabled={isLoading}
                    style={[
                        styles.ttsButton,
                        isPlaying ? styles.ttsButtonActive : null,
                        isLoading ? styles.ttsButtonLoading : null,
                    ]}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color={isPlaying ? '#ffffff' : '#0f172a'} />
                    ) : (
                        <Ionicons name="volume-high" size={16} color={isPlaying ? '#ffffff' : '#0f172a'} />
                    )}
                    <Text style={[styles.ttsButtonText, isPlaying ? styles.ttsButtonTextActive : null]}>
                        {isPlaying ? 'Playing' : 'Listen'}
                    </Text>
                </Pressable>
                <Pressable
                    onPress={handlePause}
                    disabled={!isPlaying}
                    style={[
                        styles.ttsButton,
                        styles.ttsSecondaryButton,
                        !isPlaying ? styles.ttsButtonDisabled : null,
                    ]}
                >
                    <Ionicons name="pause" size={16} color={isPlaying ? '#0f172a' : '#94a3b8'} />
                    <Text style={[styles.ttsButtonText, !isPlaying ? styles.ttsButtonDisabledText : null]}>Pause</Text>
                </Pressable>
            </View>
            {error ? <Text style={styles.ttsError}>{error}</Text> : null}
        </View>
    );
};

const buildMessageKey = (message: KanaMessage, fallbackIndex = 0) => {
    const ts = message.timestamp || `${message.role}-${fallbackIndex}`;
    const snippet = (message.content || '').slice(0, 16) || 'kana';
    return `${ts}-${snippet}`.replace(/[^a-z0-9]/gi, '-').toLowerCase();
};

const KanaInput: React.FC<{ onSend: (text: string) => void; onTranscribe: (uri: string) => Promise<void>; isSending: boolean }> = ({ onSend, onTranscribe, isSending }) => {
    const [text, setText] = useState('');
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSend = useCallback(() => {
        if (!text.trim()) return;
        onSend(text);
        setText('');
    }, [onSend, text]);

    const startRecording = useCallback(async () => {
        try {
            setError(null);
            const permission = await Audio.requestPermissionsAsync();
            if (!permission.granted) {
                setError('Microphone permission is required');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
            });

            const rec = new Audio.Recording();
            await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            await rec.startAsync();
            setRecording(rec);
            setIsRecording(true);
        } catch (err: any) {
            setError(err?.message || 'Could not start recording');
        }
    }, []);

    const stopRecording = useCallback(async () => {
        if (!recording) return;
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setIsRecording(false);
            setRecording(null);

            if (!uri) {
                setError('No audio captured');
                return;
            }

            setIsTranscribing(true);
            await onTranscribe(uri);
        } catch (err: any) {
            setError(err?.message || 'Could not stop recording');
        } finally {
            setIsTranscribing(false);
        }
    }, [onTranscribe, recording]);

    const handleRecordPress = useCallback(() => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }, [isRecording, startRecording, stopRecording]);

    return (
        <View style={styles.inputRow}>
            <Pressable
                onPress={handleRecordPress}
                disabled={isSending || isTranscribing}
                style={[styles.recordButton, isRecording ? styles.recordButtonActive : null]}
            >
                {isTranscribing ? (
                    <ActivityIndicator color="#0c0f14" />
                ) : (
                    <Text style={styles.recordLabel}>{isRecording ? 'Stop' : 'Rec'}</Text>
                )}
            </Pressable>
            <TextInput
                style={styles.input}
                placeholder="Ask Kana anything here"
                placeholderTextColor="#94a3b8"
                value={text}
                onChangeText={setText}
                multiline
                maxLength={800}
            />
            <Pressable onPress={handleSend} disabled={isSending || !text.trim()} style={styles.sendButton}>
                {isSending ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.sendLabel}>Send</Text>}
            </Pressable>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
    );
};

// ------------------------------
// Styles
// ------------------------------

const styles = StyleSheet.create({
    fab: {
        position: 'absolute',
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000ff',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    fabBlur: {
        width: '100%',
        height: '100%',
        borderRadius: 32,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        backgroundColor: 'rgba(98, 108, 133, 0.3)',
    },
    fabPressable: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 32,
        width: '100%',
        height: '100%',
    },
    fabText: {
        color: '#0c0f14',
        fontWeight: '700',
        letterSpacing: 0.5,
        fontSize: 16,
    },
    overlayWrapper: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        left: 0,
        alignItems: 'center',
    },
    kanaCard: {
        width: '90%',
        maxWidth: 520,
        minHeight: 320,
        maxHeight: 450,
        backgroundColor: 'transparent',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 12,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    title: {
        color: '#0f172a',
        fontWeight: '700',
        fontSize: 18,
    },
    subtitle: {
        color: '#475569',
        fontSize: 12,
    },
    close: {
        color: '#0f172a',
        fontWeight: '600',
        fontSize: 14,
    },
    newChatBtn: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 14,
        backgroundColor: 'rgba(91, 124, 255, 0)',
        borderWidth: 1,
        borderColor: '#000000ff',
    },
    newChatText: {
        color: '#000000ff',
        fontWeight: '700',
        fontSize: 13,
    },
    messageList: {
        paddingVertical: 6,
        gap: 10,
    },
    messageListContainer: {
        flex: 1,
    },
    bubble: {
        padding: 12,
        borderRadius: 14,
        maxWidth: '90%',
        borderWidth: 1,
    },
    bubbleUser: {
        alignSelf: 'flex-end',
        backgroundColor: '#5b7bff',
        borderColor: '#4c68e6',
    },
    bubbleAssistant: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.82)',
        borderColor: '#e2e8f0',
    },
    bubbleTextAssistant: {
        color: '#0f172a',
        lineHeight: 20,
    },
    bubbleTextUser: {
        color: '#ffffff',
        lineHeight: 20,
        fontWeight: '600',
    },
    blurLayer: {
        flex: 1,
        borderRadius: 18,
        overflow: 'hidden',
    },
    cardContent: {
        flex: 1,
        padding: 14,
    },
    inputRow: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-end',
        marginTop: 8,
    },
    input: {
        flex: 1,
        minHeight: 44,
        maxHeight: 120,
        backgroundColor: 'rgba(255,255,255,0.82)',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        color: '#0f172a',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    sendButton: {
        backgroundColor: '#5b7bff',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 76,
        shadowColor: '#5b7bff',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    recordButton: {
        backgroundColor: '#e2e8f0',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 60,
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    recordButtonActive: {
        backgroundColor: '#f87171',
        borderColor: '#ef4444',
    },
    sendLabel: {
        color: '#ffffff',
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    recordLabel: {
        color: '#0f172a',
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    errorText: {
        position: 'absolute',
        bottom: -20,
        left: 0,
        color: '#ef4444',
        fontSize: 11,
    },
    ttsControls: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
        flexWrap: 'wrap',
    },
    ttsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#e2e8f0',
        gap: 6,
    },
    ttsButtonActive: {
        backgroundColor: '#0f172a',
        borderColor: '#0f172a',
    },
    ttsButtonLoading: {
        opacity: 0.8,
    },
    ttsSecondaryButton: {
        backgroundColor: 'rgba(148, 163, 184, 0.18)',
        borderColor: '#cbd5e1',
    },
    ttsButtonDisabled: {
        opacity: 0.4,
    },
    ttsButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f172a',
    },
    ttsButtonTextActive: {
        color: '#ffffff',
    },
    ttsButtonDisabledText: {
        color: '#94a3b8',
    },
    ttsError: {
        marginTop: 6,
        color: '#ef4444',
        fontSize: 11,
    },
});

// Expose overlay to be rendered near the root
export const KanaOverlay = () => {
    // Provider already renders overlay; this is a placeholder for API symmetry
    return null;
};

