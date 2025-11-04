import { useState } from "react";
import { View, Text, Button, Alert, ActivityIndicator, TouchableOpacity, SafeAreaView, StatusBar, StyleSheet, Modal, Animated } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from 'expo-haptics';
import { supabase } from "../lib/supabase";
import { log, warn, error as logError } from "../lib/logger";
import { getUserFriendlyError } from "../lib/errorUtils";
import { LinearGradient } from "expo-linear-gradient"; 
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from "../contexts/SubscriptionContext"; 
import { useTheme } from "../contexts/ThemeContext";
import * as WebBrowser from "expo-web-browser"; 

//URL to supabase edge function
const function_url = "/functions/v1/generate-mcqs"; 

//main function 
export default function UploadScreen({ navigation }: any ){
    const { colors, isDarkMode, toggleTheme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const { canUpload, uploadCount, uploadLimit, isProUser, incrementUploadCount, canUploadNow, uploadsInLastHour, uploadsInLastDay, nextUploadAllowedAt } = useSubscription();

    //Function to check rate limits for pro users 
    const checkRateLimits = () => {
        if (!isProUser) return true; // Free users use existing canUpload logic
        
        if (!canUploadNow) {
            let message = "Rate limit exceeded. ";
            let nextUploadTime = "";
            
            if (nextUploadAllowedAt) {
                const now = new Date();
                const timeDiff = nextUploadAllowedAt.getTime() - now.getTime();
                
                if (timeDiff > 0) {
                    const minutes = Math.ceil(timeDiff / (1000 * 60));
                    const hours = Math.ceil(timeDiff / (1000 * 60 * 60));
                    
                    if (hours > 1) { //if the time difference is more than 1 hour
                        nextUploadTime = `Please try again in ${hours} hours.`;
                    } else {
                        nextUploadTime = `Please try again in ${minutes} minutes.`;
                    }
                }
            }
            
            if (uploadsInLastHour >= 20) { //if the user uploaded more than 20 files in the last hour
                message += `You've uploaded ${uploadsInLastHour} files in the last hour (limit: 20). ${nextUploadTime}`;
            } else if (uploadsInLastDay >= 100) { //if the user uploaded more than 100 files in the day 
                message += `You've uploaded ${uploadsInLastDay} files in the last day (limit: 100). ${nextUploadTime}`;
            } else { //if the user uploaded two files in the last 30 seconds
                message += `Please wait 30 seconds between uploads. ${nextUploadTime}`;
            }
            
            Alert.alert(
                "Upload Rate Limited",
                message,
                [{ text: "OK", style: "default" }]
            );
            return false;
        }
        
        return true;
    };

    // Handle logout session 
    const handleLogout = async () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to logout?",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Logout", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            // Clear Supabase session
                            const { error } = await supabase.auth.signOut();
                            if (error) {
                                Alert.alert("Error", error.message);
                                return;
                            }
                            
                            // Clear WebBrowser session to ensure Google auth session is cleared
                            await WebBrowser.dismissBrowser();
                            
                            log("Successfully logged out - sessions cleared");
                            // Navigation will be handled by AuthContext automatically
                        } catch (error) {
                            logError("Error during logout:", error);
                            Alert.alert("Error", "Failed to logout properly");
                        }
                    }
                }
            ]
        );
    }; 

    //fucntion to load pdfs 
    async function loadPdf(){
        // Haptic feedback on button press
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        // Check upload limit for free users
        if (!canUpload) {
            Alert.alert(
                "Upload Limit Reached",
                `Free plan allows up to ${uploadLimit} uploads. Upgrade to Pro plan for unlimited access!`,
                [
                    { text: "Cancel", style: "cancel" },
                    { 
                        text: "View Plans", 
                        onPress: () => navigation.navigate("Subscription", { source: 'upload' })
                    }
                ]
            );
            return;
        }

        // Check rate limits for Pro users
        if (!checkRateLimits()) {
            return;
        }

        const result = await DocumentPicker.getDocumentAsync({
            type: ["application/pdf"], 
            multiple: false, //change to true if you want multiple pdfs 
            copyToCacheDirectory: true, //stores files into app's cache folder 
        }); 
        if(result.canceled || !result.assets?.[0]) return; 
        await handleUpload(result.assets[0].uri, "application/pdf"); 
    }

    //function to load images 
    async function loadImage(){
        // Haptic feedback on button press
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        // Check upload limit for free users
        if (!canUpload) {
            Alert.alert(
                "Upload Limit Reached",
                `Free plan allows up to ${uploadLimit} uploads. Upgrade to Pro plan for unlimited access!`,
                [
                    { text: "Cancel", style: "cancel" },
                    { 
                        text: "View Plans", 
                        onPress: () => navigation.navigate("Subscription", { source: 'upload' })
                    }
                ]
            );
            return;
        }

        // Check rate limits for Pro users
        if (!checkRateLimits()) {
            return;
        }

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync(); 
        if (status !== "granted"){
            Alert.alert("Permission Required", "We need media permissions"); 
            return; 
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, 
            base64: false, 
            quality: 0.7, // Reduced quality to 70% for smaller file size
            allowsEditing: false,
        }); 
        if (result.canceled || !result.assets?.[0]) return; 
        
        // Get proper MIME type from file extension
        const uri = result.assets[0].uri;
        const fileExt = uri.split(".").pop()?.toLowerCase();
        let mimeType = "image/jpeg"; // default
        
        switch (fileExt) {
            case "jpg":
            case "jpeg":
                mimeType = "image/jpeg";
                break;
            case "png":
                mimeType = "image/png";
                break;
            case "gif":
                mimeType = "image/gif";
                break;
            case "webp":
                mimeType = "image/webp";
                break;
        }
        
        await handleUpload(uri, mimeType); 
    }


    async function handleUpload(uri: string, mime: string){
        try {
            log("🟢 Step 1: Starting upload process");
            setLoading(true);
                
            // 1. Validate MIME type
            const ALLOWED_MIME_TYPES = [
                'application/pdf',
                'image/jpeg',
                'image/jpg',
                'image/png',
                'image/gif',
                'image/webp'
            ];
            
            log("🟢 Step 2: Validating file type");
            if (!ALLOWED_MIME_TYPES.includes(mime)) {
                throw new Error("Invalid file type. Please upload a PDF or image file (JPEG, PNG, GIF, WebP).");
            }

            // 2. Get current user
            log("🟢 Step 3: Authenticating user");
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error("User not authenticated. Please log in.");
            }

            // 3. Load file and validate size
            log("🟢 Step 4: Loading file");
            const file = await fetch(uri);
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            log("🟢 Step 5: Validating file size");
            const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
            if (uint8Array.length > MAX_FILE_SIZE) {
                throw new Error(`File too large. Maximum size is 20MB. Your file is ${(uint8Array.length / 1024 / 1024).toFixed(1)}MB.`);
            }

            // 4. Convert file to base64
            log("🟢 Step 6: Encoding file to base64");
            let binaryStr = '';
            for (let i = 0; i < uint8Array.length; i += 8192) {
                const chunk = uint8Array.slice(i, i + 8192);
                binaryStr += String.fromCharCode(...chunk);
            }
            const base64Data = btoa(binaryStr);
            log(`🟢 Step 7: File encoded (${(base64Data.length / 1024 / 1024).toFixed(2)} MB)`);

            // 5. Get user session token
            log("🟢 Step 8: Getting session token");
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error("No active session. Please log in again.");
            }

            // 6. Call Edge Function with file data directly (no storage upload)
            log("🟢 Step 9: Calling Edge Function");
            const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
            const fnRes = await fetch(`${baseUrl}${function_url}`, {
                method: "POST", 
                headers: {
                    "Content-Type": "application/json", 
                    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ 
                    file_data: base64Data,  // Send file data directly
                    mime_type: mime
                }),
            }); 

            if (!fnRes.ok){
                const errorText = await fnRes.text();
                throw new Error(errorText); 
            }

            // 7. Parse response and get MCQs
            log("🟢 Step 10: Parsing MCQs");
            const result = await fnRes.json();
            
            if (!result.ok || !result.mcqs) {
                throw new Error("Failed to generate MCQs");
            }

            log(`🟢 Step 11: Generated ${result.mcqs.length} MCQs successfully`);

            // 8. Check rate limit info
            if (result.rate_limit) {
                log(`🟢 Rate limit: ${result.rate_limit.remaining} remaining, resets at ${new Date(result.rate_limit.reset_time).toLocaleString()}`);
            }

            // 9. Increment upload count
            await incrementUploadCount();

            // 10. Navigate to Feed with MCQs
            log("🟢 Step 12: Navigating to Feed");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // Navigate to Feed with MCQs directly (no database storage)
            navigation.navigate('Feed', { 
                mcqs: result.mcqs,
                generated_at: result.generated_at,
                count: result.count,
                cached: result.cached || false,
                rate_limit: result.rate_limit
            });
        } catch (e: any) {
            logError('Upload error:', e);
            
            // Use user-friendly error message
            const errorMessage = getUserFriendlyError(e);
            Alert.alert("Upload Error", errorMessage); 
        } finally {
            setLoading(false); //set loading to false no matter what
        }
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
            
            {/* Header with logout button and sparkles */}
            <View style={[styles.header, { backgroundColor: `${colors.primary}08` }]}>
                <TouchableOpacity 
                    style={[styles.logoutButton, { 
                        backgroundColor: `${colors.destructive}15`,
                        borderColor: `${colors.destructive}30`,
                    }]}
                    onPress={handleLogout}
                    activeOpacity={0.7}
                >
                    <Ionicons name="log-out-outline" size={24} color={colors.destructive} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.foreground }]}>Brainlot</Text>
                <TouchableOpacity
                    onPress={toggleTheme}
                    activeOpacity={0.7}
                >
                    <Ionicons 
                        name={isDarkMode ? "sunny" : "moon"} 
                        size={24} 
                        color={colors.accent} 
                    />
                </TouchableOpacity>
            </View>

            {/* Main Content */}
            <View style={styles.mainContent}>
                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <LinearGradient
                        colors={[colors.primary, colors.accent]}
                        style={styles.iconContainer}
                    >
                        <Ionicons name="scan" size={48} color="white" />
                    </LinearGradient>
                    <Text style={[styles.heroTitle, { color: colors.foreground }]}>Upload your materials!</Text>
                    
                    {/* Upload count badge for free users */}
                    {!isProUser && (
                        <View style={[styles.uploadCountBadge, { 
                            backgroundColor: `${colors.secondary}20`,
                            borderColor: `${colors.secondary}40`,
                        }]}>
                            <Text style={[styles.uploadCountText, { color: colors.secondary }]}>
                                Remaining: {Math.max(0, uploadLimit - uploadCount)}/{uploadLimit} uploads
                            </Text>
                        </View>
                    )}
                    
                    {isProUser && (
                        <View style={[styles.proBadge, { 
                            backgroundColor: `${colors.secondary}20`,
                            borderColor: `${colors.secondary}40`,
                        }]}>
                            <Ionicons name="sparkles" size={16} color={colors.secondary} />
                            <Text style={[styles.proBadgeText, { color: colors.secondary }]}>Pro - Unlimited</Text>
                        </View>
                    )}
                </View>

                {/* Upload Cards */}
                <View style={styles.cardsContainer}>
                    <TouchableOpacity
                        style={[styles.card, styles.pdfCard, {
                            backgroundColor: colors.card,
                            borderColor: `${colors.primary}33`,
                        }]}
                        onPress={loadPdf}
                        activeOpacity={0.95}
                        disabled={loading}
                    >
                        <LinearGradient
                            colors={[colors.primary, colors.primary + 'CC']}
                            style={styles.cardIcon}
                        >
                            <Ionicons name="document-text" size={36} color="white" />
                        </LinearGradient>
                        <View style={styles.cardContent}>
                            <Text style={[styles.cardTitle, { color: colors.foreground }]}>PDF Document</Text>
                            <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>Scan text and extract data ✨</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.card, styles.imageCard, {
                            backgroundColor: colors.card,
                            borderColor: `${colors.secondary}33`,
                        }]}
                        onPress={loadImage}
                        activeOpacity={0.95}
                        disabled={loading}
                    >
                        <LinearGradient
                            colors={[colors.secondary, colors.secondary + 'CC']}
                            style={styles.cardIcon}
                        >
                            <Ionicons name="image" size={36} color="white" />
                        </LinearGradient>
                        <View style={styles.cardContent}>
                            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Image File</Text>
                            <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>Process visual content 📸</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Loading Overlay */}
            {loading && (
                <View style={styles.loadingOverlay}>
                    <View style={[styles.loadingCard, { backgroundColor: colors.card }]}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={[styles.loadingText, { color: colors.foreground }]}>Processing...</Text>
                    </View>
                </View>
            )}

            {/* Success Modal */}
            <Modal
                visible={showSuccessModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowSuccessModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.successModal, { backgroundColor: colors.card }]}>
                        <View style={styles.successIconContainer}>
                            <Ionicons name="checkmark-circle" size={80} color={colors.primary} />
                        </View>
                        
                        <Text style={[styles.successTitle, { color: colors.foreground }]}>MCQs are Ready! 🎉</Text>
                        <Text style={[styles.successMessage, { color: colors.mutedForeground }]}>
                            Your MCQs have been generated successfully! Ready to practice?
                        </Text>
                        
                        <TouchableOpacity
                            style={styles.practiceButton}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setShowSuccessModal(false);
                                navigation.navigate("Feed");
                            }}
                        >
                            <LinearGradient
                                colors={[colors.primary, colors.accent]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.practiceButtonGradient}
                            >
                                <Ionicons name="bulb" size={24} color="white" />
                                <Text style={styles.practiceButtonText}>Practice MCQs</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Shopping Cart Button - Fixed at Bottom */}
            <View style={[styles.bottomCartContainer, { 
                backgroundColor: colors.background,
                borderTopColor: colors.border,
            }]}>
                <TouchableOpacity
                    style={[styles.cartButton, loading && styles.cartButtonDisabled]}
                    onPress={() => navigation.navigate("Subscription", { source: 'upload' })}
                    activeOpacity={0.9}
                    disabled={loading}
                >
                    <LinearGradient
                        colors={[colors.secondary, colors.gold!]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.cartButtonGradient}
                    >
                        <Ionicons name={loading ? "hourglass" : "cart"} size={24} color="white" />
                        <Text style={styles.cartButtonText}>
                            {loading ? 'Processing...' : (isProUser ? 'Manage Plan' : 'Upgrade to Pro')}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    ); 
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 20,
    },
    logoutButton: {
        padding: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        flex: 1,
        textAlign: 'center',
    },
    mainContent: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 32,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    iconContainer: {
        width: 96,
        height: 96,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    heroTitle: {
        fontSize: 28,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 34,
    },
    heroSubtitle: {
        fontSize: 16,
        textAlign: 'center',
        fontWeight: '500',
        paddingHorizontal: 8,
        lineHeight: 24,
    },
    cardsContainer: {
        gap: 20,
        marginBottom: 24,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 28,
        borderRadius: 24,
        borderWidth: 2,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    pdfCard: {
        shadowOpacity: 0.1,
    },
    imageCard: {
        shadowOpacity: 0.1,
    },
    cardIcon: {
        width: 72,
        height: 72,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 20,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 14,
        fontWeight: '500',
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        paddingTop: 16,
    },
    actionButton: {
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 20,
        borderWidth: 1,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingCard: {
        padding: 32,
        borderRadius: 20,
        alignItems: 'center',
        gap: 16,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    loadingText: {
        fontSize: 16,
        fontWeight: '600',
    },
    bottomIndicator: {
        alignItems: 'center',
        paddingBottom: 16,
    },
    indicatorGradient: {
        width: 144,
        height: 6,
        borderRadius: 3,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    successModal: {
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 16,
        maxWidth: 320,
        width: '100%',
    },
    successIconContainer: {
        marginBottom: 24,
    },
    successTitle: {
        fontSize: 25,
        fontWeight: '900',
        marginBottom: 16,
        textAlign: 'center',
    },
    successMessage: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    practiceButton: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
    },
    practiceButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        gap: 8,
    },
    practiceButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
    },
    uploadCountBadge: {
        marginTop: 16,
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    uploadCountText: {
        fontSize: 14,
        fontWeight: '700',
    },
    proBadge: {
        marginTop: 16,
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    proBadgeText: {
        fontSize: 14,
        fontWeight: '700',
    },
    bottomCartContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        paddingVertical: 16,
        paddingBottom: 32,
        borderTopWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
    },
    cartButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    cartButtonDisabled: {
        opacity: 0.5,
    },
    cartButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        gap: 12,
    },
    cartButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
