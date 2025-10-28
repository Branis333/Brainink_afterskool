/**
 * Comprehensive Main Tab Container
 * Full-featured navigation system with proper state management, navigation handling,
 * and seamless integration with all app screens
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    BackHandler,
    Alert,
    StatusBar,
    Platform
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

// Import all main screens
import { CourseHomepageScreen } from '../screens/CourseHomepageScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
// import { SearchScreen } from '../screens/course/CourseSearchScreen';
import { MyCoursesScreen } from '../screens/course/MyCourses';
import { UploadsOverviewScreen } from '../screens/uploads/UploadsOverviewScreen';
import { GradesOverviewScreen } from '../screens/grades/GradesOverviewScreen';

// Import navigation components
import { BottomTabs, TabItem } from '../components/BottomTabs';
import { useAuth } from '../context/AuthContext';
import { NotesListScreen } from '../screens/notes/NotesListScreen';

type NavigationProp = NativeStackNavigationProp<any>;

export type TabScreens = 'home' | 'courses' | 'uploads' | 'notes' | 'profile';

interface Props {
    navigation: NavigationProp;
    initialTab?: TabScreens;
}

export const MainTabContainer: React.FC<Props> = ({
    navigation,
    initialTab = 'home'
}) => {
    const { user, token } = useAuth();
    const [activeTab, setActiveTab] = useState<TabScreens>(initialTab);
    const [uploadsBadgeCount, setUploadsBadgeCount] = useState(0);
    const [gradesBadgeCount, setGradesBadgeCount] = useState(0);

    // Handle hardware back button on Android
    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (activeTab !== 'home') {
                    setActiveTab('home');
                    return true;
                }

                Alert.alert(
                    'Exit App',
                    'Are you sure you want to exit?',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() },
                    ]
                );
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [activeTab])
    );

    // Load badge counts (example: pending uploads, new grades)
    useEffect(() => {
        loadBadgeCounts();
    }, [token]);

    const loadBadgeCounts = async () => {
        // This would normally fetch from your APIs
        // For now, we'll use placeholder logic
        try {
            // Example: fetch pending uploads count
            // const uploadsCount = await uploadsService.getPendingCount(token);
            // setUploadsBadgeCount(uploadsCount);

            // Example: fetch unread grades count  
            // const gradesCount = await gradesService.getUnreadCount(token);
            // setGradesBadgeCount(gradesCount);
        } catch (error) {
            console.log('Error loading badge counts:', error);
        }
    };

    const handleTabPress = (tabId: TabScreens) => {
        setActiveTab(tabId);

        // Update badge counts when tab is accessed
        if (tabId === 'uploads') {
            setUploadsBadgeCount(0);
        } else if (tabId === 'notes') {
            setGradesBadgeCount(0);
        }
    };

    // Don't automatically navigate away - keep tabs visible
    // Users can navigate through the bottom tab bar

    const renderActiveScreen = () => {
        // Create a mock route object for screens that need it
        const mockRoute = { key: activeTab, name: activeTab, params: {} } as any;

        switch (activeTab) {
            case 'home':
                return <CourseHomepageScreen navigation={navigation} />;
            case 'courses':
                return <MyCoursesScreen navigation={navigation} />;
            case 'uploads':
                return <UploadsOverviewScreen navigation={navigation as any} route={mockRoute} />;
            case 'notes':
                return <NotesListScreen navigation={navigation} />;
            case 'profile':
                return <ProfileScreen navigation={navigation} />;
            default:
                return <CourseHomepageScreen navigation={navigation} />;
        }
    };

    const tabs: TabItem[] = [
        {
            id: 'home',
            label: 'Home',
            icon: 'home-outline',
            activeIcon: 'home',
            onPress: () => handleTabPress('home'),
        },
        {
            id: 'courses',
            label: 'Courses',
            icon: 'library-outline',
            activeIcon: 'library',
            onPress: () => handleTabPress('courses'),
        },
        {
            id: 'uploads',
            label: 'Uploads',
            icon: 'cloud-upload-outline',
            activeIcon: 'cloud-upload',
            badge: uploadsBadgeCount,
            onPress: () => handleTabPress('uploads'),
        },
        {
            id: 'notes',
            label: 'Notes',
            icon: 'document-text-outline',
            activeIcon: 'document-text',
            onPress: () => handleTabPress('notes'),
        },
        {
            id: 'profile',
            label: 'Profile',
            icon: 'person-outline',
            activeIcon: 'person',
            onPress: () => handleTabPress('profile'),
        },
    ];

    return (
        <SafeAreaProvider>
            <StatusBar
                barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
                backgroundColor="transparent"
                translucent={true}
            />
            <View style={styles.container}>
                <View style={styles.content}>
                    {renderActiveScreen()}
                </View>
                <BottomTabs
                    activeTab={activeTab}
                    tabs={tabs}
                    activeColor="#26D9CA"
                    inactiveColor="#9CA3AF"
                    backgroundColor="#FFFFFF"
                    showLabels={true}
                />
            </View>
        </SafeAreaProvider>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    content: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
});