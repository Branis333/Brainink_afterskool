import React, { useCallback } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreenNew';
import { StartUpScreen } from '../screens/startUpScreen';


// Course Management Screens
import { CourseHomepageScreen } from '../screens/CourseHomepageScreen';
import { CourseDetailsScreen } from '../screens/course/CourseDetailsScreen';
import { LessonViewScreen } from '../screens/course/LessonViewScreen';
import { CourseProgressScreen } from '../screens/course/CourseProgressScreen';
import { StudySessionScreen } from '../screens/course/StudySessionScreen';
import { CourseAssignmentScreen } from '../screens/course/CourseAssignmentScreen';
import { CourseSearchScreen } from '../screens/course/CourseSearchScreen';
import { MyCoursesScreen } from '../screens/course/MyCourses';

// Grades Management Screens
import { GradesOverviewScreen } from '../screens/grades/GradesOverviewScreen';
import { GradeDetailsScreen } from '../screens/grades/GradeDetailsScreen';
import { GradesAnalyticsScreen } from '../screens/grades/GradesAnalyticsScreen';
import { SubmissionsManagementScreen } from '../screens/grades/SubmissionsManagementScreen';
import { AIGradingStatusScreen } from '../screens/grades/AIGradingStatusScreen';
import { GradeHistoryScreen } from '../screens/grades/GradeHistoryScreen';

// Uploads Management Screens
import { UploadsOverviewScreen } from '../screens/uploads/UploadsOverviewScreen';
import { useSubscription } from '../context/SubscriptionContext';
import { FileUploadScreen } from '../screens/uploads/FileUploadScreen';
import { BulkUploadScreen } from '../screens/uploads/BulkUploadScreen';
import { UploadsManagementScreen } from '../screens/uploads/UploadsManagementScreen';
import { UploadProgressScreen } from '../screens/uploads/UploadProgressScreen';
import { UploadHistoryScreen } from '../screens/uploads/UploadHistoryScreen';

// Notes Management Screens
import { NotesListScreen } from '../screens/notes/NotesListScreen';
import { NoteDetailsScreen } from '../screens/notes/NoteDetailsScreen';
import { UploadNoteScreen } from '../screens/notes/UploadNoteScreen';
import { ObjectiveDetailsScreen } from '../screens/notes/ObjectiveDetailsScreen';

// Notifications Management Screens
import {
    NotificationsScreen,
    NotificationDetailScreen,
    NotificationSettingsScreen,
} from '../screens/notifications';

// Main Tab Container
import { MainTabContainer } from '../components/MainTabContainer';
import EditProfileScreen from '../screens/EditProfileScreen';
import { QuizScreen } from '../screens/Quiz';
import FlashcardsScreen from '../screens/Flashcards';
import VideoPlayerScreen from '../screens/VideoPlayer';
import ObjectiveQuizScreen from '../screens/notes/ObjectiveQuizScreen';
import ObjectiveWrittenQuizScreen from '../screens/notes/ObjectiveWrittenQuizScreen';

