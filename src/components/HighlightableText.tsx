import React from 'react';
import { StyleSheet, Text, TextProps, View } from 'react-native';

export interface HighlightRange {
    start: number;
    end: number;
    tone?: 'info' | 'success' | 'warning';
    // Optional visual weight for advanced modes like ghost-highlights
    // 'current' = stronger emphasis; 'ghost' = faint preview
    weight?: 'current' | 'ghost';
}

interface HighlightableTextProps extends TextProps {
    text: string;
    highlightRanges?: HighlightRange[];
}

const toneColors: Record<NonNullable<HighlightRange['tone']>, { backgroundColor: string }> = {
    info: { backgroundColor: 'rgba(96, 165, 250, 0.28)' },
    success: { backgroundColor: 'rgba(74, 222, 128, 0.30)' },
    warning: { backgroundColor: 'rgba(251, 191, 36, 0.30)' },
};

// Ghost variants (fainter)
const ghostToneColors: Record<NonNullable<HighlightRange['tone']>, { backgroundColor: string; borderColor: string }> = {
    info: { backgroundColor: 'rgba(96, 165, 250, 0.12)', borderColor: 'rgba(96, 165, 250, 0.35)' },
    success: { backgroundColor: 'rgba(74, 222, 128, 0.12)', borderColor: 'rgba(74, 222, 128, 0.35)' },
    warning: { backgroundColor: 'rgba(251, 191, 36, 0.12)', borderColor: 'rgba(251, 191, 36, 0.35)' },
};

export const HighlightableText: React.FC<HighlightableTextProps> = ({
    text,
    highlightRanges = [],
    style,
    selectable = true,
    ...rest
}) => {
    if (!highlightRanges.length) {
        return (
            <Text style={[styles.text, style]} selectable={selectable} {...rest}>
                {text}
            </Text>
        );
    }

    const sortedRanges = highlightRanges
        .filter((range) => range.start < range.end && range.start >= 0 && range.end <= text.length)
        .sort((a, b) => a.start - b.start);

    const builds: Array<{ key: string; value: string; highlighted?: boolean; tone?: HighlightRange['tone'] }> = [];
    let cursor = 0;
    sortedRanges.forEach((range, index) => {
        if (cursor < range.start) {
            builds.push({ key: `plain-${cursor}-${range.start}`, value: text.slice(cursor, range.start) });
        }
        builds.push({
            key: `hl-${index}`,
            value: text.slice(range.start, range.end),
            highlighted: true,
            tone: range.tone,
        });
        cursor = range.end;
    });
    if (cursor < text.length) {
        builds.push({ key: `plain-tail-${cursor}`, value: text.slice(cursor) });
    }

    return (
        <View>
            <Text selectable={selectable} {...rest}>
                {builds.map((part) => {
                    if (!part.highlighted) {
                        return (
                            <Text key={part.key} selectable={selectable} style={[styles.text, style]}>
                                {part.value}
                            </Text>
                        );
                    }

                    const tone = part.tone || 'info';
                    const weight = (part as any).weight as HighlightRange['weight'];
                    if (weight === 'ghost') {
                        return (
                            <Text
                                key={part.key}
                                selectable={selectable}
                                style={[styles.highlightGhost, ghostToneColors[tone], style]}
                            >
                                {part.value}
                            </Text>
                        );
                    }

                    // current or default
                    return (
                        <Text
                            key={part.key}
                            selectable={selectable}
                            style={[styles.highlightCurrent, toneColors[tone], style]}
                        >
                            {part.value}
                        </Text>
                    );
                })}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    text: {
        color: '#0f172a',
    },
    highlightCurrent: {
        backgroundColor: 'rgba(96, 165, 250, 0.28)',
        fontWeight: '700',
        borderRadius: 4,
        paddingHorizontal: 1,
    },
    highlightGhost: {
        backgroundColor: 'rgba(96, 165, 250, 0.12)',
        borderRadius: 4,
        paddingHorizontal: 1,
        borderWidth: StyleSheet.hairlineWidth,
    },
});

export default HighlightableText;
