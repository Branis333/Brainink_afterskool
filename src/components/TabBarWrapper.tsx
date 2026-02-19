/**
 * Tab Bar Wrapper - Always visible bottom tabs
 * Wraps any screen to show persistent bottom navigation
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabs, TabItem } from './BottomTabs';

interface TabBarWrapperProps {
    children: React.ReactNode;
    activeTab?: string;
    // control whether this wrapper renders its own BottomTabs
    showTabs?: boolean;
}

export const TabBarWrapper: React.FC<TabBarWrapperProps> = ({
    children,
    activeTab = 'home',
    showTabs = true,
}) => {
    const navigation = useNavigation<any>();

    const tabs: TabItem[] = [
        {
            id: 'home',
            label: 'Home',
            icon: 'home-outline',
            activeIcon: 'home',
            onPress: () => navigation.navigate('MainTabs'),
        },
        {
            id: 'courses',
            label: 'Courses',
            icon: 'library-outline',
            activeIcon: 'library',
            // Take users to Browse screen by default so first-time users see all courses
            onPress: () => navigation.navigate('MyCourses'),
        },
        {
            id: 'kana',
            label: 'Kana',
            icon: 'chatbubble-ellipses-outline',
            activeIcon: 'chatbubble-ellipses',
            onPress: () => navigation.navigate('MainTabs', { initialTab: 'kana' }),
        },
        {
            id: 'notes',
            label: 'Notes',
            icon: 'document-text-outline',
            activeIcon: 'document-text',
            onPress: () => navigation.navigate('NotesList'),
        },
        {
            id: 'profile',
            label: 'Profile',
            icon: 'person-outline',
            activeIcon: 'person',
            onPress: () => navigation.navigate('MainTabs', { initialTab: 'profile' }),
        },
    ];

    return (
        <View style={styles.container}>
            <View style={[styles.content, showTabs && styles.contentWithTabs]}>
                {children}
            </View>
            {showTabs && (
                <BottomTabs
                    activeTab={activeTab}
                    tabs={tabs}
                    activeColor="#26D9CA"
                    inactiveColor="#D1D5DB"
                    backgroundColor="#FFFFFF"
                    showLabels={true}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    content: {
        flex: 1,
    },
    contentWithTabs: {
        paddingBottom: 90, // Add space for the bottom tab bar
    },
});
