/**
 * Main Notifications Screen
 * Displays all notifications with filtering, sorting, and interaction options
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    TouchableOpacity,
    Dimensions,
    StatusBar,
    SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import notificationsService, {
    NotificationItem,
    NotificationStats,
    NotificationType,
} from '../../services/notificationsService';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

interface GroupedNotifications {
    title: string;
    data: NotificationItem[];
}

const NotificationsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
    const { token, user, isLoading: authLoading } = useAuth();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [stats, setStats] = useState<NotificationStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | NotificationType>('all');
    // Default to showing all notifications so items remain visible after being marked as read
    const [activeTab, setActiveTab] = useState<'unread' | 'all'>('all');

    // Load notifications and stats
    const loadNotifications = useCallback(async () => {
        if (!token || authLoading) {
            console.warn('Waiting for auth: token exists?', !!token, 'authLoading?', authLoading);
            setLoading(false);
            return;
        }
        try {
            setError(null);
            console.log('🔔 Loading notifications with token:', token.substring(0, 20) + '...');
            const [notificationData, statsData] = await Promise.all([
                notificationsService.listNotifications(token, {
                    is_read: activeTab === 'unread' ? false : undefined,
                    notification_type: filter !== 'all' ? filter : undefined,
                    limit: 100,
                }),
                notificationsService.getStats(token),
            ]);
            setNotifications(notificationData);
            setStats(statsData);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to load notifications';
            setError(errorMsg);
            console.error('❌ Notifications load error:', errorMsg);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token, authLoading, activeTab, filter]);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        loadNotifications();
    }, [loadNotifications]);

    const handleNotificationPress = useCallback(
        async (notification: NotificationItem) => {
            if (!token) return;
            try {
                // Mark as read
                if (!notification.is_read) {
                    await notificationsService.markAsRead(token, notification.id);
                }
                // Navigate to detail screen
                navigation.navigate('NotificationDetail', { notification });
                // Reload to update UI
                loadNotifications();
            } catch (err) {
                console.error('Error marking notification as read:', err);
            }
        },
        [token, navigation, loadNotifications]
    );

    const handleDismiss = useCallback(
        async (notificationId: number, event: any) => {
            event.stopPropagation();
            if (!token) return;
            try {
                await notificationsService.dismiss(token, notificationId);
                loadNotifications();
            } catch (err) {
                console.error('Error dismissing notification:', err);
            }
        },
        [token, loadNotifications]
    );

    const handleMarkAllAsRead = useCallback(async () => {
        if (!token) return;
        try {
            await notificationsService.markAllAsRead(token);
            loadNotifications();
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    }, [token, loadNotifications]);

    const handleSettingsPress = useCallback(() => {
        navigation.navigate('NotificationSettings');
    }, [navigation]);

    // Group notifications by date, keeping newest dates and items first
    const groupNotificationsByDate = (): GroupedNotifications[] => {
        // Sort notifications descending by created_at
        const sorted = [...notifications].sort((a, b) => {
            const at = new Date(a.created_at).getTime();
            const bt = new Date(b.created_at).getTime();
            return bt - at;
        });

        const grouped: Record<string, NotificationItem[]> = {};
        const order: string[] = [];

        sorted.forEach((notif) => {
            const date = new Date(notif.created_at);
            const dateKey = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });

            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
                order.push(dateKey); // preserve section order as encountered (newest first)
            }
            grouped[dateKey].push(notif);
        });

        return order.map((date) => ({
            title: date,
            data: grouped[date],
        }));
    };

    const renderNotificationItem = ({ item }: { item: NotificationItem }) => (
        <TouchableOpacity
            style={[
                styles.notificationCard,
                !item.is_read && styles.notificationCardUnread,
            ]}
            onPress={() => handleNotificationPress(item)}
            activeOpacity={0.7}
        >
            <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                    <Text style={styles.notificationTypeEmoji}>
                        {notificationsService.typeEmoji(item.type as NotificationType)}
                    </Text>
                    <View style={styles.notificationTitleContainer}>
                        <Text
                            style={[
                                styles.notificationTitle,
                                !item.is_read && styles.notificationTitleUnread,
                            ]}
                            numberOfLines={2}
                        >
                            {item.title}
                        </Text>
                        <Text style={styles.notificationTime}>
                            {formatTime(new Date(item.created_at))}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={(event) => handleDismiss(item.id, event)}
                        style={styles.dismissButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <MaterialCommunityIcons name="close" size={20} color="#999" />
                    </TouchableOpacity>
                </View>
                <Text style={styles.notificationBody} numberOfLines={2}>
                    {item.body}
                </Text>
                <View style={styles.notificationFooter}>
                    <View style={styles.notificationBadges}>
                        {!item.is_read && <View style={styles.unreadBadge} />}
                        <Text style={styles.notificationType}>
                            {notificationsService.formatTypeLabel(
                                item.type as NotificationType
                            )}
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderSectionHeader = ({ section: { title } }: any) => (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
        </View>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
                name="bell-off-outline"
                size={64}
                color="#ccc"
                style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>
                {activeTab === 'unread' ? 'All caught up!' : 'No notifications'}
            </Text>
            <Text style={styles.emptySubtitle}>
                {activeTab === 'unread'
                    ? 'You have no unread notifications'
                    : 'Check back later for updates'}
            </Text>
        </View>
    );

    const renderHeader = () => (
        <View>
            {/* Stats Bar */}
            {stats && (
                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{stats.total_unread}</Text>
                        <Text style={styles.statLabel}>Unread</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>
                            {stats.due_date_unread}
                        </Text>
                        <Text style={styles.statLabel}>Due Dates</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>
                            {stats.daily_encouragement_unread}
                        </Text>
                        <Text style={styles.statLabel}>Encouragement</Text>
                    </View>
                </View>
            )}

            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'unread' && styles.activeTab]}
                    onPress={() => setActiveTab('unread')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'unread' && styles.activeTabText,
                        ]}
                    >
                        Unread
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'all' && styles.activeTab]}
                    onPress={() => setActiveTab('all')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            activeTab === 'all' && styles.activeTabText,
                        ]}
                    >
                        All
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Filter Bar */}
            <View style={styles.filterContainer}>
                <ScrollableFilterButtons
                    filter={filter}
                    setFilter={setFilter}
                />
            </View>

            {/* Error Message */}
            {error && (
                <View style={styles.errorBanner}>
                    <MaterialCommunityIcons
                        name="alert-circle"
                        size={16}
                        color="#d32f2f"
                    />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {/* Action Buttons */}
            {stats && stats.total_unread > 0 && (
                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handleMarkAllAsRead}
                    >
                        <MaterialCommunityIcons
                            name="check-all"
                            size={18}
                            color="#fff"
                        />
                        <Text style={styles.actionButtonText}>Mark All as Read</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    if (loading || authLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="#fff" />
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#6200ea" />
                    <Text style={styles.loadingText}>Loading notifications...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!token) {
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
                    <Text style={styles.headerTitle}>Notifications</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.centerContent}>
                    <MaterialCommunityIcons
                        name="alert-circle-outline"
                        size={64}
                        color="#ff9800"
                    />
                    <Text style={styles.emptyTitle}>Authentication Required</Text>
                    <Text style={styles.emptySubtitle}>
                        Please log in again to access notifications
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    const groupedData = groupNotificationsByDate();

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
                <Text style={styles.headerTitle}>Notifications</Text>
                <TouchableOpacity
                    onPress={handleSettingsPress}
                    style={styles.settingsButton}
                >
                    <MaterialCommunityIcons
                        name="cog-outline"
                        size={24}
                        color="#333"
                    />
                </TouchableOpacity>
            </View>

            {/* Content: Always render the header (stats/tabs/filters) even when empty */}
            <SectionList
                sections={groupedData}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderNotificationItem}
                renderSectionHeader={renderSectionHeader}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={() => (
                    <View style={styles.centerContent}>{renderEmptyState()}</View>
                )}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor="#6200ea"
                    />
                }
                contentContainerStyle={styles.listContent}
                stickySectionHeadersEnabled={false}
            />
        </SafeAreaView>
    );
};

