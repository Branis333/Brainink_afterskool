/**
 * Modern Bottom Tab Navigation Component
 * Clean, minimal design matching the screenshots
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
}

export const BottomTabs: React.FC<BottomTabsProps> = ({
    activeTab,
    tabs,
    backgroundColor = '#FFFFFF',
    activeColor = '#26D9CA',
    inactiveColor = '#D1D5DB',
    showLabels = true,
}) => {
    // Find active tab index for dynamic spacing
    const activeIndex = tabs.findIndex(tab => tab.id === activeTab);

    const renderTabItem = (tab: TabItem, index: number) => {
        const isActive = activeTab === tab.id;
        const iconName = isActive && tab.activeIcon ? tab.activeIcon : tab.icon;
        // sizes increased by ~20%
        const activeIconSize = 26; // ~22 * 1.2
        const inactiveIconSize = 24; // ~20 * 1.2
        const iconSize = isActive ? activeIconSize : inactiveIconSize;
        // compute a responsive min width for the active pill based on label length and screen width
        const maxActiveWidth = Math.min(width * 0.44, 200);
        const estimatedLabelWidth = Math.min(Math.max(tab.label.length * 12 + 32, 80), maxActiveWidth);

        // Calculate dynamic margin based on position relative to active tab
        let marginLeft = 0;
        let marginRight = 0;

        if (index < activeIndex) {
            // Icons to the left of active: shift left by 10%
            marginRight = width * 0.02;
        } else if (index > activeIndex) {
            // Icons to the right of active: shift right by 10%
            marginLeft = width * 0.02;
        }

        return (
            <TouchableOpacity
                key={tab.id}
                style={[
                    styles.tabItem,
                    isActive ? styles.tabItemActive : styles.tabItemInactive,
                    { marginLeft, marginRight }
                ]}
                onPress={tab.onPress}
                activeOpacity={0.8}
            >
                {isActive ? (
                    // Active: show pill with label on the left and larger icon on the right
                    <View style={[
                        styles.activeTabWrapper,
                        { backgroundColor: activeColor, minWidth: estimatedLabelWidth, maxWidth: maxActiveWidth }
                    ]}>
                        {showLabels && (
                            <Text style={styles.activeTabLabel} numberOfLines={1} ellipsizeMode="tail">
                                {tab.label}
                            </Text>
                        )}
                        <Ionicons
                            name={iconName}
                            size={iconSize}
                            color="#000000"
                        />
                    </View>
                ) : (
                    // Inactive: icon-only for compactness
                    <View style={styles.inactiveTabWrapper}>
                        <Ionicons
                            name={iconName}
                            size={iconSize}
                            color={inactiveColor}
                        />
                    </View>
                )}
                {(tab.badge ?? 0) > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                            {tab.badge > 99 ? '99+' : tab.badge.toString()}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        // Use absolute positioning to avoid accidental duplicate stacking from parent layouts
        <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor }]}>
            <View style={styles.tabBar} pointerEvents="box-none">
                {tabs.map(renderTabItem)}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 0,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -1,
        },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 4,
        paddingTop: Platform.OS === 'ios' ? 0 : 4,
        // Make container overlay at bottom to avoid duplicated bars when parent also renders a bar
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
    },
    tabBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        paddingHorizontal: 16,
        paddingVertical: 8,
        height: 64, // reduced from 64 to remove extra white space under icons
    },
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 56,
    },
    tabItemActive: {
        // allow active tab to take more horizontal space
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        flex: 2.5,
    },
    tabItemInactive: {
        paddingHorizontal: 4,
        flex: 1,
    },
    activeTabWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 14,
        gap: 8,
        minWidth: 80,
    },
    inactiveTabWrapper: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        paddingVertical: 6,
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#FF3B30',
        borderRadius: 9,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        zIndex: 10,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '700',
        textAlign: 'center',
    },
    activeTabLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#000000',
        textAlign: 'left',
        paddingRight: 8,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '400',
        textAlign: 'center',
        marginTop: 2,
    },
});