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
import { CourseSearchScreen } from '../screens/course/CourseSearchScreen';
import { UploadsOverviewScreen } from '../screens/uploads/UploadsOverviewScreen';
import { GradesOverviewScreen } from '../screens/grades/GradesOverviewScreen';

// Import navigation components
import { BottomTabs, TabItem } from '../components/BottomTabs';
import { useAuth } from '../context/AuthContext';

type NavigationProp = NativeStackNavigationProp<any>;

export type TabScreens = 'home' | 'courses' | 'uploads' | 'grades' | 'profile';

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
        } else if (tabId === 'grades') {
            setGradesBadgeCount(0);
        }
    };

    // Handle tab navigation by updating navigation directly
    React.useEffect(() => {
        if (activeTab === 'uploads') {
            // Navigate to uploads screen
            navigation.navigate('UploadsOverview' as never);
            return;
        }
        if (activeTab === 'grades') {
            // Navigate to grades screen if it exists, otherwise handle appropriately
            try {
                navigation.navigate('GradesOverview' as never);
            } catch (error) {
                console.log('Grades screen not found, showing home instead');
                setActiveTab('home');
            }
            return;
        }
    }, [activeTab, navigation]);

    const renderActiveScreen = () => {
        switch (activeTab) {
            case 'home':
                return <CourseHomepageScreen navigation={navigation} />;
            case 'courses':
                return <CourseSearchScreen navigation={navigation} />;
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
            id: 'grades',
            label: 'Grades',
            icon: 'school-outline',
            activeIcon: 'school',
            badge: gradesBadgeCount,
            onPress: () => handleTabPress('grades'),
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
                    activeColor="#007AFF"
                    inactiveColor="#8E8E93"
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
        backgroundColor: '#f8f9fa',
    },
    content: {
        flex: 1,
    },
});