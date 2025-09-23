/**
 * Comprehensive Bottom Tab Navigation Component
 * Full-featured bottom navigation with animations, badges, and proper state management
 */

import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Animated,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export type TabIconName = keyof typeof Ionicons.glyphMap;

export interface TabItem {
    id: string;
    label: string;
    icon: TabIconName;
    activeIcon?: TabIconName;
    badge?: number;
    onPress: () => void;
}

interface BottomTabsProps {
    activeTab: string;
    tabs: TabItem[];
    backgroundColor?: string;
    activeColor?: string;
    inactiveColor?: string;
    showLabels?: boolean;
    height?: number;
}

export const BottomTabs: React.FC<BottomTabsProps> = ({
    activeTab,
    tabs,
    backgroundColor = '#ffffff',
    activeColor = '#007AFF',
    inactiveColor = '#6b7280',
    showLabels = true,
    height: customHeight
}) => {
    const animatedValue = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        const activeIndex = tabs.findIndex(tab => tab.id === activeTab);
        Animated.spring(animatedValue, {
            toValue: activeIndex,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
        }).start();
    }, [activeTab, tabs]);

    const renderTabItem = (tab: TabItem, index: number) => {
        const isActive = activeTab === tab.id;
        const iconName = isActive && tab.activeIcon ? tab.activeIcon : tab.icon;

        return (
            <TouchableOpacity
                key={tab.id}
                style={[
                    styles.tabItem,
                    { width: width / tabs.length }
                ]}
                onPress={tab.onPress}
                activeOpacity={0.7}
            >
                <Animated.View style={[
                    styles.tabContent,
                    isActive && [styles.activeTabContent, { backgroundColor: `${activeColor}15` }]
                ]}>
                    <View style={styles.iconContainer}>
                        <Ionicons
                            name={iconName}
                            size={isActive ? 26 : 24}
                            color={isActive ? activeColor : inactiveColor}
                        />
                        {(tab.badge ?? 0) > 0 && (
                            <View style={[styles.badge, { backgroundColor: '#ff3b30' }]}>
                                <Text style={styles.badgeText}>
                                    {tab.badge > 99 ? '99+' : tab.badge.toString()}
                                </Text>
                            </View>
                        )}
                    </View>
                    {showLabels && (
                        <Text style={[
                            styles.tabLabel,
                            {
                                color: isActive ? activeColor : inactiveColor,
                                fontWeight: isActive ? '600' : '500',
                                fontSize: isActive ? 12 : 11,
                            }
                        ]}>
                            {tab.label}
                        </Text>
                    )}
                </Animated.View>
            </TouchableOpacity>
        );
    };

    const indicatorTranslateX = animatedValue.interpolate({
        inputRange: tabs.map((_, index) => index),
        outputRange: tabs.map((_, index) => (width / tabs.length) * index + (width / tabs.length - 40) / 2),
    });
    return (
        <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor }]}>
            <View style={[
                styles.tabBar,
                { height: customHeight || (showLabels ? 70 : 50) }
            ]}>
                {/* Active Tab Indicator */}
                <Animated.View
                    style={[
                        styles.activeIndicator,
                        {
                            transform: [{ translateX: indicatorTranslateX }],
                            backgroundColor: activeColor,
                        }
                    ]}
                />

                {/* Tab Items */}
                {tabs.map(renderTabItem)}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 16,
        paddingTop: Platform.OS === 'ios' ? 8 : 12,
    },
    tabBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        position: 'relative',
    },
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        zIndex: 2,
    },
    tabContent: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        minHeight: 44,
    },
    activeTabContent: {
        transform: [{ scale: 1.05 }],
    },
    iconContainer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: -8,
        backgroundColor: '#ff3b30',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#ffffff',
    },
    badgeText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '700',
        textAlign: 'center',
    },
    tabLabel: {
        textAlign: 'center',
        marginTop: 2,
        letterSpacing: 0.1,
    },
    activeIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: 3,
        width: 40,
        borderRadius: 2,
        zIndex: 1,
    },
});