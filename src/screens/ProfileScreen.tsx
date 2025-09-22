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
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({
        fname: '',
        lname: '',
        email: '',
        username: '',
    });

    useEffect(() => {
        loadProfile();
    }, []);

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
            setFormData({
                fname: profile.fname || '',
                lname: profile.lname || '',
                email: profile.email || '',
                username: profile.username || '',
            });
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

    const handleSaveProfile = async () => {
        if (!token) return;

        try {
            setLoading(true);

            const updateData: UpdateProfileRequest = {
                fname: formData.fname,
                lname: formData.lname,
                email: formData.email,
                username: formData.username,
            };

            const updatedProfile = await profileService.updateProfile(token, updateData);
            setProfileData(updatedProfile);
            setEditing(false);
            Alert.alert('Success', 'Profile updated successfully!');
        } catch (error) {
            console.error('Error updating profile:', error);
            Alert.alert('Error', 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

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
                            logout();
                        } catch (error) {
                            console.error('Logout error:', error);
                            logout(); // Force logout even if API call fails
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
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Profile</Text>
                    <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => setEditing(!editing)}
                    >
                        <Text style={styles.editButtonText}>
                            {editing ? 'Cancel' : 'Edit'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Profile Information */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>First Name</Text>
                        <TextInput
                            style={[styles.input, !editing && styles.inputDisabled]}
                            value={formData.fname}
                            onChangeText={(text) => setFormData(prev => ({ ...prev, fname: text }))}
                            editable={editing}
                            placeholder="Enter first name"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Last Name</Text>
                        <TextInput
                            style={[styles.input, !editing && styles.inputDisabled]}
                            value={formData.lname}
                            onChangeText={(text) => setFormData(prev => ({ ...prev, lname: text }))}
                            editable={editing}
                            placeholder="Enter last name"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Username</Text>
                        <TextInput
                            style={[styles.input, !editing && styles.inputDisabled]}
                            value={formData.username}
                            onChangeText={(text) => setFormData(prev => ({ ...prev, username: text }))}
                            editable={editing}
                            placeholder="Enter username"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={[styles.input, !editing && styles.inputDisabled]}
                            value={formData.email}
                            onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
                            editable={editing}
                            placeholder="Enter email"
                            keyboardType="email-address"
                        />
                    </View>

                    {editing && (
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSaveProfile}
                        >
                            <Text style={styles.saveButtonText}>Save Changes</Text>
                        </TouchableOpacity>
                    )}
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