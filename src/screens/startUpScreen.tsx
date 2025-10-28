import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

type NavigationProp = NativeStackNavigationProp<any>;

interface Props {
    navigation: NavigationProp;
}

const { width, height } = Dimensions.get('window');

export const StartUpScreen: React.FC<Props> = ({ navigation }) => {
    const onJoin = () => {
        // Navigate to Login screen but start on the Sign Up mode
        navigation.navigate('Login', { startInSignUp: true });
    };

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
                {/* Background decorative blobs spread across entire screen */}
                <View style={[styles.blob, styles.blobTopLeft]} />
                <View style={[styles.blob, styles.blobTopRight]} />
                <View style={[styles.blob, styles.blobMiddleLeft]} />
                <View style={[styles.blob, styles.blobMiddleRight]} />
                <View style={[styles.blob, styles.blobBottomLeft]} />
                <View style={[styles.blob, styles.blobBottomRight]} />
                <View style={[styles.blob, styles.blobCenter]} />

                {/* Illustration area with person on laptop */}
                <View style={styles.illustrationWrapper}>
                    {/* Person illustration using icons */}
                    <View style={styles.personContainer}>
                        {/* Head/face */}
                        <View style={styles.face}>
                            <View style={styles.hair} />
                            <View style={styles.faceCircle}>
                                <View style={styles.eyeLeft} />
                                <View style={styles.eyeRight} />
                                <View style={styles.smile} />
                            </View>
                        </View>

                        {/* Body/shirt */}
                        <View style={styles.body}>
                            <View style={styles.neckArea} />
                            <View style={styles.shirt} />
                        </View>

                        {/* Laptop */}
                        <View style={styles.laptop}>
                            <View style={styles.laptopScreen} />
                            <View style={styles.laptopBase} />
                        </View>
                    </View>

                    {/* Table line - positioned below everything */}
                    <View style={styles.table} />
                </View>

                {/* Text content */}
                <Text style={styles.title}>Welcome to BrainInk</Text>
                <Text style={styles.subtitle}>Discover courses and start your after‑school journey</Text>

                {/* Primary action */}
                <TouchableOpacity style={styles.primaryButton} activeOpacity={0.9} onPress={onJoin}>
                    <Text style={styles.primaryButtonText}>Join</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: '#EFE9FF',
    },
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 40,
    },
    illustrationWrapper: {
        width: '100%',
        flex: 1,
        maxHeight: 340,
        borderRadius: 24,
        backgroundColor: '#F8F6FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
        position: 'relative',
        zIndex: 10,
    },
    // Decorative blobs
    blob: {
        position: 'absolute',
        borderRadius: 999,
        opacity: 0.25,
    },
    blobTopLeft: {
        width: 150,
        height: 150,
        backgroundColor: '#b69bfaff',
        top: 20,
        left: -40,
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: '#D4C5FF',
    },
    blobTopRight: {
        width: 180,
        height: 180,
        backgroundColor: '#bba2faff',
        top: -30,
        right: -60,
        opacity: 0.3,
    },
    blobMiddleLeft: {
        width: 120,
        height: 120,
        backgroundColor: '#b192ffff',
        top: '35%',
        left: -50,
        borderStyle: 'dotted',
        borderWidth: 2,
        borderColor: '#C9B8FF',
    },
    blobMiddleRight: {
        width: 100,
        height: 100,
        backgroundColor: '#bfa6ffff',
        top: '40%',
        right: 20,
        opacity: 0.2,
    },
    blobBottomLeft: {
        width: 140,
        height: 140,
        backgroundColor: '#DDD0FF',
        bottom: 100,
        left: 10,
        borderStyle: 'dotted',
        borderWidth: 2,
        borderColor: '#C9B8FF',
    },
    blobBottomRight: {
        width: 160,
        height: 160,
        backgroundColor: '#b79cfcff',
        bottom: -40,
        right: -50,
        opacity: 0.3,
    },
    blobCenter: {
        width: 90,
        height: 90,
        backgroundColor: '#bda3ffff',
        bottom: '25%',
        left: '45%',
        opacity: 0.15,
    },
    // Person illustration
    personContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    face: {
        alignItems: 'center',
        marginBottom: 8,
    },
    hair: {
        width: 50,
        height: 30,
        backgroundColor: '#5A5A5A',
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        marginBottom: -10,
        zIndex: 1,
    },
    faceCircle: {
        width: 60,
        height: 60,
        backgroundColor: '#997e59ff',
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    eyeLeft: {
        position: 'absolute',
        width: 6,
        height: 6,
        backgroundColor: '#2C2C2C',
        borderRadius: 3,
        top: 22,
        left: 18,
    },
    eyeRight: {
        position: 'absolute',
        width: 6,
        height: 6,
        backgroundColor: '#2C2C2C',
        borderRadius: 3,
        top: 22,
        right: 18,
    },
    smile: {
        position: 'absolute',
        width: 20,
        height: 10,
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
        borderWidth: 2,
        borderColor: '#2C2C2C',
        borderTopWidth: 0,
        bottom: 12,
    },
    body: {
        alignItems: 'center',
        marginTop: 0,
    },
    neckArea: {
        width: 16,
        height: 8,
        backgroundColor: '#997e59ff',
        marginBottom: -2,
        zIndex: 1,
    },
    shirt: {
        width: 80,
        height: 50,
        backgroundColor: '#8B77F2',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
    },
    laptop: {
        marginTop: 12,
        marginBottom: 8,
        alignItems: 'center',
        zIndex: 2,
    },
    laptopScreen: {
        width: 50,
        height: 32,
        backgroundColor: '#F0F0F0',
        borderWidth: 2,
        borderColor: '#4A4A4A',
        borderRadius: 3,
        marginBottom: 2,
    },
    laptopBase: {
        width: 64,
        height: 6,
        backgroundColor: '#4A4A4A',
        borderRadius: 2,
    },
    table: {
        position: 'absolute',
        bottom: 60,
        width: 240,
        height: 3,
        backgroundColor: '#3C3C3C',
        borderRadius: 2,
        zIndex: 1,
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: '#1C1C1E',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 36,
        paddingHorizontal: 20,
        lineHeight: 22,
    },
    primaryButton: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#E6E0FF',
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: '#6E59F6',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default StartUpScreen;

