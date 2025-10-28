import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Easing,
    TextInput,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ScrollView,
} from 'react-native';
import { TutorCheckpointPrompt } from '../services/aiTutorService';

export type AuroraCueVariant = 'spark' | 'warn';

export interface AuroraCueData {
    id: string;
    title: string;
    message: string;
    prompts?: string[];
    variant?: AuroraCueVariant;
}

export interface AuroraGuideProps {
    enabled: boolean;
    anchorOpen: boolean;
    status: 'idle' | 'loading' | 'ready' | 'error';
    title?: string;
    summary?: string;
    message?: string;
    suggestions?: string[];
    comprehensionCheck?: string | null;
    checkpoint?: TutorCheckpointPrompt | null;
    cue?: AuroraCueData | null;
    walkthroughActive?: boolean;
    walkthroughLoading?: boolean;
    onWalkNext?: () => void;
    onWalkPrev?: () => void;
    walkStepLabel?: string;
    postWalkthroughActionLabel?: string;
    postWalkthroughActionDisabled?: boolean;
    onToggleAnchor: () => void;
    onSuggestionPress?: (suggestion: string) => void;
    onCuePromptPress?: (prompt: string) => void;
    onDismissCue?: () => void;
    onPostWalkthroughAction?: () => void;
    onAnswerComprehension?: (answer: 'true' | 'false') => void;
    onSubmitReflection?: (notes: string) => void;
    onAnswerFreeform?: (answer: string) => void;
    onSubmitQuizNotes?: (notes: string) => void;
    onSubmitPhotoCheckpoint?: () => void;
}

export type AuroraMicrocardTone = 'insight' | 'practice' | 'context' | 'alert';

export interface AuroraMicrocardData {
    id: string;
    tone: AuroraMicrocardTone;
    headline: string;
    body: string;
    footnote?: string;
    prompts?: string[];
    score?: number;
}

interface AuroraMicrocardProps extends AuroraMicrocardData {
    onPromptPress?: (prompt: string) => void;
}

const toneStyles: Record<AuroraMicrocardTone, { backgroundColor: string; borderColor: string; highlight: string }> = {
    insight: {
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        borderColor: 'rgba(59, 130, 246, 0.35)',
        highlight: '#1D4ED8',
    },
    practice: {
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderColor: 'rgba(16, 185, 129, 0.35)',
        highlight: '#047857',
    },
    context: {
        backgroundColor: 'rgba(14, 165, 233, 0.12)',
        borderColor: 'rgba(14, 165, 233, 0.35)',
        highlight: '#0369A1',
    },
    alert: {
        backgroundColor: 'rgba(249, 115, 22, 0.15)',
        borderColor: 'rgba(249, 115, 22, 0.35)',
        highlight: '#C2410C',
    },
};

const cueVariantStyles: Record<AuroraCueVariant, { backgroundColor: string; borderColor: string; title: string }> = {
    spark: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 0.4)',
        title: '#1D4ED8',
    },
    warn: {
        backgroundColor: 'rgba(249, 115, 22, 0.2)',
        borderColor: 'rgba(249, 115, 22, 0.4)',
        title: '#C2410C',
    },
};

