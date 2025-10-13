import { useState } from "react"; 
import { View, Text, Pressable, StyleSheet } from "react-native"; 
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

type Props = {
    item: {
        id: string; 
        question: string; 
        options: string[];  
        answer_index: number; 
    }; 
    cardHeight: number;
    navigation?: any;
    safeAreaInsets?: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
    colors?: {
        background: string;
        foreground: string;
        primary: string;
        secondary: string;
        accent: string;
        muted: string;
        mutedForeground: string;
        card: string;
        border: string;
        destructive: string;
    };
}; 

export default function MCQCard({ item, cardHeight, navigation, safeAreaInsets, colors }: Props) {
    const [selected, setSelected] = useState<number | null>(null);
    const isAnswered = selected !== null; // check if user already chose answer

    // Handle option selection with haptic feedback
    const handleOptionPress = (optionIndex: number) => {
        if (isAnswered) return;

        const isCorrect = optionIndex === item.answer_index;
        
        // Provide haptic feedback based on correctness
        if (isCorrect) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        setSelected(optionIndex);
    }; 

    // Default colors if not provided
    const defaultColors = {
        background: '#f8fdf9',
        foreground: '#1a1f2e',
        primary: '#58cc02',
        secondary: '#ff9600',
        accent: '#1cb0f6',
        muted: '#f0f9f1',
        mutedForeground: '#6b7280',
        card: '#ffffff',
        border: '#e8f5e8',
        destructive: '#dc2626',
    };

    const theme = colors || defaultColors;
    const insets = safeAreaInsets || { top: 0, bottom: 0, left: 0, right: 0 };

    const getOptionStyle = (optionIndex: number) => {
        const correct = optionIndex === item.answer_index; //correct option 
        const picked = optionIndex === selected; //chosen option 

        //default color if not chosen yet
        if (!isAnswered) {
            return {
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: 2,
            };
        }

        //make the button green when it is correct
        if (correct) {
            return {
                backgroundColor: theme.primary,
                borderColor: theme.primary,
                borderWidth: 2,
                transform: [{ scale: 1.02 }],
            };
        }

        //make the button red 
        if (picked && !correct) {
            return {
                backgroundColor: theme.destructive,
                borderColor: theme.destructive,
                borderWidth: 2,
            };
        }

        return {
            backgroundColor: theme.muted,
            borderColor: theme.border,
            borderWidth: 2,
            opacity: 0.6,
        };
    };

    const getOptionTextStyle = (optionIndex: number) => {
        const correct = optionIndex === item.answer_index;
        const picked = optionIndex === selected;

        if (!isAnswered) {
            return { color: theme.foreground };
        }

        if (correct || (picked && !correct)) {
            return { color: '#ffffff' };
        }

        return { color: theme.mutedForeground };
    };

    return (
        <View style={[
            styles.container, 
            { 
                height: cardHeight, 
                backgroundColor: theme.background,
                paddingTop: insets.top,
                paddingBottom: insets.bottom,
            }
        ]}>

            {/* Header */}
            <View style={styles.header}>
                <Pressable 
                    style={[styles.backButton, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        navigation?.goBack();
                    }}
                >
                    <Ionicons name="chevron-back" size={24} color={theme.foreground} />
                </Pressable>
                <View style={styles.spacer} />
            </View>

            {/* Main Content - This takes the remaining space */}
            <View style={styles.mainContent}>
                {/* Question - Fixed position */}
                <View style={styles.questionContainer}>
                    <Text style={[styles.questionText, { color: theme.foreground }]}>
                        {item.question}
                    </Text>
                </View>

                {/* Options - Dynamic spacing with ScrollView for overflow */}
                <View style={styles.optionsWrapper}>
                    <View style={styles.optionsContainer}>
                        {item.options.map((opt, idx) => {
                            const optionStyle = getOptionStyle(idx);
                            const textStyle = getOptionTextStyle(idx);

                            return (
                                <Pressable
                                    key={idx}
                                    onPress={() => handleOptionPress(idx)}
                                    style={[styles.optionButton, optionStyle]}
                                    disabled={isAnswered}
                                >
                                    <Text style={[styles.optionText, textStyle]}>
                                        {opt}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            </View>
        </View>
    ); 
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
        // No justifyContent here - let children define their own spacing
    },
    statusBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
    },
    statusLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    time: {
        fontSize: 18,
        fontWeight: '900',
    },
    moon: {
        fontSize: 12,
    },
    statusRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    signalBars: {
        flexDirection: 'row',
        gap: 1,
        marginRight: 8,
    },
    signalBar: {
        width: 3,
        height: 12,
        borderRadius: 2,
    },
    statusIcon: {
        marginLeft: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
    },
    backButton: {
        padding: 12,
        borderRadius: 50,
        borderWidth: 2,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
    },
    spacer: {
        width: 48,
    },
    progressContainer: {
        width: '100%',
        height: 12,
        borderRadius: 6,
        marginVertical: 16,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        width: '60%',
        borderRadius: 10,
    },
    mainContent: {
        flex: 1,
        justifyContent: 'flex-start', // Start from top
        paddingVertical: 20,
    },
    questionContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 100, // Minimum height instead of fixed
        paddingHorizontal: 16,
        marginBottom: 40, // Increased spacing between question and options
    },
    questionText: {
        fontSize: 18,
        fontWeight: '900',
        textAlign: 'center',
        paddingHorizontal: 8,
        flexShrink: 1, // Allow text to shrink if needed
    },
    explanationContainer: {
        borderRadius: 16,
        borderWidth: 2,
        padding: 20,
        marginTop: 24,
        width: '100%',
    },
    explanationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    explanationTitle: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    explanationText: {
        fontSize: 14,
        lineHeight: 20,
    },
    optionsWrapper: {
        flex: 1,
        justifyContent: 'flex-start', // Start from top instead of center
        paddingBottom: 30, // Increased bottom padding
        paddingTop: 10, // Add top padding for breathing room
    },
    optionsContainer: {
        gap: 30, // Consistent gap between each option 
        paddingHorizontal: 8,
    },
    optionButton: {
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderRadius: 16,
        alignItems: 'flex-start',
        justifyContent: 'center',
        minHeight: 56, // Minimum height for consistent sizing 
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2, 
    },
    optionText: {
        fontSize: 14,
        fontWeight: '800',
        lineHeight: 20,
        textAlign: 'left',
        flexWrap: 'wrap', // Ensure text wraps
        width: '100%', // Take full width for proper wrapping
    },
    bottomIndicator: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    indicatorGradient: {
        width: 128,
        height: 4,
        borderRadius: 2,
    },
});