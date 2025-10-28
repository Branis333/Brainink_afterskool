/**
 * Notification Card Component
 * Reusable card component for displaying a single notification
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ViewStyle,
    Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NotificationItem, NotificationType } from '../../services/notificationsService';
import notificationsService from '../../services/notificationsService';

interface NotificationCardProps {
    notification: NotificationItem;
    onPress?: () => void;
    onDismiss?: () => void;
    style?: ViewStyle;
    compact?: boolean;
}

const NotificationCard: React.FC<NotificationCardProps> = ({
    notification,
    onPress,
    onDismiss,
    style,
    compact = false,
}) => {
    const typeEmoji = notificationsService.typeEmoji(notification.type as NotificationType);
    const typeLabel = notificationsService.formatTypeLabel(notification.type as NotificationType);

    const getTypeColor = (type: NotificationType): string => {
        switch (type) {
            case 'due_date':
                return '#ff9800';
            case 'daily_encouragement':
                return '#4caf50';
            case 'completion':
                return '#2196f3';
            default:
                return '#6200ea';
        }
    };

    const typeColor = getTypeColor(notification.type as NotificationType);
    const createdTime = formatTime(new Date(notification.created_at));

    if (compact) {
        return (
            <TouchableOpacity
                style={[styles.compactCard, !notification.is_read && styles.compactCardUnread, style]}
                onPress={onPress}
                activeOpacity={0.7}
            >
                <View style={styles.compactHeader}>
                    <Text style={styles.emoji}>{typeEmoji}</Text>
                    <View style={styles.compactTitleContainer}>
                        <Text
                            style={[
                                styles.compactTitle,
                                !notification.is_read && styles.compactTitleUnread,
                            ]}
                            numberOfLines={1}
                        >
                            {notification.title}
                        </Text>
                        <Text style={styles.compactTime}>{createdTime}</Text>
                    </View>
                    {!notification.is_read && <View style={styles.unreadDot} />}
                </View>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            style={[
                styles.card,
                !notification.is_read && styles.cardUnread,
                style,
            ]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {/* Left border indicator */}
            <View
                style={[
                    styles.leftBorder,
                    { backgroundColor: typeColor },
                    !notification.is_read && styles.leftBorderActive,
                ]}
            />

            {/* Content */}
            <View style={styles.cardContent}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.typeContainer}>
                        <Text style={styles.emoji}>{typeEmoji}</Text>
                        <Text
                            style={[
                                styles.typeLabel,
                                { color: typeColor },
                            ]}
                        >
                            {typeLabel}
                        </Text>
                    </View>
                    <Text style={styles.time}>{createdTime}</Text>
                </View>

                {/* Title */}
                <Text
                    style={[
                        styles.title,
                        !notification.is_read && styles.titleUnread,
                    ]}
                    numberOfLines={2}
                >
                    {notification.title}
                </Text>

                {/* Body */}
                <Text
                    style={styles.body}
                    numberOfLines={2}
                >
                    {notification.body}
                </Text>

                {/* Footer */}
                <View style={styles.footer}>
                    <View style={styles.badges}>
                        {!notification.is_read && (
                            <View style={[styles.badge, { backgroundColor: typeColor }]} />
                        )}
                    </View>
                    {onDismiss && (
                        <TouchableOpacity
                            onPress={onDismiss}
                            style={styles.dismissIcon}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <MaterialCommunityIcons
                                name="close-circle-outline"
                                size={18}
                                color="#999"
                            />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Right indicator for unread */}
            {!notification.is_read && (
                <View style={[styles.rightIndicator, { backgroundColor: typeColor }]} />
            )}
        </TouchableOpacity>
    );
};

// Helper function to format time
const formatTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
};

// Styles
const styles = StyleSheet.create({
    // Regular card
    card: {
        flexDirection: 'row',
        alignItems: 'stretch',
        backgroundColor: '#fff',
        borderRadius: 10,
        marginVertical: 4,
        overflow: 'hidden',
    },
    cardUnread: {
        backgroundColor: '#f9f7ff',
    },
    leftBorder: {
        width: 4,
    },
    leftBorderActive: {
        width: 4,
    },
    cardContent: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 12,
        gap: 6,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    typeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    emoji: {
        fontSize: 16,
    },
    typeLabel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    time: {
        fontSize: 11,
        color: '#999',
    },
    title: {
        fontSize: 13,
        fontWeight: '600',
        color: '#666',
    },
    titleUnread: {
        color: '#333',
        fontWeight: '700',
    },
    body: {
        fontSize: 12,
        color: '#999',
        lineHeight: 16,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    badges: {
        flexDirection: 'row',
        gap: 4,
    },
    badge: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    dismissIcon: {
        padding: 4,
    },
    rightIndicator: {
        width: 3,
    },

    // Compact card
    compactCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    compactCardUnread: {
        backgroundColor: '#f9f7ff',
    },
    compactHeader: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    compactTitleContainer: {
        flex: 1,
        gap: 2,
    },
    compactTitle: {
        fontSize: 13,
        fontWeight: '500',
        color: '#666',
    },
    compactTitleUnread: {
        color: '#333',
        fontWeight: '700',
    },
    compactTime: {
        fontSize: 11,
        color: '#999',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#6200ea',
    },
});

export default NotificationCard;
