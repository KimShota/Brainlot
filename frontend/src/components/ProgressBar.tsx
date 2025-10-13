import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface ProgressBarProps {
  currentQuestion: number;
  totalQuestions: number;
  correctAnswers: number;
  colors: {
    background: string;
    foreground: string;
    primary: string;
    accent: string;
    card: string;
    border: string;
  };
}

export default function ProgressBar({ 
  currentQuestion, 
  totalQuestions, 
  correctAnswers, 
  colors 
}: ProgressBarProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fireScaleAnim = useRef(new Animated.Value(1)).current;
  const fireRotateAnim = useRef(new Animated.Value(0)).current;

  const progress = totalQuestions > 0 ? currentQuestion / totalQuestions : 0;

  useEffect(() => {
    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();

    // Animate fire icon when correct answer increases
    if (correctAnswers > 0) {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(fireScaleAnim, {
            toValue: 1.2,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(fireRotateAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(fireScaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        fireRotateAnim.setValue(0);
      });
    }
  }, [progress, correctAnswers]);

  const fireRotation = fireRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '15deg'],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Fire Icon */}
      <Animated.View
        style={[
          styles.fireContainer,
          {
            transform: [
              { scale: fireScaleAnim },
              { rotate: fireRotation },
            ],
          },
        ]}
      >
        <Ionicons name="flame" size={24} color="#FF6B35" />
        <View style={[styles.correctCount, { backgroundColor: colors.primary }]}>
          <Text style={[styles.correctCountText, { color: 'white' }]}>
            {correctAnswers}
          </Text>
        </View>
      </Animated.View>

      {/* Progress Bar */}
      <View style={[styles.progressBarContainer, { backgroundColor: colors.background }]}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        >
          <LinearGradient
            colors={[colors.primary, colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.progressGradient}
          />
        </Animated.View>
      </View>

      {/* Question Counter */}
      <View style={styles.counterContainer}>
        <Text style={[styles.counterText, { color: colors.foreground }]}>
          {currentQuestion}/{totalQuestions}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  fireContainer: {
    position: 'relative',
    marginRight: 12,
  },
  correctCount: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  correctCountText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressBarContainer: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressGradient: {
    flex: 1,
    borderRadius: 4,
  },
  counterContainer: {
    minWidth: 40,
    alignItems: 'center',
  },
  counterText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
