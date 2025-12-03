import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    ScrollView,
    Switch,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { profileService, UpdateProfileRequest, User } from '../services/profileService';
import notificationsService, { NotificationPreference } from '../services/notificationsService';

type NavigationProp = NativeStackNavigationProp<any>;

interface Props {
    navigation: NavigationProp;
}

const EditProfileScreen: React.FC<Props> = ({ navigation }) => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        fname: '',
        lname: '',
        email: '',
        username: '',
    });
    const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreference | null>(null);
    const [notifChanges, setNotifChanges] = useState<Partial<NotificationPreference>>({});

    useEffect(() => {
        const load = async () => {
            try {
                if (!token) throw new Error('Not authenticated');
                setLoading(true);

                const [profile, prefs] = await Promise.all([
                    profileService.getUserProfile(token),
                    notificationsService.getPreferences(token).catch(() => null)
                ]);

                setFormData({
                    fname: profile.fname || '',
                    lname: profile.lname || '',
                    email: profile.email || '',
                    username: profile.username || '',
                });
                setNotificationPrefs(prefs);
            } catch (e) {
                console.error('EditProfile load error', e);
                Alert.alert('Error', 'Unable to load your profile');
                navigation.goBack();
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [navigation, token]);

    const handleNotifToggle = (key: keyof NotificationPreference, value: boolean) => {
        setNotifChanges(prev => ({ ...prev, [key]: value }));
    };

    const currentNotifPrefs = { ...notificationPrefs, ...notifChanges };

    const handleSave = async () => {
        try {
            if (!token) return;
            setSaving(true);

            // Save profile
            const update: UpdateProfileRequest = { ...formData };
            await profileService.updateProfile(token, update);

            // Save notification preferences if changed
            if (Object.keys(notifChanges).length > 0) {
                await notificationsService.updatePreferences(token, notifChanges);
            }

            Alert.alert('Success', 'Settings saved successfully');
            navigation.goBack();
        } catch (e) {
            console.error('Save profile error', e);
            Alert.alert('Error', 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                    <Ionicons name="close" size={28} color="#1a1a1a" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Personal Information Section */}
                <Text style={styles.sectionHeader}>PERSONAL INFORMATION</Text>
                <View style={styles.section}>
                    <View style={styles.inputRow}>
                        <Ionicons name="person-outline" size={22} color="#666" style={styles.inputIcon} />
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>First Name</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.fname}
                                onChangeText={(text) => setFormData((p) => ({ ...p, fname: text }))}
                                placeholder="Enter first name"
                                placeholderTextColor="#999"
                            />
                        </View>
                    </View>

                    <View style={styles.inputRow}>
                        <Ionicons name="person-outline" size={22} color="#666" style={styles.inputIcon} />
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Last Name</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.lname}
                                onChangeText={(text) => setFormData((p) => ({ ...p, lname: text }))}
                                placeholder="Enter last name"
                                placeholderTextColor="#999"
                            />
                        </View>
                    </View>

                    <View style={styles.inputRow}>
                        <Ionicons name="at-outline" size={22} color="#666" style={styles.inputIcon} />
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Username</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.username}
                                onChangeText={(text) => setFormData((p) => ({ ...p, username: text }))}
                                placeholder="Enter username"
                                placeholderTextColor="#999"
                                autoCapitalize="none"
                            />
                        </View>
                    </View>

                    <View style={[styles.inputRow, { borderBottomWidth: 0 }]}>
                        <Ionicons name="mail-outline" size={22} color="#666" style={styles.inputIcon} />
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Email</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.email}
                                onChangeText={(text) => setFormData((p) => ({ ...p, email: text }))}
                                placeholder="Enter email"
                                placeholderTextColor="#999"
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>
                    </View>
                </View>

                {/* Push Notifications Section */}
                <Text style={styles.sectionHeader}>PUSH NOTIFICATIONS</Text>
                <View style={styles.section}>
                    <View style={styles.settingRow}>
                        <Ionicons name="notifications-outline" size={22} color="#666" style={styles.settingIcon} />
                        <View style={styles.settingContent}>
                            <Text style={styles.settingTitle}>Push Notifications</Text>
                            <Text style={styles.settingDescription}>
                                Enable push notifications to stay updated
                            </Text>
                        </View>
                        <Switch
                            value={currentNotifPrefs.push_notifications_enabled ?? false}
                            onValueChange={(value) => handleNotifToggle('push_notifications_enabled', value)}
                            trackColor={{ false: '#d0d0d0', true: '#34C759' }}
                            thumbColor="#fff"
                        />
                    </View>

                    <View style={styles.settingRow}>
                        <Ionicons name="calendar-outline" size={22} color="#666" style={styles.settingIcon} />
                        <View style={styles.settingContent}>
                            <Text style={styles.settingTitle}>Due Date Reminders</Text>
                            <Text style={styles.settingDescription}>
                                Get reminded about upcoming deadlines
                            </Text>
                        </View>
                        <Switch
                            value={currentNotifPrefs.due_date_notifications ?? false}
                            onValueChange={(value) => handleNotifToggle('due_date_notifications', value)}
                            trackColor={{ false: '#d0d0d0', true: '#34C759' }}
                            thumbColor="#fff"
                        />
                    </View>

                    <View style={styles.settingRow}>
                        <Ionicons name="star-outline" size={22} color="#666" style={styles.settingIcon} />
                        <View style={styles.settingContent}>
                            <Text style={styles.settingTitle}>Daily Encouragement</Text>
                            <Text style={styles.settingDescription}>
                                Receive daily motivational messages
                            </Text>
                        </View>
                        <Switch
                            value={currentNotifPrefs.daily_encouragement ?? false}
                            onValueChange={(value) => handleNotifToggle('daily_encouragement', value)}
                            trackColor={{ false: '#d0d0d0', true: '#34C759' }}
                            thumbColor="#fff"
                        />
                    </View>

                    <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
                        <Ionicons name="checkmark-circle-outline" size={22} color="#666" style={styles.settingIcon} />
                        <View style={styles.settingContent}>
                            <Text style={styles.settingTitle}>Completion Alerts</Text>
                            <Text style={styles.settingDescription}>
                                Get notified when you complete tasks
                            </Text>
                        </View>
                        <Switch
                            value={currentNotifPrefs.completion_notifications ?? false}
                            onValueChange={(value) => handleNotifToggle('completion_notifications', value)}
                            trackColor={{ false: '#d0d0d0', true: '#34C759' }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>

                {/* Save Button */}
                <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    loadingText: {
        marginTop: 12,
        color: '#666'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    closeBtn: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1a1a1a'
    },
    scrollView: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 40,
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
        marginLeft: 4,
        letterSpacing: 0.5,
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 24,
        overflow: 'hidden',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    inputIcon: {
        marginRight: 14,
    },
    inputContainer: {
        flex: 1,
    },
    inputLabel: {
        fontSize: 13,
        color: '#666',
        marginBottom: 4,
    },
    input: {
        fontSize: 16,
        color: '#1a1a1a',
        padding: 0,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    settingIcon: {
        marginRight: 14,
    },
    settingContent: {
        flex: 1,
        marginRight: 12,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1a1a1a',
        marginBottom: 2,
    },
    settingDescription: {
        fontSize: 13,
        color: '#999',
    },
    saveBtn: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    saveText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
});

export default EditProfileScreen;