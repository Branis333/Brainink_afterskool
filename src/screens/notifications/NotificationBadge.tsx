/**
 * Notification Badge Component
 * Displays unread notification count as a badge
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface NotificationBadgeProps {
    count: number;
    size?: 'small' | 'medium' | 'large';
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({
    count,
    size = 'medium',
}) => {
    if (count === 0) return null;

    const styles = getStyles(size);
    const displayCount = count > 99 ? '99+' : count;

    return (
        <View style={[styles.badge, getBackgroundColor(count)]}>
            <Text style={styles.badgeText}>{displayCount}</Text>
        </View>
    );
};

const getStyles = (size: 'small' | 'medium' | 'large') => {
    const baseStyles = StyleSheet.create({
        badge: {
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#d32f2f',
        },
        badgeText: {
            color: '#fff',
            fontWeight: 'bold',
        },
    });

    switch (size) {
        case 'small':
            return StyleSheet.create({
                badge: {
                    ...baseStyles.badge,
                    width: 20,
                    height: 20,
                    minWidth: 20,
                },
                badgeText: {
                    ...baseStyles.badgeText,
                    fontSize: 10,
                },
            });
        case 'large':
            return StyleSheet.create({
                badge: {
                    ...baseStyles.badge,
                    width: 32,
                    height: 32,
                    minWidth: 32,
                },
                badgeText: {
                    ...baseStyles.badgeText,
                    fontSize: 16,
                },
            });
        case 'medium':
        default:
            return StyleSheet.create({
                badge: {
                    ...baseStyles.badge,
                    width: 24,
                    height: 24,
                    minWidth: 24,
                },
                badgeText: {
                    ...baseStyles.badgeText,
                    fontSize: 12,
                },
            });
    }
};

const getBackgroundColor = (count: number) => {
    if (count > 10) return { backgroundColor: '#d32f2f' };
    if (count > 5) return { backgroundColor: '#f57c00' };
    return { backgroundColor: '#ff9800' };
};

export default NotificationBadge;
