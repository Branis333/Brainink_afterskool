/**
 * Study Session Screen
 * Active study session interface with lesson content, progress tracking, and session controls
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Dimensions,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import {
    afterSchoolService,
    StudySession,
    CourseLesson,
    CourseWithLessons
} from '../../services/afterSchoolService';

type NavigationProp = NativeStackNavigationProp<any>;
type RouteProp_ = RouteProp<{
    params: {
        sessionId: number;
        courseId: number;
        lessonId: number;
        lessonTitle: string;
        courseTitle: string;
    }
}>;

interface Props {
    navigation: NavigationProp;
    route: RouteProp_;
}

const { width, height } = Dimensions.get('window');

export const StudySessionScreen: React.FC<Props> = ({ navigation, route }) => {
    const { sessionId, courseId, lessonId, lessonTitle, courseTitle } = route.params;
    const { token } = useAuth();

    const [session, setSession] = useState<StudySession | null>(null);
    const [lesson, setLesson] = useState<CourseLesson | null>(null);
    const [course, setCourse] = useState<CourseWithLessons | null>(null);
    const [loading, setLoading] = useState(true);
    const [sessionTime, setSessionTime] = useState(0); // in seconds
    const [isActive, setIsActive] = useState(true);
    const [completionPercentage, setCompletionPercentage] = useState(0);
    const [showEndSessionModal, setShowEndSessionModal] = useState(false);
    const [endingSession, setEndingSession] = useState(false);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<Date>(new Date());

    // Load session data
    const loadSessionData = async () => {
        try {
            setLoading(true);

            if (!token) {
                throw new Error('No authentication token available');
            }

            // Load session, lesson, and course data in parallel
            const [sessionData, lessonData, courseData] = await Promise.all([
                afterSchoolService.getStudySession(sessionId, token),
                afterSchoolService.getLessonDetails(courseId, lessonId, token),
                afterSchoolService.getCourseDetails(courseId, token)
            ]);

            setSession(sessionData);
            setLesson(lessonData);
            setCourse(courseData);
            setCompletionPercentage(sessionData.completion_percentage);

            // Calculate elapsed time if session is ongoing
            if (!sessionData.ended_at) {
                const startTime = new Date(sessionData.started_at);
                const now = new Date();
                const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
                setSessionTime(elapsedSeconds);
                startTimeRef.current = startTime;
            }
        } catch (error) {
            console.error('Error loading session data:', error);
            Alert.alert(
                'Error',
                'Failed to load study session. Please try again.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } finally {
            setLoading(false);
        }
    };

    // Start session timer
    const startTimer = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        intervalRef.current = setInterval(() => {
            if (isActive) {
                setSessionTime(prev => prev + 1);
            }
        }, 1000);
    }, [isActive]);

    // Stop session timer
    const stopTimer = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = undefined;
        }
    }, []);

    // Load data on screen focus
    useFocusEffect(
        useCallback(() => {
            loadSessionData();
            return () => {
                stopTimer();
            };
        }, [sessionId, token])
    );

    // Start timer when session is active
    useEffect(() => {
        if (session && !session.ended_at && isActive) {
            startTimer();
        } else {
            stopTimer();
        }

        return () => stopTimer();
    }, [session, isActive, startTimer, stopTimer]);

    // Handle back button press
    const handleBackPress = () => {
        if (session && !session.ended_at) {
            setShowEndSessionModal(true);
        } else {
            navigation.goBack();
        }
    };

    // End study session
    const endStudySession = async (status: 'completed' | 'abandoned') => {
        try {
            setEndingSession(true);

            if (!token || !session) return;

            await afterSchoolService.endStudySession(sessionId, {
                completion_percentage: completionPercentage,
                status
            }, token);

            setShowEndSessionModal(false);

            // Navigate back to course details
            navigation.navigate('CourseDetails', {
                courseId,
                courseTitle
            });
        } catch (error) {
            console.error('Error ending study session:', error);
            Alert.alert(
                'Error',
                'Failed to end study session. Please try again.',
                [{ text: 'OK' }]
            );
        } finally {
            setEndingSession(false);
        }
    };

    // Mark lesson as completed
    const markLessonCompleted = () => {
        setCompletionPercentage(100);
        Alert.alert(
            'Lesson Completed!',
            'Great job! You have completed this lesson.',
            [
                {
                    text: 'Continue Studying',
                    style: 'default'
                },
                {
                    text: 'End Session',
                    onPress: () => endStudySession('completed')
                }
            ]
        );
    };

    // Update progress
    const updateProgress = (percentage: number) => {
        setCompletionPercentage(Math.min(100, Math.max(0, percentage)));
    };

    // Pause/Resume session
    const toggleSession = () => {
        setIsActive(!isActive);
    };

    // Format time
    const formatTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    // Render loading state
    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading study session...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!session || !lesson) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Session not found</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.retryButtonText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // Render session header
    const renderSessionHeader = () => (
        <View style={styles.sessionHeader}>
            <View style={styles.headerTop}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBackPress}
                >
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>

                <View style={styles.sessionInfo}>
                    <Text style={styles.sessionTitle} numberOfLines={1}>{lessonTitle}</Text>
                    <Text style={styles.sessionSubtitle} numberOfLines={1}>{courseTitle}</Text>
                </View>

                <View style={styles.sessionTimer}>
                    <Text style={styles.timerText}>{formatTime(sessionTime)}</Text>
                    <View style={[styles.statusIndicator, {
                        backgroundColor: isActive ? '#28a745' : '#ffc107'
                    }]} />
                </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                    <View
                        style={[
                            styles.progressFill,
                            { width: `${completionPercentage}%` }
                        ]}
                    />
                </View>
                <Text style={styles.progressText}>{Math.round(completionPercentage)}%</Text>
            </View>

            {/* Session Controls */}
            <View style={styles.sessionControls}>
                <TouchableOpacity
                    style={[styles.controlButton, styles.pauseButton]}
                    onPress={toggleSession}
                >
                    <Text style={styles.controlButtonText}>
                        {isActive ? 'Pause' : 'Resume'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.controlButton, styles.progressButton]}
                    onPress={() => updateProgress(completionPercentage + 25)}
                >
                    <Text style={styles.controlButtonText}>+25%</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.controlButton, styles.completeButton]}
                    onPress={markLessonCompleted}
                >
                    <Text style={styles.controlButtonText}>Complete</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // Render lesson content
    const renderLessonContent = () => (
        <ScrollView style={styles.contentScrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.contentContainer}>
                {/* Learning Objectives */}
                {lesson.learning_objectives && (
                    <View style={styles.objectivesCard}>
                        <Text style={styles.objectivesTitle}>Learning Objectives</Text>
                        <Text style={styles.objectivesText}>{lesson.learning_objectives}</Text>
                    </View>
                )}

                {/* Lesson Content */}
                <View style={styles.lessonContentCard}>
                    <Text style={styles.lessonContentTitle}>Lesson Content</Text>
                    {lesson.content ? (
                        <Text style={styles.lessonContentText}>{lesson.content}</Text>
                    ) : (
                        <View style={styles.noContentContainer}>
                            <Text style={styles.noContentText}>No content available</Text>
                            <Text style={styles.noContentSubtext}>
                                Content for this lesson will be added soon
                            </Text>
                        </View>
                    )}
                </View>

                {/* Progress Tracking */}
                <View style={styles.progressCard}>
                    <Text style={styles.progressCardTitle}>Progress Tracking</Text>
                    <Text style={styles.progressCardDescription}>
                        Update your progress as you work through the lesson content.
                    </Text>

                    <View style={styles.progressButtons}>
                        <TouchableOpacity
                            style={styles.progressOptionButton}
                            onPress={() => updateProgress(25)}
                        >
                            <Text style={styles.progressOptionText}>25% - Getting Started</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.progressOptionButton}
                            onPress={() => updateProgress(50)}
                        >
                            <Text style={styles.progressOptionText}>50% - Halfway Through</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.progressOptionButton}
                            onPress={() => updateProgress(75)}
                        >
                            <Text style={styles.progressOptionText}>75% - Almost Done</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.progressOptionButton}
                            onPress={() => updateProgress(100)}
                        >
                            <Text style={styles.progressOptionText}>100% - Completed</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Study Tips */}
                <View style={styles.tipsCard}>
                    <Text style={styles.tipsTitle}>Study Tips</Text>
                    <Text style={styles.tipsText}>
                        • Take notes while studying{'\n'}
                        • Ask questions if you don't understand{'\n'}
                        • Practice what you learn{'\n'}
                        • Take breaks when needed{'\n'}
                        • Review the material after completing
                    </Text>
                </View>

                <View style={{ height: 100 }} />
            </View>
        </ScrollView>
    );

    // Render end session modal
    const renderEndSessionModal = () => (
        <Modal
            visible={showEndSessionModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowEndSessionModal(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    <Text style={styles.modalTitle}>End Study Session?</Text>
                    <Text style={styles.modalMessage}>
                        You've been studying for {formatTime(sessionTime)}. How would you like to end this session?
                    </Text>

                    <View style={styles.modalButtons}>
                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => setShowEndSessionModal(false)}
                            disabled={endingSession}
                        >
                            <Text style={styles.modalButtonText}>Continue</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modalButton, styles.abandonButton]}
                            onPress={() => endStudySession('abandoned')}
                            disabled={endingSession}
                        >
                            <Text style={styles.modalButtonTextWhite}>
                                {endingSession ? 'Ending...' : 'Save & Exit'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modalButton, styles.completeButtonModal]}
                            onPress={() => endStudySession('completed')}
                            disabled={endingSession}
                        >
                            <Text style={styles.modalButtonTextWhite}>
                                {endingSession ? 'Ending...' : 'Mark Complete'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    return (
        <SafeAreaView style={styles.container}>
            {renderSessionHeader()}
            {renderLessonContent()}
            {renderEndSessionModal()}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
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
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        color: '#666',
        marginBottom: 16,
    },
    retryButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#007AFF',
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    sessionHeader: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    backButton: {
        marginRight: 16,
        padding: 8,
    },
    backButtonText: {
        fontSize: 24,
        color: '#007AFF',
    },
    sessionInfo: {
        flex: 1,
        marginRight: 16,
    },
    sessionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    sessionSubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    sessionTimer: {
        alignItems: 'center',
    },
    timerText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    statusIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    progressBar: {
        flex: 1,
        height: 8,
        backgroundColor: '#e0e0e0',
        borderRadius: 4,
        marginRight: 12,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#007AFF',
        borderRadius: 4,
    },
    progressText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
        minWidth: 40,
    },
    sessionControls: {
        flexDirection: 'row',
        gap: 12,
    },
    controlButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    pauseButton: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#dee2e6',
    },
    progressButton: {
        backgroundColor: '#007AFF',
    },
    completeButton: {
        backgroundColor: '#28a745',
    },
    controlButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    contentScrollView: {
        flex: 1,
    },
    contentContainer: {
        padding: 20,
    },
    objectivesCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    objectivesTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    objectivesText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    lessonContentCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    lessonContentTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 12,
    },
    lessonContentText: {
        fontSize: 16,
        color: '#333',
        lineHeight: 24,
    },
    noContentContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    noContentText: {
        fontSize: 16,
        color: '#666',
        marginBottom: 8,
    },
    noContentSubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
    progressCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    progressCardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    progressCardDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
        lineHeight: 20,
    },
    progressButtons: {
        gap: 8,
    },
    progressOptionButton: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#dee2e6',
    },
    progressOptionText: {
        fontSize: 14,
        color: '#495057',
        textAlign: 'center',
    },
    tipsCard: {
        backgroundColor: '#e3f2fd',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    tipsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1976d2',
        marginBottom: 8,
    },
    tipsText: {
        fontSize: 14,
        color: '#1565c0',
        lineHeight: 20,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
        textAlign: 'center',
        marginBottom: 12,
    },
    modalMessage: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    modalButtons: {
        gap: 12,
    },
    modalButton: {
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#dee2e6',
    },
    abandonButton: {
        backgroundColor: '#6c757d',
        borderColor: '#6c757d',
    },
    completeButtonModal: {
        backgroundColor: '#28a745',
        borderColor: '#28a745',
    },
    modalButtonText: {
        fontSize: 16,
        color: '#495057',
        fontWeight: '600',
    },
    modalButtonTextWhite: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
});