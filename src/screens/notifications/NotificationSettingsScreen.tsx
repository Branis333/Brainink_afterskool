/**
 * Notification Settings Screen
 * Manage notification preferences and settings
 */

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Switch,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import notificationsService, { NotificationPreference } from '../../services/notificationsService';
import { useAuth } from '../../context/AuthContext';

interface NotificationSettingsScreenProps {
    navigation: any;
}

const NotificationSettingsScreen: React.FC<NotificationSettingsScreenProps> = ({
    navigation,
}) => {
    const { token } = useAuth();
    const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [changes, setChanges] = useState<Partial<NotificationPreference>>({});

    // Load preferences
    useEffect(() => {
        const loadPreferences = async () => {
            if (!token) return;
            try {
                setLoading(true);
                const prefs = await notificationsService.getPreferences(token);
                setPreferences(prefs);
            } catch (err) {
                console.error('Error loading preferences:', err);
                Alert.alert('Error', 'Failed to load notification settings');
            } finally {
                setLoading(false);
            }
        };

        loadPreferences();
    }, [token]);

    const handleToggle = (key: keyof NotificationPreference, value: boolean) => {
        setChanges({
            ...changes,
            [key]: value,
        });
    };

    const handleTimeChange = (time: string) => {
        setChanges({
            ...changes,
            daily_encouragement_time: time,
        });
    };

    const handleDaysBeforeChange = (days: number) => {
        setChanges({
            ...changes,
            due_date_days_before: days,
        });
    };

    const handleSave = async () => {
        if (!token || !preferences) return;
        if (Object.keys(changes).length === 0) {
            navigation.goBack();
            return;
        }

        try {
            setSaving(true);
            await notificationsService.updatePreferences(token, changes);
            Alert.alert('Success', 'Settings saved successfully');
            navigation.goBack();
        } catch (err) {
            console.error('Error saving preferences:', err);
            Alert.alert('Error', 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const currentPreferences = { ...preferences, ...changes };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="#fff" />
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#6200ea" />
                </View>
            </SafeAreaView>
        );
    }

    if (!preferences) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="#fff" />
                <View style={styles.centerContent}>
                    <Text style={styles.errorText}>Failed to load settings</Text>
                </View>
            </SafeAreaView>
        );
    }

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
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={styles.headerSpacer} />
            </View>

            {/* Content */}
            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* Push Notifications Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons
                            name="bell-alert-outline"
                            size={20}
                            color="#6200ea"
                        />
                        <Text style={styles.sectionTitle}>Push Notifications</Text>
                    </View>

                    <View style={styles.settingItem}>
                        <View style={styles.settingContent}>
                            <Text style={styles.settingLabel}>Enable Push Notifications</Text>
                            <Text style={styles.settingDescription}>
                                Receive alerts on your device
                            </Text>
                        </View>
                        <Switch
                            value={currentPreferences.push_notifications_enabled ?? false}
                            onValueChange={(value) =>
                                handleToggle('push_notifications_enabled', value)
                            }
                            trackColor={{ false: '#d0d0d0', true: '#b39ddb' }}
                            thumbColor={
                                currentPreferences.push_notifications_enabled
                                    ? '#6200ea'
                                    : '#f0f0f0'
                            }
                        />
                    </View>
                </View>

                {/* Notification Types Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons
                            name="format-list-bulleted"
                            size={20}
                            color="#6200ea"
                        />
                        <Text style={styles.sectionTitle}>Notification Types</Text>
                    </View>

                    {/* Due Date Notifications */}
                    <View style={styles.settingItem}>
                        <View style={styles.settingContent}>
                            <View style={styles.settingLabelRow}>
                                <Text style={styles.settingEmoji}>⏰</Text>
                                <Text style={styles.settingLabel}>Due Date Reminders</Text>
                            </View>
                            <Text style={styles.settingDescription}>
                                Get notified when assignments are due
                            </Text>
                        </View>
                        <Switch
                            value={currentPreferences.due_date_notifications ?? false}
                            onValueChange={(value) =>
                                handleToggle('due_date_notifications', value)
                            }
                            trackColor={{ false: '#d0d0d0', true: '#ffcc80' }}
                            thumbColor={
                                currentPreferences.due_date_notifications ? '#ff9800' : '#f0f0f0'
                            }
                        />
                    </View>

                    {/* Daily Encouragement Notifications */}
                    <View style={styles.settingItem}>
                        <View style={styles.settingContent}>
                            <View style={styles.settingLabelRow}>
                                <Text style={styles.settingEmoji}>🌟</Text>
                                <Text style={styles.settingLabel}>Daily Encouragement</Text>
                            </View>
                            <Text style={styles.settingDescription}>
                                Receive daily motivational messages
                            </Text>
                        </View>
                        <Switch
                            value={currentPreferences.daily_encouragement ?? false}
                            onValueChange={(value) =>
                                handleToggle('daily_encouragement', value)
                            }
                            trackColor={{ false: '#d0d0d0', true: '#a5d6a7' }}
                            thumbColor={
                                currentPreferences.daily_encouragement ? '#4caf50' : '#f0f0f0'
                            }
                        />
                    </View>

                    {/* Completion Notifications */}
                    <View style={styles.settingItem}>
                        <View style={styles.settingContent}>
                            <View style={styles.settingLabelRow}>
                                <Text style={styles.settingEmoji}>🏁</Text>
                                <Text style={styles.settingLabel}>Completion Alerts</Text>
                            </View>
                            <Text style={styles.settingDescription}>
                                Know when you complete assignments
                            </Text>
                        </View>
                        <Switch
                            value={currentPreferences.completion_notifications ?? false}
                            onValueChange={(value) =>
                                handleToggle('completion_notifications', value)
                            }
                            trackColor={{ false: '#d0d0d0', true: '#90caf9' }}
                            thumbColor={
                                currentPreferences.completion_notifications ? '#2196f3' : '#f0f0f0'
                            }
                        />
                    </View>
                </View>

                {/* Due Date Settings */}
                {currentPreferences.due_date_notifications && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <MaterialCommunityIcons
                                name="calendar"
                                size={20}
                                color="#ff9800"
                            />
                            <Text style={styles.sectionTitle}>Due Date Settings</Text>
                        </View>

                        <Text style={[styles.settingDescription, styles.settingDescriptionStandalone]}>
                            How many days before due date should we notify you?
                        </Text>

                        <View style={styles.daysButtonsContainer}>
                            {[0, 1, 3, 5, 7].map((days) => (
                                <TouchableOpacity
                                    key={days}
                                    style={[
                                        styles.dayButton,
                                        currentPreferences.due_date_days_before === days &&
                                        styles.dayButtonActive,
                                    ]}
                                    onPress={() => handleDaysBeforeChange(days)}
                                >
                                    <Text
                                        style={[
                                            styles.dayButtonText,
                                            currentPreferences.due_date_days_before === days &&
                                            styles.dayButtonTextActive,
                                        ]}
                                    >
                                        {days === 0 ? 'Same day' : `${days}d before`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* Daily Encouragement Time */}
                {currentPreferences.daily_encouragement && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <MaterialCommunityIcons name="clock-outline" size={20} color="#4caf50" />
                            <Text style={styles.sectionTitle}>Encouragement Time</Text>
                        </View>

                        <Text style={styles.settingDescriptionStandalone}>
                            What time would you like to receive daily messages?
                        </Text>

                        <View style={styles.timePresetContainer}>
                            {[
                                { label: 'Morning (8 AM)', time: '08:00' },
                                { label: 'Afternoon (2 PM)', time: '14:00' },
                                { label: 'Evening (6 PM)', time: '18:00' },
                            ].map((preset) => (
                                <TouchableOpacity
                                    key={preset.time}
                                    style={[
                                        styles.timePreset,
                                        currentPreferences.daily_encouragement_time ===
                                        preset.time && styles.timePresetActive,
                                    ]}
                                    onPress={() => handleTimeChange(preset.time)}
                                >
                                    <Text
                                        style={[
                                            styles.timePresetText,
                                            currentPreferences.daily_encouragement_time ===
                                            preset.time && styles.timePresetTextActive,
                                        ]}
                                    >
                                        {preset.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* Info Banner */}
                <View style={styles.infoBanner}>
                    <MaterialCommunityIcons
                        name="information-outline"
                        size={18}
                        color="#1976d2"
                    />
                    <Text style={styles.infoBannerText}>
                        You can change these settings anytime
                    </Text>
                </View>

                {/* Spacer for bottom button */}
                <View style={{ height: 20 }} />
            </ScrollView>

            {/* Bottom Actions */}
            <View style={styles.bottomActions}>
                <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => navigation.goBack()}
                    disabled={saving}
                >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
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
    },
    headerSpacer: {
        width: 44,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 16,
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 12,
        overflow: 'hidden',
        gap: 0,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        gap: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    settingContent: {
        flex: 1,
        marginRight: 16,
        gap: 4,
    },
    settingLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    settingLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
    },
    settingEmoji: {
        fontSize: 18,
    },
    settingDescription: {
        fontSize: 13,
        color: '#999',
    },
    settingDescriptionStandalone: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 13,
        color: '#666',
    },
    daysButtonsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
        flexWrap: 'wrap',
    },
    dayButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    dayButtonActive: {
        backgroundColor: '#ff9800',
        borderColor: '#ff9800',
    },
    dayButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#666',
    },
    dayButtonTextActive: {
        color: '#fff',
    },
    timePresetContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    timePreset: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: '#f5f5f5',
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    timePresetActive: {
        backgroundColor: '#c8e6c9',
        borderColor: '#4caf50',
    },
    timePresetText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#666',
    },
    timePresetTextActive: {
        color: '#2e7d32',
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e3f2fd',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
    },
    infoBannerText: {
        flex: 1,
        fontSize: 13,
        color: '#1565c0',
    },
    errorText: {
        fontSize: 16,
        color: '#d32f2f',
    },
    bottomActions: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingBottom: 20,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#666',
    },
    saveButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: '#6200ea',
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
});

export default NotificationSettingsScreen;
