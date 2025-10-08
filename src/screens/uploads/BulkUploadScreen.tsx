/**
 * Bulk Upload Screen
 * Bulk image-to-PDF upload interface with batch processing and conversion monitoring
 * Allows users to upload multiple images and combine them into a single PDF
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
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigatorNew';
import { uploadsService, UploadFile, BulkPDFUploadRequest, BulkPDFUploadResponse } from '../../services/uploadsService';
import { gradesService } from '../../services/gradesService';
import { useAuth } from '../../context/AuthContext';

// For React Native, we'll simulate file picker functionality
import * as DocumentPicker from 'expo-document-picker';

type Props = NativeStackScreenProps<RootStackParamList, 'BulkUpload'>;

interface BulkUploadProgress {
    progress: number;
    status: 'idle' | 'uploading' | 'converting' | 'processing' | 'completed' | 'error';
    message: string;
    currentStep: string;
}

interface FileItem {
    file: UploadFile;
    id: string;
    isValid: boolean;
    errorMessage?: string;
}

export const BulkUploadScreen: React.FC<Props> = ({ navigation, route }) => {
    const { token, user } = useAuth();
    const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
    const [courseId, setCourseId] = useState<string>(route.params?.courseId ? String(route.params.courseId) : '');
    const [assignmentId, setAssignmentId] = useState<string>(route.params?.assignmentId ? String(route.params.assignmentId) : '');
    const [blockId, setBlockId] = useState<string>(route.params?.blockId ? String(route.params.blockId) : '');
    const [submissionType, setSubmissionType] = useState<'homework' | 'quiz' | 'practice' | 'assessment'>('homework');
    const [uploadProgress, setUploadProgress] = useState<BulkUploadProgress>({
        progress: 0,
        status: 'idle',
        message: '',
        currentStep: '',
    });
    const [totalFileSize, setTotalFileSize] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(false);

    const screenWidth = Dimensions.get('window').width;
    const maxFiles = 20;

    // Pre-fill session ID if provided from navigation
    useEffect(() => {
        if (route.params?.courseId) setCourseId(String(route.params.courseId));
        if (route.params?.assignmentId) setAssignmentId(String(route.params.assignmentId));
        if (route.params?.blockId) setBlockId(String(route.params.blockId));
        if (route.params?.submissionType) setSubmissionType(route.params.submissionType);
    }, [route.params]);

    // Update total file size when files change
    useEffect(() => {
        const total = selectedFiles.reduce((sum, item) => sum + (item.file.size || 0), 0);
        setTotalFileSize(total);
    }, [selectedFiles]);

    const handleFilesPicker = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'image/*',
                multiple: true,
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets) {
                const newFileItems: FileItem[] = [];

                for (const asset of result.assets) {
                    if (selectedFiles.length + newFileItems.length >= maxFiles) {
                        Alert.alert('Limit Reached', `Maximum ${maxFiles} files allowed`);
                        break;
                    }

                    const uploadFile: UploadFile = {
                        uri: asset.uri,
                        name: asset.name || 'unknown',
                        type: asset.mimeType || 'image/jpeg',
                        size: asset.size || 0,
                    };

                    const validation = uploadsService.validateFile(uploadFile);
                    const fileItem: FileItem = {
                        file: uploadFile,
                        id: `${Date.now()}_${Math.random()}`,
                        isValid: validation.valid,
                        errorMessage: validation.error,
                    };

                    newFileItems.push(fileItem);
                }

                setSelectedFiles(prev => [...prev, ...newFileItems]);
            }
        } catch (error) {
            console.error('File picker error:', error);
            Alert.alert('Error', 'Failed to select files');
        }
    };

    const removeFile = (fileId: string) => {
        setSelectedFiles(prev => prev.filter(item => item.id !== fileId));
    };

    const removeAllFiles = () => {
        Alert.alert(
            'Remove All Files',
            'Are you sure you want to remove all selected files?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove All', style: 'destructive', onPress: () => setSelectedFiles([]) },
            ]
        );
    };

    const reorderFiles = (fromIndex: number, toIndex: number) => {
        const updatedFiles = [...selectedFiles];
        const [movedFile] = updatedFiles.splice(fromIndex, 1);
        updatedFiles.splice(toIndex, 0, movedFile);
        setSelectedFiles(updatedFiles);
    };

    const validateBulkUpload = (): { valid: boolean; error?: string } => {
        if (selectedFiles.length === 0) {
            return { valid: false, error: 'Please select at least one file' };
        }

        if (!courseId.trim()) return { valid: false, error: 'Missing course ID' };
        if (!assignmentId.trim()) return { valid: false, error: 'Missing assignment ID' };

        const invalidFiles = selectedFiles.filter(item => !item.isValid);
        if (invalidFiles.length > 0) {
            return { valid: false, error: `${invalidFiles.length} file(s) have validation errors` };
        }

        const validFiles = selectedFiles.filter(item => item.isValid).map(item => item.file);
        const sizeValidation = uploadsService.validateTotalFileSize(validFiles);
        if (!sizeValidation.valid) {
            return { valid: false, error: sizeValidation.error };
        }

        return { valid: true };
    };

    const handleBulkUpload = async () => {
        const validation = validateBulkUpload();
        if (!validation.valid) {
            Alert.alert('Validation Error', validation.error);
            return;
        }

        if (!token) {
            Alert.alert('Error', 'Authentication required');
            return;
        }

        try {
            setIsLoading(true);
            setUploadProgress({
                progress: 5,
                status: 'uploading',
                message: 'Starting bulk upload...',
                currentStep: 'Preparing files',
            });

            const validFiles = selectedFiles.filter(item => item.isValid).map(item => item.file);

            const uploadRequest: BulkPDFUploadRequest = {
                course_id: parseInt(courseId),
                submission_type: submissionType,
                files: validFiles,
                storage_mode: 'database',
                skip_db: false,
                assignment_id: parseInt(assignmentId),
                block_id: blockId ? parseInt(blockId) : undefined,
            };

            // Simulate upload progress
            let currentProgress = 10;
            const progressInterval = setInterval(() => {
                if (currentProgress < 80) {
                    currentProgress += 10;
                    setUploadProgress(prev => ({
                        ...prev,
                        progress: currentProgress,
                        message: `Uploading files... ${currentProgress}%`,
                        currentStep: `Uploading ${Math.floor((currentProgress / 80) * validFiles.length)}/${validFiles.length} files`,
                    }));
                }
            }, 800);

            clearInterval(progressInterval);

            // Use the new workflow integration method
            const assignmentIdLocal = parseInt(assignmentId || String(route.params?.assignmentId || '0'));
            setUploadProgress({
                progress: 70,
                status: 'uploading',
                message: 'Starting automatic workflow...',
                currentStep: 'Integrating with assignment system',
            });

            const workflowResult = await uploadsService.uploadImagesForAssignmentWorkflow(
                parseInt(courseId),
                assignmentIdLocal,
                validFiles,
                token,
                submissionType,
                {
                    lesson_id: route.params?.lessonId,
                    block_id: route.params?.blockId,
                }
            );

            setUploadProgress({
                progress: 85,
                status: 'converting',
                message: 'Converting images to PDF...',
                currentStep: 'Automatic PDF generation',
            });

            // Simulate brief delay to show PDF conversion
            await new Promise(resolve => setTimeout(resolve, 1000));

            setUploadProgress({
                progress: 95,
                status: 'processing',
                message: 'Auto-grading in progress...',
                currentStep: 'AI processing without user intervention',
            });

            // Brief delay to show AI processing
            await new Promise(resolve => setTimeout(resolve, 1500));

            setUploadProgress({
                progress: 100,
                status: 'completed',
                message: 'Workflow completed successfully!',
                currentStep: 'Ready for next assignment',
            });

            Alert.alert(
                'Assignment Workflow Complete',
                `Successfully uploaded ${validFiles.length} images, converted to PDF, and automatically graded!\n\nYour results are ready to view.`,
                [
                    {
                        text: 'View Results',
                        onPress: () => navigation.navigate('GradesOverview'),
                    },
                    {
                        text: 'Continue Learning',
                        onPress: () => navigation.navigate('CourseHomepage'),
                    },
                    {
                        text: 'Upload More',
                        onPress: () => {
                            setSelectedFiles([]);
                            setUploadProgress({
                                progress: 0,
                                status: 'idle',
                                message: '',
                                currentStep: '',
                            });
                        },
                    },
                ]
            );

        } catch (error) {
            console.error('Bulk upload error:', error);
            setUploadProgress({
                progress: 0,
                status: 'error',
                message: 'Bulk upload failed. Please try again.',
                currentStep: 'Upload failed',
            });
            Alert.alert('Error', error instanceof Error ? error.message : 'Bulk upload failed');
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusColor = (): string => {
        switch (uploadProgress.status) {
            case 'uploading':
                return '#3B82F6';
            case 'converting':
                return '#8B5CF6';
            case 'processing':
                return '#F59E0B';
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

    const renderFileItem = ({ item, index }: { item: FileItem; index: number }) => (
        <View style={[styles.fileItem, !item.isValid && styles.fileItemInvalid]}>
            <View style={styles.fileHeader}>
                <View style={styles.fileInfo}>
                    <Text style={styles.fileIndex}>{index + 1}</Text>
                    <Text style={styles.fileIcon}>🖼️</Text>
                    <View style={styles.fileDetails}>
                        <Text style={styles.fileName} numberOfLines={1}>
                            {item.file.name}
                        </Text>
                        <Text style={styles.fileSize}>
                            {item.file.size ? uploadsService.formatFileSize(item.file.size) : 'Unknown size'}
                        </Text>
                    </View>
                </View>

                {(uploadProgress.status === 'idle' || uploadProgress.status === 'error') && (
                    <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeFile(item.id)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.removeButtonText}>✕</Text>
                    </TouchableOpacity>
                )}
            </View>

            {!item.isValid && item.errorMessage && (
                <Text style={styles.fileError}>{item.errorMessage}</Text>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.safeContainer}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Bulk Upload</Text>
                    <Text style={styles.headerSubtitle}>
                        Upload multiple images and combine them into a PDF
                    </Text>
                </View>

                <ScrollView style={styles.scrollContainer}>
                    {/* Upload Form */}
                    <View style={styles.form}>
                        {/* Context Inputs */}

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Course ID *</Text>
                            <TextInput
                                style={styles.textInput}
                                value={courseId}
                                onChangeText={setCourseId}
                                placeholder="Enter course ID"
                                keyboardType="numeric"
                                editable={uploadProgress.status === 'idle' || uploadProgress.status === 'error'}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Assignment ID *</Text>
                            <TextInput
                                style={styles.textInput}
                                value={assignmentId}
                                onChangeText={setAssignmentId}
                                placeholder="Enter assignment ID"
                                keyboardType="numeric"
                                editable={uploadProgress.status === 'idle' || uploadProgress.status === 'error'}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Block ID (optional)</Text>
                            <TextInput
                                style={styles.textInput}
                                value={blockId}
                                onChangeText={setBlockId}
                                placeholder="Enter block ID (if applicable)"
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
                                        disabled={uploadProgress.status !== 'idle' && uploadProgress.status !== 'error'}
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
                            <View style={styles.filesHeader}>
                                <Text style={styles.inputLabel}>
                                    Selected Images ({selectedFiles.length}/{maxFiles})
                                </Text>
                                {selectedFiles.length > 0 && (
                                    <View style={styles.fileSizeInfo}>
                                        <Text style={styles.fileSizeText}>
                                            Total: {uploadsService.formatFileSize(totalFileSize)}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {selectedFiles.length === 0 ? (
                                <TouchableOpacity
                                    style={styles.filePickerButton}
                                    onPress={handleFilesPicker}
                                    activeOpacity={0.7}
                                    disabled={uploadProgress.status !== 'idle' && uploadProgress.status !== 'error'}
                                >
                                    <View style={styles.filePickerContent}>
                                        <Text style={styles.filePickerIcon}>📚</Text>
                                        <Text style={styles.filePickerText}>Tap to select images</Text>
                                        <Text style={styles.filePickerSubtext}>
                                            Select multiple images to combine into PDF
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ) : (
                                <View style={styles.filesContainer}>
                                    <View style={styles.filesActions}>
                                        <TouchableOpacity
                                            style={styles.addMoreButton}
                                            onPress={handleFilesPicker}
                                            activeOpacity={0.7}
                                            disabled={
                                                selectedFiles.length >= maxFiles ||
                                                (uploadProgress.status !== 'idle' && uploadProgress.status !== 'error')
                                            }
                                        >
                                            <Text style={styles.addMoreText}>+ Add More Images</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.removeAllButton}
                                            onPress={removeAllFiles}
                                            activeOpacity={0.7}
                                            disabled={uploadProgress.status !== 'idle' && uploadProgress.status !== 'error'}
                                        >
                                            <Text style={styles.removeAllText}>Remove All</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <FlatList
                                        data={selectedFiles}
                                        renderItem={renderFileItem}
                                        keyExtractor={(item) => item.id}
                                        style={styles.filesList}
                                        scrollEnabled={false}
                                    />
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

                                {uploadProgress.currentStep && (
                                    <Text style={styles.progressStep}>
                                        {uploadProgress.currentStep}
                                    </Text>
                                )}
                            </View>
                        )}

                        {/* Upload Button */}
                        <TouchableOpacity
                            style={[
                                styles.uploadButton,
                                (selectedFiles.length === 0 ||
                                    !courseId.trim() ||
                                    !assignmentId.trim() ||
                                    uploadProgress.status === 'uploading' ||
                                    uploadProgress.status === 'converting' ||
                                    uploadProgress.status === 'processing') &&
                                styles.uploadButtonDisabled,
                            ]}
                            onPress={handleBulkUpload}
                            activeOpacity={0.7}
                            disabled={
                                selectedFiles.length === 0 ||
                                !courseId.trim() ||
                                !assignmentId.trim() ||
                                uploadProgress.status === 'uploading' ||
                                uploadProgress.status === 'converting' ||
                                uploadProgress.status === 'processing' ||
                                isLoading
                            }
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.uploadButtonText}>
                                    {uploadProgress.status === 'completed'
                                        ? 'Upload More Files'
                                        : `Upload ${selectedFiles.length} Image${selectedFiles.length !== 1 ? 's' : ''} to PDF`
                                    }
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Help Section */}
                    <View style={styles.helpSection}>
                        <Text style={styles.helpTitle}>Bulk Upload Guidelines</Text>
                        <View style={styles.helpItem}>
                            <Text style={styles.helpBullet}>•</Text>
                            <Text style={styles.helpText}>Upload up to {maxFiles} image files at once</Text>
                        </View>
                        <View style={styles.helpItem}>
                            <Text style={styles.helpBullet}>•</Text>
                            <Text style={styles.helpText}>Images will be combined into a single PDF document</Text>
                        </View>
                        <View style={styles.helpItem}>
                            <Text style={styles.helpBullet}>•</Text>
                            <Text style={styles.helpText}>Supported formats: JPG, PNG, GIF, BMP, WebP</Text>
                        </View>
                        <View style={styles.helpItem}>
                            <Text style={styles.helpBullet}>•</Text>
                            <Text style={styles.helpText}>Files are ordered as displayed - drag to reorder</Text>
                        </View>
                    </View>
                </ScrollView>
            </View>
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
    scrollContainer: {
        flex: 1,
    },
    form: {
        padding: 20,
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
    filesHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    fileSizeInfo: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    fileSizeText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
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
    filesContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        overflow: 'hidden',
    },
    filesActions: {
        flexDirection: 'row',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        gap: 8,
    },
    addMoreButton: {
        flex: 1,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    addMoreText: {
        fontSize: 14,
        color: '#3B82F6',
        fontWeight: '600',
    },
    removeAllButton: {
        backgroundColor: '#FEE2E2',
        borderRadius: 8,
        padding: 12,
        paddingHorizontal: 16,
    },
    removeAllText: {
        fontSize: 14,
        color: '#DC2626',
        fontWeight: '600',
    },
    filesList: {
        maxHeight: 300,
    },
    fileItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    fileItemInvalid: {
        backgroundColor: '#FEF2F2',
    },
    fileHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    fileInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    fileIndex: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: 'bold',
        width: 20,
        textAlign: 'center',
    },
    fileIcon: {
        fontSize: 20,
        marginHorizontal: 8,
    },
    fileDetails: {
        flex: 1,
    },
    fileName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
        marginBottom: 2,
    },
    fileSize: {
        fontSize: 12,
        color: '#6B7280',
    },
    removeButton: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: '#FEE2E2',
    },
    removeButtonText: {
        fontSize: 14,
        color: '#DC2626',
        fontWeight: 'bold',
    },
    fileError: {
        fontSize: 12,
        color: '#DC2626',
        marginTop: 4,
        marginLeft: 48,
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
        marginBottom: 4,
    },
    progressStep: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        fontStyle: 'italic',
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
});