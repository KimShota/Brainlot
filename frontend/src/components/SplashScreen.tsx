import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onAnimationComplete }) => {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const logoScaleAnim = useRef(new Animated.Value(0)).current;
  const textOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start the animation sequence
    startAnimationSequence();
  }, []);

  const startAnimationSequence = () => {
    // Reset all animations
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.3);
    slideAnim.setValue(50);
    rotateAnim.setValue(0);
    pulseAnim.setValue(1);
    logoScaleAnim.setValue(0);
    textOpacityAnim.setValue(0);

    // Animation sequence
    Animated.sequence([
      // Phase 1: Logo entrance (0.6s)
      Animated.parallel([
        Animated.timing(logoScaleAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      
      // Phase 2: Text entrance (0.5s)
      Animated.timing(textOpacityAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      
      // Phase 3: Scale and slide animation (0.6s)
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      
      // Phase 4: Rotation and pulse effects (1.0s)
      Animated.parallel([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.1,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
          ]),
          { iterations: 2 }
        ),
      ]),
      
      // Phase 5: Hold and fade out (0.8s)
      Animated.delay(800),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onAnimationComplete();
    });
  };

  // Interpolate rotation value
  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Interpolate slide value for text
  const slideInterpolate = slideAnim.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 50],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />
      
      {/* Background Gradient */}
      <LinearGradient
        colors={['#4F46E5', '#7C3AED', '#EC4899']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Animated Background Elements */}
        <Animated.View
          style={[
            styles.backgroundElement1,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { rotate: rotateInterpolate },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.backgroundElement2,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { rotate: rotateInterpolate },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.backgroundElement3,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { rotate: rotateInterpolate },
              ],
            },
          ]}
        />

        {/* Main Content */}
        <View style={styles.content}>
          {/* Logo Section */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: fadeAnim,
                transform: [
                  { scale: logoScaleAnim },
                  { scale: pulseAnim },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['#FFFFFF', '#F8FAFC']}
              style={styles.logoGradient}
            >
              <Ionicons name="school" size={80} color="#4F46E5" />
            </LinearGradient>
          </Animated.View>

          {/* App Title */}
          <Animated.View
            style={[
              styles.titleContainer,
              {
                opacity: textOpacityAnim,
                transform: [{ translateY: slideInterpolate }],
              },
            ]}
          >
            <Text style={styles.appTitle}>Quiz Reels</Text>
            <Text style={styles.appSubtitle}>Learn • Practice • Master</Text>
          </Animated.View>

          {/* Loading Indicator */}
          <Animated.View
            style={[
              styles.loadingContainer,
              {
                opacity: textOpacityAnim,
              },
            ]}
          >
            <View style={styles.loadingDots}>
              <Animated.View
                style={[
                  styles.loadingDot,
                  {
                    opacity: pulseAnim,
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.loadingDot,
                  {
                    opacity: pulseAnim,
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.loadingDot,
                  {
                    opacity: pulseAnim,
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              />
            </View>
          </Animated.View>
        </View>

        {/* Bottom Decorative Elements */}
        <Animated.View
          style={[
            styles.bottomElement1,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { rotate: rotateInterpolate },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.bottomElement2,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { rotate: rotateInterpolate },
              ],
            },
          ]}
        />
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundElement1: {
    position: 'absolute',
    top: height * 0.1,
    left: width * 0.1,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  backgroundElement2: {
    position: 'absolute',
    top: height * 0.2,
    right: width * 0.15,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  backgroundElement3: {
    position: 'absolute',
    top: height * 0.15,
    left: width * 0.3,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  bottomElement1: {
    position: 'absolute',
    bottom: height * 0.15,
    left: width * 0.2,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  bottomElement2: {
    position: 'absolute',
    bottom: height * 0.1,
    right: width * 0.1,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logoContainer: {
    marginBottom: 40,
  },
  logoGradient: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  appTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  appSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    letterSpacing: 1,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginHorizontal: 4,
  },
});

export default SplashScreen;
