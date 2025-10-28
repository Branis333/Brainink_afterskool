/**
 * Upload Note Screen
 * Allows users to upload notes as images with metadata
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    Dimensions,
    StatusBar,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { notesService, UploadFile, NoteUploadRequest } from '../../services/notesService';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

type NavigationProp = NativeStackNavigationProp<any>;

interface Props {
    navigation: NavigationProp;
}

const { width } = Dimensions.get('window');

export const UploadNoteScreen: React.FC<Props> = ({ navigation }) => {
    const { token } = useAuth();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [subject, setSubject] = useState('');
    const [tags, setTags] = useState('');
    const [selectedImages, setSelectedImages] = useState<UploadFile[]>([]);
    const [uploading, setUploading] = useState(false);

    // Pick images from gallery
    const pickImages = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsMultipleSelection: true,
                quality: 0.8,
                allowsEditing: false,
            });

            if (!result.canceled && result.assets) {
                const newImages: UploadFile[] = result.assets.map((asset) => ({
                    uri: asset.uri,
                    type: 'image/jpeg',
                    name: asset.fileName || `note_${Date.now()}.jpg`,
                    size: asset.fileSize,
                }));

                setSelectedImages([...selectedImages, ...newImages]);
            }
        } catch (error) {
            console.error('Error picking images:', error);
            Alert.alert('Error', 'Failed to pick images');
        }
    };

    // Take photo with camera
    const takePhoto = async () => {
        try {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission Required', 'Camera permission is required to take photos');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                quality: 0.8,
                allowsEditing: false,
            });

            if (!result.canceled && result.assets[0]) {
                const newImage: UploadFile = {
                    uri: result.assets[0].uri,
                    type: 'image/jpeg',
                    name: result.assets[0].fileName || `note_${Date.now()}.jpg`,
                    size: result.assets[0].fileSize,
                };

                setSelectedImages([...selectedImages, newImage]);
            }
        } catch (error) {
            console.error('Error taking photo:', error);
            Alert.alert('Error', 'Failed to take photo');
        }
    };

    // Remove image
    const removeImage = (index: number) => {
        const newImages = selectedImages.filter((_, i) => i !== index);
        setSelectedImages(newImages);
    };

    // Validate form
    const validateForm = (): boolean => {
        if (!title.trim()) {
            Alert.alert('Required Field', 'Please enter a title for your note');
            return false;
        }

        if (selectedImages.length === 0) {
            Alert.alert('No Images', 'Please select at least one image');
            return false;
        }

        return true;
    };

    // Handle upload
    const handleUpload = async () => {
        if (!validateForm() || !token) return;

        try {
            setUploading(true);

            const uploadRequest: NoteUploadRequest = {
                title: title.trim(),
                files: selectedImages,
                description: description.trim() || undefined,
                subject: subject.trim() || undefined,
                tags: tags.trim() || undefined,
            };

            const result = await notesService.uploadAndAnalyzeNotes(uploadRequest, token);

            Alert.alert(
                'Success! 🎉',
                'Your note has been uploaded and is being analyzed by AI!',
                [
                    {
                        text: 'View Note',
                        onPress: () => {
                            // Navigate to the newly created note - backend returns note_id directly
                            navigation.replace('NoteDetails', { noteId: result.note_id });
                        },
                    },
                    {
                        text: 'Back to Notes',
                        style: 'cancel',
                        onPress: () => navigation.navigate('NotesList'),
                    },
                ]
            );
        } catch (error) {
            console.error('Error uploading note:', error);
            Alert.alert('Upload Failed', error instanceof Error ? error.message : 'Failed to upload note');
        } finally {
            setUploading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="light-content" backgroundColor="#7C5CFF" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Upload Note</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {/* Instructions Card */}
                <View style={styles.instructionsCard}>
                    <Ionicons name="information-circle" size={24} color="#007AFF" />
                    <Text style={styles.instructionsText}>
                        Upload images of your school notes and our AI will analyze them to provide summaries, key points, and study questions.
                    </Text>
                </View>

                {/* Title Input */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>
                        Title <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g., Math Chapter 5 Notes"
                        value={title}
                        onChangeText={setTitle}
                        placeholderTextColor="#999"
                    />
                </View>

                {/* Subject Input */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Subject</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g., Mathematics, Science, History"
                        value={subject}
                        onChangeText={setSubject}
                        placeholderTextColor="#999"
                    />
                </View>

                {/* Description Input */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Description (Optional)</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Add any additional context about these notes..."
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                        placeholderTextColor="#999"
                    />
                </View>

                {/* Tags Input */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Tags (Optional)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g., algebra, equations, homework"
                        value={tags}
                        onChangeText={setTags}
                        placeholderTextColor="#999"
                    />
                    <Text style={styles.hint}>Separate tags with commas</Text>
                </View>

                {/* Images Section */}
                <View style={styles.imagesSection}>
                    <Text style={styles.label}>
                        Images <Text style={styles.required}>*</Text>
                    </Text>

                    {/* Image Picker Buttons */}
                    <View style={styles.pickerButtons}>
                        <TouchableOpacity
                            style={styles.pickerButton}
                            onPress={pickImages}
                        >
                            <Ionicons name="images" size={24} color="#ffffffff" />
                            <Text style={styles.pickerButtonText}>Choose from Gallery</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.pickerButton}
                            onPress={takePhoto}
                        >
                            <Ionicons name="camera" size={24} color="#ffffffff" />
                            <Text style={styles.pickerButtonText}>Take Photo</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Selected Images Grid */}
                    {selectedImages.length > 0 && (
                        <View style={styles.imageGrid}>
                            {selectedImages.map((image, index) => (
                                <View key={index} style={styles.imageContainer}>
                                    <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                                    <TouchableOpacity
                                        style={styles.removeButton}
                                        onPress={() => removeImage(index)}
                                    >
                                        <Ionicons name="close-circle" size={24} color="#FF3B30" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}

                    <Text style={styles.imageCount}>
                        {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
                    </Text>
                </View>

                {/* Upload Button */}
                <TouchableOpacity
                    style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
                    onPress={handleUpload}
                    disabled={uploading}
                >
                    {uploading ? (
                        <>
                            <ActivityIndicator size="small" color="#FFFFFF" />
                            <Text style={styles.uploadButtonText}>Uploading...</Text>
                        </>
                    ) : (
                        <>
                            <Ionicons name="cloud-upload" size={24} color="#FFFFFF" />
                            <Text style={styles.uploadButtonText}>Upload & Analyze</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA',
    },
    header: {
        backgroundColor: 'rgba(125, 92, 255, 0.4)',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        paddingHorizontal: 20,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
        flex: 1,
        textAlign: 'center',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    instructionsCard: {
        flexDirection: 'row',
        backgroundColor: '#E3F2FD',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        gap: 12,
    },
    instructionsText: {
        flex: 1,
        fontSize: 14,
        color: '#007AFF',
        lineHeight: 20,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    required: {
        color: '#FF3B30',
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    textArea: {
        height: 100,
        paddingTop: 16,
    },
    hint: {
        fontSize: 12,
        color: '#999',
        marginTop: 6,
    },
    imagesSection: {
        marginBottom: 24,
    },
    pickerButtons: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    pickerButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(125, 92, 255, 0.4)',
        borderRadius: 12,
        padding: 16,
        gap: 8,
        borderWidth: 2,
        borderColor: 'rgba(125, 92, 255, 0)',
    },
    pickerButtonText: {
        fontSize: 14,
        color: '#ffffffff',
        fontWeight: '600',
    },
    imageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 12,
    },
    imageContainer: {
        width: (width - 64) / 3,
        height: (width - 64) / 3,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
    },
    removeButton: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
    },
    imageCount: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(125, 92, 255, 0.4)',
        borderRadius: 12,
        padding: 18,
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    uploadButtonDisabled: {
        backgroundColor: '#999',
    },
    uploadButtonText: {
        fontSize: 18,
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
});
