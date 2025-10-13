import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const colors = {
    background: '#f8fdf9',
    primary: '#58cc02',
    accent: '#1cb0f6',
    foreground: '#1a1f2e',
};

interface SplashScreenProps {
    onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.3)).current;
    const logoRotateAnim = useRef(new Animated.Value(0)).current;
    const textFadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Start animation sequence
        Animated.sequence([
            // 1. Logo appears and scales up
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 50,
                    friction: 7,
                    useNativeDriver: true,
                }),
            ]),
            // 2. Slight bounce effect
            Animated.spring(scaleAnim, {
                toValue: 1.05,
                tension: 100,
                friction: 3,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 100,
                friction: 5,
                useNativeDriver: true,
            }),
            // 3. Text fades in
            Animated.timing(textFadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();

        // Navigate after 2 seconds
        const timer = setTimeout(() => {
            onFinish();
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    const rotate = logoRotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View style={styles.container}>
            {/* Background gradient */}
            <LinearGradient
                colors={[colors.background, '#e8f5e9']}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Animated logo */}
            <Animated.View
                style={[
                    styles.logoContainer,
                    {
                        opacity: fadeAnim,
                        transform: [
                            { scale: scaleAnim },
                            { rotate },
                        ],
                    },
                ]}
            >
                <LinearGradient
                    colors={[colors.primary, colors.accent]}
                    style={styles.iconGradient}
                >
                    <Ionicons name="school" size={80} color="white" />
                </LinearGradient>
            </Animated.View>

            {/* Animated app name */}
            <Animated.View
                style={[
                    styles.textContainer,
                    {
                        opacity: textFadeAnim,
                        transform: [
                            {
                                translateY: textFadeAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [20, 0],
                                }),
                            },
                        ],
                    },
                ]}
            >
                <Text style={styles.appName}>Edu-Shorts</Text>
                <Text style={styles.tagline}>Learn on the go! 📚</Text>
            </Animated.View>

            {/* Loading indicator dots */}
            <Animated.View
                style={[
                    styles.dotsContainer,
                    {
                        opacity: fadeAnim,
                    },
                ]}
            >
                <View style={styles.dotWrapper}>
                    <Animated.View
                        style={[
                            styles.dot,
                            {
                                transform: [
                                    {
                                        scale: scaleAnim.interpolate({
                                            inputRange: [0.3, 1],
                                            outputRange: [0, 1],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    />
                    <Animated.View
                        style={[
                            styles.dot,
                            {
                                transform: [
                                    {
                                        scale: scaleAnim.interpolate({
                                            inputRange: [0.3, 1],
                                            outputRange: [0, 1],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    />
                    <Animated.View
                        style={[
                            styles.dot,
                            {
                                transform: [
                                    {
                                        scale: scaleAnim.interpolate({
                                            inputRange: [0.3, 1],
                                            outputRange: [0, 1],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    />
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    logoContainer: {
        marginBottom: 40,
    },
    iconGradient: {
        width: 160,
        height: 160,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 10,
    },
    textContainer: {
        alignItems: 'center',
    },
    appName: {
        fontSize: 42,
        fontWeight: 'bold',
        color: colors.foreground,
        marginBottom: 8,
        letterSpacing: 1,
    },
    tagline: {
        fontSize: 18,
        color: colors.primary,
        fontWeight: '600',
    },
    dotsContainer: {
        position: 'absolute',
        bottom: 80,
    },
    dotWrapper: {
        flexDirection: 'row',
        gap: 12,
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.primary,
    },
});

