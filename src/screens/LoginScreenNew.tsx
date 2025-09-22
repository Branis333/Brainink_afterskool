import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

type LoginScreenProps = {
    navigation: NativeStackNavigationProp<any, 'Login'>;
};

// Get the correct backend URL based on environment
const getBackendUrl = () => {
    // In React Native, we'll always use the production backend
    return 'https://brainink-backend.onrender.com';
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
    const [form, setForm] = useState({
        username: '',
        password: '',
        email: '',
        fname: '',
        lname: '',
    });
    const [isLogin, setIsLogin] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAuth();

    const handleInputChange = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    // Function to handle successful authentication
    const handleSuccessfulAuth = async (data: any) => {
        try {
            // Store tokens using AsyncStorage (React Native equivalent of localStorage)
            await AsyncStorage.setItem('access_token', data.access_token);
            await AsyncStorage.setItem('encrypted_user_data', data.encrypted_data);

            console.log('Authentication successful:', data);

            // Create user data object for context
            let userData;
            if (data.user) {
                // If user data is provided directly
                userData = {
                    id: data.user.id,
                    username: data.user.username,
                    email: data.user.email,
                    fname: data.user.fname,
                    lname: data.user.lname,
                };
            } else {
                // Fallback to form data for now since encrypted_data requires decryption
                userData = {
                    id: data.id || 1, // Use ID from response or default
                    username: form.username,
                    email: form.email,
                    fname: form.fname,
                    lname: form.lname,
                };
            }

            await login(data.access_token, userData);
            navigation.navigate('CourseHomepage');
        } catch (error) {
            console.error('Error in handleSuccessfulAuth:', error);
            setError('Authentication succeeded but navigation failed');
        }
    };

    const validateForm = () => {
        if (!form.username.trim() || !form.password.trim()) {
            Alert.alert('Validation Error', 'Username and password are required');
            return false;
        }

        if (!isLogin) {
            if (!form.email.trim() || !form.fname.trim() || !form.lname.trim()) {
                Alert.alert('Validation Error', 'All fields are required for registration');
                return false;
            }
            if (form.password.length < 6) {
                Alert.alert('Validation Error', 'Password must be at least 6 characters');
                return false;
            }
        }

        return true;
    };

    const handleLogin = async () => {
        if (!validateForm()) return;

        setIsLoading(true);
        setError('');

        try {
            console.log('🔐 Attempting login...');
            const response = await fetch(`${getBackendUrl()}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: form.username,
                    password: form.password,
                }),
            });

            // Check if response has content before parsing
            const responseText = await response.text();
            console.log('Raw response:', responseText);

            if (!responseText) {
                throw new Error('Empty response from server');
            }

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON Parse Error:', parseError);
                console.error('Response text was:', responseText);
                throw new Error(`Invalid JSON response: ${responseText.slice(0, 100)}`);
            }

            console.log('Login response:', data);

            if (response.ok) {
                console.log('✅ Login successful');
                await handleSuccessfulAuth(data);
            } else {
                setError(data.detail || 'Invalid credentials');
            }
        } catch (error) {
            console.error('Login error:', error);
            if (error instanceof SyntaxError) {
                setError('Invalid response from server. Please try again.');
            } else if (error.message?.includes('Network') || error.message?.includes('Failed to fetch')) {
                setError('Network error: Unable to connect to server. Please check your internet connection and try again.');
            } else {
                setError('An unexpected error occurred. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignUp = async () => {
        if (!validateForm()) return;

        setIsLoading(true);
        setError('');

        try {
            console.log('📝 Attempting registration...');
            const response = await fetch(`${getBackendUrl()}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fname: form.fname,
                    lname: form.lname,
                    username: form.username,
                    email: form.email,
                    password: form.password,
                }),
            });

            // Check if response has content before parsing
            const responseText = await response.text();
            console.log('Raw registration response:', responseText);

            if (!responseText) {
                throw new Error('Empty response from server');
            }

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON Parse Error:', parseError);
                console.error('Response text was:', responseText);
                throw new Error(`Invalid JSON response: ${responseText.slice(0, 100)}`);
            }

            console.log('Registration response:', data);

            if (response.ok) {
                console.log('✅ Registration successful');
                await handleSuccessfulAuth(data);
            } else {
                setError(data.detail || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            if (error instanceof SyntaxError) {
                setError('Invalid response from server. Please try again.');
            } else if (error.message?.includes('Network') || error.message?.includes('Failed to fetch')) {
                setError('Network error: Unable to connect to server. Please check your internet connection and try again.');
            } else {
                setError('An unexpected error occurred. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = () => {
        if (isLogin) {
            handleLogin();
        } else {
            handleSignUp();
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.header}>
                    <Text style={styles.title}>BrainInk School</Text>
                    <Text style={styles.subtitle}>
                        {isLogin ? 'Welcome back!' : 'Create your account'}
                    </Text>
                </View>

                <View style={styles.form}>
                    {!isLogin && (
                        <>
                            <View style={styles.row}>
                                <View style={[styles.inputGroup, styles.halfWidth]}>
                                    <Text style={styles.label}>First Name</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={form.fname}
                                        onChangeText={(value) => handleInputChange('fname', value)}
                                        placeholder="First name"
                                        autoCapitalize="words"
                                    />
                                </View>
                                <View style={[styles.inputGroup, styles.halfWidth]}>
                                    <Text style={styles.label}>Last Name</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={form.lname}
                                        onChangeText={(value) => handleInputChange('lname', value)}
                                        placeholder="Last name"
                                        autoCapitalize="words"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Email</Text>
                                <TextInput
                                    style={styles.input}
                                    value={form.email}
                                    onChangeText={(value) => handleInputChange('email', value)}
                                    placeholder="Enter your email"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>
                        </>
                    )}

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Username</Text>
                        <TextInput
                            style={styles.input}
                            value={form.username}
                            onChangeText={(value) => handleInputChange('username', value)}
                            placeholder="Enter username or email"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={styles.passwordInput}
                                value={form.password}
                                onChangeText={(value) => handleInputChange('password', value)}
                                placeholder="Enter your password"
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity
                                style={styles.eyeButton}
                                onPress={() => setShowPassword(!showPassword)}
                            >
                                <Ionicons
                                    name={showPassword ? 'eye-off' : 'eye'}
                                    size={20}
                                    color="#6B7280"
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {error ? (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    <TouchableOpacity
                        style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.submitButtonText}>
                                {isLogin ? 'Login' : 'Create Account'}
                            </Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.switchButton}
                        onPress={() => {
                            setIsLogin(!isLogin);
                            setError('');
                        }}
                    >
                        <Text style={styles.switchText}>
                            {isLogin
                                ? "Don't have an account? Sign up"
                                : 'Already have an account? Login'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
    },
    form: {
        backgroundColor: '#FFFFFF',
        padding: 24,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    inputGroup: {
        marginBottom: 20,
    },
    halfWidth: {
        flex: 1,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#FFFFFF',
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
    },
    passwordInput: {
        flex: 1,
        padding: 12,
        fontSize: 16,
    },
    eyeButton: {
        padding: 12,
    },
    submitButton: {
        backgroundColor: '#3B82F6',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    submitButtonDisabled: {
        backgroundColor: '#9CA3AF',
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    switchButton: {
        alignItems: 'center',
        marginTop: 16,
    },
    switchText: {
        color: '#3B82F6',
        fontSize: 14,
        fontWeight: '500',
    },
    errorContainer: {
        backgroundColor: '#FEE2E2',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    errorText: {
        color: '#DC2626',
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '500',
    },
});