// Helper component for filter buttons
const ScrollableFilterButtons: React.FC<{
    filter: 'all' | NotificationType;
    setFilter: (filter: 'all' | NotificationType) => void;
}> = ({ filter, setFilter }) => {
    const filters: { label: string; value: 'all' | NotificationType }[] = [
        { label: 'All', value: 'all' },
        { label: 'Due Dates', value: 'due_date' },
        { label: 'Encouragement', value: 'daily_encouragement' },
        { label: 'Completion', value: 'completion' },
    ];

    return (
        <View style={styles.filterButtonsRow}>
            {filters.map((item) => (
                <TouchableOpacity
                    key={item.value}
                    style={[
                        styles.filterButton,
                        filter === item.value && styles.filterButtonActive,
                    ]}
                    onPress={() => setFilter(item.value)}
                >
                    <Text
                        style={[
                            styles.filterButtonText,
                            filter === item.value && styles.filterButtonTextActive,
                        ]}
                    >
                        {item.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
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
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
};

// Styles
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
        textAlign: 'center',
    },
    settingsButton: {
        padding: 8,
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 12,
        marginVertical: 12,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
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
        marginHorizontal: 8,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        marginHorizontal: 12,
        marginVertical: 8,
        borderRadius: 8,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 6,
    },
    activeTab: {
        backgroundColor: '#f0e6ff',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#999',
    },
    activeTabText: {
        color: '#6200ea',
    },
    filterContainer: {
        backgroundColor: '#fff',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    filterButtonsRow: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        gap: 8,
    },
    filterButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#f0f0f0',
    },
    filterButtonActive: {
        backgroundColor: '#6200ea',
    },
    filterButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#666',
    },
    filterButtonTextActive: {
        color: '#fff',
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffebee',
        marginHorizontal: 12,
        marginVertical: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        gap: 8,
    },
    errorText: {
        flex: 1,
        fontSize: 13,
        color: '#d32f2f',
    },
    actionButtons: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 12,
        gap: 8,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#6200ea',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    listContent: {
        paddingBottom: 20,
        flexGrow: 1, // ensures ListEmptyComponent can center vertically beneath the header
    },
    sectionHeader: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#f5f5f5',
    },
    sectionHeaderText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#999',
        textTransform: 'uppercase',
    },
    notificationCard: {
        marginHorizontal: 12,
        marginVertical: 6,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        borderLeftWidth: 4,
        borderLeftColor: 'transparent',
    },
    notificationCardUnread: {
        borderLeftColor: '#6200ea',
        backgroundColor: '#f9f7ff',
    },
    notificationContent: {
        gap: 8,
    },
    notificationHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    notificationTypeEmoji: {
        fontSize: 24,
        marginTop: 2,
    },
    notificationTitleContainer: {
        flex: 1,
    },
    notificationTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    notificationTitleUnread: {
        color: '#333',
        fontWeight: '700',
    },
    notificationTime: {
        fontSize: 12,
        color: '#999',
        marginTop: 2,
    },
    dismissButton: {
        padding: 4,
    },
    notificationBody: {
        fontSize: 13,
        color: '#666',
        lineHeight: 18,
        marginLeft: 34,
    },
    notificationFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        marginLeft: 34,
    },
    notificationBadges: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    unreadBadge: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#6200ea',
    },
    notificationType: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6200ea',
        backgroundColor: '#f0e6ff',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyIcon: {
        marginBottom: 16,
        opacity: 0.5,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
});

export default NotificationsScreen;
