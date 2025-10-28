import React, { useEffect, useMemo, useRef } from 'react';
import {
    Animated,
    Easing,
    GestureResponderEvent,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';

interface AIAssistPanelProps {
    visible: boolean;
    title?: string;
    subtitle?: string;
    status?: 'processing' | 'ready' | 'error';
    message?: string;
    secondaryMessage?: string;
    suggestions?: string[];
    onClose: () => void;
    onSuggestionPress?: (suggestion: string) => void;
}

export const AIAssistPanel: React.FC<AIAssistPanelProps> = ({
    visible,
    title = 'AI Assistant',
    subtitle,
    status = 'processing',
    message,
    secondaryMessage,
    suggestions,
    onClose,
    onSuggestionPress,
}) => {
    const translateY = useRef(new Animated.Value(80)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: 260,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 220,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: 80,
                    duration: 200,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 180,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [opacity, translateY, visible]);

    const statusLabel = useMemo(() => {
        switch (status) {
            case 'processing':
                return 'Thinking…';
            case 'error':
                return 'Something went wrong';
            default:
                return undefined;
        }
    }, [status]);

    const renderSuggestion = (label: string) => (
        <TouchableOpacity
            key={label}
            style={styles.suggestion}
            onPress={(event: GestureResponderEvent) => {
                event.stopPropagation();
                onSuggestionPress?.(label);
            }}
        >
            <Text style={styles.suggestionText}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.backdrop} pointerEvents={visible ? 'auto' : 'none'}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={styles.dismissArea} />
                </TouchableWithoutFeedback>
                <Animated.View style={[styles.panelContainer, { opacity }]}> 
                    <Animated.View style={[styles.panel, { transform: [{ translateY }] }]}
                        pointerEvents="box-none"
                    >
                        <View style={styles.headerRow}>
                            <View style={styles.headerTextBlock}>
                                <Text style={styles.panelTitle}>{title}</Text>
                                {subtitle ? <Text style={styles.panelSubtitle}>{subtitle}</Text> : null}
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Text style={styles.closeLabel}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        {statusLabel ? <Text style={styles.statusLabel}>{statusLabel}</Text> : null}
                        {message ? <Text style={styles.message}>{message}</Text> : null}
                        {secondaryMessage ? (
                            <Text style={styles.secondaryMessage}>{secondaryMessage}</Text>
                        ) : null}
                        {Array.isArray(suggestions) && suggestions.length > 0 ? (
                            <View style={styles.suggestionsContainer}>
                                <Text style={styles.suggestionsHeading}>Try asking:</Text>
                                {suggestions.map(renderSuggestion)}
                            </View>
                        ) : null}
                    </Animated.View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.35)',
        justifyContent: 'flex-end',
    },
    dismissArea: {
        ...StyleSheet.absoluteFillObject,
    },
    panelContainer: {
        padding: 16,
    },
    panel: {
        backgroundColor: '#111827',
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(148, 163, 184, 0.25)',
        shadowColor: '#0f172a',
        shadowOpacity: 0.32,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTextBlock: {
        flex: 1,
        paddingRight: 16,
    },
    panelTitle: {
        color: '#E0E7FF',
        fontSize: 18,
        fontWeight: '700',
    },
    panelSubtitle: {
        color: '#94A3B8',
        marginTop: 4,
        fontSize: 13,
    },
    closeButton: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(148, 163, 184, 0.14)',
    },
    closeLabel: {
        fontSize: 14,
        color: '#E0E7FF',
    },
    statusLabel: {
        color: '#38BDF8',
        marginTop: 12,
        fontSize: 12,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    message: {
        marginTop: 8,
        color: '#F8FAFC',
        fontSize: 16,
        lineHeight: 22,
    },
    secondaryMessage: {
        marginTop: 8,
        color: '#94A3B8',
        fontSize: 13,
        lineHeight: 20,
    },
    suggestionsContainer: {
        marginTop: 16,
    },
    suggestionsHeading: {
        color: '#CBD5F5',
        fontSize: 12,
        marginBottom: 8,
        letterSpacing: 0.3,
    },
    suggestion: {
        paddingVertical: 9,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        borderRadius: 14,
        marginBottom: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(59, 130, 246, 0.4)',
    },
    suggestionText: {
        color: '#BFDBFE',
        fontSize: 14,
    },
});

export default AIAssistPanel;