export const AuroraMicrocard: React.FC<AuroraMicrocardProps> = ({
    tone,
    headline,
    body,
    footnote,
    prompts,
    score,
    onPromptPress,
}) => {
    const palette = toneStyles[tone] ?? toneStyles.insight;

    const getScoreChipPalette = (value: number) => {
        const s = Math.max(0, Math.min(100, Math.round(value)));
        if (s >= 80) {
            // Green
            return {
                border: '#10B981',
                background: 'rgba(16, 185, 129, 0.18)',
                text: '#065F46',
            };
        }
        if (s >= 60) {
            // Amber
            return {
                border: '#F59E0B',
                background: 'rgba(245, 158, 11, 0.2)',
                text: '#92400E',
            };
        }
        // Red
        return {
            border: '#EF4444',
            background: 'rgba(239, 68, 68, 0.2)',
            text: '#991B1B',
        };
    };

    return (
        <View style={[styles.microcard, { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }]}
            accessible accessibilityRole="summary"
        >
            <View style={styles.microcardHeaderRow}>
                <Text style={[styles.microcardHeadline, { color: palette.highlight }]}>{headline}</Text>
                {typeof score === 'number' ? (
                    <View style={[styles.scoreChip, (() => { const c = getScoreChipPalette(score); return { borderColor: c.border, backgroundColor: c.background }; })()]}> 
                        <Text style={[styles.scoreChipLabel, (() => { const c = getScoreChipPalette(score); return { color: c.text }; })()]}>
                            {Math.round(score)}/100
                        </Text>
                    </View>
                ) : null}
            </View>
            <Text style={styles.microcardBody}>{body}</Text>
            {footnote ? <Text style={styles.microcardFootnote}>{footnote}</Text> : null}
            {Array.isArray(prompts) && prompts.length > 0 ? (
                <View style={styles.microcardPromptRow}>
                    {prompts.slice(0, 3).map((prompt) => (
                        <TouchableOpacity
                            key={prompt}
                            onPress={() => onPromptPress?.(prompt)}
                            style={[styles.chip, { borderColor: palette.highlight, backgroundColor: 'rgba(255,255,255,0.55)' }]}>
                            <Text style={[styles.chipLabel, { color: palette.highlight }]}>{prompt}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            ) : null}
        </View>
    );
};

export const AuroraGuide: React.FC<AuroraGuideProps> = ({
    enabled,
    anchorOpen,
    status,
    title = 'Aurora Guide',
    summary,
    message,
    suggestions,
    comprehensionCheck,
    checkpoint,
    cue,
    walkthroughActive = false,
    walkthroughLoading = false,
    onWalkNext,
    onWalkPrev,
    walkStepLabel,
    postWalkthroughActionLabel,
    postWalkthroughActionDisabled,
    onToggleAnchor,
    onSuggestionPress,
    onCuePromptPress,
    onDismissCue,
    onPostWalkthroughAction,
    onAnswerComprehension,
    onSubmitReflection,
    onAnswerFreeform,
    onSubmitQuizNotes,
    onSubmitPhotoCheckpoint,
}) => {
    const activation = useRef(new Animated.Value(enabled ? 1 : 0)).current;
    const panelOpacity = useRef(new Animated.Value(anchorOpen ? 1 : 0)).current;
    const panelTranslate = useRef(new Animated.Value(anchorOpen ? 0 : 40)).current;
    const [reflectionText, setReflectionText] = useState('');
    const [answerText, setAnswerText] = useState('');

    useEffect(() => {
        Animated.timing(activation, {
            toValue: enabled ? 1 : 0,
            duration: 240,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad),
        }).start();
    }, [activation, enabled]);

    useEffect(() => {
        Animated.parallel([
            Animated.timing(panelOpacity, {
                toValue: anchorOpen ? 1 : 0,
                duration: anchorOpen ? 220 : 180,
                easing: anchorOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(panelTranslate, {
                toValue: anchorOpen ? 0 : 40,
                duration: anchorOpen ? 240 : 200,
                easing: anchorOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, [anchorOpen, panelOpacity, panelTranslate]);

    const cuePalette = useMemo(() =>
        cue ? cueVariantStyles[cue.variant ?? 'spark'] : null,
    [cue]);

    if (!enabled) {
        return null;
    }

    return (
        <View pointerEvents="box-none" style={styles.overlayContainer}>
            {cue && cuePalette ? (
                <Animated.View style={[styles.cueContainer, { opacity: activation }]}
                    pointerEvents="box-none"
                >
                    <Pressable
                        style={[styles.cueCard, {
                            backgroundColor: cuePalette.backgroundColor,
                            borderColor: cuePalette.borderColor,
                        }]}
                        accessibilityRole="button"
                        onPress={() => {
                            const prompt = cue.prompts?.[0];
                            if (prompt) {
                                onCuePromptPress?.(prompt);
                            }
                        }}
                    >
                        <View style={styles.cueHeaderRow}>
                            <Text style={[styles.cueTitle, { color: cuePalette.title }]}>{cue.title}</Text>
                            <TouchableOpacity
                                accessibilityLabel="Dismiss Aurora cue"
                                onPress={(event) => {
                                    event.stopPropagation();
                                    onDismissCue?.();
                                }}
                                style={styles.cueDismissButton}
                            >
                                <Text style={styles.cueDismissLabel}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.cueMessage}>{cue.message}</Text>
                        {Array.isArray(cue.prompts) && cue.prompts.length > 0 ? (
                            <View style={styles.cuePromptRow}>
                                {cue.prompts.map((prompt) => (
                                    <TouchableOpacity
                                        key={prompt}
                                        onPress={(event) => {
                                            event.stopPropagation();
                                            onCuePromptPress?.(prompt);
                                        }}
                                        style={[styles.chip, { borderColor: cuePalette.title }]}
                                    >
                                        <Text style={[styles.chipLabel, { color: cuePalette.title }]}>{prompt}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : null}
                    </Pressable>
                </Animated.View>
            ) : null}

            <Animated.View
                pointerEvents="box-none"
                style={[styles.anchorRegion, { transform: [{ scale: activation }] }]}
            >
                <Animated.View
                    pointerEvents={anchorOpen ? 'auto' : 'none'}
                    style={[styles.panel, {
                        opacity: panelOpacity,
                        transform: [{ translateY: panelTranslate }],
                    }]}
                >
                    <Text style={styles.panelTitle}>{title}</Text>
                    {summary ? (
                        <Text style={styles.panelSummary}>{summary}</Text>
                    ) : null}
                    <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelScrollContent}>
                        {message ? (
                            <Text style={styles.panelMessage}>{message}</Text>
                        ) : null}
                    {status === 'error' ? (
                        <Text style={styles.panelError}>Aurora ran into a snag. Try again.</Text>
                    ) : null}
                    {status === 'loading' ? (
                        <View style={styles.panelLoadingRow}>
                            <ActivityIndicator color="#C7D2FE" size="small" />
                            <Text style={styles.panelLoadingLabel}>Aurora is thinking…</Text>
                        </View>
                    ) : null}
                    {comprehensionCheck ? (
                        <View style={styles.checkCard}>
                            <Text style={styles.checkCardTitle}>💭 Question for you:</Text>
                            <Text style={styles.checkCardText}>{comprehensionCheck}</Text>
                            {/(^\s*true\s*or\s*false\b)|(^\s*is\s+this\s+true\b)/i.test(comprehensionCheck) ? (
                                <View style={styles.answerRow}>
                                    <TouchableOpacity
                                        style={[styles.answerBtn, styles.answerTrue]}
                                        accessibilityLabel="Answer True"
                                        onPress={() => onAnswerComprehension?.('true')}
                                        disabled={!onAnswerComprehension || status === 'loading'}
                                    >
                                        <Text style={styles.answerBtnLabel}>True</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.answerBtn, styles.answerFalse]}
                                        accessibilityLabel="Answer False"
                                        onPress={() => onAnswerComprehension?.('false')}
                                        disabled={!onAnswerComprehension || status === 'loading'}
                                    >
                                        <Text style={styles.answerBtnLabel}>False</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={{ marginTop: 10 }}>
                                    <TextInput
                                        style={styles.reflectionInput}
                                        placeholder="Type your answer..."
                                        placeholderTextColor="#6B7280"
                                        multiline
                                        value={answerText}
                                        onChangeText={setAnswerText}
                                    />
                                    <TouchableOpacity
                                        style={[styles.reflectionSubmitBtn, !answerText?.trim() && { opacity: 0.6 }]}
                                        onPress={() => {
                                            const val = answerText.trim();
                                            if (!val) return;
                                            onAnswerFreeform?.(val);
                                            setAnswerText('');
                                        }}
                                        disabled={!onAnswerFreeform || !answerText.trim() || status === 'loading'}
                                    >
                                        <Text style={styles.reflectionSubmitLabel}>Send answer</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    ) : null}
                    {checkpoint && checkpoint.instructions ? (
                        <View style={styles.checkpointCard}>
                            <Text style={styles.checkpointTitle}>✓ Checkpoint:</Text>
                            {checkpoint.checkpoint_type ? (
                                <View
                                    style={[
                                        styles.checkpointTypeBadge,
                                        {
                                            backgroundColor:
                                                checkpoint.checkpoint_type === 'reflection'
                                                    ? 'rgba(59,130,246,0.15)'
                                                    : checkpoint.checkpoint_type === 'photo'
                                                    ? 'rgba(16,185,129,0.2)'
                                                    : 'rgba(245,158,11,0.2)',
                                        },
                                    ]}
                                >
                                    <Text style={[styles.checkpointTypeLabel, { color: '#111827' }]}>
                                        {checkpoint.checkpoint_type.toUpperCase()}
                                    </Text>
                                </View>
                            ) : null}
                            <Text style={styles.checkpointText}>{checkpoint.instructions}</Text>
                            {(() => { const list = (checkpoint as any)?.tips || (checkpoint as any)?.criteria; return Array.isArray(list) && list.length > 0; })() ? (
                                <View style={styles.tipsList}>
                                    {((checkpoint as any)?.tips || (checkpoint as any)?.criteria).slice(0, 4).map((tip: string, idx: number) => (
                                        <Text key={idx} style={styles.tipItem}>• {tip}</Text>
                                    ))}
                                </View>
                            ) : null}

                            {checkpoint.checkpoint_type === 'reflection' ? (
                                <View style={{ marginTop: 10 }}>
                                    <TextInput
                                        style={styles.reflectionInput}
                                        placeholder="Type your reflection..."
                                        placeholderTextColor="#6B7280"
                                        multiline
                                        value={reflectionText}
                                        onChangeText={setReflectionText}
                                        accessibilityLabel="Reflection input"
                                    />
                                    <TouchableOpacity
                                        style={[styles.reflectionSubmitBtn, !reflectionText?.trim() && { opacity: 0.6 }]}
                                        onPress={() => {
                                            const notes = reflectionText.trim();
                                            if (!notes) return;
                                            onSubmitReflection?.(notes);
                                            setReflectionText('');
                                        }}
                                        accessibilityLabel="Submit reflection"
                                        disabled={!onSubmitReflection || !reflectionText.trim() || status === 'loading'}
                                    >
                                        <Text style={styles.reflectionSubmitLabel}>Submit Reflection</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : null}

                            {checkpoint.checkpoint_type === 'quiz' ? (
                                <View style={{ marginTop: 10 }}>
                                    <TextInput
                                        style={styles.reflectionInput}
                                        placeholder="Type your answers..."
                                        placeholderTextColor="#6B7280"
                                        multiline
                                        value={reflectionText}
                                        onChangeText={setReflectionText}
                                        accessibilityLabel="Quiz answer input"
                                    />
                                    <View style={styles.answerRow}>
                                        <TouchableOpacity
                                            style={[styles.reflectionSubmitBtn, !reflectionText?.trim() && { opacity: 0.6 }]}
                                            onPress={() => {
                                                const notes = reflectionText.trim();
                                                if (!notes) return;
                                                onSubmitQuizNotes?.(notes);
                                                setReflectionText('');
                                            }}
                                            accessibilityLabel="Submit quiz notes"
                                            disabled={!onSubmitQuizNotes || !reflectionText.trim() || status === 'loading'}
                                        >
                                            <Text style={styles.reflectionSubmitLabel}>Submit notes</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.reflectionSubmitBtn}
                                            onPress={onSubmitPhotoCheckpoint}
                                            accessibilityLabel="Submit photo of work"
                                            disabled={!onSubmitPhotoCheckpoint || status === 'loading'}
                                        >
                                            <Text style={styles.reflectionSubmitLabel}>Submit photo of work</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : null}
                        </View>
                    ) : null}
                    {status !== 'loading' && Array.isArray(suggestions) && suggestions.length > 0 ? (
                        <View style={styles.panelSuggestions}>
                            {suggestions.slice(0, 4).map((suggestion) => (
                                <TouchableOpacity
                                    key={suggestion}
                                    onPress={() => onSuggestionPress?.(suggestion)}
                                    style={styles.chip}
                                >
                                    <Text style={styles.chipLabel}>{suggestion}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : null}
                    </ScrollView>
                    {walkthroughActive ? (
                        <View style={styles.walkthroughRow}>
                            <TouchableOpacity
                                onPress={onWalkPrev}
                                disabled={!onWalkPrev || walkthroughLoading}
                                style={[
                                    styles.walkthroughButton,
                                    (!onWalkPrev || walkthroughLoading) && styles.walkthroughButtonDisabled,
                                ]}
                                accessibilityLabel="Previous step"
                            >
                                <Text style={styles.walkthroughButtonText}>←</Text>
                            </TouchableOpacity>
                            <View style={styles.walkthroughStatus}>
                                {walkthroughLoading ? (
                                    <View style={styles.walkthroughLoadingRow}>
                                        <ActivityIndicator size="small" color="#C7D2FE" />
                                        <Text style={styles.walkthroughLoadingLabel}>Preparing next step…</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.walkthroughLabel}>{walkStepLabel || 'Guided walkthrough'}</Text>
                                )}
                            </View>
                            <TouchableOpacity
                                onPress={onWalkNext}
                                disabled={!onWalkNext || walkthroughLoading}
                                style={[
                                    styles.walkthroughButton,
                                    (!onWalkNext || walkthroughLoading) && styles.walkthroughButtonDisabled,
                                ]}
                                accessibilityLabel="Next step"
                            >
                                <Text style={styles.walkthroughButtonText}>→</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}
                    {!walkthroughActive && postWalkthroughActionLabel ? (
                        <TouchableOpacity
                            onPress={onPostWalkthroughAction}
                            disabled={postWalkthroughActionDisabled}
                            style={[
                                styles.postWalkthroughButton,
                                postWalkthroughActionDisabled && styles.postWalkthroughButtonDisabled,
                            ]}
                        >
                            <Text style={styles.postWalkthroughButtonText}>{postWalkthroughActionLabel}</Text>
                        </TouchableOpacity>
                    ) : null}
                </Animated.View>

                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Toggle Aurora Guide"
                    onPress={onToggleAnchor}
                    style={styles.anchorButton}
                >
                    <View style={styles.anchorHalo} />
                    <Text style={styles.anchorLabel}>{status === 'loading' ? '…' : 'Aurora'}</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlayContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        padding: 16,
    },
    cueContainer: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 160,
    },
    cueCard: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
    },
    cueHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    cueTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    cueMessage: {
        fontSize: 13,
        color: '#1f2937',
        lineHeight: 18,
    },
    cuePromptRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 10,
        gap: 8,
    },
    cueDismissButton: {
        padding: 4,
        borderRadius: 12,
    },
    cueDismissLabel: {
        fontSize: 14,
        color: '#1f2937',
    },
    anchorRegion: {
        alignItems: 'flex-end',
    },
    panel: {
        backgroundColor: 'rgba(17, 24, 39, 0.94)',
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderRadius: 18,
        marginBottom: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(148, 163, 184, 0.28)',
        width: Math.min(320, 0.88 * 360),
    },
    panelTitle: {
        color: '#E0E7FF',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    panelSummary: {
        color: '#A5B4FC',
        fontSize: 12,
        marginBottom: 6,
    },
    panelMessage: {
        color: '#F8FAFC',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 10,
    },
    panelError: {
        color: '#FCA5A5',
        fontSize: 12,
        marginBottom: 8,
    },
    panelLoadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    panelLoadingLabel: {
        color: '#E0E7FF',
        fontSize: 13,
    },
    panelSuggestions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    walkthroughRow: {
        marginTop: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    walkthroughButton: {
        width: 44,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(59, 130, 246, 0.22)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(59, 130, 246, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    walkthroughButtonDisabled: {
        opacity: 0.4,
    },
    walkthroughButtonText: {
        color: '#E0E7FF',
        fontSize: 16,
        fontWeight: '700',
    },
    walkthroughStatus: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 36,
    },
    panelScroll: {
        maxHeight: 340,
        marginBottom: 8,
    },
    panelScrollContent: {
        paddingBottom: 6,
    },
    walkthroughLoadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    walkthroughLoadingLabel: {
        color: '#C7D2FE',
        fontSize: 12,
        fontWeight: '600',
    },
    postWalkthroughButton: {
        marginTop: 14,
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(59, 130, 246, 0.22)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(59, 130, 246, 0.4)',
        alignItems: 'center',
    },
    postWalkthroughButtonDisabled: {
        opacity: 0.5,
    },
    postWalkthroughButtonText: {
        color: '#E0E7FF',
        fontSize: 13,
        fontWeight: '600',
    },
    walkthroughLabel: {
        flex: 1,
        textAlign: 'center',
        color: '#C7D2FE',
        fontSize: 13,
        fontWeight: '600',
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: 'rgba(59, 130, 246, 0.18)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(59, 130, 246, 0.4)',
    },
    chipLabel: {
        color: '#BFDBFE',
        fontSize: 12,
        fontWeight: '600',
    },
    anchorButton: {
        width: 68,
        height: 68,
        borderRadius: 34,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#312E81',
        borderWidth: 2,
        borderColor: 'rgba(99, 102, 241, 0.7)',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 6,
    },
    anchorHalo: {
        position: 'absolute',
        width: 82,
        height: 82,
        borderRadius: 41,
        backgroundColor: 'rgba(129, 140, 248, 0.25)',
    },
    anchorLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#F8FAFC',
    },
    microcard: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginTop: 16,
    },
    microcardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    microcardHeadline: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    scoreChip: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255,255,255,0.7)',
    },
    scoreChipLabel: {
        fontSize: 12,
        fontWeight: '700',
    },
    microcardBody: {
        fontSize: 13,
        color: '#1f2937',
        lineHeight: 18,
    },
    microcardFootnote: {
        fontSize: 11,
        color: '#475569',
        marginTop: 8,
    },
    microcardPromptRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 10,
        gap: 8,
    },
    comprehensionCheckCard: {
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        borderColor: 'rgba(59, 130, 246, 0.35)',
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginVertical: 10,
    },
    comprehensionCheckTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1D4ED8',
        marginBottom: 8,
    },
    comprehensionCheckQuestion: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 10,
        lineHeight: 20,
    },
    choicesList: {
        marginTop: 8,
    },
    choiceItem: {
        paddingVertical: 6,
        paddingHorizontal: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        borderRadius: 4,
        marginVertical: 4,
    },
    choiceText: {
        fontSize: 13,
        color: '#374151',
    },
    checkCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        borderLeftWidth: 3,
        borderLeftColor: '#1D4ED8',
        padding: 12,
        marginVertical: 10,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(148, 163, 184, 0.6)'
    },
    checkCardTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1D4ED8',
        marginBottom: 6,
    },
    checkCardText: {
        fontSize: 13,
        color: '#111827',
        lineHeight: 19,
    },
    checkpointCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        borderLeftWidth: 3,
        borderLeftColor: '#C2410C',
        padding: 12,
        marginVertical: 10,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(148, 163, 184, 0.6)'
    },
    checkpointTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#C2410C',
        marginBottom: 6,
    },
    checkpointText: {
        fontSize: 13,
        color: '#111827',
        lineHeight: 19,
    },
    checkpointTypeBadge: {
        display: 'flex',
        borderRadius: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        marginBottom: 8,
        alignSelf: 'flex-start',
    },
    checkpointTypeLabel: {
        fontSize: 11,
        fontWeight: '700',
    },
    checkpointInstructions: {
        fontSize: 13,
        color: '#374151',
        lineHeight: 19,
        marginBottom: 8,
    },
    tipsList: {
        marginTop: 8,
    },
    tipItem: {
        fontSize: 12,
        color: '#6B7280',
        marginVertical: 4,
    },
    answerRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    answerBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
    },
    answerTrue: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: 'rgba(16, 185, 129, 0.5)',
    },
    answerFalse: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderColor: 'rgba(239, 68, 68, 0.5)',
    },
    answerBtnLabel: {
        color: '#111827',
        fontSize: 13,
        fontWeight: '700',
    },
    reflectionInput: {
        minHeight: 64,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(148, 163, 184, 0.6)',
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 10,
        paddingVertical: 8,
        color: '#111827',
    },
    reflectionSubmitBtn: {
        marginTop: 8,
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(59, 130, 246, 0.22)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(59, 130, 246, 0.4)',
    },
    reflectionSubmitLabel: {
        color: '#E0E7FF',
        fontSize: 12,
        fontWeight: '700',
    },
});
