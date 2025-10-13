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
import MCQCard from "../components/MCQCard";

// Duolingo-inspired color palette
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
export default function FeedScreen({ navigation }: any) {
    const insets = useSafeAreaInsets(); 
    const win = Dimensions.get("window"); // get the dimensions of your device

    // Use full screen height for true full-screen experience like Instagram Reels
    const ITEM_HEIGHT = useMemo(
        () => win.height, 
        [win.height]
    ); 

    const [items, setItems] = useState<any[]>([]); // start with an empty array 
    const [from, setFrom] = useState(0); // begin loading from the first question 
    const [loading, setLoading] = useState(false); // check if loading is happening
    const [end, setEnd] = useState(false); // check if it is the end of the quiz table
    const [error, setError] = useState<string | null>(null); // error state 
    
    // load function to fetch MCQs from the database 
    const load = useCallback(async () => {
        if (loading || end) return; 
        setLoading(true);
        setError(null); // Clear previous errors
        
        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                if (__DEV__) console.log('No authenticated user found');
                setLoading(false);
                return;
            }

            const to = from + PAGE - 1; 
            
            //Fetch MCQs generated only by the user with the matching user_id 
            const { data, error } = await supabase 
                .from("mcqs")
                .select(`
                    *,
                    files!inner(
                        user_id
                    )
                `)
                .eq("files.user_id", user.id) //only look at the current user 
                .order("created_at", { ascending: false })
                .range(from, to); 

            if (error) { //If there is an error, log it and show to user
                console.error(error);
                setError('Failed to load quizzes. Please check your connection and try again.');
            } else {
                setItems((cur) => [...cur, ...(data ?? [])]); //add new ones to the current list of quizzes
                if (!data || data.length < PAGE) setEnd(true); // if there are no more quizzes, set the end to true 
                setFrom((f) => f + PAGE); // increment the from by the page size to fetch the next quizzes
            }
        } catch (err) {
            console.error('Unexpected error:', err);
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false); // set loading to false 
        }
    }, [from, loading, end]); 

    // load the quizzes when the component mounts 
    useEffect(() => {
        load(); 
    }, [load]); 

    const renderItem = useCallback(
        ({ item }: { item: any }) => (
            // Each item takes full screen height with no additional containers
            <MCQCard 
                item={item} 
                cardHeight={ITEM_HEIGHT}
                navigation={navigation}
                safeAreaInsets={insets} // Pass safe area insets to MCQCard
                colors={colors}
            />
        ), 
        [ITEM_HEIGHT, navigation, insets]
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
                    setFrom(0);
                    setItems([]);
                    setEnd(false);
                    load();
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
                    <Text style={styles.retryButtonText}>Try Again</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    ); 

    // extract the key (unique id) from the item 
    const keyExtractor = useCallback((it: any) => it.id, []); 

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
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                ListEmptyComponent={!loading ? renderEmptyState : null}
                getItemLayout={getItemLayout}
                pagingEnabled={true} //each quiz takes up one full screen
                snapToInterval={ITEM_HEIGHT} //each snap lands at the top of the card 
                snapToAlignment="start" //the card's top edge line should align with the top of the screen
                decelerationRate={Platform.OS === "ios" ? 0.99 : 0.98} //controls how fast the scroll slows down after you swipe 
                showsVerticalScrollIndicator={false} //hid the scroll bar on the side 
                scrollEventThrottle={16} //control the speed of onScroll() reacting
                onEndReached={load} // Load more questions when near the end
                onEndReachedThreshold={0.7}
                removeClippedSubviews={true} // Performance optimization
                windowSize={3} // Keep only 3 screens in memory
                initialNumToRender={1} // Render only 1 question initially
                maxToRenderPerBatch={2} // Batch render 2 more as you scroll
                contentContainerStyle={{
                    flexGrow: 1, // Allow content to grow but no extra padding
                }}
                style={{ flex: 1 }} // Ensure FlatList takes full height
                bounces={false} // Disable bounce for more native feel
                overScrollMode="never" // Android: prevent over-scroll glow
                disableIntervalMomentum={true} // Prevent momentum from skipping items
                disableScrollViewPanResponder={false} // Allow pan gestures
                scrollEnabled={true} // Ensure scrolling is enabled
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
});