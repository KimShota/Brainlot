import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

const colors = {
  background: '#1a1a28',
  foreground: '#ffffff',
  primary: '#8B5CF6',
  secondary: '#A78BFA',
  accent: '#60A5FA',
  muted: '#252538',
  mutedForeground: '#c0c0d0',
  card: '#252538',
  border: '#4a4a6e',
};

interface OnboardingScreenProps {
  onComplete: () => void;
}

const onboardingPages = [
  {
    id: 1,
    title: "Welcome to Brainlot",
    subtitle: "AI-Powered Learning Platform",
    description: "Transform your study materials into interactive MCQs. Learn efficiently with AI-generated questions.",
    icon: "school",
    gradient: ['#8B5CF6', '#A78BFA'],
  },
  {
    id: 2,
    title: "Upload & Generate",
    subtitle: "PDF or Images",
    description: "Simply upload your PDF documents or images. Our AI will generate 30 high-quality MCQs for you.",
    icon: "cloud-upload",
    gradient: ['#60A5FA', '#8B5CF6'],
  },
  {
    id: 3,
    title: "Swipe to Learn",
    subtitle: "TikTok-Style Learning",
    description: "Answer questions by swiping. Get instant feedback on your answers and learn on the go.",
    icon: "reorder",
    gradient: ['#A78BFA', '#60A5FA'],
  },
  {
    id: 4,
    title: "Pro Features",
    subtitle: "Unlimited Access",
    description: "Upgrade to Pro for unlimited uploads, unlimited MCQ generation, and ad-free experience.",
    icon: "sparkles",
    gradient: ['#60A5FA', '#A78BFA'],
  },
];

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const [currentPage, setCurrentPage] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleNext = () => {
    if (currentPage < onboardingPages.length - 1) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      setCurrentPage(currentPage + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleDotPress = (index: number) => {
    setCurrentPage(index);
  };

  const currentSlide = onboardingPages[currentPage];

  return (
    <View style={styles.container}>
      {/* Skip Button */}
      <TouchableOpacity
        style={[styles.skipButton, { top: insets.top + 10 }]}
        onPress={handleSkip}
        activeOpacity={0.7}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={currentSlide.gradient}
          style={styles.iconContainer}
        >
          <Ionicons name={currentSlide.icon as any} size={80} color="white" />
        </LinearGradient>

        <Text style={styles.title}>{currentSlide.title}</Text>
        <Text style={styles.subtitle}>{currentSlide.subtitle}</Text>
        <Text style={styles.description}>{currentSlide.description}</Text>
      </Animated.View>

      {/* Dots Indicator */}
      <View style={styles.dotsContainer}>
        {onboardingPages.map((_, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.dot,
              index === currentPage && styles.activeDot,
              { backgroundColor: index === currentPage ? currentSlide.gradient[0] : colors.border },
            ]}
            onPress={() => handleDotPress(index)}
            activeOpacity={0.7}
          />
        ))}
      </View>

      {/* Next Button */}
      <TouchableOpacity
        style={styles.nextButton}
        onPress={handleNext}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={currentSlide.gradient}
          style={styles.nextButtonGradient}
        >
          <Text style={styles.nextButtonText}>
            {currentPage === onboardingPages.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <Ionicons
            name={currentPage === onboardingPages.length - 1 ? 'checkmark' : 'arrow-forward'}
            size={24}
            color="white"
          />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skipButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
  },
  skipText: {
    color: colors.mutedForeground,
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 32,
    borderRadius: 4,
  },
  nextButton: {
    marginHorizontal: 32,
    marginBottom: 40,
    borderRadius: 16,
    overflow: 'hidden',
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

