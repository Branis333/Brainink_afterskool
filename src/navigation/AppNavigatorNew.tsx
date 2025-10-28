import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
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
import { FileUploadScreen } from '../screens/uploads/FileUploadScreen';
import { BulkUploadScreen } from '../screens/uploads/BulkUploadScreen';
import { UploadsManagementScreen } from '../screens/uploads/UploadsManagementScreen';
import { UploadProgressScreen } from '../screens/uploads/UploadProgressScreen';
import { UploadHistoryScreen } from '../screens/uploads/UploadHistoryScreen';

// Notes Management Screens
import { NotesListScreen } from '../screens/notes/NotesListScreen';
import { NoteDetailsScreen } from '../screens/notes/NoteDetailsScreen';
import { UploadNoteScreen } from '../screens/notes/UploadNoteScreen';

// Notifications Management Screens
import {
    NotificationsScreen,
    NotificationDetailScreen,
    NotificationSettingsScreen,
} from '../screens/notifications';

// Main Tab Container
import { MainTabContainer } from '../components/MainTabContainer';
import EditProfileScreen from '../screens/EditProfileScreen';

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
    // Notifications Management
    Notifications: undefined;
    NotificationDetail: { notification: any };
    NotificationSettings: undefined;
    // Profile
    EditProfile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
    const { user, token, school, role, isLoading } = useAuth();

    if (isLoading) {
        return null; // Or a loading screen component
    }

    return (
        <NavigationContainer>
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
                    component={CourseDetailsScreen}
                />
                <Stack.Screen
                    name="LessonView"
                    component={LessonViewScreen}
                />
                <Stack.Screen
                    name="CourseProgress"
                    component={CourseProgressScreen}
                />
                <Stack.Screen
                    name="StudySession"
                    component={StudySessionScreen}
                />
                <Stack.Screen
                    name="CourseAssignments"
                    component={CourseAssignmentScreen}
                />
                {/* Alias route so navigation.navigate('CourseAssignment', ...) also works */}
                <Stack.Screen
                    name="CourseAssignment"
                    component={CourseAssignmentScreen}
                />
                <Stack.Screen
                    name="CourseSearch"
                    component={CourseSearchScreen}
                />
                <Stack.Screen
                    name="MyCourses"
                    component={MyCoursesScreen}
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
                    component={UploadsOverviewScreen}
                />
                <Stack.Screen
                    name="FileUpload"
                    component={FileUploadScreen}
                />
                <Stack.Screen
                    name="BulkUpload"
                    component={BulkUploadScreen}
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
