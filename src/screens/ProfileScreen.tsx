/**
 * Profile Screen
 * User profile management interface with account settings and information
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    TextInput,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { profileService, User, UpdateProfileRequest } from '../services/profileService';
import { afterSchoolService, StudentDashboard, Course } from '../services/afterSchoolService';

type NavigationProp = NativeStackNavigationProp<any>;

interface Props {
    navigation: NavigationProp;
}

export const ProfileScreen: React.FC<Props> = ({ navigation }) => {
    const { token, user, logout } = useAuth();
    const [profileData, setProfileData] = useState<User | null>(null);
    const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    // View mode only; editing happens in EditProfile screen

    useEffect(() => {
        loadProfile();
    }, []);

    // Refresh when returning to this screen (e.g., after editing)
    useFocusEffect(
        React.useCallback(() => {
            loadProfile(true);
        }, [])
    );

    const loadProfile = async (isRefresh = false) => {
        if (!token) {
            Alert.alert('Error', 'Authentication required');
            return;
        }

        try {
            if (!isRefresh) setLoading(true);

            // Load both profile and dashboard data
            const [profile, dashboardData] = await Promise.all([
                profileService.getUserProfile(token),
                afterSchoolService.getStudentDashboard(token).catch(() => null) // Don't fail if dashboard fails
            ]);

            setProfileData(profile);
            setDashboard(dashboardData);
            // No local form state here; display values directly
        } catch (error) {
            console.error('Error loading profile:', error);
            Alert.alert('Error', 'Failed to load profile information');
        } finally {
            setLoading(false);
            if (isRefresh) setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadProfile(true);
    };

    // Editing handled on EditProfile screen

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await profileService.logout();
                        } catch (error) {
                            console.error('Logout error:', error);
                            // Continue with client-side logout regardless
                        } finally {
                            logout();
                            // Reset navigation stack and go to StartUp screen
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'StartUp' as never }],
                            });
                        }
                    },
                },
            ]
        );
    };

    const renderStatsCard = (title: string, value: string | number, icon: string) => (
        <View style={styles.statsCard}>
            <Text style={styles.statsIcon}>{icon}</Text>
            <Text style={styles.statsValue}>{value}</Text>
            <Text style={styles.statsTitle}>{title}</Text>
        </View>
    );

    const renderCourseCard = (course: Course) => (
        <TouchableOpacity key={course.id} style={styles.courseCard}>
            <View style={styles.courseHeader}>
                <Text style={styles.courseTitle}>{course.title || 'Untitled Course'}</Text>
                <Text style={styles.courseDifficulty}>{course.difficulty_level || 'N/A'}</Text>
            </View>
            <Text style={styles.courseSubject}>{course.subject || 'No subject'}</Text>
            <Text style={styles.courseDescription} numberOfLines={2}>
                {course.description || 'No description available'}
            </Text>
            <View style={styles.courseFooter}>
                <Text style={styles.courseStatus}>
                    {course.is_active ? 'Active' : 'Inactive'}
                </Text>
                <Text style={styles.courseDate}>
                    {course.created_at ? new Date(course.created_at).toLocaleDateString() : 'Unknown'}
                </Text>
            </View>
        </TouchableOpacity>
    );

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading profile...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Profile</Text>
                    <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => navigation.navigate('EditProfile' as never)}
                    >
                        <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                </View>

                {/* Account Information (read-only) */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account Information</Text>
                    <View style={styles.readOnlyRow}>
                        <Text style={styles.label}>Username</Text>
                        <Text style={styles.valueText}>{profileData?.username || user?.username || '—'}</Text>
                    </View>
                    <View style={styles.readOnlyRow}>
                        <Text style={styles.label}>Email</Text>
                        <Text style={styles.valueText}>{profileData?.email || user?.email || '—'}</Text>
                    </View>
                </View>

                {/* Account Status */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account Status</Text>

                    <View style={styles.statusItem}>
                        <Text style={styles.statusLabel}>Account Active</Text>
                        <View style={[styles.statusBadge, profileData?.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                            <Text style={[styles.statusText, profileData?.is_active ? styles.activeText : styles.inactiveText]}>
                                {profileData?.is_active ? 'Active' : 'Inactive'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.statusItem}>
                        <Text style={styles.statusLabel}>Email Verified</Text>
                        <View style={[styles.statusBadge, profileData?.email_confirmed ? styles.activeBadge : styles.inactiveBadge]}>
                            <Text style={[styles.statusText, profileData?.email_confirmed ? styles.activeText : styles.inactiveText]}>
                                {profileData?.email_confirmed ? 'Verified' : 'Unverified'}
                            </Text>
                        </View>
                    </View>

                    {profileData?.created_at && (
                        <View style={styles.statusItem}>
                            <Text style={styles.statusLabel}>Member Since</Text>
                            <Text style={styles.statusValue}>
                                {new Date(profileData.created_at).toLocaleDateString()}
                            </Text>
                        </View>
                    )}
                </View>

                {/* User Statistics */}
                {dashboard && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Your Statistics</Text>
                        <View style={styles.statsContainer}>
                            {renderStatsCard("Courses", dashboard.active_courses?.length || 0, "📚")}
                            {renderStatsCard("Sessions", dashboard.recent_sessions?.length || 0, "📝")}
                            {renderStatsCard("Study Time", `${Math.round((dashboard.total_study_time || 0) / 60)}h`, "⏰")}
                        </View>
                        <View style={styles.statsContainer}>
                            {renderStatsCard("Progress", dashboard.progress_summary?.length || 0, "�")}
                            {renderStatsCard("Avg Score", `${Math.round(dashboard.average_score || 0)}%`, "🎯")}
                        </View>
                    </View>
                )}

                {/* Active Courses */}
                {dashboard?.active_courses && dashboard.active_courses.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Active Courses</Text>
                        {dashboard.active_courses.map(renderCourseCard)}
                    </View>
                )}

                {/* Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account Actions</Text>

                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => Alert.alert('Info', 'Change password feature coming soon!')}
                    >
                        <Text style={styles.actionButtonText}>Change Password</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, styles.logoutButton]}
                        onPress={handleLogout}
                    >
                        <Text style={[styles.actionButtonText, styles.logoutButtonText]}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 120,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    editButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#007AFF',
        borderRadius: 8,
    },
    editButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    section: {
        backgroundColor: '#fff',
        marginTop: 16,
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 16,
    },
    readOnlyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    valueText: {
        fontSize: 16,
        color: '#1f2937',
        fontWeight: '500',
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#1a1a1a',
    },
    inputDisabled: {
        backgroundColor: '#f3f4f6',
        color: '#6b7280',
    },
    saveButton: {
        backgroundColor: '#10b981',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    statusItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    statusLabel: {
        fontSize: 16,
        color: '#374151',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    activeBadge: {
        backgroundColor: '#d1fae5',
    },
    inactiveBadge: {
        backgroundColor: '#fee2e2',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    activeText: {
        color: '#065f46',
    },
    inactiveText: {
        color: '#991b1b',
    },
    statusValue: {
        fontSize: 16,
        color: '#6b7280',
    },
    actionButton: {
        backgroundColor: '#f3f4f6',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 12,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    logoutButton: {
        backgroundColor: '#fef2f2',
    },
    logoutButtonText: {
        color: '#dc2626',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 16,
    },
    statsCard: {
        backgroundColor: '#f8fafc',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        flex: 1,
        marginHorizontal: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    statsIcon: {
        fontSize: 24,
        marginBottom: 8,
    },
    statsValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 4,
    },
    statsTitle: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
    },
    courseCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    courseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    courseTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        flex: 1,
    },
    courseDifficulty: {
        fontSize: 12,
        fontWeight: '500',
        color: '#7c3aed',
        backgroundColor: '#f3e8ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    courseSubject: {
        fontSize: 14,
        color: '#059669',
        fontWeight: '500',
        marginBottom: 8,
    },
    courseDescription: {
        fontSize: 14,
        color: '#6b7280',
        lineHeight: 20,
        marginBottom: 12,
    },
    courseFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    courseStatus: {
        fontSize: 12,
        fontWeight: '500',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: '#d1fae5',
        color: '#065f46',
    },
    courseDate: {
        fontSize: 12,
        color: '#9ca3af',
    },
});