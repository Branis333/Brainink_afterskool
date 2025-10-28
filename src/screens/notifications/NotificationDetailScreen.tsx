/**
 * Notification Detail Screen
 * Shows full details of a single notification
 */

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import notificationsService, { NotificationItem, NotificationType } from '../../services/notificationsService';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

interface NotificationDetailScreenProps {
    route: {
        params: {
            notification: NotificationItem;
        };
    };
    navigation: any;
}

const NotificationDetailScreen: React.FC<NotificationDetailScreenProps> = ({
    route,
    navigation,
}) => {
    const { notification: initialNotification } = route.params;
    const { token, user } = useAuth();
    const [notification, setNotification] = useState(initialNotification);
    const [loading, setLoading] = useState(false);

    // Mark as read on mount if not already read
    useEffect(() => {
        const markAsRead = async () => {
            if (!notification.is_read && token) {
                try {
                    setLoading(true);
                    await notificationsService.markAsRead(token, notification.id);
                    setNotification({ ...notification, is_read: true });
                } catch (err) {
                    console.error('Error marking notification as read:', err);
                } finally {
                    setLoading(false);
                }
            }
        };

        markAsRead();
    }, [notification, token]);

    const handleDismiss = async () => {
        if (!token) return;
        try {
            setLoading(true);
            await notificationsService.dismiss(token, notification.id);
            navigation.goBack();
        } catch (err) {
            console.error('Error dismissing notification:', err);
            setLoading(false);
        }
    };

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

    const getTypeIcon = (type: NotificationType): any => {
        switch (type) {
            case 'due_date':
                return 'calendar-clock';
            case 'daily_encouragement':
                return 'star';
            case 'completion':
                return 'check-circle';
            default:
                return 'bell';
        }
    };

    const typeColor = getTypeColor(notification.type as NotificationType);
    const typeIcon = getTypeIcon(notification.type as NotificationType);
    const createdDate = new Date(notification.created_at);
    const readDate = notification.read_at ? new Date(notification.read_at) : null;
    const dismissedDate = notification.dismissed_at ? new Date(notification.dismissed_at) : null;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <MaterialCommunityIcons name="chevron-left" size={28} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Details</Text>
                <TouchableOpacity
                    onPress={handleDismiss}
                    style={styles.headerAction}
                    disabled={loading}
                >
                    <MaterialCommunityIcons name="delete-outline" size={24} color="#d32f2f" />
                </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* Type Badge */}
                <View style={[styles.typeBadge, { backgroundColor: `${typeColor}20` }]}>
                    <MaterialCommunityIcons
                        name={typeIcon}
                        size={28}
                        color={typeColor}
                    />
                    <Text style={[styles.typeLabel, { color: typeColor }]}>
                        {notificationsService.formatTypeLabel(
                            notification.type as NotificationType
                        )}
                    </Text>
                </View>

                {/* Title */}
                <Text style={styles.title}>{notification.title}</Text>

                {/* Body */}
                <View style={styles.bodyContainer}>
                    <Text style={styles.body}>{notification.body}</Text>
                </View>

                {/* Status Card */}
                <View style={styles.statusCard}>
                    <View style={styles.statusItem}>
                        <MaterialCommunityIcons
                            name={notification.is_read ? 'check-circle' : 'circle-outline'}
                            size={20}
                            color={notification.is_read ? '#4caf50' : '#999'}
                        />
                        <View style={styles.statusContent}>
                            <Text style={styles.statusLabel}>Status</Text>
                            <Text style={styles.statusValue}>
                                {notification.is_read ? 'Read' : 'Unread'}
                            </Text>
                        </View>
                    </View>

                    {readDate && (
                        <Text style={styles.statusTime}>
                            {formatDateTime(readDate)}
                        </Text>
                    )}
                </View>

                {/* Metadata */}
                <View style={styles.metadataContainer}>
                    <Text style={styles.metadataTitle}>Information</Text>

                    <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Created</Text>
                        <Text style={styles.metadataValue}>
                            {formatDateTime(createdDate)}
                        </Text>
                    </View>

                    {readDate && (
                        <View style={styles.metadataItem}>
                            <Text style={styles.metadataLabel}>Read</Text>
                            <Text style={styles.metadataValue}>
                                {formatDateTime(readDate)}
                            </Text>
                        </View>
                    )}

                    {dismissedDate && (
                        <View style={styles.metadataItem}>
                            <Text style={styles.metadataLabel}>Dismissed</Text>
                            <Text style={styles.metadataValue}>
                                {formatDateTime(dismissedDate)}
                            </Text>
                        </View>
                    )}

                    {notification.course_id && (
                        <View style={styles.metadataItem}>
                            <Text style={styles.metadataLabel}>Course ID</Text>
                            <Text style={styles.metadataValue}>
                                #{notification.course_id}
                            </Text>
                        </View>
                    )}

                    {notification.assignment_id && (
                        <View style={styles.metadataItem}>
                            <Text style={styles.metadataLabel}>Assignment ID</Text>
                            <Text style={styles.metadataValue}>
                                #{notification.assignment_id}
                            </Text>
                        </View>
                    )}

                    <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Status</Text>
                        <Text style={[
                            styles.metadataValue,
                            {
                                color: notification.status === 'sent' ? '#4caf50' : '#999'
                            }
                        ]}>
                            {notification.status.charAt(0).toUpperCase() +
                                notification.status.slice(1)}
                        </Text>
                    </View>
                </View>

                {/* Action Card */}
                <View style={styles.actionCard}>
                    <MaterialCommunityIcons
                        name="information-outline"
                        size={20}
                        color="#666"
                    />
                    <Text style={styles.actionCardText}>
                        {notification.is_read
                            ? 'You have read this notification'
                            : 'This notification is waiting for your attention'}
                    </Text>
                </View>
            </ScrollView>

            {/* Bottom Actions */}
            <View style={styles.bottomActions}>
                <TouchableOpacity
                    style={styles.dismissButton}
                    onPress={handleDismiss}
                    disabled={loading}
                >
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color="#fff" />
                    <Text style={styles.dismissButtonText}>Dismiss</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

// Helper function to format date and time
const formatDateTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Relative time
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    // Absolute time
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

// Styles
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        flex: 1,
        textAlign: 'center',
    },
    headerAction: {
        padding: 8,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingVertical: 20,
        gap: 16,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        gap: 12,
    },
    typeLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        lineHeight: 30,
    },
    bodyContainer: {
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 16,
        borderRadius: 10,
    },
    body: {
        fontSize: 15,
        color: '#666',
        lineHeight: 24,
    },
    statusCard: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statusItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    statusContent: {
        flex: 1,
    },
    statusLabel: {
        fontSize: 12,
        color: '#999',
        marginBottom: 2,
    },
    statusValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    statusTime: {
        fontSize: 12,
        color: '#999',
    },
    metadataContainer: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderRadius: 10,
        gap: 12,
    },
    metadataTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 4,
    },
    metadataItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    metadataLabel: {
        fontSize: 13,
        color: '#999',
    },
    metadataValue: {
        fontSize: 13,
        fontWeight: '500',
        color: '#333',
    },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e8f5e9',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 10,
        gap: 10,
    },
    actionCardText: {
        flex: 1,
        fontSize: 13,
        color: '#2e7d32',
        lineHeight: 18,
    },
    bottomActions: {
        paddingHorizontal: 16,
        paddingVertical: 16,
        paddingBottom: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    dismissButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#d32f2f',
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
    },
    dismissButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default NotificationDetailScreen;