export type RootStackParamList = {
    Login: undefined;
    StartUp: undefined;
    MainTabs: undefined;
    // Course Management
    CourseHomepage: undefined;
    CourseDetails: { courseId: number; courseTitle: string };
    LessonView: {
        courseId: number;
        lessonId: number;
        lessonTitle: string;
        courseTitle: string;
    };
    CourseProgress: { courseId: number; courseTitle: string };
    StudySession: {
        sessionId: number;
        courseId: number;
        lessonId?: number;
        blockId?: number;
        lessonTitle?: string;
        courseTitle: string;
    };
    // Many screens navigate using both 'CourseAssignments' and 'CourseAssignment'.
    // Support both route names pointing to the same screen component and params.
    CourseAssignments: {
        courseId: number;
        courseTitle: string;
        assignmentId?: number;
        assignmentTitle?: string;
        startWorkflow?: boolean;
        // Optional focus to filter assignments by lesson/block
        lessonId?: number;
        blockId?: number;
    };
    CourseAssignment: {
        courseId: number;
        courseTitle: string;
        assignmentId?: number;
        assignmentTitle?: string;
        startWorkflow?: boolean;
        // Optional focus to filter assignments by lesson/block
        lessonId?: number;
        blockId?: number;
    };
    CourseSearch: undefined;
    MyCourses: undefined;
    // Grades Management
    GradesOverview: undefined;
    GradeDetails: {
        submissionId: number;
        submissionType: 'homework' | 'quiz' | 'practice' | 'assessment';
    };
    GradesAnalytics: undefined;
    SubmissionsManagement: undefined;
    AIGradingStatus: undefined;
    GradeHistory: undefined;
    // Uploads Management
    UploadsOverview: undefined;
    FileUpload: {
        courseId?: number;
        assignmentId?: number;
        sessionId?: number;
        submissionType?: 'homework' | 'quiz' | 'practice' | 'assessment';
    };
    BulkUpload: {
        title?: string;
        courseId?: number;
        assignmentId?: number;
        sessionId?: number;
        lessonId?: number; // optional anchor for uploads context
        blockId?: number;  // optional anchor for uploads context
        submissionType?: 'homework' | 'quiz' | 'practice' | 'assessment';
    };
    UploadsManagement: undefined;
    UploadProgress: undefined;
    UploadHistory: undefined;
    // Notes Management
    NotesList: undefined;
    NoteDetails: { noteId: number };
    UploadNote: undefined;
    ObjectiveDetails: { noteId: number; objectiveIndex: number };
    Flashcards: { mode: 'objective'; noteId: number; objectiveIndex: number; title?: string; flashcardsPayload?: any };
    VideoPlayer: { url: string; title?: string };
    ObjectiveQuiz: { noteId: number; objectiveIndex: number; title?: string; quizPayload?: any };
    ObjectiveWrittenQuiz: { noteId: number; objectiveIndex: number; title?: string; quizPayload?: any };
    // Notifications Management
    Notifications: undefined;
    NotificationDetail: { notification: any };
    NotificationSettings: undefined;
    // Profile
    EditProfile: undefined;
    // Ephemeral Practice Quiz (assignment/block/note)
    Quiz: { mode: 'assignment' | 'block' | 'note'; id: number; title?: string };
    // Payments
    Paywall: undefined;
};
import { PaywallScreen } from '../screens/payments/PaywallScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

type AppNavigatorProps = {
    onRouteChange?: (routeName: string) => void;
};

const navigationRef = createNavigationContainerRef();

