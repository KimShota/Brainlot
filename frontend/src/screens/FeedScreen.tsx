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
import MCQCard from "../components/MCQCard";

//Colors 
const colors = {
    background: '#f8fdf9', // Light green-tinted background
    foreground: '#1a1f2e', // Deep navy for text
    primary: '#58cc02', // Duolingo green
    secondary: '#ff9600', // Warm orange accent
    accent: '#1cb0f6', // Bright blue accent
    muted: '#f0f9f1', // Very light green
    mutedForeground: '#6b7280',
    card: '#ffffff',
    border: '#e8f5e8',
    destructive: '#dc2626', // Friendly red
};

const PAGE = 8; // each request will return 8 quizzes 

//main function
export default function FeedScreen({ navigation, route }: any) {
    const insets = useSafeAreaInsets(); //returns an object with the safe area insets not to overlap with the status bar 
    const win = Dimensions.get("window"); //get dimensions of the device window  

    // Use full screen height for true full-screen experience like Instagram Reels
    const ITEM_HEIGHT = useMemo(
        () => win.height, 
        [win.height]
    ); 

    // Get MCQs from route params (passed from UploadScreen)
    const routeMcqs = route?.params?.mcqs || [];
    
    const [items, setItems] = useState<any[]>(routeMcqs); 
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSwipeHint, setShowSwipeHint] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [correctAnswers, setCorrectAnswers] = useState(0);
    const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());
    const [userAnswers, setUserAnswers] = useState<Map<string, number>>(new Map());
    
    // Update items when route params change
    useEffect(() => {
        if (route?.params?.mcqs) {
            log(`📚 Loaded ${route.params.mcqs.length} MCQs from upload`);
            setItems(route.params.mcqs);
            setCurrentQuestion(0);
            setCorrectAnswers(0);
            setAnsweredQuestions(new Set());
            setUserAnswers(new Map());
        }
    }, [route?.params?.mcqs]); 

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
                        
                        if (isCorrect) {
                            setCorrectAnswers(prev => prev + 1);
                        }
                    }}
                />
            );
        }, 
        [ITEM_HEIGHT, navigation, insets, colors, showSwipeHint, currentQuestion, items.length, correctAnswers, answeredQuestions, userAnswers]
    );

    // Empty state component
    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
                <Ionicons name="school-outline" size={80} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No Quizzes Yet!</Text>
            <Text style={styles.emptySubtitle}>
                Upload your study materials to generate MCQs and start learning
            </Text>
            <TouchableOpacity 
                style={styles.emptyButton}
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
    const renderErrorState = () => (
        <View style={styles.errorState}>
            <View style={styles.errorIconContainer}>
                <Ionicons name="alert-circle" size={80} color={colors.destructive} />
            </View>
            <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
            <Text style={styles.errorSubtitle}>{error}</Text>
            <TouchableOpacity 
                style={styles.retryButton}
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
        </View>
    ); 
}

const styles = StyleSheet.create({
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        backgroundColor: colors.background,
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: `${colors.primary}10`,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: colors.foreground,
        marginBottom: 12,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 16,
        color: colors.mutedForeground,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    emptyButton: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: colors.primary,
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
        backgroundColor: colors.background,
    },
    errorIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: `${colors.destructive}10`,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    errorTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: colors.foreground,
        marginBottom: 12,
        textAlign: 'center',
    },
    errorSubtitle: {
        fontSize: 16,
        color: colors.mutedForeground,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    retryButton: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: colors.accent,
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
        color: colors.accent,
        fontWeight: '600',
        marginTop: 6,
    },    
});