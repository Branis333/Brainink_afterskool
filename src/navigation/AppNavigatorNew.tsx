import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreenNew';


// Course Management Screens
import { CourseHomepageScreen } from '../screens/CourseHomepageScreen';
import { CourseDetailsScreen } from '../screens/course/CourseDetailsScreen';
import { LessonViewScreen } from '../screens/course/LessonViewScreen';
import { CourseProgressScreen } from '../screens/course/CourseProgressScreen';
import { StudySessionScreen } from '../screens/course/StudySessionScreen';
import { CourseAssignmentScreen } from '../screens/course/CourseAssignmentScreen';
import { CourseSearchScreen } from '../screens/course/CourseSearchScreen';

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

// Main Tab Container
import { MainTabContainer } from '../components/MainTabContainer';

export type RootStackParamList = {
    Login: undefined;
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
        lessonId: number;
        lessonTitle: string;
        courseTitle: string;
    };
    CourseAssignments: { courseId: number; courseTitle: string };
    CourseSearch: undefined;
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
        submissionType?: 'homework' | 'quiz' | 'practice' | 'assessment';
    };
    UploadsManagement: undefined;
    UploadProgress: undefined;
    UploadHistory: undefined;
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
                <Stack.Screen
                    name="CourseSearch"
                    component={CourseSearchScreen}
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
            </Stack.Navigator>
        </NavigationContainer>
    );

    function getInitialRoute(): keyof RootStackParamList {
        // If user is not logged in, go to login
        if (!user || !token) {
            return 'Login';
        }

        // If user is logged in, go to main tabs
        return 'MainTabs';
    }
};
