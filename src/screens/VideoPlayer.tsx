import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';

type RootStackParamList = {
    VideoPlayer: { url: string; title?: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'VideoPlayer'>;

function getYouTubeId(url: string): string | null {
    try {
        // patterns: youtu.be/ID, watch?v=ID, embed/ID, shorts/ID
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
        if (id) return id;
        return null;
    } catch {
        return null;
    }
}

export default function VideoPlayerScreen({ route, navigation }: Props) {
    const { url, title } = route.params;

    const embedUrl = useMemo(() => {
        const id = getYouTubeId(url);
        if (!id) return url;
        return `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&modestbranding=1&rel=0`;
    }, [url]);

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="light-content" backgroundColor="#111827" />
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                    <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text numberOfLines={1} style={styles.headerTitle}>{title || 'Playing Video'}</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.playerWrapper}>
                <WebView
                    source={{ uri: embedUrl }}
                    allowsFullscreenVideo
                    javaScriptEnabled
                    domStorageEnabled
                    allowsInlineMediaPlayback
                    mediaPlaybackRequiresUserAction={false}
                    style={styles.webview}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111827' },
    header: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginHorizontal: 8, textAlign: 'center' },
    playerWrapper: { flex: 1, backgroundColor: '#000' },
    webview: { flex: 1 },
});
