import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    StatusBar,
    Alert,
    Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigatorNew';
import { useAuth } from '../../context/AuthContext';
import {
    notesService,
    WrittenQuizQuestion,
    WrittenQuizResponse,
    WrittenQuizGradeResponse,
    UploadFile,
} from '../../services/notesService';

// Route params
type Params = {
    ObjectiveWrittenQuiz: {
        noteId: number;
        objectiveIndex: number;
        title?: string;
        quizPayload?: WrittenQuizResponse;
    };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList & Params, 'ObjectiveWrittenQuiz'>;
type RouteProps = RouteProp<RootStackParamList & Params, 'ObjectiveWrittenQuiz'>;

const mapAssetToUpload = (asset: ImagePicker.ImagePickerAsset): UploadFile => {
    const uri = asset.uri;
    const name = asset.fileName || uri.split('/').pop() || 'answer.jpg';
    const type = asset.mimeType || 'image/jpeg';
    return { uri, name, type } as UploadFile;
};

const ObjectiveWrittenQuizScreen: React.FC = () => {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<RouteProps>();
    const { token } = useAuth();

    const { noteId, objectiveIndex, title, quizPayload } = route.params;
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [questions, setQuestions] = useState<WrittenQuizQuestion[]>(quizPayload?.questions || []);
    const [objectiveTitle, setObjectiveTitle] = useState<string | undefined>(quizPayload?.objective || title);
    const [selectedImages, setSelectedImages] = useState<UploadFile[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [graded, setGraded] = useState<WrittenQuizGradeResponse | null>(null);

    const headerTitle = useMemo(() => objectiveTitle ? `Written Quiz: ${objectiveTitle}` : 'Written Quiz', [objectiveTitle]);

    useEffect(() => {
        if (quizPayload) {
            setQuestions(quizPayload.questions || []);
            setObjectiveTitle(quizPayload.objective || title);
        }
    }, [quizPayload, title]);

    const generateWrittenQuiz = async (forceRegenerate: boolean = false) => {
        if (!token) {
            setError('No auth token');
            return;
        }
        try {
            setError(null);
            setLoading(true);
            const res = await notesService.generateObjectiveWrittenQuiz(noteId, objectiveIndex, token, 1, forceRegenerate);
            setQuestions(res.questions || []);
            setObjectiveTitle(res.objective || title);
            setGraded(null);
            setSelectedImages([]);
        } catch (e: any) {
            setError(e?.message || 'Failed to load written quiz');
        } finally {
            setLoading(false);
        }
    };

    const onClose = () => navigation.goBack();

    const pickImages = async () => {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                Alert.alert('Permission needed', 'Allow photo library access to upload answers.');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.8,
            });
            if (result.canceled) return;
            const uploads = (result.assets || []).map(mapAssetToUpload);
            setSelectedImages(prev => [...prev, ...uploads]);
        } catch (e: any) {
            Alert.alert('Image Picker', e?.message || 'Unable to pick images');
        }
    };

    const removeImage = (idx: number) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== idx));
    };

    const onSubmit = async () => {
        if (!token) {
            Alert.alert('Auth', 'Please sign in again.');
            return;
        }
        if (!questions || questions.length === 0) {
            Alert.alert('Quiz', 'No questions to submit.');
            return;
        }
        if (!selectedImages || selectedImages.length === 0) {
            Alert.alert('Answers', 'Add at least one answer photo before submitting.');
            return;
        }
        try {
            setSubmitting(true);
            const res = await notesService.gradeObjectiveWrittenQuiz(
                noteId,
                objectiveIndex,
                questions,
                selectedImages,
                token,
            );
            setGraded(res);
            Alert.alert('Submitted', `Graded: ${Math.round(res.percentage)}%`);
        } catch (e: any) {
            Alert.alert('Submit Failed', e?.message || 'Unable to grade written quiz');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#3B82F6" />
                <View style={styles.center}>
                    {error ? (
                        <>
                            <Ionicons name="alert-circle" size={48} color="#EF4444" />
                            <Text style={styles.errorText}>{error}</Text>
                            <TouchableOpacity style={styles.primaryButton} onPress={() => generateWrittenQuiz(true)}>
                                <Text style={styles.primaryButtonText}>Generate Written Quiz</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <ActivityIndicator size="large" color="#3B82F6" />
                            <Text style={styles.loadingText}>Preparing written quiz…</Text>
                        </>
                    )}
                </View>
            </View>
        );
    }

    if (!questions || questions.length === 0) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#3B82F6" />
                <View style={styles.center}>
                    <Ionicons name="create-outline" size={48} color="#3B82F6" />
                    <Text style={styles.loadingText}>No written quiz yet. Generate one to start.</Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={() => generateWrittenQuiz(false)}>
                        <Text style={styles.primaryButtonText}>Generate Written Quiz</Text>
                    </TouchableOpacity>
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#3B82F6" />
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                    <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
                <View style={styles.iconButton} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.sectionLabel}>Prompts</Text>
                {(questions || []).map((q, i) => (
                    <View key={i} style={styles.card}>
                        <Text style={styles.cardTitle}>{`Question ${i + 1}`}</Text>
                        <Text style={styles.cardQuestion}>{q.prompt}</Text>
                    </View>
                ))}

                <View style={styles.uploadHeader}>
                    <Text style={styles.sectionLabel}>Answer Photos</Text>
                    <TouchableOpacity style={styles.secondaryButton} onPress={pickImages}>
                        <Ionicons name="images" size={18} color="#3B82F6" />
                        <Text style={styles.secondaryButtonText}>Add Photos</Text>
                    </TouchableOpacity>
                </View>

                {selectedImages.length === 0 ? (
                    <Text style={styles.emptyText}>No answer photos added yet.</Text>
                ) : (
                    <View style={styles.imageGrid}>
                        {selectedImages.map((img, idx) => (
                            <View key={`${img.uri}-${idx}`} style={styles.imageItem}>
                                <Image source={{ uri: img.uri }} style={styles.imageThumb} />
                                <TouchableOpacity style={styles.removeBadge} onPress={() => removeImage(idx)}>
                                    <Ionicons name="close" size={16} color="#fff" />
                                </TouchableOpacity>
                                <Text numberOfLines={1} style={styles.imageName}>{img.name}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {graded && (
                    <View style={styles.summary}>
                        <Text style={styles.summaryTitle}>Results</Text>
                        <Text style={styles.summaryText}>{`Score: ${graded.total_score}/${graded.max_score} (${Math.round(graded.percentage)}%)`}</Text>
                        {(graded.items || []).map((item, i) => (
                            <View key={i} style={styles.resultItem}>
                                <Text style={styles.resultPrompt}>{item.prompt}</Text>
                                <Text style={styles.resultScore}>{`${item.score}/${item.max_score}`}</Text>
                                {item.feedback ? <Text style={styles.resultFeedback}>{item.feedback}</Text> : null}
                            </View>
                        ))}
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.primaryButton, submitting && { opacity: 0.7 }]}
                    disabled={submitting}
                    onPress={onSubmit}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.primaryButtonText}>Submit for Grading</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.secondaryButton, { marginTop: 10, justifyContent: 'center' }]}
                    onPress={() => generateWrittenQuiz(true)}
                >
                    <Ionicons name="refresh" size={18} color="#3B82F6" />
                    <Text style={styles.secondaryButtonText}>Generate New Written Quiz</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        height: 56,
        backgroundColor: '#3B82F6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
    },
    iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', flex: 1, textAlign: 'center' },
    content: { padding: 16, gap: 12 },
    sectionLabel: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10 },
    cardTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 6 },
    cardQuestion: { fontSize: 15, color: '#111827' },
    hintLabel: { marginTop: 6, color: '#374151', fontSize: 13, fontWeight: '600' },
    hintText: { marginTop: 2, color: '#6B7280', fontSize: 13 },
    uploadHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    secondaryButton: { backgroundColor: '#E8F0FE', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
    secondaryButtonText: { color: '#3B82F6', fontWeight: '700' },
    emptyText: { color: '#6B7280', fontSize: 13, marginTop: 6 },
    imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    imageItem: { width: 110, backgroundColor: '#fff', borderRadius: 10, padding: 6, borderWidth: 1, borderColor: '#E5E7EB' },
    imageThumb: { width: '100%', height: 70, borderRadius: 8, backgroundColor: '#E5E7EB' },
    imageName: { fontSize: 11, color: '#374151', marginTop: 4 },
    removeBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#EF4444', borderRadius: 10, padding: 4 },
    summary: { backgroundColor: '#ECFEFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#CFFAFE', marginTop: 10 },
    summaryTitle: { fontWeight: '700', color: '#0EA5E9', marginBottom: 4 },
    summaryText: { color: '#0F172A', fontWeight: '700' },
    resultItem: { marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
    resultPrompt: { color: '#111827', fontWeight: '600' },
    resultScore: { color: '#111827', marginTop: 2 },
    resultFeedback: { color: '#4B5563', marginTop: 2 },
    primaryButton: { backgroundColor: '#3B82F6', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
    primaryButtonText: { color: '#FFFFFF', fontWeight: '600' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    loadingText: { marginTop: 12, color: '#6B7280' },
    errorText: { marginTop: 12, color: '#EF4444', fontWeight: '600', textAlign: 'center' },
});

export default ObjectiveWrittenQuizScreen;
