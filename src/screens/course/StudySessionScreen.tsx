/**
 * Study Session Screen
 * Active study session interface with lesson content, progress tracking, and session controls
 */

import React, { useState, useEffect, useCallback, useRef, ReactNode, useMemo } from 'react';
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
    Linking,
    Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import YouTubeIframe from 'react-native-youtube-iframe';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { AuroraGuide, AuroraMicrocard, AuroraMicrocardData, AuroraCueData } from '../../components/AuroraGuide';
import { HighlightableText, HighlightRange } from '../../components/HighlightableText';
import {
    afterSchoolService,
    StudySession,
    CourseLesson,
    CourseBlock,
    CourseWithLessons,
    CourseWithBlocks,
    StudentAssignment
} from '../../services/afterSchoolService';
import {
    aiTutorService,
    StartSessionPayload,
    TutorInteraction,
    TutorSessionSnapshot,
    TutorSessionState,
    TutorTurn,
    LessonPlan,
} from '../../services/aiTutorService';

type NavigationProp = NativeStackNavigationProp<any>;
type RouteProp_ = RouteProp<{
    params: {
        sessionId: number;
        courseId: number;
        lessonId?: number;  // Optional for lesson-based
        blockId?: number;   // Optional for block-based
        lessonTitle?: string;
        blockTitle?: string;
        courseTitle: string;
    }
}>;

interface Props {
    navigation: NavigationProp;
    route: RouteProp_;
}

interface StudySection {
    id: string;
    title: string;
    icon: string;
    content: ReactNode;
    rawText?: string;
}

type SectionMicrocards = Record<string, AuroraMicrocardData[]>;

const sectionIntroCueId = (sectionId: string) => `section-intro-${sectionId}`;
const practiceCueId = (sectionId: string) => `practice-${sectionId}`;
const nextSectionCueId = (sectionId: string) => `next-section-${sectionId}`;

const extractSentences = (text: string): string[] => {
    return text
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 0);
};

const findHighlightRange = (
    source: string,
    snippet: string,
    tone: HighlightRange['tone'] = 'info'
): HighlightRange | null => {
    const cleaned = snippet?.trim();
    if (!cleaned) return null;
    const lowerSource = source.toLowerCase();
    const lowerSnippet = cleaned.toLowerCase();
    const index = lowerSource.indexOf(lowerSnippet);
    if (index === -1) return null;
    return {
        start: index,
        end: Math.min(index + cleaned.length, source.length),
        tone,
    };
};

const computeHighlightRanges = (
    text: string,
    hints: string[] = [],
    options: {
        maxHighlights?: number;
        preferredLength?: number;
    } = {}
): HighlightRange[] => {
    const { maxHighlights = 4, preferredLength = 140 } = options;
    if (!text) return [];
    const ranges: HighlightRange[] = [];
    const seen = new Set<string>();

    const pushRange = (range: HighlightRange | null) => {
        if (!range) return;
        const key = `${range.start}-${range.end}`;
        if (seen.has(key)) return;
        seen.add(key);
        ranges.push(range);
    };

    hints.filter(Boolean).forEach((hint) => {
        const trimmed = hint.trim();
        if (!trimmed) {
            return;
        }

        const segments = extractSentences(trimmed);
        segments.forEach((segment) => {
            if (ranges.length >= maxHighlights) return;
            if (segment.length > preferredLength) {
                const midpoint = Math.floor(segment.length / 2);
                const pivot = segment.slice(0, midpoint).lastIndexOf(' ');
                const firstHalf = segment.slice(0, pivot > 0 ? pivot : midpoint).trim();
                const secondHalf = segment.slice(pivot > 0 ? pivot : midpoint).trim();
                [firstHalf, secondHalf].forEach((half) => {
                    if (half.length >= 24 && ranges.length < maxHighlights) {
                        pushRange(findHighlightRange(text, half));
                    }
                });
            } else if (segment.length >= 18) {
                pushRange(findHighlightRange(text, segment));
            }
        });
    });

    if (!ranges.length) {
        const sentences = extractSentences(text).filter((sentence) => sentence.length >= 18);
        sentences.slice(0, maxHighlights).forEach((sentence, index) => {
            pushRange(findHighlightRange(text, sentence, index === 0 ? 'success' : 'info'));
        });
    }

    return ranges.slice(0, maxHighlights);
};

const { width, height } = Dimensions.get('window');

