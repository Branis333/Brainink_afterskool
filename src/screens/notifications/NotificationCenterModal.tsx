/**
 * Notification Center Modal
 * Quick-access notification center that can be opened from anywhere
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import notificationsService, { NotificationItem, NotificationStats } from '../../services/notificationsService';
import { useAuth } from '../../context/AuthContext';
import NotificationCard from './NotificationCard';

interface NotificationCenterModalProps {
    visible: boolean;
    onClose: () => void;
    onNavigateToDetail?: (notification: NotificationItem) => void;
}

const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
    visible,
    onClose,
    onNavigateToDetail,
}) => {
    const { token } = useAuth();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [stats, setStats] = useState<NotificationStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'unread' | 'recent'>('unread');

    const loadNotifications = useCallback(async () => {
        if (!token || !visible) return;
        try {
            setLoading(true);
            const [notifs, stat] = await Promise.all([
                notificationsService.listNotifications(token, {
                    is_read: activeTab === 'unread' ? false : undefined,
                    limit: 20,
                }),
                notificationsService.getStats(token),
            ]);
            setNotifications(notifs);
            setStats(stat);
        } catch (err) {
            console.error('Error loading notifications:', err);
        } finally {
            setLoading(false);
        }
    }, [token, visible, activeTab]);

    useEffect(() => {
        if (visible) {
            loadNotifications();
        }
    }, [visible, loadNotifications]);

    const handleNotificationPress = (notification: NotificationItem) => {
        if (onNavigateToDetail) {
            onNavigateToDetail(notification);
        }
        onClose();
    };

    const handleDismiss = async (notificationId: number) => {
        if (!token) return;
        try {
            await notificationsService.dismiss(token, notificationId);
            setNotifications(notifications.filter((n) => n.id !== notificationId));
        } catch (err) {
            console.error('Error dismissing notification:', err);
        }
    };

    const handleMarkAllAsRead = async () => {
        if (!token) return;
        try {
            await notificationsService.markAllAsRead(token);
            loadNotifications();
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    };

    const displayNotifications = notifications;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Notification Center</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <MaterialCommunityIcons
                            name="close"
                            size={24}
                            color="#333"
                        />
                    </TouchableOpacity>
                </View>

                {/* Stats */}
                {stats && (
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{stats.total_unread}</Text>
                            <Text style={styles.statLabel}>Unread</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{stats.total_dismissed}</Text>
                            <Text style={styles.statLabel}>Dismissed</Text>
                        </View>
                    </View>
                )}

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[
                            styles.tab,
                            activeTab === 'unread' && styles.activeTab,
                        ]}
                        onPress={() => setActiveTab('unread')}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === 'unread' && styles.activeTabText,
                            ]}
                        >
                            Unread
                            {stats && stats.total_unread > 0 && (
                                <Text style={styles.tabBadge}> ({stats.total_unread})</Text>
                            )}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.tab,
                            activeTab === 'recent' && styles.activeTab,
                        ]}
                        onPress={() => setActiveTab('recent')}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === 'recent' && styles.activeTabText,
                            ]}
                        >
                            Recent
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Content */}
                {loading ? (
                    <View style={styles.centerContent}>
                        <ActivityIndicator size="large" color="#6200ea" />
                    </View>
                ) : displayNotifications.length === 0 ? (
                    <View style={styles.centerContent}>
                        <MaterialCommunityIcons
                            name="bell-off-outline"
                            size={48}
                            color="#ccc"
                            style={styles.emptyIcon}
                        />
                        <Text style={styles.emptyTitle}>
                            {activeTab === 'unread'
                                ? 'All caught up!'
                                : 'No recent notifications'}
                        </Text>
                        <Text style={styles.emptySubtitle}>
                            {activeTab === 'unread'
                                ? 'You have no unread notifications'
                                : 'Come back later for updates'}
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Action Button */}
                        {stats && stats.total_unread > 0 && activeTab === 'unread' && (
                            <View style={styles.actionButtonContainer}>
                                <TouchableOpacity
                                    style={styles.markAllButton}
                                    onPress={handleMarkAllAsRead}
                                >
                                    <MaterialCommunityIcons
                                        name="check-all"
                                        size={16}
                                        color="#6200ea"
                                    />
                                    <Text style={styles.markAllButtonText}>
                                        Mark All as Read
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Notifications List */}
                        <FlatList
                            data={displayNotifications}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                                <View style={styles.notificationItemContainer}>
                                    <NotificationCard
                                        notification={item}
                                        onPress={() => handleNotificationPress(item)}
                                        onDismiss={() => handleDismiss(item.id)}
                                        compact={true}
                                    />
                                </View>
                            )}
                            contentContainerStyle={styles.listContent}
                            scrollEnabled={true}
                            nestedScrollEnabled={true}
                        />
                    </>
                )}
            </SafeAreaView>
        </Modal>
    );
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
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    closeButton: {
        padding: 8,
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 12,
        marginVertical: 12,
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#6200ea',
    },
    statLabel: {
        fontSize: 12,
        color: '#999',
        marginTop: 4,
    },
    statDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#e0e0e0',
        marginHorizontal: 16,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        marginHorizontal: 12,
        borderRadius: 8,
        padding: 4,
        marginBottom: 8,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    activeTab: {
        backgroundColor: '#f0e6ff',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#999',
    },
    activeTabText: {
        color: '#6200ea',
    },
    tabBadge: {
        fontSize: 11,
        color: '#6200ea',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyIcon: {
        marginBottom: 16,
        opacity: 0.5,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 13,
        color: '#999',
        textAlign: 'center',
    },
    actionButtonContainer: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    markAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0e6ff',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    markAllButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6200ea',
    },
    notificationItemContainer: {
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    listContent: {
        paddingHorizontal: 0,
        paddingVertical: 8,
    },
});

export default NotificationCenterModal;