export const AppNavigator: React.FC<AppNavigatorProps> = ({ onRouteChange }) => {
    const { user, token, school, role, isLoading } = useAuth();
    const { status } = useSubscription();

    const handleRouteChange = useCallback(() => {
        if (!navigationRef.isReady()) return;
        const current = navigationRef.getCurrentRoute();
        if (current?.name) {
            onRouteChange?.(current.name);
        }
    }, [onRouteChange]);

    if (isLoading) {
        return null; // Or a loading screen component
    }

    return (
        <NavigationContainer
            ref={navigationRef}
            onReady={handleRouteChange}
            onStateChange={handleRouteChange}
        >
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    gestureEnabled: false,
                }}
                initialRouteName={getInitialRoute()}
            >
                <Stack.Screen
                    name="StartUp"
                    component={StartUpScreen}
                    options={{ gestureEnabled: true }}
                />
                <Stack.Screen
                    name="Login"
                    component={LoginScreen}
                    options={{ gestureEnabled: true }}
                />

                {/* Main Tab Container */}
                <Stack.Screen
                    name="MainTabs"
                    component={MainTabContainer}
                />

                {/* Course Management Screens */}
                <Stack.Screen
                    name="CourseHomepage"
                    component={CourseHomepageScreen}
                />
                <Stack.Screen
                    name="CourseDetails"
                    component={status?.active ? CourseDetailsScreen : PaywallScreen}
                />
                <Stack.Screen
                    name="LessonView"
                    component={status?.active ? LessonViewScreen : PaywallScreen}
                />
                <Stack.Screen
                    name="CourseProgress"
                    component={status?.active ? CourseProgressScreen : PaywallScreen}
                />
                <Stack.Screen
                    name="StudySession"
                    component={status?.active ? StudySessionScreen : PaywallScreen}
                />
                <Stack.Screen
                    name="CourseAssignments"
                    component={status?.active ? CourseAssignmentScreen : PaywallScreen}
                />
                {/* Alias route so navigation.navigate('CourseAssignment', ...) also works */}
                <Stack.Screen
                    name="CourseAssignment"
                    component={status?.active ? CourseAssignmentScreen : PaywallScreen}
                />
                <Stack.Screen
                    name="CourseSearch"
                    component={CourseSearchScreen}
                />
                <Stack.Screen
                    name="MyCourses"
                    component={status?.active ? MyCoursesScreen : PaywallScreen}
                />

                {/* Grades Management Screens */}
                <Stack.Screen
                    name="GradesOverview"
                    component={GradesOverviewScreen}
                />
                <Stack.Screen
                    name="GradeDetails"
                    component={GradeDetailsScreen}
                />
                <Stack.Screen
                    name="GradesAnalytics"
                    component={GradesAnalyticsScreen}
                />
                <Stack.Screen
                    name="SubmissionsManagement"
                    component={SubmissionsManagementScreen}
                />
                <Stack.Screen
                    name="AIGradingStatus"
                    component={AIGradingStatusScreen}
                />
                <Stack.Screen
                    name="GradeHistory"
                    component={GradeHistoryScreen}
                />

                {/* Uploads Management Screens */}
                <Stack.Screen
                    name="UploadsOverview"
                    component={status?.active ? UploadsOverviewScreen : PaywallScreen}
                />
                <Stack.Screen
                    name="FileUpload"
                    component={status?.active ? FileUploadScreen : PaywallScreen}
                />
                <Stack.Screen
                    name="BulkUpload"
                    component={status?.active ? BulkUploadScreen : PaywallScreen}
                />
                <Stack.Screen
                    name="UploadsManagement"
                    component={UploadsManagementScreen}
                />
                <Stack.Screen
                    name="UploadProgress"
                    component={UploadProgressScreen}
                />
                <Stack.Screen
                    name="UploadHistory"
                    component={UploadHistoryScreen}
                />

                {/* Notes Management Screens */}
                <Stack.Screen
                    name="NotesList"
                    component={NotesListScreen}
                    options={{
                        animation: 'slide_from_right',
                        gestureEnabled: true,
                    }}
                />
                <Stack.Screen
                    name="NoteDetails"
                    component={NoteDetailsScreen}
                    options={{
                        animation: 'slide_from_right',
                        gestureEnabled: true,
                    }}
                />
                <Stack.Screen
                    name="UploadNote"
                    component={UploadNoteScreen}
                    options={{
                        animation: 'slide_from_bottom',
                        gestureEnabled: true,
                        gestureDirection: 'vertical',
                    }}
                />
                <Stack.Screen
                    name="ObjectiveDetails"
                    component={ObjectiveDetailsScreen}
                    options={{
                        animation: 'slide_from_right',
                        gestureEnabled: true,
                    }}
                />
                <Stack.Screen
                    name="Flashcards"
                    component={FlashcardsScreen}
                    options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                        gestureEnabled: true,
                        gestureDirection: 'vertical',
                    }}
                />
                <Stack.Screen
                    name="ObjectiveQuiz"
                    component={ObjectiveQuizScreen}
                    options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                        gestureEnabled: true,
                        gestureDirection: 'vertical',
                    }}
                />
                <Stack.Screen
                    name="ObjectiveWrittenQuiz"
                    component={ObjectiveWrittenQuizScreen}
                    options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                        gestureEnabled: true,
                        gestureDirection: 'vertical',
                    }}
                />
                <Stack.Screen
                    name="VideoPlayer"
                    component={VideoPlayerScreen}
                    options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                        gestureEnabled: true,
                        gestureDirection: 'vertical',
                    }}
                />


                {/* Notifications Management Screens */}
                <Stack.Screen
                    name="Notifications"
                    component={NotificationsScreen}
                />
                <Stack.Screen
                    name="NotificationDetail"
                    component={NotificationDetailScreen}
                />
                <Stack.Screen
                    name="NotificationSettings"
                    component={NotificationSettingsScreen}
                />
                {/* Profile */}
                <Stack.Screen
                    name="EditProfile"
                    component={EditProfileScreen}
                    options={{
                        animation: 'slide_from_right',
                        gestureEnabled: true,
                    }}
                />
                {/* Ephemeral Practice Quiz Modal */}
                <Stack.Screen
                    name="Quiz"
                    component={QuizScreen}
                    options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                        gestureEnabled: true,
                        gestureDirection: 'vertical',
                    }}
                />
                {/* Payments */}
                <Stack.Screen
                    name="Paywall"
                    component={PaywallScreen}
                    options={{
                        animation: 'slide_from_bottom',
                        gestureEnabled: true,
                        gestureDirection: 'vertical',
                    }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );

    function getInitialRoute(): keyof RootStackParamList {
        // If user is not logged in, show StartUp screen first
        if (!user || !token) {
            return 'StartUp';
        }

        // If user is logged in, go to main tabs
        return 'MainTabs';
    }
};
