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
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { profileService, UpdateProfileRequest, User } from '../services/profileService';

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

    useEffect(() => {
        const load = async () => {
            try {
                if (!token) throw new Error('Not authenticated');
                setLoading(true);
                const profile: User = await profileService.getUserProfile(token);
                setFormData({
                    fname: profile.fname || '',
                    lname: profile.lname || '',
                    email: profile.email || '',
                    username: profile.username || '',
                });
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

    const handleSave = async () => {
        try {
            if (!token) return;
            setSaving(true);
            const update: UpdateProfileRequest = { ...formData };
            await profileService.updateProfile(token, update);
            Alert.alert('Success', 'Profile updated successfully');
            navigation.goBack();
        } catch (e) {
            console.error('Save profile error', e);
            Alert.alert('Error', 'Failed to update profile');
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
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>{'<'} Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <View style={{ width: 64 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>First Name</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.fname}
                            onChangeText={(text) => setFormData((p) => ({ ...p, fname: text }))}
                            placeholder="Enter first name"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Last Name</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.lname}
                            onChangeText={(text) => setFormData((p) => ({ ...p, lname: text }))}
                            placeholder="Enter last name"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Username</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.username}
                            onChangeText={(text) => setFormData((p) => ({ ...p, username: text }))}
                            placeholder="Enter username"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.email}
                            onChangeText={(text) => setFormData((p) => ({ ...p, email: text }))}
                            placeholder="Enter email"
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
                        <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { marginTop: 12, color: '#666' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    backBtn: { paddingVertical: 8, paddingHorizontal: 8 },
    backText: { color: '#007AFF', fontWeight: '600' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    content: { paddingBottom: 120 },
    section: {
        backgroundColor: '#fff',
        marginTop: 16,
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 16,
    },
    sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16, color: '#1a1a1a' },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#374151' },
    input: {
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#111827',
    },
    saveBtn: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    saveText: { color: '#fff', fontWeight: '700' },
});

export default EditProfileScreen;