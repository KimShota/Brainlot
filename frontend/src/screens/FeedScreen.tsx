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
import { useSubscription } from "../contexts/SubscriptionContext";
import { getStreamingSource, removeStreamingSource, StreamingSource } from "../services/streamingSourceStore";

const STREAM_TARGET_COUNT = 20;
const function_url = "/functions/v1/generate-mcqs";

const normalizeMcq = (mcq: any) => ({
    question: mcq?.question || mcq?.q || "",
    options: mcq?.options || mcq?.o || [],
    answer_index: typeof mcq?.answer_index === "number"
        ? mcq.answer_index
        : (typeof mcq?.a === "number" ? mcq.a : 0),
});

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

    const { addRecentUpload, fetchSubscriptionData } = useSubscription();

    const routeMcqs = route?.params?.mcqs || [];
    const streamingSourceId = route?.params?.streamingSourceId || null;
    
    const [items, setItems] = useState<any[]>(routeMcqs);
    const [error, setError] = useState<string | null>(null);
    const [showSwipeHint, setShowSwipeHint] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [correctAnswers, setCorrectAnswers] = useState(0);
    const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());
    const [userAnswers, setUserAnswers] = useState<Map<string, number>>(new Map());
    const [isStreaming, setIsStreaming] = useState<boolean>(Boolean(streamingSourceId));
    const [isInitialLoading, setIsInitialLoading] = useState<boolean>(Boolean(streamingSourceId) && routeMcqs.length === 0);
    const [streamingError, setStreamingError] = useState<string | null>(null);
    const [expectedCount, setExpectedCount] = useState<number | null>(null);

    const streamAbortRef = useRef<AbortController | null>(null);
    const streamStartedRef = useRef(false);
    const uploadLoggedRef = useRef(false);
    
    useEffect(() => {
        if (route?.params?.mcqs) {
            log(`📚 Loaded ${route.params.mcqs.length} MCQs from upload (legacy flow)`);
            setItems(route.params.mcqs);
            setCurrentQuestion(0);
            setCorrectAnswers(0);
            setAnsweredQuestions(new Set());
            setUserAnswers(new Map());
            setIsStreaming(false);
            setIsInitialLoading(false);
            setStreamingError(null);
        }
    }, [route?.params?.mcqs]);

    const appendMcq = useCallback((mcq: any) => {
        setItems(prev => [...prev, mcq]);
    }, []);

    const handleStreamLine = useCallback((line: string) => {
        try {
            const payload = JSON.parse(line);
            if (payload.type === "meta" && typeof payload.total === "number") {
                setExpectedCount(payload.total);
                return;
            }
            if (payload.type === "mcq" && payload.data) {
                const normalized = normalizeMcq(payload.data);
                appendMcq(normalized);
                if (!uploadLoggedRef.current) {
                    uploadLoggedRef.current = true;
                    try {
                        addRecentUpload();
                    } catch (recentError) {
                        logError("Error updating recent uploads:", recentError);
                    }
                    fetchSubscriptionData().catch((fetchErr) => logError("Error refreshing subscription data:", fetchErr));
                }
                return;
            }
            if (payload.type === "error") {
                setStreamingError(payload.message || "Failed to generate MCQs. Please try again.");
                streamAbortRef.current?.abort();
                return;
            }
            if (payload.type === "done") {
                setIsStreaming(false);
                setIsInitialLoading(false);
            }
        } catch (err) {
            logError("Failed to parse streaming payload:", { line, err });
        }
    }, [appendMcq, addRecentUpload, fetchSubscriptionData, logError]);

    const startStreaming = useCallback(async (sourceId: string, source: StreamingSource, controller: AbortController) => {
        try {
            setStreamingError(null);
            setIsStreaming(true);
            setIsInitialLoading(items.length === 0);
            
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error("No active session. Please log in again.");
            }

            const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
            if (!baseUrl) {
                throw new Error("Supabase URL is not configured.");
            }

            const body: Record<string, any> = {
                stream: true,
                target_count: STREAM_TARGET_COUNT,
            };

            if (source.type === "text") {
                body.text_content = source.text;
                body.content_type = "text";
            } else if (source.type === "file") {
                body.file_data = source.fileData;
                body.mime_type = source.mimeType;
            } else {
                throw new Error("Invalid streaming source. Please try again.");
            }

            const response = await fetch(`${baseUrl}${function_url}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/x-ndjson",
                    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            // Check for HTTP errors first
            if (!response.ok) {
                let errorText = "";
                try {
                    errorText = await response.text();
                } catch {
                    errorText = `HTTP ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorText || "Failed to generate MCQs.");
            }

            // Check if ReadableStream is supported
            if (!response.body || typeof response.body.getReader !== "function") {
                // Fallback: read entire response as text (for devices without ReadableStream support)
                log("⚠️ ReadableStream not supported, using fallback mode");
                try {
                    const fallbackText = await response.text();
                    if (!fallbackText || fallbackText.trim().length === 0) {
                        throw new Error("Received empty response from server.");
                    }

                    // Parse NDJSON line by line
                    const lines = fallbackText
                        .split("\n")
                        .map(line => line.trim())
                        .filter(Boolean);
                    
                    if (lines.length === 0) {
                        throw new Error("No data received from server.");
                    }

                    lines.forEach(line => handleStreamLine(line));
                    return;
                } catch (fallbackError: any) {
                    throw new Error(`Fallback mode failed: ${fallbackError.message || "Unknown error"}`);
                }
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                let newlineIndex: number;
                while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
                    const line = buffer.slice(0, newlineIndex).trim();
                    buffer = buffer.slice(newlineIndex + 1);
                    if (!line) continue;
                    handleStreamLine(line);
                }
            }

            if (buffer.trim()) {
                handleStreamLine(buffer.trim());
            }
        } catch (err: any) {
            if (err.name === "AbortError") {
                log("Streaming aborted");
                return;
            }
            logError("Streaming error:", err);
            setStreamingError(getUserFriendlyError(err));
        } finally {
            setIsStreaming(false);
            setIsInitialLoading(false);
            streamAbortRef.current = null;
            removeStreamingSource(sourceId);
        }
    }, [appendMcq, handleStreamLine, items.length, log, logError]);

    useEffect(() => {
        if (!streamingSourceId || streamStartedRef.current) {
            return;
        }

        const source = getStreamingSource(streamingSourceId);
        if (!source) {
            setStreamingError("Generation session expired. Please re-upload your material.");
            setIsStreaming(false);
            setIsInitialLoading(false);
            return;
        }

        streamStartedRef.current = true;
        const controller = new AbortController();
        streamAbortRef.current = controller;

        startStreaming(streamingSourceId, source, controller);

        return () => {
            controller.abort();
            streamAbortRef.current = null;
            removeStreamingSource(streamingSourceId);
        };
    }, [streamingSourceId, startStreaming]);

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
                        
                        const answeredCount = answeredQuestions.size + 1;
                        const batchesPending = isStreaming;

                        // Navigate to score summary when all questions are answered and no more batches remain
                        if (!batchesPending && answeredCount === items.length) {
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
        [ITEM_HEIGHT, navigation, insets, colors, showSwipeHint, currentQuestion, items, correctAnswers, answeredQuestions, userAnswers, isStreaming]
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

    const waitingForNextBatch = isStreaming && answeredQuestions.size >= items.length;

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
                ListEmptyComponent={!isInitialLoading ? renderEmptyState : null}
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
            {isStreaming && items.length > 0 && !error && (
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
            {waitingForNextBatch && (
                <View style={[styles.waitingOverlay, { backgroundColor: colors.card }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.waitingText, { color: colors.foreground }]}>Loading next batch...</Text>
                </View>
            )}
            {streamingError && (
                <View style={[styles.batchErrorBanner, { borderColor: colors.destructive, backgroundColor: `${colors.destructive}10` }]}>
                    <Ionicons name="warning" size={16} color={colors.destructive} />
                    <Text style={[styles.batchErrorText, { color: colors.destructive }]}>{streamingError}</Text>
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
    waitingOverlay: {
        position: 'absolute',
        bottom: 120,
        left: 32,
        right: 32,
        borderRadius: 20,
        paddingVertical: 18,
        paddingHorizontal: 24,
        alignItems: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
    waitingText: {
        fontSize: 15,
        fontWeight: '600',
    },
    batchErrorBanner: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        borderRadius: 12,
        borderWidth: 1,
        paddingVertical: 10,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    batchErrorText: {
        fontSize: 14,
        flex: 1,
    },
});