/**
 * Objective Details Screen
 * Shows a single objective with its summary, related videos, and actions
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Image,
    Dimensions,
    StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import YouTubeIframe from 'react-native-youtube-iframe';
import { Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { notesService, ObjectiveItem, StudentNote, FlashcardsResponse, ObjectiveQuizResponse } from '../../services/notesService';

const { width } = Dimensions.get('window');
const VIDEO_CARD_WIDTH = Math.min(Math.round(width * 0.86), 440);
const VIDEO_HEIGHT = Math.round(VIDEO_CARD_WIDTH * 9 / 16); // 16:9 aspect

type NavigationProp = NativeStackNavigationProp<any>;
type RouteParams = RouteProp<{ params: { noteId: number; objectiveIndex: number } }, 'params'>;

interface Props {
    navigation: NavigationProp;
    route: RouteParams;
}

export const ObjectiveDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
    const { token } = useAuth();
    const { noteId, objectiveIndex } = route.params; // accept 0- or 1-based

    const [note, setNote] = useState<StudentNote | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const idx0 = useMemo(() => (objectiveIndex >= 1 ? objectiveIndex - 1 : objectiveIndex), [objectiveIndex]);

    useEffect(() => {
        const load = async () => {
            try {
                if (!token) throw new Error('No auth token');
                setLoading(true);
                const n = await notesService.getNoteById(noteId, token);
                setNote(n);
            } catch (e) {
                console.error('Objective load failed', e);
                Alert.alert('Error', 'Failed to load objective');
                navigation.goBack();
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [noteId, token]);

    const objective: ObjectiveItem | null = useMemo(() => {
        if (!note || !note.objectives || !Array.isArray(note.objectives)) return null;
        if (idx0 < 0 || idx0 >= note.objectives.length) return null;
        return note.objectives[idx0];
    }, [note, idx0]);

    const getYouTubeId = (url?: string): string | null => {
        if (!url) return null;
        try {
            const patterns = [
                /youtu\.be\/([a-zA-Z0-9_-]{6,})/i,
                /youtube\.com\/(?:watch\?v=|embed\/|shorts\/)([a-zA-Z0-9_-]{6,})/i,
                /youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{6,})/i,
            ];
            for (const re of patterns) {
                const m = url.match(re);
                if (m && m[1]) return m[1];
            }
            const u = new URL(url);
            const id = u.searchParams.get('v');
            return id || null;
        } catch {
            return null;
        }
    };

    // Use inline player like StudySession: show/hide per-card
    const [expandedVideoIndex, setExpandedVideoIndex] = useState<number | null>(null);
    const [playingIndex, setPlayingIndex] = useState<number | null>(null);

    const objectiveVideos = useMemo(() => {
        // Show videos as provided from backend; only dedupe exact same URL
        const list = objective?.videos || [];
        const seen = new Set<string>();
        const result: typeof list = [];
        for (const v of list) {
            const key = (v.url || '').trim();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            result.push(v);
        }
        return result;
    }, [objective]);
    // Toggle video expand/collapse and play state
    const toggleVideoPlayer = (index: number) => {
        setExpandedVideoIndex(prev => {
            const next = prev === index ? null : index;
            if (next !== null) setPlayingIndex(next); else setPlayingIndex(null);
            return next;
        });
    };

    const onGenerateQuiz = async () => {
        try {
            setBusy(true);
            // If routes exist, navigate; else show info.
            // navigation.navigate('ObjectiveQuizScreen', { noteId, objectiveIndex: idx0 + 1 });
            Alert.alert('Quiz', 'Quiz generation is triggered for this objective.');
        } finally {
            setBusy(false);
        }
    };

    const onGenerateFlashcards = async () => {
        try {
            setBusy(true);
            // navigation.navigate('FlashcardsScreen', { noteId, objectiveIndex: idx0 + 1 });
            Alert.alert('Flashcards', 'Flashcards generation is triggered for this objective.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={22} color="#1a1a1a" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>Objective Details</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>Loading objective…</Text>
                </View>
            ) : !objective ? (
                <View style={styles.loadingContainer}>
                    <Text style={styles.errorText}>Objective not found.</Text>
                </View>
            ) : (
                <ScrollView style={styles.scrollView} contentContainerStyle={{ padding: 20 }}>
                    <View style={styles.titleCard}>
                        <Text style={styles.noteTitle}>{note?.title || 'Note'}</Text>
                        {note?.subject ? (
                            <View style={styles.subjectBadge}>
                                <Ionicons name="book" size={16} color="#007AFF" />
                                <Text style={styles.subjectText}>{note.subject}</Text>
                            </View>
                        ) : null}
                        {objective?.summary ? (
                            <Text style={styles.description}>{objective.summary}</Text>
                        ) : null}
                    </View>

                    {objectiveVideos.length > 0 && (
                        <View style={styles.resourcesContainer}>
                            <Text style={styles.resourcesSectionTitle}>🎥 Video Resources</Text>
                            {objectiveVideos.map((v, i) => {
                                const vid = getYouTubeId(v.url || '') || '';
                                const embedUrl = vid ? `https://www.youtube.com/embed/${vid}?playsinline=1&modestbranding=1&rel=0` : (v.url || '');
                                const isExpanded = expandedVideoIndex === i;
                                return (
                                    <View key={i} style={styles.videoCard}>
                                        {!isExpanded ? (
                                            <TouchableOpacity activeOpacity={0.85} onPress={() => toggleVideoPlayer(i)}>
                                                <View style={styles.thumbnailWrapper}>
                                                    <Image
                                                        source={{ uri: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` }}
                                                        style={styles.thumbnail}
                                                        resizeMode="cover"
                                                    />
                                                    <View style={styles.playOverlay}>
                                                        <View style={styles.playButton}>
                                                            <Ionicons name="play" size={20} color="#fff" />
                                                        </View>
                                                    </View>
                                                </View>
                                            </TouchableOpacity>
                                        ) : (
                                            <View style={styles.playerWrapper}>
                                                {vid ? (
                                                    <YouTubeIframe
                                                        height={220}
                                                        play={playingIndex === i}
                                                        mute
                                                        initialPlayerParams={{ controls: 1, modestbranding: true, rel: false, playsinline: true }}
                                                        videoId={vid}
                                                        onReady={() => { if (expandedVideoIndex === i) setPlayingIndex(i); }}
                                                        onError={() => { Alert.alert('Video unavailable', 'Opening on YouTube instead.'); Linking.openURL(`https://www.youtube.com/watch?v=${vid}`); }}
                                                        webViewProps={{ style: styles.player, allowsFullscreenVideo: true, allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: true, startInLoadingState: true, setSupportMultipleWindows: false }}
                                                    />
                                                ) : (
                                                    <WebView
                                                        originWhitelist={["https://*"]}
                                                        source={{ uri: embedUrl }}
                                                        allowsFullscreenVideo
                                                        javaScriptEnabled={true}
                                                        domStorageEnabled={true}
                                                        allowsInlineMediaPlayback={true}
                                                        mediaPlaybackRequiresUserAction={true}
                                                        startInLoadingState={true}
                                                        setSupportMultipleWindows={false}
                                                        androidHardwareAccelerationDisabled={false}
                                                        mixedContentMode="always"
                                                        onError={() => { const target = v.url || ''; if (target) Linking.openURL(target); }}
                                                        onHttpError={() => { const target = v.url || ''; if (target) Linking.openURL(target); }}
                                                        style={styles.player}
                                                    />
                                                )}
                                            </View>
                                        )}

                                        <View style={styles.videoMeta}>
                                            <Text style={styles.videoTitle} numberOfLines={2}>{v.title || 'Video'}</Text>
                                            {v.channel && (
                                                <Text style={styles.videoChannel} numberOfLines={1}>{v.channel}</Text>
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    <View style={styles.actionsRow}>
                        <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.7 }]} disabled={busy} onPress={onGenerateQuiz}>
                            <Ionicons name="help-circle" size={20} color="#FFFFFF" />
                            <Text style={styles.primaryBtnText}>Generate Quiz</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.secondaryBtn, busy && { opacity: 0.7 }]} disabled={busy} onPress={onGenerateFlashcards}>
                            <Ionicons name="albums" size={20} color="#3B82F6" />
                            <Text style={styles.secondaryBtnText}>Flash Cards</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 16, fontSize: 16, color: '#666', fontWeight: '500' },
    errorText: { fontSize: 18, color: '#FF3B30', fontWeight: '600' },
    header: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a', flex: 1, textAlign: 'center' },
    scrollView: { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },
    titleCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
    noteTitle: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 },
    subjectBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#E3F2FD', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 8, gap: 6 },
    subjectText: { fontSize: 14, color: '#007AFF', fontWeight: '600' },
    description: { fontSize: 15, color: '#444', lineHeight: 22, marginTop: 4 },
    resourcesContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
    resourcesSectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
    videoCard: { backgroundColor: '#121212', borderRadius: 16, marginBottom: 16, overflow: 'hidden' },
    thumbnailWrapper: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#0a0a0a' },
    thumbnail: { width: '100%', height: '100%' },
    playOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    playButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
    playerWrapper: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
    player: { flex: 1, backgroundColor: '#000' },
    videoMeta: { paddingHorizontal: 12, paddingVertical: 10 },
    videoTitle: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 4 },
    videoChannel: { fontSize: 12, color: '#b3b3b3' },
    actionsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
    primaryBtn: { flex: 1, backgroundColor: '#3B82F6', paddingVertical: 14, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    primaryBtnText: { color: '#FFFFFF', fontWeight: '700' },
    secondaryBtn: { flex: 1, backgroundColor: '#E8F0FE', paddingVertical: 14, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    secondaryBtnText: { color: '#3B82F6', fontWeight: '700' },
});
