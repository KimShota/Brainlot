import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MCQCard from '../components/MCQCard';
import { Dimensions } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

interface ScoreSummaryScreenProps {
  navigation: any;
  route: {
    params: {
      totalQuestions: number;
      correctAnswers: number;
      userAnswers: Map<string, number>;
      items: any[];
    };
  };
}

export default function ScoreSummaryScreen({ navigation, route }: ScoreSummaryScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { totalQuestions, correctAnswers, userAnswers, items } = route.params;
  const [viewMode, setViewMode] = useState<'summary' | 'retest'>('summary');
  const [retestUserAnswers, setRetestUserAnswers] = useState<Map<string, number>>(new Map());
  const [retestAnsweredQuestions, setRetestAnsweredQuestions] = useState<Set<string>>(new Set());
  const [retestCorrectAnswers, setRetestCorrectAnswers] = useState(0);
  const [currentRetestIndex, setCurrentRetestIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const score = correctAnswers;
  const percentage = Math.round((correctAnswers / totalQuestions) * 100);
  
  const ITEM_HEIGHT = height;

  // Get incorrect questions for retest
  const getIncorrectQuestions = () => {
    const incorrect: any[] = [];
    items.forEach((item, index) => {
      const itemId = `mcq-${index}-${item.question?.substring(0, 20)}`;
      const userAnswer = userAnswers.get(itemId);
      const correctAnswer = item.answer_index;
      if (userAnswer !== correctAnswer) {
        incorrect.push({ ...item, originalIndex: index });
      }
    });
    return incorrect;
  };

  const incorrectQuestions = getIncorrectQuestions();

  const getPerformanceMessage = () => {
    if (percentage >= 90) return 'Outstanding! 🌟';
    if (percentage >= 80) return 'Great Job! 🎉';
    if (percentage >= 70) return 'Good Work! 👍';
    if (percentage >= 60) return 'Keep Practicing! 💪';
    return 'Keep Learning! 📚';
  };

  const getPerformanceColor = (): [string, string] => {
    if (percentage >= 90) return ['#10b981', '#059669'];
    if (percentage >= 70) return ['#60A5FA', '#3B82F6'];
    if (percentage >= 60) return ['#F59E0B', '#D97706'];
    return ['#EF4444', '#DC2626'];
  };

  if (viewMode === 'retest') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        
        {/* Header */}
        <SafeAreaView style={{ backgroundColor: colors.background }}>
          <View style={[styles.reviewHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => {
                setViewMode('summary');
                setCurrentRetestIndex(0);
                setRetestUserAnswers(new Map());
                setRetestAnsweredQuestions(new Set());
                setRetestCorrectAnswers(0);
              }}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.reviewTitle, { color: colors.foreground }]}>Practice Incorrect Questions</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>

        {/* Retest Questions */}
        <ScrollView 
          style={styles.reviewScrollView}
          showsVerticalScrollIndicator={false}
          pagingEnabled
          horizontal
          scrollEnabled={false}
          ref={scrollViewRef}
        >
          {incorrectQuestions.map((item, index) => {
            const itemId = `retest-${index}-${item.question?.substring(0, 20)}`;
            const userAnswer = retestUserAnswers.get(itemId);
            const correctAnswer = item.answer_index;

            return (
              <View key={itemId} style={[styles.reviewItem, { 
                backgroundColor: colors.card,
                borderColor: colors.border,
                shadowColor: colors.primary,
              }]}>
                <View style={styles.reviewItemHeader}>
                  <Text style={[styles.reviewItemNumber, { color: colors.mutedForeground }]}>Question {index + 1} of {incorrectQuestions.length}</Text>
                </View>
                
                <Text style={[styles.reviewQuestion, { color: colors.foreground }]}>{item.question}</Text>
                
                <View style={styles.reviewOptions}>
                  {item.options.map((opt: string, idx: number) => {
                    const isSelected = userAnswer === idx;
                    const isCorrect = idx === correctAnswer;
                    const showResult = retestAnsweredQuestions.has(itemId);

                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => {
                          if (retestAnsweredQuestions.has(itemId)) return;
                          
                          setRetestAnsweredQuestions(prev => new Set(prev).add(itemId));
                          setRetestUserAnswers(prev => new Map(prev).set(itemId, idx));
                          
                          if (isCorrect) {
                            setRetestCorrectAnswers(prev => prev + 1);
                          }
                          
                          // Auto-scroll to next question after delay
                          if (index < incorrectQuestions.length - 1) {
                            setTimeout(() => {
                              setCurrentRetestIndex(index + 1);
                              scrollViewRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
                            }, 1500);
                          } else {
                            // All questions answered, show summary
                            setTimeout(() => {
                              setViewMode('summary');
                            }, 1500);
                          }
                        }}
                        style={[
                          styles.reviewOption,
                          { backgroundColor: colors.muted },
                          isSelected && !isCorrect && showResult && styles.incorrectAnswer,
                          isCorrect && showResult && styles.correctAnswer,
                        ]}
                      >
                        <Ionicons
                          name={
                            !showResult ? "ellipse-outline" :
                            isCorrect ? "checkmark-circle" : 
                            isSelected && !isCorrect ? "close-circle" : 
                            "ellipse-outline"
                          }
                          size={20}
                          color={
                            !showResult ? colors.mutedForeground :
                            isCorrect ? '#10b981' : 
                            isSelected && !isCorrect ? '#EF4444' : 
                            colors.mutedForeground
                          }
                        />
                        <Text style={[
                          styles.reviewOptionText,
                          { color: colors.foreground },
                          isCorrect && showResult && styles.correctText,
                          isSelected && !isCorrect && showResult && styles.incorrectText,
                        ]}>
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Score Display */}
        <View style={styles.scoreCardWrapper}>
          <LinearGradient
            colors={getPerformanceColor()}
            style={styles.scoreCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Decorative circles */}
            <View style={[styles.decorativeCircle, { top: -30, right: -30, width: 120, height: 120, opacity: 0.3 }]} />
            <View style={[styles.decorativeCircle, { bottom: -40, left: -40, width: 140, height: 140, opacity: 0.2 }]} />
            
            <View style={styles.scoreIcon}>
              <LinearGradient
                colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                style={styles.scoreIconGradient}
              >
                <Ionicons name="trophy" size={50} color="white" />
              </LinearGradient>
            </View>
            <Text style={styles.scoreText}>{score}/{totalQuestions}</Text>
            <Text style={styles.percentageText}>{percentage}%</Text>
            <View style={styles.performanceBadge}>
              <Text style={styles.performanceMessage}>{getPerformanceMessage()}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Stats */}
        <View style={[styles.statsContainer, { 
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: colors.primary,
        }]}>
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={32} color="#10b981" />
            <Text style={[styles.statNumber, { color: colors.foreground }]}>{correctAnswers}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Correct</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Ionicons name="close-circle" size={32} color="#EF4444" />
            <Text style={[styles.statNumber, { color: colors.foreground }]}>{totalQuestions - correctAnswers}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Incorrect</Text>
          </View>
        </View>

        {/* Practice Section - Only show if there are incorrect questions */}
        {incorrectQuestions.length > 0 && (
          <TouchableOpacity
            style={[styles.reviewButton, { shadowColor: colors.primary }]}
            onPress={() => {
              setViewMode('retest');
              setCurrentRetestIndex(0);
              setRetestUserAnswers(new Map());
              setRetestAnsweredQuestions(new Set());
              setRetestCorrectAnswers(0);
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              style={styles.reviewButtonGradient}
            >
              <Ionicons name="refresh-circle" size={24} color="white" />
              <Text style={styles.reviewButtonText}>
                Practice {incorrectQuestions.length} Incorrect Question{incorrectQuestions.length > 1 ? 's' : ''}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.homeButton, { shadowColor: colors.accent }]}
          onPress={() => navigation.navigate('Upload')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[colors.accent, colors.primary]}
            style={styles.homeButtonGradient}
          >
            <Ionicons name="home" size={24} color="white" />
            <Text style={styles.homeButtonText}>Upload New Material</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 80,
  },
  scoreCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  scoreIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  scoreText: {
    fontSize: 42,
    fontWeight: '900',
    color: 'white',
    marginBottom: 6,
  },
  percentageText: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    marginBottom: 6,
  },
  performanceMessage: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  scoreCardWrapper: {
    marginBottom: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 16,
  },
  decorativeCircle: {
    position: 'absolute',
    borderRadius: 100,
    backgroundColor: 'white',
  },
  scoreIconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  performanceBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  statsContainer: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '900',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    marginHorizontal: 24,
  },
  reviewButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  reviewButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  reviewButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  homeButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  homeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  homeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  reviewScrollView: {
    flex: 1,
    width: width,
  },
  reviewItem: {
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: width - 40,
    alignSelf: 'center',
    minHeight: height * 0.6,
  },
  reviewItemHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewItemNumber: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  reviewQuestion: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    lineHeight: 26,
  },
  reviewOptions: {
    gap: 12,
  },
  reviewOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  incorrectAnswer: {
    borderColor: '#EF4444',
    backgroundColor: `${'#EF4444'}20`,
  },
  userAnswer: {
    borderColor: '#EF4444',
    backgroundColor: `${'#EF4444'}20`,
  },
  correctAnswer: {
    borderColor: '#10b981',
    backgroundColor: `${'#10b981'}20`,
  },
  reviewOptionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  correctText: {
    fontWeight: '700',
    color: '#10b981',
  },
  incorrectText: {
    fontWeight: '700',
    color: '#EF4444',
  },
});

