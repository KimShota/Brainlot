import { useEffect, useState, useMemo, useCallback, useRef } from "react"; 
import { 
    View, 
    Text,
    FlatList,
    ActivityIndicator,
    Dimensions, 
    Platform,
    StatusBar,
    TouchableOpacity,
    StyleSheet,
} from "react-native"; 
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from "../lib/supabase";
import { log, error as logError } from "../lib/logger"; 
import { getUserFriendlyError } from "../lib/errorUtils";
import MCQCard from "../components/MCQCard";
import { useTheme } from "../contexts/ThemeContext";
import { useLocalLLM } from "../contexts/LocalLLMContext";

const PAGE = 8; // each request will return 8 quizzes 

//main function
export default function FeedScreen({ navigation, route }: any) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets(); //returns an object with the safe area insets not to overlap with the status bar 
    const win = Dimensions.get("window"); //get dimensions of the device window  

    // Use full screen height for true full-screen experience like Instagram Reels
    const ITEM_HEIGHT = useMemo(
        () => win.height, 
        [win.height]
    ); 

    // Get MCQs from route params (passed from UploadScreen)
    const routeMcqs = route?.params?.mcqs || [];
    const generationStrategy = route?.params?.generationStrategy;
    const studyMaterial = route?.params?.studyMaterial || '';
    const isLocalInfinite = generationStrategy === 'local' && Boolean(studyMaterial);
    const { generateBatch } = useLocalLLM();
    
    const [items, setItems] = useState<any[]>(routeMcqs); 
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSwipeHint, setShowSwipeHint] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [correctAnswers, setCorrectAnswers] = useState(0);
    const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());
    const [userAnswers, setUserAnswers] = useState<Map<string, number>>(new Map());
    const [nextBatch, setNextBatch] = useState<any[]>([]);
    const [isPrefetching, setIsPrefetching] = useState(false);
    const [prefetchError, setPrefetchError] = useState<string | null>(null);
    const [waitingForNextBatch, setWaitingForNextBatch] = useState(false);
    
    // Update items when route params change
    useEffect(() => {
        if (route?.params?.mcqs) {
            log(`📚 Loaded ${route.params.mcqs.length} MCQs from upload`);
            setItems(route.params.mcqs);
            setCurrentQuestion(0);
            setCorrectAnswers(0);
            setAnsweredQuestions(new Set());
            setUserAnswers(new Map());
            setNextBatch([]);
            setWaitingForNextBatch(false);
        }
    }, [route?.params?.mcqs]); 

    const resetQuizState = useCallback((newItems: any[]) => {
        setItems(newItems);
        setCurrentQuestion(0);
        setCorrectAnswers(0);
        setAnsweredQuestions(new Set());
        setUserAnswers(new Map());
        setShowSwipeHint(false);
    }, []);

    const prefetchNextBatch = useCallback(async () => {
        if (!isLocalInfinite || !studyMaterial || isPrefetching) {
            return;
        }
        setIsPrefetching(true);
        setPrefetchError(null);
        try {
            const batch = await generateBatch(studyMaterial);
            setNextBatch(batch);
        } catch (err: any) {
            setPrefetchError(err?.message || "Failed to generate more MCQs.");
        } finally {
            setIsPrefetching(false);
        }
    }, [generateBatch, isLocalInfinite, studyMaterial, isPrefetching]);

    const handleBatchCompletion = useCallback(() => {
        if (!isLocalInfinite) return false;
        if (nextBatch.length) {
            resetQuizState(nextBatch);
            setNextBatch([]);
            setWaitingForNextBatch(false);
            prefetchNextBatch();
        } else {
            setWaitingForNextBatch(true);
            if (!isPrefetching) {
                prefetchNextBatch();
            }
        }
        return true;
    }, [isLocalInfinite, nextBatch, resetQuizState, prefetchNextBatch, isPrefetching]);

    useEffect(() => {
        if (isLocalInfinite) {
            prefetchNextBatch();
        }
    }, [isLocalInfinite, prefetchNextBatch]);

    useEffect(() => {
        if (!isLocalInfinite) return;
        if (waitingForNextBatch && nextBatch.length) {
            resetQuizState(nextBatch);
            setNextBatch([]);
            setWaitingForNextBatch(false);
            prefetchNextBatch();
        }
    }, [waitingForNextBatch, nextBatch, isLocalInfinite, resetQuizState, prefetchNextBatch]);

    const renderItem = useCallback(
        ({ item, index }: { item: any; index: number }) => {
            // Generate a unique ID for each MCQ based on its content
            const itemId = `mcq-${index}-${item.question?.substring(0, 20)}`;
            
            return (
                <MCQCard 
                    item={{ ...item, id: itemId }} // Add unique ID
                    cardHeight={ITEM_HEIGHT}
                    navigation={navigation}
                    safeAreaInsets={insets}
                    colors={colors}
                    showSwipeHint={index === 0 && showSwipeHint}
                    currentQuestion={currentQuestion}
                    totalQuestions={items.length}
                    correctAnswers={correctAnswers}
                    isAnswered={answeredQuestions.has(itemId)}
                    userAnswer={userAnswers.get(itemId)}
                    onAnswered={(isCorrect: boolean, selectedAnswer: number) => {
                        if (answeredQuestions.has(itemId)) {
                            return;
                        }
                        
                        setAnsweredQuestions(prev => new Set(prev).add(itemId));
                        setUserAnswers(prev => new Map(prev).set(itemId, selectedAnswer));
                        
                        if (index === 0) {
                            setShowSwipeHint(true);
                        }
                        setCurrentQuestion(prev => prev + 1);
                        const answeredCount = answeredQuestions.size + 1;
                        const isLastQuestion = answeredCount === items.length;

                        if (isCorrect) {
                            setCorrectAnswers(prev => prev + 1);
                        }
                        
                        if (isLocalInfinite && isLastQuestion) {
                            const handled = handleBatchCompletion();
                            if (!handled) {
                                logError('Local batch completion failed to trigger');
                            }
                            return;
                        }

                        // Navigate to score summary when all questions are answered (remote generation)
                        if (!isLocalInfinite && isLastQuestion) {
                            setTimeout(() => {
                                navigation.navigate('ScoreSummary', {
                                    totalQuestions: items.length,
                                    correctAnswers: isCorrect ? correctAnswers + 1 : correctAnswers,
                                    userAnswers: new Map(userAnswers).set(itemId, selectedAnswer),
                                    items: items,
                                });
                            }, 1500);
                        }
                    }}
                />
            );
        }, 
        [ITEM_HEIGHT, navigation, insets, colors, showSwipeHint, currentQuestion, items.length, correctAnswers, answeredQuestions, userAnswers, isLocalInfinite, handleBatchCompletion]
    );

    // Empty state component
    const renderEmptyState = () => (
        <View style={[styles.emptyState, { backgroundColor: colors.background }]}>
            <View style={[styles.emptyIconContainer, { backgroundColor: `${colors.primary}10` }]}>
                <Ionicons name="school-outline" size={80} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Quizzes Yet!</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Upload your study materials to generate MCQs and start learning
            </Text>
            <TouchableOpacity 
                style={[styles.emptyButton, { shadowColor: colors.primary }]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    navigation.navigate('Upload');
                }}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={[colors.primary, colors.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.emptyButtonGradient}
                >
                    <Ionicons name="add-circle" size={24} color="white" />
                    <Text style={styles.emptyButtonText}>Upload Material</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    // Error state component
    const renderErrorState = () => {
        const friendlyError = getUserFriendlyError(error);
        return (
            <View style={[styles.errorState, { backgroundColor: colors.background }]}>
                <View style={[styles.errorIconContainer, { backgroundColor: `${colors.destructive}10` }]}>
                    <Ionicons name="alert-circle" size={80} color={colors.destructive} />
                </View>
                <Text style={[styles.errorTitle, { color: colors.foreground }]}>Oops! Something went wrong</Text>
                <Text style={[styles.errorSubtitle, { color: colors.mutedForeground }]}>{friendlyError}</Text>
            <TouchableOpacity 
                style={[styles.retryButton, { shadowColor: colors.accent }]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setError(null);
                    navigation.navigate('Upload');
                }}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={[colors.accent, colors.primary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.retryButtonGradient}
                >
                    <Ionicons name="refresh" size={24} color="white" />
                    <Text style={styles.retryButtonText}>Upload New Material</Text>
                </LinearGradient>
            </TouchableOpacity>
            </View>
        );
    }; 

    // manually calculate the item layout for perfect snapping
    const getItemLayout = useCallback(
        (_: any, index: number) => ({
            length: ITEM_HEIGHT, 
            offset: ITEM_HEIGHT * index, 
            index, 
        }), 
        [ITEM_HEIGHT]
    ); 

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar 
                barStyle="dark-content" 
                backgroundColor={colors.background}
                translucent={false}
            />
            {error ? renderErrorState() : (
            <FlatList
                data={items}
                keyExtractor={(item, index) => `mcq-${index}-${item.question?.substring(0, 20)}`}
                renderItem={renderItem}
                ListEmptyComponent={!loading ? renderEmptyState : null}
                getItemLayout={getItemLayout}
                pagingEnabled={true}
                snapToInterval={ITEM_HEIGHT}
                snapToAlignment="start"
                decelerationRate={Platform.OS === "ios" ? 0.99 : 0.98}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                removeClippedSubviews={true}
                windowSize={3}
                initialNumToRender={1}
                maxToRenderPerBatch={2}
                contentContainerStyle={{
                    flexGrow: 1,
                }}
                style={{ flex: 1 }}
                bounces={false}
                overScrollMode="never"
                disableIntervalMomentum={true}
                disableScrollViewPanResponder={false}
                scrollEnabled={true}
                onScroll={(e) => {
                    const offsetY = e.nativeEvent.contentOffset.y; 
                    if (offsetY > ITEM_HEIGHT * 0.5 && showSwipeHint){ 
                        setShowSwipeHint(false); 
                    }
                }}
            />
            )}
            {loading && !error && (
                <View style={{
                    position: "absolute",
                    top: insets.top + 60, // Position below status bar
                    right: 20,
                    backgroundColor: colors.card,
                    borderRadius: 20,
                    padding: 12,
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 4,
                    zIndex: 1000, // Ensure loading indicator is on top
                }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
            )}
            {isLocalInfinite && (waitingForNextBatch || isPrefetching || prefetchError) && (
                <View style={[
                    styles.generatingOverlay,
                    { backgroundColor: colors.card, bottom: insets.bottom + 24, shadowColor: colors.primary }
                ]}>
                    {prefetchError ? (
                        <>
                            <Ionicons name="warning" size={18} color={colors.destructive} />
                            <Text style={[styles.generatingText, { color: colors.foreground }]}>{prefetchError}</Text>
                            <TouchableOpacity
                                style={[styles.retryMiniButton, { borderColor: colors.primary }]}
                                onPress={prefetchNextBatch}
                            >
                                <Text style={[styles.retryMiniText, { color: colors.primary }]}>Retry</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={[styles.generatingText, { color: colors.foreground }]}>
                                Generating more MCQs...
                            </Text>
                        </>
                    )}
                </View>
            )}
        </View>
    ); 
}

const styles = StyleSheet.create({
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 28,
        fontWeight: '900',
        marginBottom: 12,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    emptyButton: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    emptyButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 32,
        gap: 8,
    },
    emptyButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
    },
    errorState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    errorIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    errorTitle: {
        fontSize: 24,
        fontWeight: '900',
        marginBottom: 12,
        textAlign: 'center',
    },
    errorSubtitle: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    retryButton: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    retryButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 32,
        gap: 8,
    },
    retryButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
    },
    generatingOverlay: {
        position: 'absolute',
        left: 20,
        right: 20,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
        elevation: 6,
    },
    generatingText: {
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },
    retryMiniButton: {
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    retryMiniText: {
        fontSize: 12,
        fontWeight: '700',
    },

    swipeHintContainer: {
        position: 'absolute',
        bottom: 60,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 1000,
        backgroundColor: 'transparent',
    },
    swipeHintText: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 6,
    },    
});