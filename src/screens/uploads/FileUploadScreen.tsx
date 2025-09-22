/**
 * File Upload Screen
 * Interactive single file upload interface with validation, preview, and progress tracking
 * Supports drag-and-drop, file selection, and real-time upload monitoring
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
    Dimensions,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigatorNew';
import { uploadsService, UploadFile, AISubmission } from '../../services/uploadsService';
import { useAuth } from '../../context/AuthContext';

// For React Native, we'll simulate file picker functionality
// In a real app, you'd use react-native-document-picker or similar
import * as DocumentPicker from 'expo-document-picker';

type Props = NativeStackScreenProps<RootStackParamList, 'FileUpload'>;

interface UploadProgress {
    progress: number;
    status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
    message: string;
}

export const FileUploadScreen: React.FC<Props> = ({ navigation, route }) => {
    const { token, user } = useAuth();
    const [selectedFile, setSelectedFile] = useState<UploadFile | null>(null);
    const [sessionId, setSessionId] = useState<string>('');
    const [submissionType, setSubmissionType] = useState<'homework' | 'quiz' | 'practice' | 'assessment'>('homework');
    const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
        progress: 0,
        status: 'idle',
        message: '',
    });
    const [validationError, setValidationError] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    const screenWidth = Dimensions.get('window').width;

    // Pre-fill session ID if provided from navigation
    useEffect(() => {
        if (route.params?.sessionId) {
            setSessionId(route.params.sessionId.toString());
        }
        if (route.params?.submissionType) {
            setSubmissionType(route.params.submissionType);
        }
    }, [route.params]);

    const handleFilePicker = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                const uploadFile: UploadFile = {
                    uri: asset.uri,
                    name: asset.name || 'unknown',
                    type: asset.mimeType || 'application/octet-stream',
                    size: asset.size || 0,
                };

                // Validate the selected file
                const validation = uploadsService.validateFile(uploadFile);
                if (!validation.valid) {
                    setValidationError(validation.error || 'File validation failed');
                    return;
                }

                setSelectedFile(uploadFile);
                setValidationError('');
            }
        } catch (error) {
            console.error('File picker error:', error);
            Alert.alert('Error', 'Failed to select file');
        }
    };

    const removeSelectedFile = () => {
        setSelectedFile(null);
        setValidationError('');
        setUploadProgress({
            progress: 0,
            status: 'idle',
            message: '',
        });
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            Alert.alert('Error', 'Please select a file to upload');
            return;
        }

        if (!sessionId.trim()) {
            Alert.alert('Error', 'Please enter a session ID');
            return;
        }

        if (!token) {
            Alert.alert('Error', 'Authentication required');
            return;
        }

        try {
            setIsLoading(true);
            setUploadProgress({
                progress: 10,
                status: 'uploading',
                message: 'Starting upload...',
            });

            // Simulate upload progress
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev.progress < 90) {
                        return {
                            ...prev,
                            progress: prev.progress + 10,
                            message: `Uploading... ${prev.progress + 10}%`,
                        };
                    }
                    return prev;
                });
            }, 500);

            // Perform the actual upload
            const result = await uploadsService.uploadSingleFile(
                parseInt(sessionId),
                selectedFile,
                submissionType,
                token
            );

            clearInterval(progressInterval);

            setUploadProgress({
                progress: 100,
                status: 'processing',
                message: 'Processing with AI...',
            });

            // Simulate AI processing delay
            setTimeout(() => {
                setUploadProgress({
                    progress: 100,
                    status: 'completed',
                    message: 'Upload completed successfully!',
                });

                Alert.alert(
                    'Success',
                    'File uploaded successfully and is being processed by AI.',
                    [
                        {
                            text: 'View Details',
                            onPress: () => navigation.navigate('GradeDetails', {
                                submissionId: result.id,
                                submissionType: result.submission_type as any,
                            }),
                        },
                        {
                            text: 'Upload Another',
                            onPress: () => {
                                removeSelectedFile();
                                setSessionId('');
                            },
                        },
                        {
                            text: 'Go to Overview',
                            onPress: () => navigation.navigate('UploadsOverview'),
                        },
                    ]
                );
            }, 2000);

        } catch (error) {
            console.error('Upload error:', error);
            setUploadProgress({
                progress: 0,
                status: 'error',
                message: 'Upload failed. Please try again.',
            });
            Alert.alert('Error', error instanceof Error ? error.message : 'Upload failed');
        } finally {
            setIsLoading(false);
        }
    };

    const getFileTypeIcon = (file: UploadFile): string => {
        const category = uploadsService.getFileTypeCategory(file);
        switch (category) {
            case 'image':
                return '🖼️';
            case 'document':
                return '📄';
            default:
                return '📎';
        }
    };

    const getStatusColor = (): string => {
        switch (uploadProgress.status) {
            case 'uploading':
                return '#3B82F6';
            case 'processing':
                return '#8B5CF6';
            case 'completed':
                return '#10B981';
            case 'error':
                return '#EF4444';
            default:
                return '#6B7280';
        }
    };

    const submissionTypes = [
        { value: 'homework', label: 'Homework Assignment', icon: '📝' },
        { value: 'quiz', label: 'Quiz Submission', icon: '❓' },
        { value: 'practice', label: 'Practice Exercise', icon: '🔄' },
        { value: 'assessment', label: 'Assessment Task', icon: '📊' },
    ];

    return (
        <SafeAreaView style={styles.safeContainer}>
            <ScrollView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Upload File</Text>
                    <Text style={styles.headerSubtitle}>
                        Upload a single file for AI processing and grading
                    </Text>
                </View>

                {/* Upload Form */}
                <View style={styles.form}>
                    {/* Session ID Input */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Session ID *</Text>
                        <TextInput
                            style={styles.textInput}
                            value={sessionId}
                            onChangeText={setSessionId}
                            placeholder="Enter session ID"
                            keyboardType="numeric"
                            editable={uploadProgress.status === 'idle' || uploadProgress.status === 'error'}
                        />
                    </View>

                    {/* Submission Type Selection */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Submission Type *</Text>
                        <View style={styles.typeSelection}>
                            {submissionTypes.map((type) => (
                                <TouchableOpacity
                                    key={type.value}
                                    style={[
                                        styles.typeButton,
                                        submissionType === type.value && styles.typeButtonActive,
                                    ]}
                                    onPress={() => setSubmissionType(type.value as any)}
                                    activeOpacity={0.7}
                                    disabled={uploadProgress.status === 'uploading' || uploadProgress.status === 'processing'}
                                >
                                    <Text style={styles.typeIcon}>{type.icon}</Text>
                                    <Text
                                        style={[
                                            styles.typeText,
                                            submissionType === type.value && styles.typeTextActive,
                                        ]}
                                    >
                                        {type.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* File Selection */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Select File *</Text>

                        {!selectedFile ? (
                            <TouchableOpacity
                                style={styles.filePickerButton}
                                onPress={handleFilePicker}
                                activeOpacity={0.7}
                                disabled={uploadProgress.status === 'uploading' || uploadProgress.status === 'processing'}
                            >
                                <View style={styles.filePickerContent}>
                                    <Text style={styles.filePickerIcon}>📁</Text>
                                    <Text style={styles.filePickerText}>Tap to select file</Text>
                                    <Text style={styles.filePickerSubtext}>
                                        Supported: Images, PDFs, Documents (Max 20MB)
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.selectedFileContainer}>
                                <View style={styles.selectedFileInfo}>
                                    <Text style={styles.selectedFileIcon}>
                                        {getFileTypeIcon(selectedFile)}
                                    </Text>
                                    <View style={styles.selectedFileDetails}>
                                        <Text style={styles.selectedFileName} numberOfLines={1}>
                                            {selectedFile.name}
                                        </Text>
                                        <Text style={styles.selectedFileSize}>
                                            {selectedFile.size ? uploadsService.formatFileSize(selectedFile.size) : 'Unknown size'}
                                        </Text>
                                    </View>
                                    {(uploadProgress.status === 'idle' || uploadProgress.status === 'error') && (
                                        <TouchableOpacity
                                            style={styles.removeFileButton}
                                            onPress={removeSelectedFile}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.removeFileText}>✕</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Validation Error */}
                                {validationError ? (
                                    <View style={styles.errorContainer}>
                                        <Text style={styles.errorText}>{validationError}</Text>
                                    </View>
                                ) : null}
                            </View>
                        )}
                    </View>

                    {/* Upload Progress */}
                    {uploadProgress.status !== 'idle' && (
                        <View style={styles.progressContainer}>
                            <View style={styles.progressHeader}>
                                <Text style={styles.progressLabel}>Upload Progress</Text>
                                <Text style={styles.progressPercent}>{uploadProgress.progress}%</Text>
                            </View>

                            <View style={styles.progressBar}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        {
                                            width: `${uploadProgress.progress}%`,
                                            backgroundColor: getStatusColor(),
                                        },
                                    ]}
                                />
                            </View>

                            <Text style={[styles.progressMessage, { color: getStatusColor() }]}>
                                {uploadProgress.message}
                            </Text>
                        </View>
                    )}

                    {/* Upload Button */}
                    <TouchableOpacity
                        style={[
                            styles.uploadButton,
                            (!selectedFile || !sessionId.trim() || uploadProgress.status === 'uploading' || uploadProgress.status === 'processing') &&
                            styles.uploadButtonDisabled,
                        ]}
                        onPress={handleUpload}
                        activeOpacity={0.7}
                        disabled={
                            !selectedFile ||
                            !sessionId.trim() ||
                            uploadProgress.status === 'uploading' ||
                            uploadProgress.status === 'processing' ||
                            isLoading
                        }
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.uploadButtonText}>
                                {uploadProgress.status === 'completed' ? 'Upload Another File' : 'Upload File'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Help Section */}
                <View style={styles.helpSection}>
                    <Text style={styles.helpTitle}>Upload Guidelines</Text>
                    <View style={styles.helpItem}>
                        <Text style={styles.helpBullet}>•</Text>
                        <Text style={styles.helpText}>Maximum file size: 20MB</Text>
                    </View>
                    <View style={styles.helpItem}>
                        <Text style={styles.helpBullet}>•</Text>
                        <Text style={styles.helpText}>Supported formats: Images, PDFs, Word documents</Text>
                    </View>
                    <View style={styles.helpItem}>
                        <Text style={styles.helpBullet}>•</Text>
                        <Text style={styles.helpText}>Files will be processed by AI for automatic grading</Text>
                    </View>
                    <View style={styles.helpItem}>
                        <Text style={styles.helpBullet}>•</Text>
                        <Text style={styles.helpText}>You'll receive feedback and scores within minutes</Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.quickActions}>
                    <TouchableOpacity
                        style={styles.quickActionButton}
                        onPress={() => navigation.navigate('BulkUpload')}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.quickActionText}>📚 Upload Multiple Files</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.quickActionButton}
                        onPress={() => navigation.navigate('UploadProgress')}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.quickActionText}>⏳ View Upload Progress</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    backButton: {
        marginBottom: 16,
        alignSelf: 'flex-start',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
    },
    backButtonText: {
        fontSize: 16,
        color: '#3B82F6',
        fontWeight: '600',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#6B7280',
    },
    form: {
        padding: 20,
        paddingTop: 24,
    },
    inputGroup: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    textInput: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#111827',
    },
    typeSelection: {
        gap: 8,
    },
    typeButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    typeButtonActive: {
        borderColor: '#3B82F6',
        backgroundColor: '#EFF6FF',
    },
    typeIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    typeText: {
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '500',
    },
    typeTextActive: {
        color: '#3B82F6',
        fontWeight: '600',
    },
    filePickerButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#D1D5DB',
        borderStyle: 'dashed',
        borderRadius: 12,
        padding: 32,
        alignItems: 'center',
    },
    filePickerContent: {
        alignItems: 'center',
    },
    filePickerIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    filePickerText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 4,
    },
    filePickerSubtext: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    selectedFileContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        overflow: 'hidden',
    },
    selectedFileInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    selectedFileIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    selectedFileDetails: {
        flex: 1,
    },
    selectedFileName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    selectedFileSize: {
        fontSize: 14,
        color: '#6B7280',
    },
    removeFileButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#FEE2E2',
    },
    removeFileText: {
        fontSize: 16,
        color: '#DC2626',
        fontWeight: 'bold',
    },
    errorContainer: {
        backgroundColor: '#FEE2E2',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#FECACA',
    },
    errorText: {
        fontSize: 14,
        color: '#DC2626',
        textAlign: 'center',
    },
    progressContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        marginBottom: 20,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    progressLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    progressPercent: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    progressBar: {
        height: 8,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    progressMessage: {
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
    },
    uploadButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    uploadButtonDisabled: {
        backgroundColor: '#9CA3AF',
    },
    uploadButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    helpSection: {
        backgroundColor: '#FFFFFF',
        margin: 20,
        marginTop: 0,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    helpTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    helpItem: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    helpBullet: {
        fontSize: 14,
        color: '#6B7280',
        marginRight: 8,
    },
    helpText: {
        fontSize: 14,
        color: '#6B7280',
        flex: 1,
    },
    quickActions: {
        padding: 20,
        paddingTop: 0,
        gap: 12,
    },
    quickActionButton: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    quickActionText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
});