export const StudySessionScreen: React.FC<Props> = ({ navigation, route }) => {
    const { sessionId, courseId, lessonId, blockId, lessonTitle, blockTitle, courseTitle } = route.params;
    const { token } = useAuth();

    const [session, setSession] = useState<StudySession | null>(null);
    const [lesson, setLesson] = useState<CourseLesson | null>(null);
    const [block, setBlock] = useState<CourseBlock | null>(null);
    const [course, setCourse] = useState<CourseWithLessons | CourseWithBlocks | null>(null);
    const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [markingDone, setMarkingDone] = useState(false);
    const [expandedVideoIndex, setExpandedVideoIndex] = useState<number | null>(null);
    const [isAlreadyCompleted, setIsAlreadyCompleted] = useState(false);
    const [isMenuVisible, setMenuVisible] = useState(false);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [auroraEnabled, setAuroraEnabled] = useState(false);
    const [auroraAnchorOpen, setAuroraAnchorOpen] = useState(false);
    const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiSessionSnapshot, setAiSessionSnapshot] = useState<TutorSessionSnapshot | null>(null);
    const [aiTurn, setAiTurn] = useState<TutorTurn | null>(null);
    const [aiInteractions, setAiInteractions] = useState<TutorInteraction[]>([]);
    const [aiState, setAiState] = useState<TutorSessionState | null>(null);
    const [lessonPlan, setLessonPlan] = useState<LessonPlan | null>(null);
    const [aiHighlights, setAiHighlights] = useState<Record<string, HighlightRange[]>>({});
    const [aiProcessingSectionId, setAiProcessingSectionId] = useState<string | null>(null);
    const [aiFocusedSectionId, setAiFocusedSectionId] = useState<string | null>(null);
    const [auroraMicrocards, setAuroraMicrocards] = useState<SectionMicrocards>({});
    const [auroraCue, setAuroraCue] = useState<AuroraCueData | null>(null);
    const [explainCountSincePractice, setExplainCountSincePractice] = useState(0);
    const dismissedCueIdsRef = useRef<Set<string>>(new Set());
    const lastAutoContinueTurnIdRef = useRef<string | null>(null);
    const lastPracticeTurnIdRef = useRef<string | null>(null);
    const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(false);
    const lastPrimedSectionRef = useRef<string | null>(null);
    // Fallback cursor for rotating highlights when hints don't map to text
    const fallbackHighlightIndexRef = useRef<Record<string, number>>({});
    const [ghostHighlightsEnabled] = useState<boolean>(true);

    const scrollViewRef = useRef<ScrollView>(null);

    const markCueDismissed = useCallback((cueId?: string | null) => {
        if (!cueId) {
            return;
        }
        dismissedCueIdsRef.current.add(cueId);
    }, []);

    const updateAiState = useCallback((state: TutorSessionState) => {
        // Debug: log incoming AI session state for tracing UI updates
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
            try {
                console.log('[AI] updateAiState:', {
                    session_id: state?.session?.session_id,
                    status: state?.session?.status,
                    tutor_turn_present: !!state?.tutor_turn,
                    tutor_turn_narration: state?.tutor_turn?.narration?.slice?.(0, 180),
                    interactions_count: (state?.interactions || []).length,
                });
            } catch (e) {
                console.warn('[AI] updateAiState log failed', e);
            }
        }
        setAiState(state);
        setAiSessionSnapshot(state.session);
        setAiTurn(state.tutor_turn);
        setAiInteractions(state.interactions);
    }, []);

    // Background helper: retry fetching the lesson plan if it isn't ready yet
    const fetchLessonPlanWithRetries = useCallback(
        async (sessionId: number, tries: number = 3) => {
            if (!token || !sessionId) return;
            const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
            let delay = 350; // start with ~350ms backoff
            for (let i = 0; i < tries; i++) {
                try {
                    const plan = await aiTutorService.getLessonPlan(token, sessionId);
                    if (plan && Array.isArray(plan.segments) && plan.segments.length > 0) {
                        setLessonPlan(plan);
                        if (typeof __DEV__ !== 'undefined' && __DEV__) {
                            console.log('[AI Tutor] lesson plan fetched (retry loop)', { segments: plan.segments.length });
                        }
                        return;
                    }
                } catch (e) {
                    // ignore and retry
                }
                await sleep(delay);
                delay = Math.min(1500, Math.round(delay * 1.8));
            }
            if (typeof __DEV__ !== 'undefined' && __DEV__) {
                console.warn('[AI Tutor] lesson plan not available after retries');
            }
        },
        [token]
    );

    // AURORA STATE MACHINE: Determine what to display based on backend session status
    const auroraDisplayState = useMemo(() => {
        if (!aiSessionSnapshot) {
            return { mode: 'idle' as const, showNarration: false, showQuestion: false, showCheckpoint: false, showSuggestions: false };
        }

        const status = aiSessionSnapshot.status;

        // Mode: AWAITING_CHECKPOINT - Only show checkpoint, hide suggestions
        if (status === 'awaiting_checkpoint') {
            return {
                mode: 'awaiting_checkpoint' as const,
                showNarration: true,
                showQuestion: false,
                showCheckpoint: true,
                showSuggestions: false,
                checkpointData: aiTurn?.checkpoint || null,
            };
        }

        // Mode: ACTIVE - Show narration, optionally question, optionally checkpoint, optionally suggestions
        if (status === 'active') {
            const hasQuestion = !!aiTurn?.comprehension_check;
            const hasCheckpoint = aiTurn?.checkpoint && aiTurn.checkpoint.required;

            return {
                mode: 'active' as const,
                showNarration: true,
                showQuestion: hasQuestion,
                showCheckpoint: hasCheckpoint && !hasQuestion, // Show checkpoint after question is shown
                showSuggestions: !hasCheckpoint && !hasQuestion, // Only show suggestions if no checkpoint or question awaiting
                questionText: aiTurn?.comprehension_check || null,
                checkpointData: hasCheckpoint ? aiTurn?.checkpoint : null,
            };
        }

        // Mode: COMPLETED - Show completion state
        if (status === 'completed') {
            return {
                mode: 'completed' as const,
                showNarration: false,
                showQuestion: false,
                showCheckpoint: false,
                showSuggestions: false,
            };
        }

        // Default/other modes (error, abandoned, etc.)
        return {
            mode: 'idle' as const,
            showNarration: false,
            showQuestion: false,
            showCheckpoint: false,
            showSuggestions: false,
        };
    }, [aiSessionSnapshot, aiTurn]);

    const ensureAiSession = useCallback(async (): Promise<TutorSessionState | null> => {
        if (aiState?.session?.session_id) {
            // Ensure lesson plan is loaded and mark UI ready
            try {
                if (!lessonPlan) {
                    const plan = await aiTutorService.getLessonPlan(token!, aiState.session.session_id);
                    setLessonPlan(plan);
                }
            } catch (e) {
                if (typeof __DEV__ !== 'undefined' && __DEV__) {
                    console.warn('[AI Tutor] lesson plan fetch (existing session) failed', e);
                }
                // Kick off background retries in case plan is being generated server-side
                fetchLessonPlanWithRetries(aiState.session.session_id, 3);
            }
            setAiStatus('ready');
            setAiError(null);
            return aiState;
        }

        if (!token) {
            Alert.alert('AI Assistant', 'Please sign in to use AI mode.');
            setAiError('Sign-in required for AI mode');
            setAiStatus('error');
            return null;
        }

        // Do not early-return on 'loading' here; caller may have just toggled the UI.
        // Always attempt to start or fetch the session when none exists.

        setAiStatus('loading');
        setAiError(null);

        const payload: StartSessionPayload = {
            course_id: courseId,
        };
        if (lessonId) payload.lesson_id = lessonId;
        if (blockId) payload.block_id = blockId;

        try {
            // First try to resume any in-progress session for this context to avoid re-generation and get an immediate tutor turn
            let state: TutorSessionState | null = null;
            try {
                state = await aiTutorService.resumeSession(token, { course_id: courseId, block_id: blockId, lesson_id: lessonId });
                if (typeof __DEV__ !== 'undefined' && __DEV__) {
                    console.log('[AI Tutor] resumeSession succeeded', {
                        session_id: state?.session?.session_id,
                        status: state?.session?.status,
                        tutor_turn_present: !!state?.tutor_turn,
                    });
                }
            } catch (resumeErr) {
                if (typeof __DEV__ !== 'undefined' && __DEV__) {
                    console.log('[AI Tutor] resumeSession not available, starting new session', resumeErr);
                }
            }

            if (!state) {
                state = await aiTutorService.startSession(token, payload);
            }
            updateAiState(state);
            // Fetch pre-generated lesson plan for highlights/navigation
            try {
                const plan = await aiTutorService.getLessonPlan(token, state.session.session_id);
                setLessonPlan(plan);
            } catch (e) {
                if (typeof __DEV__ !== 'undefined' && __DEV__) {
                    console.warn('[AI Tutor] lesson plan not available yet', e);
                }
                // Start background retries so it appears as soon as it's generated
                fetchLessonPlanWithRetries(state.session.session_id, 3);
            }
            setAiStatus('ready');
            return state;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to start AI assistant right now.';
            setAiError(message);
            setAiStatus('error');
            console.error('[StudySessionScreen] AI session start error:', message);
            return null;
        }
    }, [aiState, aiStatus, blockId, courseId, lessonId, token, updateAiState, fetchLessonPlanWithRetries, lessonPlan]);

    const computeHighlightsForSection = useCallback(
        (
            sectionId: string,
            sourceText: string,
            hints: string[] = [],
            intent: 'explain' | 'quiz' | 'context' | 'custom' = 'explain',
            options: {
                exclusive?: boolean;
                tone?: HighlightRange['tone'];
            } = {}
        ) => {
            if (!sourceText) return;

            let ranges: HighlightRange[] = [];

            if (options.exclusive && hints.length) {
                const tone = options.tone || 'success';
                const focused = hints
                    .map((hint) => findHighlightRange(sourceText, hint, tone))
                    .filter((range): range is HighlightRange => !!range);

                if (focused.length) {
                    ranges = [focused[0]];
                }
            }

            if (!ranges.length) {
                const maxHighlights = intent === 'explain' ? 5 : 2;
                const preferredLength = intent === 'explain' ? 110 : 80;
                ranges = computeHighlightRanges(sourceText, hints, { maxHighlights, preferredLength });
            }

            if (!ranges.length) return;

            setAiHighlights((prev) => {
                const existing = prev[sectionId];
                if (
                    existing &&
                    existing.length === ranges.length &&
                    existing.every(
                        (item, index) =>
                            item.start === ranges[index]?.start &&
                            item.end === ranges[index]?.end &&
                            item.tone === ranges[index]?.tone,
                    )
                ) {
                    return prev;
                }
                return {
                    ...prev,
                    [sectionId]: ranges,
                };
            });
        },
        []
    );

    // Set ghost + current highlights in one pass for walkthrough
    const setGhostHighlights = useCallback(
        (sectionId: string, sourceText: string, snippets: string[], currentIdx: number) => {
            if (!ghostHighlightsEnabled || !sourceText || snippets.length === 0) return;
            const ranges: HighlightRange[] = [];
            snippets.forEach((snip, idx) => {
                const r = findHighlightRange(sourceText, snip, idx === currentIdx ? 'success' : 'info');
                if (!r) return;
                (r as any).weight = idx === currentIdx ? 'current' : 'ghost';
                ranges.push(r);
            });
            if (ranges.length) {
                setAiHighlights((prev) => ({ ...prev, [sectionId]: ranges }));
            }
        },
        [ghostHighlightsEnabled]
    );


    // Load content data (mark-done model - no session required)
    const loadSessionData = async () => {
        try {
            setLoading(true);

            if (!token) {
                throw new Error('No authentication token available');
            }

            // Load content directly without requiring a session
            if (blockId) {
                // Block-based content
                const [blockData, courseData, assignmentsData] = await Promise.all([
                    afterSchoolService.getCourseBlockDetails(courseId, blockId, token),
                    afterSchoolService.getCourseWithBlocks(courseId, token),
                    afterSchoolService.getCourseAssignments(courseId, token, { block_id: blockId }).catch(() => [])
                ]);
                setBlock(blockData);
                setCourse(courseData);
                setAssignments(assignmentsData);

                // Check completion status for this block
                try {
                    const blocksProgress = await afterSchoolService.getCourseBlocksProgress(courseId, token);
                    const me = (blocksProgress?.blocks || []).find(b => b.block_id === blockId);
                    setIsAlreadyCompleted(!!me?.is_completed);
                } catch (_) {
                    setIsAlreadyCompleted(false);
                }

                // Create a mock session object for UI compatibility
                setSession({
                    id: sessionId,
                    user_id: 0, // Will be filled by backend
                    course_id: courseId,
                    lesson_id: lessonId,
                    block_id: blockId,
                    completion_percentage: 0, // Will be updated by mark-done actions
                    started_at: new Date().toISOString(),
                    status: 'active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            } else if (lessonId) {
                // Lesson-based content
                const [lessonData, courseData] = await Promise.all([
                    afterSchoolService.getLessonDetails(courseId, lessonId, token),
                    afterSchoolService.getCourseDetails(courseId, token)
                ]);
                setLesson(lessonData);
                setCourse(courseData);
                setAssignments([]);

                // Create a mock session object for UI compatibility
                setSession({
                    id: sessionId,
                    user_id: 0, // Will be filled by backend
                    course_id: courseId,
                    lesson_id: lessonId,
                    block_id: blockId,
                    completion_percentage: 0, // Will be updated by mark-done actions
                    started_at: new Date().toISOString(),
                    status: 'active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
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



    // Load data on screen focus
    useFocusEffect(
        useCallback(() => {
            loadSessionData();
        }, [sessionId, token])
    );

    // Handle back button press
    const handleBackPress = () => {
        navigation.goBack();
    };

    // Mark block/lesson as done
    const markAsDone = async () => {
        try {
            setMarkingDone(true);

            if (!token || !blockId) {
                Alert.alert('Error', 'Missing required information to mark as done.');
                return;
            }

            await afterSchoolService.markStudySessionDone(blockId, courseId, token);
            // Immediately reflect completed state
            setIsAlreadyCompleted(true);

            // When leaving this screen, ensure callers can force-refresh
            const refreshTs = Date.now();

            Alert.alert(
                'Success!',
                'You have successfully completed this study session.',
                [
                    {
                        text: 'Continue to Assignments',
                        onPress: () => {
                            continueToAssignments();
                            // Also push a refresh hint for CourseDetails (and Progress if opened next)
                            navigation.navigate('CourseDetails', { courseId, courseTitle, refreshTs });
                        },
                        style: 'default'
                    },
                    {
                        text: 'Back to Course',
                        onPress: () => navigation.navigate('CourseDetails', { courseId, courseTitle, refreshTs }),
                        style: 'default'
                    }
                ]
            );
        } catch (error) {
            console.error('Error marking study session as done:', error);
            Alert.alert(
                'Error',
                'Failed to mark study session as done. Please try again.',
                [{ text: 'OK' }]
            );
        } finally {
            setMarkingDone(false);
        }
    };

    // Navigate to assignment workflow
    const navigateToAssignment = (assignment: StudentAssignment) => {
        navigation.navigate('CourseAssignment', {
            courseId,
            courseTitle,
            assignmentId: assignment.assignment_id,
            assignmentTitle: assignment.assignment?.title || `Assignment ${assignment.assignment_id}`,
            startWorkflow: true  // Automatically start the workflow
        });
    };

    // Continue to assignments after completing session
    const continueToAssignments = () => {
        // Get block-specific pending assignments if we have a blockId
        const blockAssignments = blockId
            ? assignments.filter(a => {
                const assignmentBlockId = a.assignment?.block_id || (a as any).block_id;
                return assignmentBlockId === blockId && a.status === 'assigned';
            })
            : assignments.filter(a => a.status === 'assigned');

        const pendingAssignment = blockAssignments[0];

        if (pendingAssignment) {
            navigateToAssignment(pendingAssignment);
        } else {
            // If no block-specific assignments, navigate to course assignments page
            navigation.navigate('CourseAssignment', {
                courseId,
                courseTitle
            });
        }
    };

    // Mark lesson/block as completed
    const markContentCompleted = () => {
        markAsDone();
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

    // Open URL in browser
    const openURL = async (url: string, title: string) => {
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                Alert.alert('Error', `Cannot open URL: ${title}`);
            }
        } catch (error) {
            console.error('Error opening URL:', error);
            Alert.alert('Error', 'Failed to open link');
        }
    };

    // Extract YouTube video ID from URL
    const getYouTubeVideoId = (url: string): string | null => {
        try {
            // Handle various YouTube URL formats
            const patterns = [
                /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
                /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/,
                /(?:https?:\/\/)?youtu\.be\/([^?]+)/,
                /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([^?]+)/
            ];

            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && match[1]) {
                    return match[1];
                }
            }
            return null;
        } catch (error) {
            console.error('Error extracting YouTube ID:', error);
            return null;
        }
    };

    // Toggle video player expansion
    const toggleVideoPlayer = (index: number) => {
        setExpandedVideoIndex(expandedVideoIndex === index ? null : index);
    };

    // Render video resources
    const renderVideoResources = () => {
        console.log('🎬 renderVideoResources called (Study Session)');
        console.log('🎬 block.resources:', block?.resources);

        if (!block?.resources || block.resources.length === 0) {
            console.log('❌ No resources found');
            return null;
        }

        const videoResources = block.resources.filter((r: any) => r.type === 'video');
        console.log('🎬 Video resources filtered:', videoResources);
        console.log('🎬 Video resources count:', videoResources.length);

        if (videoResources.length === 0) {
            console.log('❌ No video resources found');
            return null;
        }

        return (
            <View style={styles.resourcesContainer}>
                <Text style={styles.resourcesSectionTitle}>🎥 Video Resources</Text>
                <Text style={styles.resourcesSectionSubtitle}>
                    Watch these videos to learn more about this topic
                </Text>
                {videoResources.map((resource: any, index: number) => {
                    const videoId = getYouTubeVideoId(resource.url);
                    const isExpanded = expandedVideoIndex === index;
                    const shouldPlay = isExpanded; // start playback when expanded

                    return (
                        <View key={index} style={styles.videoCard}>
                            {/* Video Header */}
                            <TouchableOpacity
                                style={styles.videoHeader}
                                onPress={() => toggleVideoPlayer(index)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.videoIconContainer}>
                                    <Text style={styles.videoIcon}>🎬</Text>
                                </View>
                                <View style={styles.videoInfo}>
                                    <Text style={styles.videoTitle} numberOfLines={2}>
                                        {resource.title}
                                    </Text>
                                    {resource.search_query && !isExpanded && (
                                        <Text style={styles.videoQuery} numberOfLines={1}>
                                            🔍 {resource.search_query}
                                        </Text>
                                    )}
                                </View>
                                <View style={styles.videoToggleContainer}>
                                    <Text style={styles.videoToggleText}>
                                        {isExpanded ? 'Close' : 'Watch'}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Embedded Video Player */}
                            {isExpanded && videoId && (
                                <View style={styles.videoPlayerContainer}>
                                    <View style={styles.videoPlayerWrapper}>
                                        <YouTubeIframe
                                            height={220}
                                            play={shouldPlay}
                                            mute
                                            initialPlayerParams={{
                                                controls: 1,
                                                modestbranding: true,
                                                rel: false,
                                                playsinline: true,
                                            }}
                                            videoId={videoId}
                                            onReady={() => {
                                                // Auto-play when ready if expanded
                                                if (!shouldPlay) return;
                                            }}
                                            webViewProps={{
                                                style: styles.videoPlayer,
                                                allowsFullscreenVideo: true,
                                                allowsInlineMediaPlayback: true,
                                                mediaPlaybackRequiresUserAction: true,
                                                startInLoadingState: true,
                                                setSupportMultipleWindows: false,
                                            }}
                                            onError={() => openURL(`https://www.youtube.com/watch?v=${videoId}`, resource.title)}
                                        />
                                    </View>
                                    {resource.search_query && (
                                        <Text style={styles.videoQueryExpanded}>
                                            🔍 {resource.search_query}
                                        </Text>
                                    )}
                                </View>
                            )}

                            {/* Fallback: Open in Browser */}
                            {isExpanded && !videoId && (
                                <View style={styles.videoFallbackContainer}>
                                    <Text style={styles.videoFallbackText}>
                                        Video preview not available
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.videoFallbackButton}
                                        onPress={() => openURL(resource.url, resource.title)}
                                    >
                                        <Text style={styles.videoFallbackButtonText}>
                                            Open in Browser
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>
        );
    };

    // Render article resources
    const renderArticleResources = () => {
        console.log('📚 renderArticleResources called (Study Session)');
        console.log('📚 block.resources:', block?.resources);

        if (!block?.resources || block.resources.length === 0) {
            console.log('❌ No resources found for articles');
            return null;
        }

        const articleResources = block.resources.filter((r: any) => r.type === 'article');
        console.log('📚 Article resources filtered:', articleResources);
        console.log('📚 Article resources count:', articleResources.length);

        if (articleResources.length === 0) {
            console.log('❌ No article resources found');
            return null;
        }

        return (
            <View style={styles.resourcesContainer}>
                <Text style={styles.resourcesSectionTitle}>� Related Links</Text>
                <Text style={styles.resourcesSectionSubtitle}>
                    Explore these resources for deeper understanding
                </Text>
                {articleResources.map((resource: any, index: number) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.resourceCard}
                        onPress={() => openURL(resource.url, resource.title)}
                    >
                        <View style={styles.resourceIconContainer}>
                            <Text style={styles.resourceIcon}>📄</Text>
                        </View>
                        <View style={styles.resourceInfo}>
                            <Text style={styles.resourceTitle} numberOfLines={2}>
                                {resource.title}
                            </Text>
                            {resource.search_query && (
                                <Text style={styles.resourceQuery} numberOfLines={1}>
                                    {resource.search_query}
                                </Text>
                            )}
                        </View>
                        <Text style={styles.resourceArrow}>→</Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const relevantAssignments = useMemo(() => {
        if (!assignments || assignments.length === 0) {
            return [];
        }

        if (blockId) {
            return assignments.filter((a) => {
                const assignmentBlockId = a.assignment?.block_id || (a as any).block_id;
                return assignmentBlockId === blockId;
            });
        }

        return assignments;
    }, [assignments, blockId]);

    const renderAssignmentsSection = () => {
        const statusRank: Record<string, number> = {
            assigned: 0,
            in_progress: 1,
            submitted: 2,
            graded: 3,
        };

        const sortedAssignments = [...relevantAssignments].sort((a, b) => {
            const rankA = statusRank[a.status as keyof typeof statusRank] ?? 4;
            const rankB = statusRank[b.status as keyof typeof statusRank] ?? 4;
            return rankA - rankB;
        });

        if (sortedAssignments.length === 0) {
            return (
                <View style={styles.assignmentsCard}>
                    <Text style={styles.assignmentsTitle}>Assignments & Exercises</Text>
                    <Text style={styles.assignmentsSubtitle}>
                        No assignments have been assigned for this section yet. Check back later for new exercises.
                    </Text>
                    <TouchableOpacity
                        style={styles.assignmentsAllButton}
                        onPress={async () => {
                            try {
                                if (!token) throw new Error('No authentication token');
                                const one = await afterSchoolService.getOneAssignment(courseId, token, { block_id: blockId, lesson_id: lessonId, prefer_status: 'assigned' });
                                const pickedId = one?.assignment?.id;
                                if (pickedId) {
                                    navigation.navigate('CourseAssignment', { courseId, courseTitle, assignmentId: pickedId, startWorkflow: true });
                                    return;
                                }
                            } catch (e: any) {
                                // Fallback: open filtered list
                                console.log('ℹ️ getOneAssignment failed, falling back to list:', e?.message || e);
                            }
                            navigation.navigate('CourseAssignment', { courseId, courseTitle, lessonId, blockId });
                        }}
                    >
                        <Text style={styles.assignmentsAllButtonText}>Browse Course Assignments</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.assignmentsCard}>
                <Text style={styles.assignmentsTitle}>Assignments & Exercises</Text>
                <Text style={styles.assignmentsSubtitle}>
                    Use these tasks to practice what you've learned in this section.
                </Text>
                {sortedAssignments.map((assignment) => {
                    const title = assignment.assignment?.title || `Assignment ${assignment.assignment_id}`;
                    const statusLabel = assignment.status?.replace(/_/g, ' ') ?? 'unknown';
                    const isPending = assignment.status === 'assigned';

                    return (
                        <TouchableOpacity
                            key={assignment.assignment_id}
                            style={[styles.assignmentRow, isPending && styles.assignmentRowPending]}
                            onPress={() => navigateToAssignment(assignment)}
                        >
                            <View style={styles.assignmentIconContainer}>
                                <Text style={styles.assignmentIcon}>📝</Text>
                            </View>
                            <View style={styles.assignmentInfo}>
                                <Text style={styles.assignmentTitle}>{title}</Text>
                                <Text style={styles.assignmentStatusText}>
                                    Status: {statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.assignmentAction,
                                    isPending ? styles.assignmentActionPrimary : styles.assignmentActionSecondary,
                                ]}
                            >
                                {isPending ? 'Start' : 'Review'}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
                <TouchableOpacity
                    style={styles.assignmentsAllButton}
                    onPress={() => navigation.navigate('CourseAssignment', { courseId, courseTitle })}
                >
                    <Text style={styles.assignmentsAllButtonText}>View All Assignments</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const sections = useMemo<StudySection[]>(() => {
        const items: StudySection[] = [];

        if (block?.learning_objectives?.length || lesson?.learning_objectives) {
            const objectivesText = block?.learning_objectives?.length
                ? block.learning_objectives.map((objective) => `• ${objective}`).join('\n')
                : lesson?.learning_objectives || '';
            items.push({
                id: 'learning-objectives',
                title: 'Learning Objectives',
                icon: '🎯',
                content: (
                    <View style={styles.objectivesCard}>
                        <Text style={styles.objectivesTitle}>Learning Objectives</Text>
                        <HighlightableText
                            text={objectivesText}
                            highlightRanges={aiHighlights['learning-objectives']}
                            style={styles.objectivesText}
                        />
                    </View>
                ),
                rawText: objectivesText,
            });
        }

        const lessonContentText = block?.content || lesson?.content || '';
        items.push({
            id: 'course-content',
            title: block ? 'Module Content' : 'Lesson Content',
            icon: '📘',
            content: (
                <View style={styles.lessonContentCard}>
                    <Text style={styles.lessonContentTitle}>
                        {block ? 'Module Content' : 'Lesson Content'}
                    </Text>
                    {lessonContentText ? (
                        <HighlightableText
                            text={lessonContentText}
                            highlightRanges={aiHighlights['course-content']}
                            style={styles.lessonContentText}
                        />
                    ) : (
                        <View style={styles.noContentContainer}>
                            <Text style={styles.noContentText}>No content available</Text>
                            <Text style={styles.noContentSubtext}>
                                Content for this {block ? 'module' : 'lesson'} will be added soon
                            </Text>
                        </View>
                    )}
                    {/* Generate Practice Quiz button for block content */}
                    {block?.id && (
                        <TouchableOpacity
                            style={{
                                marginTop: 16,
                                backgroundColor: '#3B82F6',
                                paddingVertical: 12,
                                borderRadius: 10,
                                alignItems: 'center',
                                flexDirection: 'row',
                                justifyContent: 'center',
                                gap: 8,
                            }}
                            onPress={() =>
                                navigation.navigate('Quiz', {
                                    mode: 'block',
                                    id: block.id,
                                    title: `Practice: ${block.title}`,
                                })
                            }
                        >
                            <Ionicons name="help-circle" size={18} color="#FFFFFF" />
                            <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Generate Practice Quiz</Text>
                        </TouchableOpacity>
                    )}
                </View>
            ),
            rawText: lessonContentText,
        });

        const videoSection = renderVideoResources();
        if (videoSection) {
            items.push({
                id: 'video-resources',
                title: 'Video Resources',
                icon: '🎥',
                content: videoSection
            });
        }

        const linksSection = renderArticleResources();
        if (linksSection) {
            items.push({
                id: 'related-links',
                title: 'Related Links',
                icon: '🔗',
                content: linksSection
            });
        }

        items.push({
            id: 'assignments',
            title: 'Assignments & Exercises',
            icon: '📝',
            content: renderAssignmentsSection()
        });

        items.push({
            id: 'study-tips',
            title: 'Study Tips',
            icon: '💡',
            content: (
                <View style={styles.tipsCard}>
                    <Text style={styles.tipsTitle}>Study Tips</Text>
                    <HighlightableText
                        text={`• Take notes while studying\n• Ask questions if you don't understand\n• Practice what you learn\n• Take breaks when needed\n• Review the material after completing`}
                        highlightRanges={aiHighlights['study-tips']}
                        style={styles.tipsText}
                    />
                </View>
            ),
            rawText: `Take notes while studying. Ask questions if you don't understand. Practice what you learn. Take breaks when needed. Review the material after completing.`,
        });

        return items;
    }, [aiHighlights, block, lesson, expandedVideoIndex, relevantAssignments]);

    const { activeSection, currentSectionIndex, previousSection, nextSection } = useMemo(() => {
        if (!sections.length) {
            return {
                activeSection: null as StudySection | null,
                currentSectionIndex: -1,
                previousSection: null as StudySection | null,
                nextSection: null as StudySection | null,
            };
        }

        const fallback = sections[0];
        const resolvedActive = activeSectionId
            ? sections.find((section) => section.id === activeSectionId) || fallback
            : fallback;
        const index = sections.findIndex((section) => section.id === resolvedActive.id);

        return {
            activeSection: resolvedActive,
            currentSectionIndex: index,
            previousSection: index > 0 ? sections[index - 1] : null,
            nextSection: index >= 0 && index < sections.length - 1 ? sections[index + 1] : null,
        };
    }, [sections, activeSectionId]);

    const auroraSuggestions = useMemo(() => {
        if (aiStatus === 'error') {
            return ['Try again', 'Summarise this section', 'Give me a fun fact'];
        }

        const suggestions: string[] = [];
        const seen = new Set<string>();
        const push = (value?: string) => {
            const trimmed = value?.trim();
            if (!trimmed || seen.has(trimmed)) {
                return;
            }
            seen.add(trimmed);
            suggestions.push(trimmed);
        };

        // From backend: follow_up_prompts (not follow_up_options)
        if (aiTurn?.follow_up_prompts?.length) {
            aiTurn.follow_up_prompts.forEach(push);
            // If the only prompt is Continue, keep UI focused on a single CTA
            if (aiTurn.follow_up_prompts.length === 1 && aiTurn.follow_up_prompts[0].toLowerCase() === 'continue') {
                return suggestions;
            }
        }
        // Fallback alternatives
        else if (aiTurn?.follow_up_options?.length) {
            aiTurn.follow_up_options.forEach(push);
        } else {
            ['Explain differently', 'Quiz me on this', 'Give a real-world example'].forEach(push);
        }

        // Add comprehension check prompts if available
        if (aiTurn?.comprehension_check) {
            push('I need a hint');
            push('Here is my answer');
        }

        if (activeSection) {
            push(`Explain ${activeSection.title}`);
            push(`Quiz me on ${activeSection.title}`);
        }

        // Keep extras minimal after structured follow-ups
        push('Give me a quick exercise');

        if (nextSection) {
            push(`Continue to ${nextSection.title}`);
        }

        return suggestions.slice(0, 5);
    }, [activeSection, aiStatus, aiTurn, nextSection]);

    const auroraSummary = useMemo(() => {
        if (activeSection) {
            return activeSection.title;
        }
        const focused = sections.find((section) => section.id === aiFocusedSectionId);
        if (focused) {
            return focused.title;
        }
        return courseTitle;
    }, [activeSection, aiFocusedSectionId, courseTitle, sections]);

    const auroraMessage = useMemo(() => {
        if (aiStatus === 'error') {
            return aiError || 'Aurora is momentarily offline.';
        }

        const narration = aiTurn?.narration?.trim();
        if (narration) {
            return narration;
        }

        const summary = aiTurn?.summary?.trim();
        if (summary) {
            return summary;
        }

        if (activeSection) {
            return `Highlight something in “${activeSection.title}” and Aurora will explain, quiz, or connect the dots.`;
        }

        return 'Highlight a section and invite Aurora to explain, quiz, or connect the dots.';
    }, [activeSection, aiError, aiStatus, aiTurn]);

    const getSectionPlainText = useCallback((sectionId: string) => {
        const section = sections.find((item) => item.id === sectionId);
        if (!section) return '';
        return typeof section.rawText === 'string' ? section.rawText : '';
    }, [sections]);

    const pushAuroraMicrocard = useCallback((sectionId: string, card: AuroraMicrocardData) => {
        setAuroraMicrocards((prev) => {
            const existing = prev[sectionId] ?? [];
            const filtered = existing.filter((item) => item.id !== card.id);
            const next = [card, ...filtered].slice(0, 4);
            if (existing.length === next.length && existing.every((item, index) => item.id === next[index]?.id)) {
                return prev;
            }
            return {
                ...prev,
                [sectionId]: next,
            };
        });
    }, []);

    const buildAuroraMicrocard = useCallback((
        intent: 'explain' | 'quiz' | 'context' | 'custom',
        turn: TutorTurn | null,
        sectionTitle: string,
    ): AuroraMicrocardData | null => {
        if (!turn) {
            return null;
        }

        const tone: AuroraMicrocardData['tone'] = ((): AuroraMicrocardData['tone'] => {
            if (turn.comprehension_check) {
                return 'practice';
            }
            switch (intent) {
                case 'quiz':
                    return 'practice';
                case 'context':
                    return 'context';
                default:
                    return 'insight';
            }
        })();

        let body = turn.summary || turn.narration || '';
        if (turn.comprehension_check) {
            const isString = typeof turn.comprehension_check === 'string';
            let question = '';
            let answers: string[] = [];

            if (isString) {
                question = turn.comprehension_check as string;
            } else {
                const cc = turn.comprehension_check as any;
                question = cc?.question || '';
                answers = cc?.expected_answers?.filter(Boolean) ?? [];
            }

            const answerLine = answers.length > 0 ? answers.join(', ') : 'Think about it!';
            body = `${question}\n• ${answerLine}`;
        }

        const headline = (() => {
            if (intent === 'quiz') {
                return 'Quick Check';
            }
            if (intent === 'context') {
                return `Context boost • ${sectionTitle}`;
            }
            if (intent === 'custom') {
                return `Aurora Insight • ${sectionTitle}`;
            }
            return `Key idea • ${sectionTitle}`;
        })();

        const trimmedBody = body.trim();
        if (!trimmedBody) {
            return null;
        }

        return {
            id: `${turn.turn_id}-${intent}-${Date.now()}`,
            tone,
            headline,
            body: trimmedBody,
            footnote: turn.reflection_prompt || undefined,
            prompts: turn.follow_up_options && turn.follow_up_options.length > 0 ? turn.follow_up_options.slice(0, 3) : undefined,
        };
    }, []);

    const handleToggleAiAssist = useCallback(async () => {
        if (auroraEnabled) {
            setAuroraEnabled(false);
            setAuroraAnchorOpen(false);
            setAiProcessingSectionId(null);
            setAiFocusedSectionId(null);
            setAuroraCue(null);
            setAiError(null);
            dismissedCueIdsRef.current.clear();
            lastPrimedSectionRef.current = null;
            return;
        }

        setAiError(null);
        // Let ensureAiSession drive the loading state to avoid an early return inside it.
        const state = await ensureAiSession();
        if (!state) {
            setAuroraEnabled(false);
            setAuroraAnchorOpen(false);
            return;
        }

        setAuroraEnabled(true);
        setAuroraAnchorOpen(true);

        const targetSectionId = activeSectionId || sections[0]?.id || null;
        if (targetSectionId) {
            setAiFocusedSectionId(targetSectionId);
        }
    }, [activeSectionId, auroraEnabled, ensureAiSession, sections]);

    const handleToggleAuroraAnchor = useCallback(() => {
        if (!auroraEnabled) {
            handleToggleAiAssist();
            return;
        }
        setAuroraAnchorOpen((prev) => !prev);
    }, [auroraEnabled, handleToggleAiAssist]);

    const handleDismissCue = useCallback(() => {
        if (auroraCue?.id) {
            markCueDismissed(auroraCue.id);
        }
        setAuroraCue(null);
    }, [auroraCue, markCueDismissed]);

    const requestAiResponse = useCallback(
        async (
            intent: 'explain' | 'quiz' | 'context' | 'custom',
            sectionId?: string,
            customPrompt?: string,
            options: {
                skipHighlightUpdate?: boolean;
                highlightSnippet?: string;
                exclusiveHighlight?: boolean;
            } = {},
        ) => {
            const state = await ensureAiSession();
            if (!state || !state.session?.session_id || !token) {
                return;
            }

            const focusSectionId = sectionId || activeSectionId || sections[0]?.id || null;
            const sectionText = focusSectionId ? getSectionPlainText(focusSectionId) : '';
            const sectionTitle = sections.find((item) => item.id === focusSectionId)?.title || 'this section';
            const isPracticeIntent = intent === 'quiz';

            // If we already have highlights for this section, prefer focusing the explanation on the first one
            let focusedSnippet = options.highlightSnippet;
            if (!focusedSnippet && focusSectionId && aiHighlights[focusSectionId]?.length) {
                const r = aiHighlights[focusSectionId][0];
                if (r && sectionText) {
                    focusedSnippet = sectionText.slice(r.start, r.end).trim();
                }
            }

            let prompt = customPrompt || '';
            if (!prompt) {
                switch (intent) {
                    case 'explain':
                        if (focusedSnippet) {
                            prompt = `Explain this specific part from the section "${sectionTitle}": "${focusedSnippet}". Keep it simple, concrete, and kid-friendly. Also connect it briefly to the rest of the section.`;
                        } else {
                            prompt = `Explain the section titled "${sectionTitle}" in the course using simple, friendly language for kids. Highlight the most important idea and relate it to the learner's everyday life.\nContent: ${sectionText.slice(0, 600)}`;
                        }
                        break;
                    case 'quiz':
                        if (focusedSnippet) {
                            prompt = `Create one quick comprehension check about this part from "${sectionTitle}": "${focusedSnippet}". Provide the correct answer too. Keep it short and fun.`;
                        } else {
                            prompt = `Create one quick comprehension question and the answer based on this section titled "${sectionTitle}". Keep it short and fun.\nContent: ${sectionText.slice(0, 600)}`;
                        }
                        break;
                    case 'context':
                        if (focusedSnippet) {
                            prompt = `Give helpful background context to better understand this part from "${sectionTitle}": "${focusedSnippet}".`;
                        } else {
                            prompt = `Give some background context that helps understand this section titled "${sectionTitle}".\nContent: ${sectionText.slice(0, 600)}`;
                        }
                        break;
                    default:
                        prompt = focusedSnippet
                            ? `Explain this in a different way: "${focusedSnippet}"`
                            : (sectionText ? `Explain this content in a new way: ${sectionText.slice(0, 600)}` : 'Explain the current topic again in a new way.');
                        break;
                }
            }

            setAiStatus('loading');
            setAiError(null);
            setAiProcessingSectionId(focusSectionId || null);
            setAiFocusedSectionId(focusSectionId || null);
            setAuroraAnchorOpen(true);

            try {
                const response = await aiTutorService.sendMessage(token, state.session.session_id, {
                    input_type: 'text',
                    message: prompt,
                });
                updateAiState(response);
                setAiStatus('ready');
                setAiProcessingSectionId(null);
                setExplainCountSincePractice((prev) => (isPracticeIntent ? 0 : prev + 1));

                if (focusSectionId) {
                    const hints: string[] = [];
                    if (response.tutor_turn?.summary) hints.push(response.tutor_turn.summary);
                    if (response.tutor_turn?.narration) hints.push(response.tutor_turn.narration);
                    const textSource = getSectionPlainText(focusSectionId);

                    if (options.skipHighlightUpdate) {
                        if (options.highlightSnippet) {
                            computeHighlightsForSection(
                                focusSectionId,
                                textSource,
                                [options.highlightSnippet],
                                intent,
                                { exclusive: options.exclusiveHighlight }
                            );
                        }
                    } else {
                        // If we had a focused snippet, pin the highlight to it; else compute from hints
                        if (focusedSnippet) {
                            computeHighlightsForSection(
                                focusSectionId,
                                textSource,
                                [focusedSnippet],
                                intent,
                                { exclusive: true, tone: 'success' }
                            );
                        } else {
                            // First try to highlight based on hints
                            const beforeRanges = aiHighlights[focusSectionId];
                            computeHighlightsForSection(focusSectionId, textSource, hints, intent);
                            const afterRanges = {
                                get: () => (aiHighlights[focusSectionId] || []) as HighlightRange[],
                            };
                            // If no change or failed to map hints, rotate a deterministic fallback snippet
                            const prevRanges = beforeRanges || [];
                            const nextRanges = afterRanges.get();
                            const noChange =
                                (prevRanges.length === nextRanges.length &&
                                    prevRanges.every((r, i) =>
                                        r && nextRanges[i] && r.start === nextRanges[i].start && r.end === nextRanges[i].end,
                                    )) ||
                                nextRanges.length === 0;
                            if (noChange) {
                                const fallbackList = computeHighlightRanges(textSource, [], { maxHighlights: 5, preferredLength: 110 });
                                if (fallbackList.length > 0) {
                                    const cursor = fallbackHighlightIndexRef.current[focusSectionId] ?? 0;
                                    const pick = fallbackList[cursor % fallbackList.length];
                                    fallbackHighlightIndexRef.current[focusSectionId] = (cursor + 1) % fallbackList.length;
                                    if (pick) {
                                        const snippet = textSource.slice(pick.start, pick.end).trim();
                                        if (snippet) {
                                            computeHighlightsForSection(
                                                focusSectionId,
                                                textSource,
                                                [snippet],
                                                intent,
                                                { exclusive: true, tone: 'success' }
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }
                    const microcard = buildAuroraMicrocard(intent, response.tutor_turn, sectionTitle);
                    if (microcard) {
                        pushAuroraMicrocard(focusSectionId, microcard);
                        if (microcard.tone === 'practice') {
                            setExplainCountSincePractice(0);
                        }
                        markCueDismissed(sectionIntroCueId(focusSectionId));
                        setAuroraCue((prev) => (prev && prev.id === sectionIntroCueId(focusSectionId) ? null : prev));
                    }
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : 'AI assistant could not respond.';
                setAiStatus('error');
                setAiError(message);
                setAiProcessingSectionId(null);
                console.error('[StudySessionScreen] AI response error:', message);
            }
        },
        [activeSectionId, buildAuroraMicrocard, computeHighlightsForSection, ensureAiSession, getSectionPlainText, markCueDismissed, pushAuroraMicrocard, sections, token, updateAiState]
    );

    // Submit a checkpoint artifact (photo) when AI requests a quick exercise
    const handleSubmitCheckpoint = useCallback(async () => {
        if (!aiState?.session?.session_id || !token) return;
        // Prefer camera; fallback to library if permission denied
        try {
            const camPerm = await ImagePicker.requestCameraPermissionsAsync();
            if (camPerm.status !== 'granted') {
                const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (libPerm.status !== 'granted') {
                    Alert.alert('Permission needed', 'Camera or photo library permission is required.');
                    return;
                }
                const pick = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
                if (pick.canceled || !pick.assets?.length) return;
                const img = pick.assets[0];
                setAiStatus('loading');
                const cpRes = await aiTutorService.submitCheckpoint(token, aiState.session.session_id, {
                    checkpoint_type: 'photo',
                    file_uri: img.uri,
                    file_name: img.fileName || `checkpoint-${Date.now()}.jpg`,
                    mime_type: img.mimeType || 'image/jpeg',
                });
                const refreshed = await aiTutorService.getSession(token, aiState.session.session_id);
                // Synthesize a tutor turn from AI feedback so UI shows results immediately
                const strengths = (cpRes as any)?.ai_feedback?.strengths as string[] | undefined;
                const improvements = (cpRes as any)?.ai_feedback?.improvements as string[] | undefined;
                const score = (cpRes as any)?.score as number | undefined;
                const needsReview = Boolean((cpRes as any)?.needs_review);
                const feedbackSummary = (cpRes as any)?.ai_feedback?.summary || (cpRes as any)?.tutor_message || 'Thanks — I received your submission.';
                const nextStep = (cpRes as any)?.ai_feedback?.suggested_next_step || (cpRes as any)?.next_steps?.[0];
                const tutorTurn: TutorTurn = {
                    turn_id: `checkpoint_feedback_${Date.now()}`,
                    narration: feedbackSummary,
                    summary: feedbackSummary,
                    follow_up_prompts: ['Continue'],
                    comprehension_check: null,
                    checkpoint: needsReview ? (aiTurn?.checkpoint || { required: true, checkpoint_type: 'photo', instructions: 'Please resubmit with the requested changes.' }) : null,
                    next_action: needsReview ? 'await_checkpoint' : 'continue',
                };
                const mergedSession = { ...refreshed.session, status: needsReview ? 'awaiting_checkpoint' as const : refreshed.session.status };
                updateAiState({ session: mergedSession, tutor_turn: tutorTurn, interactions: refreshed.interactions });
                // Also render a practice microcard with the feedback for the active section
                const targetSectionId = aiFocusedSectionId || activeSection?.id || sections[0]?.id;
                if (targetSectionId) {
                    const sectionTitle = sections.find((s) => s.id === targetSectionId)?.title || 'this section';
                    const lines: string[] = [];
                    lines.push(feedbackSummary);
                    if (Array.isArray(strengths) && strengths.length) {
                        lines.push(`Strengths:\n• ${strengths.join('\n• ')}`);
                    }
                    if (Array.isArray(improvements) && improvements.length) {
                        lines.push(`Improvements:\n• ${improvements.join('\n• ')}`);
                    }
                    const card: AuroraMicrocardData = {
                        id: tutorTurn.turn_id,
                        tone: 'practice',
                        headline: 'Checkpoint Feedback',
                        body: lines.join('\n\n'),
                        footnote: typeof nextStep === 'string' ? nextStep : undefined,
                        score: typeof score === 'number' ? score : undefined,
                    };
                    pushAuroraMicrocard(targetSectionId, card);
                    setAuroraAnchorOpen(true);
                }
                setAiStatus('ready');
                return;
            }

            const shot = await ImagePicker.launchCameraAsync({ quality: 0.7 });
            if (shot.canceled || !shot.assets?.length) return;
            const img = shot.assets[0];
            setAiStatus('loading');
            const cpRes = await aiTutorService.submitCheckpoint(token, aiState.session.session_id, {
                checkpoint_type: 'photo',
                file_uri: img.uri,
                file_name: img.fileName || `checkpoint-${Date.now()}.jpg`,
                mime_type: img.mimeType || 'image/jpeg',
            });
            const refreshed = await aiTutorService.getSession(token, aiState.session.session_id);
            const strengths = (cpRes as any)?.ai_feedback?.strengths as string[] | undefined;
            const improvements = (cpRes as any)?.ai_feedback?.improvements as string[] | undefined;
            const score = (cpRes as any)?.score as number | undefined;
            const needsReview = Boolean((cpRes as any)?.needs_review);
            const feedbackSummary = (cpRes as any)?.ai_feedback?.summary || (cpRes as any)?.tutor_message || 'Thanks — I received your submission.';
            const nextStep = (cpRes as any)?.ai_feedback?.suggested_next_step || (cpRes as any)?.next_steps?.[0];
            const tutorTurn: TutorTurn = {
                turn_id: `checkpoint_feedback_${Date.now()}`,
                narration: feedbackSummary,
                summary: feedbackSummary,
                follow_up_prompts: ['Continue'],
                comprehension_check: null,
                checkpoint: needsReview ? (aiTurn?.checkpoint || { required: true, checkpoint_type: 'photo', instructions: 'Please resubmit with the requested changes.' }) : null,
                next_action: needsReview ? 'await_checkpoint' : 'continue',
            };
            const mergedSession = { ...refreshed.session, status: needsReview ? 'awaiting_checkpoint' as const : refreshed.session.status };
            updateAiState({ session: mergedSession, tutor_turn: tutorTurn, interactions: refreshed.interactions });
            const targetSectionId = aiFocusedSectionId || activeSection?.id || sections[0]?.id;
            if (targetSectionId) {
                const lines: string[] = [];
                lines.push(feedbackSummary);
                if (Array.isArray(strengths) && strengths.length) {
                    lines.push(`Strengths:\n• ${strengths.join('\n• ')}`);
                }
                if (Array.isArray(improvements) && improvements.length) {
                    lines.push(`Improvements:\n• ${improvements.join('\n• ')}`);
                }
                const card: AuroraMicrocardData = {
                    id: tutorTurn.turn_id,
                    tone: 'practice',
                    headline: 'Checkpoint Feedback',
                    body: lines.join('\n\n'),
                    footnote: typeof nextStep === 'string' ? nextStep : undefined,
                    score: typeof score === 'number' ? score : undefined,
                };
                pushAuroraMicrocard(targetSectionId, card);
                setAuroraAnchorOpen(true);
            }
            setAiStatus('ready');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to submit checkpoint.';
            setAiStatus('error');
            setAiError(msg);
        }
    }, [aiState?.session?.session_id, token, updateAiState, aiFocusedSectionId, activeSection?.id, sections, pushAuroraMicrocard]);

    // Answer a True/False comprehension check directly from Aurora
    const handleAnswerComprehension = useCallback(async (answer: 'true' | 'false') => {
        const state = await ensureAiSession();
        if (!state || !state.session?.session_id || !token) return;
        try {
            setAiStatus('loading');
            setAuroraAnchorOpen(true);
            const response = await aiTutorService.sendMessage(token, state.session.session_id, {
                input_type: 'button',
                message: answer,
                metadata: { kind: 'comprehension', selection: answer },
            });
            updateAiState(response);
            setAiStatus('ready');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to submit answer.';
            setAiStatus('error');
            setAiError(msg);
        }
    }, [ensureAiSession, token, updateAiState]);

    // Submit reflection notes for a reflection-type checkpoint
    const handleSubmitReflectionNotes = useCallback(async (notes: string) => {
        if (!aiState?.session?.session_id || !token) return;
        try {
            setAiStatus('loading');
            const cpRes = await aiTutorService.submitCheckpoint(token, aiState.session.session_id, {
                checkpoint_type: 'reflection',
                notes,
            });
            const refreshed = await aiTutorService.getSession(token, aiState.session.session_id);
            const strengths = (cpRes as any)?.ai_feedback?.strengths as string[] | undefined;
            const improvements = (cpRes as any)?.ai_feedback?.improvements as string[] | undefined;
            const score = (cpRes as any)?.score as number | undefined;
            const needsReview = Boolean((cpRes as any)?.needs_review);
            const feedbackSummary = (cpRes as any)?.ai_feedback?.summary || (cpRes as any)?.tutor_message || 'Thanks — I received your reflection.';
            const nextStep = (cpRes as any)?.ai_feedback?.suggested_next_step || (cpRes as any)?.next_steps?.[0];
            const tutorTurn: TutorTurn = {
                turn_id: `checkpoint_feedback_${Date.now()}`,
                narration: feedbackSummary,
                summary: feedbackSummary,
                follow_up_prompts: ['Continue'],
                comprehension_check: null,
                checkpoint: needsReview ? (aiTurn?.checkpoint || { required: true, checkpoint_type: 'reflection', instructions: 'Please refine and resubmit your reflection.' }) : null,
                next_action: needsReview ? 'await_checkpoint' : 'continue',
            };
            const mergedSession = { ...refreshed.session, status: needsReview ? 'awaiting_checkpoint' as const : refreshed.session.status };
            updateAiState({ session: mergedSession, tutor_turn: tutorTurn, interactions: refreshed.interactions });
            const targetSectionId = aiFocusedSectionId || activeSection?.id || sections[0]?.id;
            if (targetSectionId) {
                const sectionTitle = sections.find((s) => s.id === targetSectionId)?.title || 'this section';
                const lines: string[] = [];
                lines.push(feedbackSummary);
                if (Array.isArray(strengths) && strengths.length) {
                    lines.push(`Strengths:\n• ${strengths.join('\n• ')}`);
                }
                if (Array.isArray(improvements) && improvements.length) {
                    lines.push(`Improvements:\n• ${improvements.join('\n• ')}`);
                }
                const card: AuroraMicrocardData = {
                    id: tutorTurn.turn_id,
                    tone: 'practice',
                    headline: 'Checkpoint Feedback',
                    body: lines.join('\n\n'),
                    footnote: typeof nextStep === 'string' ? nextStep : undefined,
                    score: typeof score === 'number' ? score : undefined,
                };
                pushAuroraMicrocard(targetSectionId, card);
                setAuroraAnchorOpen(true);
            }
            setAiStatus('ready');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to submit reflection.';
            setAiStatus('error');
            setAiError(msg);
        }
    }, [aiState?.session?.session_id, token, updateAiState, aiFocusedSectionId, activeSection?.id, sections, pushAuroraMicrocard]);

    // Submit quiz answers as notes (non-multiple-choice quizzes)
    const handleSubmitQuizNotes = useCallback(async (notes: string) => {
        if (!aiState?.session?.session_id || !token) return;
        try {
            setAiStatus('loading');
            const cpRes = await aiTutorService.submitCheckpoint(token, aiState.session.session_id, {
                checkpoint_type: 'quiz',
                notes,
            });
            const refreshed = await aiTutorService.getSession(token, aiState.session.session_id);
            const strengths = (cpRes as any)?.ai_feedback?.strengths as string[] | undefined;
            const improvements = (cpRes as any)?.ai_feedback?.improvements as string[] | undefined;
            const score = (cpRes as any)?.score as number | undefined;
            const needsReview = Boolean((cpRes as any)?.needs_review);
            const feedbackSummary = (cpRes as any)?.ai_feedback?.summary || (cpRes as any)?.tutor_message || 'Thanks — I received your answers.';
            const nextStep = (cpRes as any)?.ai_feedback?.suggested_next_step || (cpRes as any)?.next_steps?.[0];
            const tutorTurn: TutorTurn = {
                turn_id: `checkpoint_feedback_${Date.now()}`,
                narration: feedbackSummary,
                summary: feedbackSummary,
                follow_up_prompts: ['Continue'],
                comprehension_check: null,
                checkpoint: needsReview ? (aiTurn?.checkpoint || { required: true, checkpoint_type: 'quiz', instructions: 'Please refine your answers and resubmit.' }) : null,
                next_action: needsReview ? 'await_checkpoint' : 'continue',
            };
            const mergedSession = { ...refreshed.session, status: needsReview ? 'awaiting_checkpoint' as const : refreshed.session.status };
            updateAiState({ session: mergedSession, tutor_turn: tutorTurn, interactions: refreshed.interactions });
            const targetSectionId = aiFocusedSectionId || activeSection?.id || sections[0]?.id;
            if (targetSectionId) {
                const lines: string[] = [];
                lines.push(feedbackSummary);
                if (Array.isArray(strengths) && strengths.length) lines.push(`Strengths:\n• ${strengths.join('\n• ')}`);
                if (Array.isArray(improvements) && improvements.length) lines.push(`Improvements:\n• ${improvements.join('\n• ')}`);
                const card: AuroraMicrocardData = {
                    id: tutorTurn.turn_id,
                    tone: 'practice',
                    headline: 'Checkpoint Feedback',
                    body: lines.join('\n\n'),
                    footnote: typeof nextStep === 'string' ? nextStep : undefined,
                    score: typeof score === 'number' ? score : undefined,
                };
                pushAuroraMicrocard(targetSectionId, card);
                setAuroraAnchorOpen(true);
            }
            setAiStatus('ready');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to submit quiz notes.';
            setAiStatus('error');
            setAiError(msg);
        }
    }, [aiState?.session?.session_id, token, updateAiState, aiFocusedSectionId, activeSection?.id, sections, pushAuroraMicrocard]);

    // Freeform answer to comprehension questions
    const handleAnswerFreeform = useCallback(async (answer: string) => {
        const state = await ensureAiSession();
        if (!state || !state.session?.session_id || !token) return;
        try {
            setAiStatus('loading');
            setAuroraAnchorOpen(true);
            const response = await aiTutorService.sendMessage(token, state.session.session_id, {
                input_type: 'text',
                message: answer,
                metadata: { kind: 'comprehension', mode: 'freeform' },
            });
            updateAiState(response);
            setAiStatus('ready');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to submit answer.';
            setAiStatus('error');
            setAiError(msg);
        }
    }, [ensureAiSession, token, updateAiState]);


    // ============================================
    // AURORA AI MODE - Clean Fresh Implementation
    // ============================================

    const [walkIndex, setWalkIndex] = useState<number>(0);
    const [walkSectionId, setWalkSectionId] = useState<string | null>(null);
    const [walkthroughRecapPrompt, setWalkthroughRecapPrompt] = useState<{
        sectionId: string;
        prompt: string;
        label: string;
    } | null>(null);

    // Clean walkthrough data structure
    const walkDataRef = useRef<{
        sectionId: string;
        snippets: string[];
        explanations: TutorTurn[];
    } | null>(null);

    const queueWalkthroughRecap = useCallback(
        (sectionId: string) => {
            const sectionTitle = sections.find((item) => item.id === sectionId)?.title || 'this section';
            setWalkthroughRecapPrompt({
                sectionId,
                prompt: `Give me a quick recap of ${sectionTitle}`,
                label: `Recap ${sectionTitle}`,
            });
        },
        [sections],
    );

    /**
     * Generate explanations for all snippets in sequence.
     * Stores results as we go, displaying first explanation immediately.
     */
    const preComputeExplanations = useCallback(
        async (sectionId: string, snippets: string[], state: TutorSessionState) => {
            console.log(`[Aurora] Pre-computing explanations for ${snippets.length} snippets...`);

            const explanations: TutorTurn[] = [];

            for (let i = 0; i < snippets.length; i++) {
                try {
                    const snippet = snippets[i];
                    const prompt = `Explain this concisely: "${snippet}". Keep it brief and engaging.`;

                    const response = await aiTutorService.sendMessage(token!, state.session.session_id, {
                        input_type: 'text',
                        message: prompt,
                    });

                    if (response.tutor_turn) {
                        explanations.push(response.tutor_turn);

                        // If first explanation, display immediately
                        if (i === 0 && walkSectionId === sectionId) {
                            updateAiState({
                                session: response.session,
                                tutor_turn: response.tutor_turn,
                                interactions: response.interactions,
                            });
                        }
                        console.log(`[Aurora] Step ${i + 1}/${snippets.length} cached`);
                    }
                } catch (err) {
                    console.warn(`[Aurora] Failed to get explanation for snippet ${i}:`, err);
                    explanations.push(null as any);
                }
            }

            // Store all explanations
            if (walkDataRef.current) {
                walkDataRef.current.explanations = explanations;
                console.log(`[Aurora] Pre-compute complete with ${explanations.filter(Boolean).length}/${snippets.length} explanations`);
            }
        },
        [token, walkSectionId, updateAiState],
    );

    const resetWalkthrough = useCallback(() => {
        walkDataRef.current = null;
        setWalkSectionId(null);
        setWalkIndex(0);
        setWalkthroughRecapPrompt(null);
        console.log('[Aurora] Walkthrough reset');
    }, []);

    const handleStartExplainWalkthrough = useCallback(
        (sectionId: string) => {
            console.log(`[Aurora] Starting explain for section: ${sectionId}`);
            const text = getSectionPlainText(sectionId);

            if (!text) {
                // Fallback to normal explain
                requestAiResponse('explain', sectionId);
                return;
            }

            // Prefer pre-generated lesson plan snippets when available
            let snippets: string[] = [];
            try {
                if (lessonPlan && aiSessionSnapshot) {
                    const seg = (lessonPlan.segments || []).find(s => s.index === aiSessionSnapshot.current_segment_index);
                    if (seg && Array.isArray(seg.snippets) && seg.snippets.length) {
                        snippets = seg.snippets.map(sn => (sn.snippet || '').trim()).filter(Boolean);
                    }
                }
            } catch (e) {
                // ignore and fallback to heuristic extraction
            }

            if (!snippets.length) {
                // Extract 3-5 key snippets from text heuristically
                const ranges = computeHighlightRanges(text, [], { maxHighlights: 5, preferredLength: 110 });
                snippets = ranges
                    .map((r) => text.slice(r.start, r.end).trim())
                    .filter((s) => s.length > 0);
            }

            if (snippets.length < 2) {
                // Not enough for walkthrough, use normal explain
                requestAiResponse('explain', sectionId);
                return;
            }

            console.log(`[Aurora] Walkthrough with ${snippets.length} snippets`);

            // Setup walkthrough
            walkDataRef.current = { sectionId, snippets, explanations: [] };
            setWalkSectionId(sectionId);
            setWalkIndex(0);
            setAutoAdvanceEnabled(false);

            // Ghost highlights + current
            setGhostHighlights(sectionId, text, snippets, 0);

            // Start explaining (will pre-compute rest in background)
            setAiStatus('loading');
            ensureAiSession().then((state) => {
                if (!state) {
                    setAiStatus('error');
                    return;
                }

                setAiStatus('ready');
                preComputeExplanations(sectionId, snippets, state);
            });
        },
        [
            getSectionPlainText,
            computeHighlightRanges,
            computeHighlightsForSection,
            requestAiResponse,
            ensureAiSession,
            preComputeExplanations,
        ]
    );

    const handleWalkNext = useCallback(() => {
        if (!walkDataRef.current || !walkSectionId) return;

        const { snippets, explanations } = walkDataRef.current;
        const nextIdx = walkIndex + 1;

        // Check if done
        if (nextIdx >= snippets.length) {
            console.log('[Aurora] Walkthrough complete');
            resetWalkthrough();
            setAutoAdvanceEnabled(true);
            queueWalkthroughRecap(walkSectionId);
            return;
        }

        // Update highlight
        const text = getSectionPlainText(walkSectionId);
        setGhostHighlights(walkSectionId, text, snippets, nextIdx);
        setWalkIndex(nextIdx);

        // Show cached explanation or request
        const cachedExplanation = explanations[nextIdx];
        if (cachedExplanation) {
            updateAiState({
                session: aiState!.session,
                tutor_turn: cachedExplanation,
                interactions: aiState!.interactions,
            });
        } else {
            console.log(`[Aurora] Requesting explanation for step ${nextIdx + 1}`);
            requestAiResponse('explain', walkSectionId, `Explain this part: ${snippets[nextIdx]}`, {
                skipHighlightUpdate: true,
                highlightSnippet: snippets[nextIdx],
                exclusiveHighlight: true,
            });
        }
    }, [walkIndex, walkSectionId, getSectionPlainText, computeHighlightsForSection, updateAiState, aiState, requestAiResponse, resetWalkthrough, setAutoAdvanceEnabled, queueWalkthroughRecap]);

    const handleWalkPrev = useCallback(() => {
        if (!walkDataRef.current || !walkSectionId || walkIndex <= 0) return;

        const { snippets, explanations } = walkDataRef.current;
        const prevIdx = walkIndex - 1;

        // Update highlight
        const text = getSectionPlainText(walkSectionId);
        setGhostHighlights(walkSectionId, text, snippets, prevIdx);
        setWalkIndex(prevIdx);

        // Show cached explanation
        const cachedExplanation = explanations[prevIdx];
        if (cachedExplanation) {
            updateAiState({
                session: aiState!.session,
                tutor_turn: cachedExplanation,
                interactions: aiState!.interactions,
            });
        }
    }, [walkIndex, walkSectionId, getSectionPlainText, computeHighlightsForSection, updateAiState, aiState]);

    const currentWalkStepLabel = useMemo(() => {
        if (!walkSectionId || !walkDataRef.current) return undefined;
        const { snippets } = walkDataRef.current;
        return `Step ${Math.min(walkIndex + 1, snippets.length)} of ${snippets.length}`;
    }, [walkSectionId, walkIndex]);

    const walkthroughLoading = useMemo(() => {
        return !!(walkSectionId && aiStatus === 'loading');
    }, [walkSectionId, aiStatus]);

    const handleAiQuizSection = useCallback(
        (sectionId: string) => {
            requestAiResponse('quiz', sectionId);
        },
        [requestAiResponse]
    );

    const handleAiContextSection = useCallback(
        (sectionId: string) => {
            requestAiResponse('context', sectionId);
        },
        [requestAiResponse]
    );

    const handleAiSuggestion = useCallback(
        (suggestion: string) => {
            if (!suggestion) return;

            const normalized = suggestion.toLowerCase();

            // Route 'continue' to walkthrough when active
            if (normalized.includes('continue') && walkSectionId) {
                handleWalkNext();
                return;
            }

            // If the suggestion is to explain the current section, start guided walkthrough
            if (activeSection) {
                const explainPhrases = [
                    'explain',
                    `explain ${activeSection.title.toLowerCase()}`,
                    'explain block content',
                    'explain this',
                ];
                if (explainPhrases.some((p) => normalized.includes(p))) {
                    setAuroraAnchorOpen(true);
                    handleStartExplainWalkthrough(activeSection.id);
                    return;
                }
            }

            if (normalized.includes('quick exercise') || normalized.includes('practice question')) {
                const targetSection = aiFocusedSectionId || activeSection?.id || sections[0]?.id;
                if (targetSection) {
                    setAuroraAnchorOpen(true);
                    markCueDismissed(practiceCueId(targetSection));
                    requestAiResponse('quiz', targetSection);
                }
                return;
            }

            if (nextSection) {
                const nextTitle = nextSection.title.toLowerCase();
                const wantsNext =
                    normalized.includes('continue') ||
                    normalized.includes('next') ||
                    normalized.includes('go to');
                if (wantsNext && normalized.includes(nextTitle)) {
                    markCueDismissed(nextSectionCueId(activeSection?.id || nextSection.id));
                    setActiveSectionId(nextSection.id);
                    setAiFocusedSectionId(nextSection.id);
                    setAuroraCue(null);
                    setAuroraAnchorOpen(true);
                    requestAiResponse('explain', nextSection.id);
                    return;
                }
            }

            setAuroraAnchorOpen(true);
            const targetSection = aiFocusedSectionId || activeSection?.id || sections[0]?.id;
            requestAiResponse('custom', targetSection, suggestion);
        },
        [activeSection, aiFocusedSectionId, markCueDismissed, nextSection, requestAiResponse, sections, walkSectionId, handleStartExplainWalkthrough, handleWalkNext]
    );

    const handleCuePrompt = useCallback((prompt: string) => {
        if (auroraCue?.id) {
            markCueDismissed(auroraCue.id);
        }
        setAuroraCue(null);
        handleAiSuggestion(prompt);
    }, [auroraCue, handleAiSuggestion, markCueDismissed]);

    const handleWalkthroughRecap = useCallback(() => {
        if (!walkthroughRecapPrompt) return;
        const { sectionId, prompt } = walkthroughRecapPrompt;
        setWalkthroughRecapPrompt(null);
        setAuroraAnchorOpen(true);
        requestAiResponse('custom', sectionId, prompt);
    }, [requestAiResponse, setAuroraAnchorOpen, walkthroughRecapPrompt]);

    const renderAiToolbar = useCallback(
        (section?: StudySection | null) => {
            if (!auroraEnabled || !section) return null;
            const isProcessing = aiStatus === 'loading' && aiProcessingSectionId === section.id;
            return (
                <View style={styles.aiToolbar}>
                    <View style={styles.aiToolbarHeader}>
                        <Text style={styles.aiToolbarTitle}>Aurora actions</Text>
                        {isProcessing ? <ActivityIndicator size="small" color="#1D4ED8" /> : null}
                    </View>
                    <View style={styles.aiToolbarRow}>
                        <TouchableOpacity
                            style={[
                                styles.aiPill,
                                isProcessing && styles.aiPillDisabled,
                            ]}
                            onPress={() => handleStartExplainWalkthrough(section.id)}
                            disabled={isProcessing}
                        >
                            <Text style={styles.aiPillText}>Explain</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.aiPill,
                                isProcessing && styles.aiPillDisabled,
                            ]}
                            onPress={() => handleAiQuizSection(section.id)}
                            disabled={isProcessing}
                        >
                            <Text style={styles.aiPillText}>Quick quiz</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.aiPill,
                                isProcessing && styles.aiPillDisabled,
                            ]}
                            onPress={() => handleAiContextSection(section.id)}
                            disabled={isProcessing}
                        >
                            <Text style={styles.aiPillText}>Context</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        },
        [aiProcessingSectionId, aiStatus, auroraEnabled, handleAiContextSection, handleStartExplainWalkthrough, handleAiQuizSection]
    );

    useEffect(() => {
        if (!auroraEnabled) return;
        if (!activeSectionId) return;
        if (aiFocusedSectionId === activeSectionId) return;
        setAiFocusedSectionId(activeSectionId);
    }, [activeSectionId, aiFocusedSectionId, auroraEnabled]);

    useEffect(() => {
        if (!auroraEnabled) return;
        if (!aiFocusedSectionId) return;
        if (walkSectionId && walkSectionId === aiFocusedSectionId) return;
        const text = getSectionPlainText(aiFocusedSectionId);
        if (!text) return;
        const hints: string[] = [];
        if (aiTurn?.summary) hints.push(aiTurn.summary);
        if (aiTurn?.narration) hints.push(aiTurn.narration);
        computeHighlightsForSection(aiFocusedSectionId, text, hints);
    }, [auroraEnabled, aiFocusedSectionId, aiTurn, computeHighlightsForSection, getSectionPlainText, walkSectionId]);

    useEffect(() => {
        if (!auroraEnabled || !activeSection) {
            if (auroraCue) {
                setAuroraCue(null);
            }
            return;
        }

        const cards = auroraMicrocards[activeSection.id] ?? [];
        const hasPracticeCard = cards.some((card) => card.tone === 'practice');

        const candidates: AuroraCueData[] = [];

        if (explainCountSincePractice >= 2 && !hasPracticeCard) {
            candidates.push({
                id: practiceCueId(activeSection.id),
                title: 'Ready to practice?',
                message: 'Try a quick exercise to make sure it sticks.',
                prompts: ['Give me a quick exercise'],
                variant: 'spark',
            });
        }

        if (nextSection && cards.length > 0) {
            candidates.push({
                id: nextSectionCueId(activeSection.id),
                title: 'Next up',
                message: `Aurora can guide you into “${nextSection.title}”. Ready to continue?`,
                prompts: [`Continue to ${nextSection.title}`],
                variant: 'spark',
            });
        }

        if (cards.length === 0) {
            candidates.push({
                id: sectionIntroCueId(activeSection.id),
                title: 'Aurora is ready',
                message: `Highlight something in “${activeSection.title}” and Aurora will explain, quiz, or connect the dots.`,
                prompts: [
                    `Explain ${activeSection.title}`,
                    `Quiz me on ${activeSection.title}`,
                    'Give me a real-world example',
                ],
                variant: 'spark',
            });
        }

        const nextCue = candidates.find((cue) => !dismissedCueIdsRef.current.has(cue.id));

        if (!nextCue) {
            if (auroraCue) {
                setAuroraCue(null);
            }
            return;
        }

        setAuroraCue((prev) => {
            if (prev && prev.id === nextCue.id && prev.message === nextCue.message) {
                return prev;
            }
            return nextCue;
        });
    }, [activeSection, auroraCue, auroraEnabled, auroraMicrocards, explainCountSincePractice, nextSection]);

    useEffect(() => {
        if (!auroraEnabled) return;
        if (!aiTurn) return;
        if (!aiTurn.comprehension_check) return;

        const targetSectionId = aiFocusedSectionId || activeSection?.id || sections[0]?.id;
        if (!targetSectionId) return;
        if (lastPracticeTurnIdRef.current === aiTurn.turn_id) return;

        const sectionTitle = sections.find((section) => section.id === targetSectionId)?.title || 'This section';
        const card = buildAuroraMicrocard('quiz', aiTurn, sectionTitle);
        if (!card) return;

        lastPracticeTurnIdRef.current = aiTurn.turn_id;
        pushAuroraMicrocard(targetSectionId, card);
        markCueDismissed(practiceCueId(targetSectionId));
        setAuroraCue((prev) => (prev && prev.id === practiceCueId(targetSectionId) ? null : prev));
        setAuroraAnchorOpen(true);
    }, [activeSection?.id, aiFocusedSectionId, aiTurn, auroraEnabled, buildAuroraMicrocard, markCueDismissed, pushAuroraMicrocard, sections]);

    useEffect(() => {
        if (!auroraEnabled) return;
        if (!autoAdvanceEnabled) return;
        if (!aiTurn) return;
        if (aiTurn.next_action !== 'continue') return;
        if (!nextSection) return;
        if (lastAutoContinueTurnIdRef.current === aiTurn.turn_id) return;

        lastAutoContinueTurnIdRef.current = aiTurn.turn_id;
        const nextId = nextSection.id;
        markCueDismissed(nextSectionCueId(activeSection?.id || nextId));
        setAuroraCue(null);
        setActiveSectionId(nextId);
        setAiFocusedSectionId(nextId);
        setAuroraAnchorOpen(true);
        requestAiResponse('explain', nextId);
    }, [activeSection?.id, aiTurn, auroraEnabled, markCueDismissed, nextSection, requestAiResponse]);

    useEffect(() => {
        if (sections.length === 0) {
            if (activeSectionId !== null) {
                setActiveSectionId(null);
            }
            return;
        }

        if (!activeSectionId || !sections.some(section => section.id === activeSectionId)) {
            setActiveSectionId(sections[0].id);
        }
    }, [sections, activeSectionId]);

    useEffect(() => {
        if (!activeSectionId) {
            return;
        }

        requestAnimationFrame(() => {
            scrollViewRef.current?.scrollTo({ y: 0, animated: false });
        });
    }, [activeSectionId]);

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

    if (!session || (!lesson && !block)) {
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
    const renderSessionHeader = () => {
        const primaryTitle = blockTitle || lessonTitle || 'Study Session';

        return (
            <View style={styles.sessionHeader}>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.backIconButton}
                        onPress={handleBackPress}
                    >
                        <Ionicons name="chevron-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.menuIconButton}
                        onPress={() => setMenuVisible(true)}
                    >
                        <Ionicons name="menu" size={24} color="#333" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    // Render session footer (simplified)
    const renderSessionFooter = () => (
        <View style={styles.sessionFooter}>
            {/* Session Info */}
            <View style={styles.footerSessionInfo}>
                <View style={styles.footerTitleRow}>
                    <Text style={styles.footerSessionTitle} numberOfLines={1}>
                        {blockTitle || lessonTitle}
                    </Text>
                </View>
                <Text style={styles.footerSessionSubtitle} numberOfLines={1}>{courseTitle}</Text>
                {assignments.length > 0 && (
                    <Text style={styles.footerAssignmentIndicator}>
                        {assignments.filter(a => a.status === 'assigned').length} assignments pending
                    </Text>
                )}
            </View>

            {/* Mark as Done Button */}
            <View style={styles.sessionControls}>
                <TouchableOpacity
                    style={[
                        styles.controlButton,
                        styles.completeButton,
                        isAlreadyCompleted && { backgroundColor: '#10B981' }
                    ]}
                    onPress={markContentCompleted}
                    disabled={markingDone || isAlreadyCompleted}
                >
                    {isAlreadyCompleted ? (
                        <Text style={styles.controlButtonText}>Done</Text>
                    ) : markingDone ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.controlButtonText}>Mark as Done</Text>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.controlButton,
                        styles.aiModeButton,
                        auroraEnabled && styles.aiModeButtonActive,
                    ]}
                    onPress={handleToggleAiAssist}
                    disabled={aiStatus === 'loading'}
                >
                    {aiStatus === 'loading' ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.controlButtonText}>
                            {auroraEnabled ? 'Aurora On' : 'Enable Aurora'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Workflow Integration */}
            {assignments.length > 0 && (() => {
                const blockAssignments = blockId
                    ? assignments.filter(a => {
                        const assignmentBlockId = a.assignment?.block_id || (a as any).block_id;
                        return assignmentBlockId === blockId && a.status === 'assigned';
                    })
                    : assignments.filter(a => a.status === 'assigned');

                if (blockAssignments.length === 0) return null;

                return (
                    <View style={styles.workflowSection}>
                        <Text style={styles.workflowTitle}>Ready for Assignments</Text>
                        <TouchableOpacity
                            style={styles.workflowButton}
                            onPress={continueToAssignments}
                        >
                            <Text style={styles.workflowButtonText}>
                                Continue to Assignment{blockAssignments.length > 1 ? 's' : ''} ({blockAssignments.length} pending)
                            </Text>
                        </TouchableOpacity>
                    </View>
                );
            })()}
        </View>
    );

    // Render content (lesson or block) with paginated sections
    const renderContentBody = () => {
        if (sections.length === 0) {
            return (
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.contentScrollView}
                    contentContainerStyle={styles.emptyStateContainer}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.emptyStateCard}>
                        <Text style={styles.emptyStateTitle}>Content coming soon</Text>
                        <Text style={styles.emptyStateSubtitle}>
                            We're still preparing materials for this study session. Please check back later.
                        </Text>
                    </View>
                </ScrollView>
            );
        }

        if (!activeSection) {
            return null;
        }
        const currentIndex = currentSectionIndex >= 0 ? currentSectionIndex : 0;

        return (
            <ScrollView
                ref={scrollViewRef}
                style={styles.contentScrollView}
                contentContainerStyle={styles.pagedContentContainer}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.sectionIntroCard}>
                    <Text style={styles.sectionIntroBadge}>
                        {currentIndex + 1} of {sections.length}
                    </Text>
                    <Text style={styles.sectionIntroTitle}>
                        {activeSection.icon} {activeSection.title}
                    </Text>
                </View>
                {activeSection.content}
                {(auroraMicrocards[activeSection.id] || []).map((card) => (
                    <AuroraMicrocard
                        key={card.id}
                        {...card}
                        onPromptPress={handleAiSuggestion}
                    />
                ))}
                {renderAiToolbar(activeSection)}
                <View style={styles.sectionPagerControls}>
                    {previousSection ? (
                        <TouchableOpacity
                            style={[styles.pagerButton, styles.pagerButtonSecondary]}
                            onPress={() => setActiveSectionId(previousSection.id)}
                        >
                            <Text style={styles.pagerButtonText}>
                                ← {previousSection.title}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.pagerButtonSpacer} />
                    )}
                    {nextSection ? (
                        <TouchableOpacity
                            style={[styles.pagerButton, styles.pagerButtonPrimary]}
                            onPress={() => setActiveSectionId(nextSection.id)}
                        >
                            <Text style={[styles.pagerButtonText, styles.pagerButtonTextPrimary]}>
                                {nextSection.title} →
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.pagerButtonSpacer} />
                    )}
                </View>
                <View style={{ height: 80 }} />
            </ScrollView>
        );
    };



    return (
        <SafeAreaView style={styles.container}>
            <Modal
                visible={isMenuVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
            >
                <View style={styles.menuOverlay}>
                    <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)} />
                    <View style={styles.sideMenuContainer}>
                        <View style={styles.sideMenuHeader}>
                            <TouchableOpacity onPress={() => setMenuVisible(false)}>
                                <Text style={styles.sideMenuClose}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.sideMenuCourseInfo}>
                            <Text style={styles.sideMenuCourseTitle} numberOfLines={1}>{courseTitle}</Text>
                            <Text style={styles.sideMenuLessonTitle} numberOfLines={2}>{blockTitle || lessonTitle}</Text>
                        </View>
                        <Text style={styles.sideMenuSectionTitle}>Course Outline</Text>
                        <View style={styles.sideMenuItemsWrapper}>
                            {sections.map((section, index) => {
                                const isActive = section.id === activeSectionId;
                                const isLast = index === sections.length - 1;
                                return (
                                    <TouchableOpacity
                                        key={section.id}
                                        style={[styles.sideMenuItem, isActive && styles.sideMenuItemActive]}
                                        onPress={() => {
                                            setActiveSectionId(section.id);
                                            setMenuVisible(false);
                                        }}
                                    >
                                        <View style={styles.sideMenuConnectorColumn}>
                                            <View style={[styles.sideMenuConnectorLine, isLast && styles.sideMenuConnectorLineHidden]} />
                                            <View style={[styles.sideMenuConnectorDot, isActive && styles.sideMenuConnectorDotActive]} />
                                        </View>
                                        <Text style={styles.sideMenuItemIndex}>{index + 1}.</Text>
                                        <View style={styles.sideMenuItemContent}>
                                            <Text
                                                style={[styles.sideMenuItemText, isActive && styles.sideMenuItemTextActive]}
                                                numberOfLines={1}
                                            >
                                                {section.icon} {section.title}
                                            </Text>
                                            {isActive && (
                                                <Text style={styles.sideMenuItemHint}>Currently viewing</Text>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                            {sections.length === 0 && (
                                <View style={styles.sideMenuEmptyState}>
                                    <Text style={styles.sideMenuEmptyStateText}>No sections available yet.</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
            {renderSessionHeader()}
            {renderContentBody()}
            {renderSessionFooter()}
            <AuroraGuide
                enabled={auroraEnabled}
                anchorOpen={auroraAnchorOpen}
                status={aiStatus}
                title="Aurora Guide"
                summary={auroraSummary}
                message={auroraDisplayState.showNarration ? auroraMessage : undefined}
                comprehensionCheck={auroraDisplayState.showQuestion ? (typeof aiTurn?.comprehension_check === 'string' ? aiTurn.comprehension_check : null) : undefined}
                checkpoint={(auroraDisplayState.showCheckpoint && (!walkSectionId || (Math.max(0, walkIndex) % 2 === 1))) ? aiTurn?.checkpoint : undefined}
                suggestions={auroraDisplayState.showSuggestions ? auroraSuggestions : undefined}
                cue={auroraCue}
                walkthroughActive={!!walkSectionId}
                walkthroughLoading={walkthroughLoading}
                walkStepLabel={currentWalkStepLabel}
                onWalkNext={walkSectionId ? handleWalkNext : undefined}
                onWalkPrev={walkSectionId && walkIndex > 0 ? handleWalkPrev : undefined}
                postWalkthroughActionLabel={
                    auroraDisplayState.showCheckpoint && (aiTurn?.checkpoint?.checkpoint_type === 'photo' || !aiTurn?.checkpoint?.checkpoint_type)
                        ? 'Submit photo'
                        : walkthroughRecapPrompt?.label
                }
                postWalkthroughActionDisabled={aiStatus === 'loading'}
                onToggleAnchor={handleToggleAuroraAnchor}
                onSuggestionPress={handleAiSuggestion}
                onCuePromptPress={handleCuePrompt}
                onDismissCue={handleDismissCue}
                onPostWalkthroughAction={
                    auroraDisplayState.showCheckpoint && (aiTurn?.checkpoint?.checkpoint_type === 'photo' || !aiTurn?.checkpoint?.checkpoint_type)
                        ? handleSubmitCheckpoint
                        : (walkthroughRecapPrompt ? handleWalkthroughRecap : undefined)
                }
                onAnswerComprehension={handleAnswerComprehension}
                onAnswerFreeform={handleAnswerFreeform}
                onSubmitReflection={handleSubmitReflectionNotes}
                onSubmitQuizNotes={handleSubmitQuizNotes}
                onSubmitPhotoCheckpoint={handleSubmitCheckpoint}
            />
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
        paddingTop: 8,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    backIconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8F9FC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuIconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8F9FC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Footer styles (moved from header) - Minimized to 1/3 size
    sessionFooter: {
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingTop: 6,
        paddingBottom: 8,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 3,
    },
    footerSessionInfo: {
        marginBottom: 6,
    },
    footerTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 2,
    },
    footerSessionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1a1a1a',
        flex: 1,
        marginRight: 8,
    },
    footerSessionSubtitle: {
        fontSize: 10,
        color: '#999',
        marginBottom: 2,
    },
    footerAssignmentIndicator: {
        fontSize: 9,
        color: '#007AFF',
        fontWeight: '600',
        backgroundColor: '#E3F2FD',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginTop: 2,
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
        fontSize: 11,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 2,
    },
    statusIndicator: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    progressBar: {
        flex: 1,
        height: 4,
        backgroundColor: '#e0e0e0',
        borderRadius: 2,
        marginRight: 6,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#007AFF',
        borderRadius: 2,
    },
    progressText: {
        fontSize: 11,
        color: '#1a1a1a',
        fontWeight: '600',
        minWidth: 30,
    },
    sessionControls: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 0,
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
    aiModeButton: {
        backgroundColor: '#2563EB',
        marginLeft: 6,
    },
    aiModeButtonActive: {
        backgroundColor: '#1E40AF',
    },
    controlButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    pauseButtonText: {
        color: '#333',
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
    aiToolbar: {
        marginTop: 16,
        marginBottom: 4,
        backgroundColor: '#EEF2FF',
        borderRadius: 18,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(129, 140, 248, 0.35)',
    },
    aiToolbarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    aiToolbarTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#312E81',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    aiToolbarRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    aiPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 7,
        paddingHorizontal: 13,
        backgroundColor: 'rgba(79, 70, 229, 0.14)',
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(79, 70, 229, 0.32)',
        marginRight: 8,
        marginBottom: 8,
    },
    aiPillDisabled: {
        opacity: 0.5,
    },
    aiPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1D4ED8',
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
    emptyStateContainer: {
        flexGrow: 1,
        padding: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyStateCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 8,
    },
    emptyStateSubtitle: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 20,
    },
    pagedContentContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    sectionIntroCard: {
        backgroundColor: '#DBEAFE',
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
    },
    sectionIntroBadge: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1D4ED8',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    sectionIntroTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1E3A8A',
    },
    sectionPagerControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 24,
        gap: 12,
    },
    pagerButton: {
        flex: 1,
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    pagerButtonSecondary: {
        backgroundColor: '#F1F5F9',
    },
    pagerButtonPrimary: {
        backgroundColor: '#2563EB',
    },
    pagerButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E3A8A',
    },
    pagerButtonTextPrimary: {
        color: '#fff',
    },
    pagerButtonSpacer: {
        flex: 1,
    },
    assignmentsCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
    },
    assignmentsTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 6,
    },
    assignmentsSubtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 16,
        lineHeight: 20,
    },
    assignmentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        marginBottom: 10,
    },
    assignmentRowPending: {
        backgroundColor: '#E0F2FE',
        borderWidth: 1,
        borderColor: '#38BDF8',
    },
    assignmentIconContainer: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#DBEAFE',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    assignmentIcon: {
        fontSize: 20,
    },
    assignmentInfo: {
        flex: 1,
    },
    assignmentTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 4,
    },
    assignmentStatusText: {
        fontSize: 12,
        color: '#6b7280',
        textTransform: 'capitalize',
    },
    assignmentAction: {
        fontSize: 13,
        fontWeight: '600',
    },
    assignmentActionPrimary: {
        color: '#2563EB',
    },
    assignmentActionSecondary: {
        color: '#64748B',
    },
    assignmentsAllButton: {
        marginTop: 8,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#1D4ED8',
        alignItems: 'center',
    },
    assignmentsAllButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    menuOverlay: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15, 23, 42, 0.35)',
    },
    menuBackdrop: {
        flex: 1,
    },
    sideMenuContainer: {
        width: Math.min(width * 0.78, 340),
        height: height * 0.6, // Half height
        backgroundColor: '#dee6ffff', // Purple theme color
        paddingVertical: 24,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 8,
        borderTopLeftRadius: 20,
        borderBottomLeftRadius: 20,
        paddingTop: 15,
        marginTop: height * 0.06,// Center vertically
    },
    sideMenuHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end', // Align close button to right
        alignItems: 'center',
        marginBottom: 16,
    },
    sideMenuClose: {
        fontSize: 25,
        color: '#070707ff', // White text for purple background
        padding: 4,
    },
    sideMenuCourseInfo: {
        marginBottom: 24,
    },
    sideMenuCourseTitle: {
        fontSize: 14,
        color: '#000000ff', // Light purple text
        marginBottom: 4,
    },
    sideMenuLessonTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000000ff', // White text for purple background
    },
    sideMenuSectionTitle: {
        fontSize: 13,
        color: '#000000ff', // Light purple text
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 12,
    },
    sideMenuItemsWrapper: {
        paddingBottom: 16,
    },
    sideMenuItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 8,
    },
    sideMenuItemActive: {
        backgroundColor: '#EEF2FF',
    },
    sideMenuItemIndex: {
        width: 24,
        fontSize: 14,
        fontWeight: '600',
        color: '#6366F1',
    },
    sideMenuItemContent: {
        flex: 1,
    },
    sideMenuItemText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1f2937',
    },
    sideMenuItemTextActive: {
        color: '#4338CA',
    },
    sideMenuItemHint: {
        marginTop: 4,
        fontSize: 12,
        color: '#6366F1',
    },
    sideMenuEmptyState: {
        paddingVertical: 24,
    },
    sideMenuEmptyStateText: {
        fontSize: 14,
        color: '#6b7280',
    },
    sideMenuConnectorColumn: {
        width: 18,
        alignItems: 'center',
        marginRight: 8,
    },
    sideMenuConnectorLine: {
        flex: 1,
        width: 2,
        backgroundColor: '#E5E7EB',
    },
    sideMenuConnectorLineHidden: {
        opacity: 0,
    },
    sideMenuConnectorDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#CBD5F5',
        marginTop: 4,
    },
    sideMenuConnectorDotActive: {
        backgroundColor: '#4338CA',
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
    assignmentIndicator: {
        backgroundColor: '#FFF3CD',
        padding: 12,
        borderRadius: 8,
        marginVertical: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#FFC107',
    },
    workflowSection: {
        backgroundColor: '#F8F9FA',
        padding: 8,
        borderRadius: 8,
        marginTop: 6,
        borderWidth: 1,
        borderColor: '#DEE2E6',
    },
    workflowTitle: {
        fontSize: 10,
        fontWeight: '600',
        color: '#666',
        marginBottom: 4,
    },
    workflowButton: {
        backgroundColor: '#007bff',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        alignItems: 'center',
    },
    workflowButtonText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
    // Resource styles
    resourcesContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    resourcesSectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    resourcesSectionSubtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
    },
    resourceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    resourceIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    resourceIcon: {
        fontSize: 24,
    },
    resourceInfo: {
        flex: 1,
        marginRight: 8,
    },
    resourceTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 4,
        lineHeight: 20,
    },
    resourceQuery: {
        fontSize: 12,
        color: '#666',
        fontStyle: 'italic',
    },
    resourceArrow: {
        fontSize: 20,
        color: '#007AFF',
        fontWeight: 'bold',
    },
    // Video player styles
    videoCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#007AFF',
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
    },
    videoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f8f9fa',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    videoIconContainer: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    videoIcon: {
        fontSize: 24,
    },
    videoInfo: {
        flex: 1,
        marginRight: 8,
    },
    videoTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 4,
        lineHeight: 22,
    },
    videoQuery: {
        fontSize: 12,
        color: '#666',
        fontStyle: 'italic',
    },
    videoToggleContainer: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#007AFF',
        borderRadius: 8,
    },
    videoToggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    videoPlayerContainer: {
        backgroundColor: '#000',
        padding: 12,
    },
    videoPlayerWrapper: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#000',
        borderWidth: 2,
        borderColor: '#007AFF',
    },
    videoPlayer: {
        flex: 1,
        backgroundColor: '#000',
    },
    videoQueryExpanded: {
        fontSize: 13,
        color: '#fff',
        marginTop: 12,
        paddingHorizontal: 4,
        fontStyle: 'italic',
    },
    videoFallbackContainer: {
        padding: 24,
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
    },
    videoFallbackText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 12,
        textAlign: 'center',
    },
    videoFallbackButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#007AFF',
        borderRadius: 8,
    },
    videoFallbackButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});