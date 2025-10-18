import { useState } from "react";
import { View, Text, Button, Alert, ActivityIndicator, TouchableOpacity, SafeAreaView, StatusBar, StyleSheet, Modal, Animated } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from 'expo-haptics';
import { supabase } from "../lib/supabase";
import { LinearGradient } from "expo-linear-gradient"; 
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from "../contexts/SubscriptionContext"; 
import * as WebBrowser from "expo-web-browser"; 

//Color theme to match duolingo 
const colors = {
    background: '#f8fdf9', //light green-tinted background color
    foreground: '#1a1f2e', //deep navy for text 
    primary: '#58cc02', // Duolingo kinda green
    secondary: '#ff9600', // Warm orange accent
    accent: '#1cb0f6', // Bright blue accent
    muted: '#f0f9f1', // Very light green
    mutedForeground: '#6b7280',
    card: '#ffffff',
    border: '#e8f5e8',
    destructive: '#dc2626', // Friendly red
    gold: '#ffd700',
}

//URL to supabase edge function
const function_url = "/functions/v1/generate-mcqs"; 

//main function 
export default function UploadScreen({ navigation }: any ){
    const [loading, setLoading] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const { canUpload, uploadCount, uploadLimit, isProUser, incrementUploadCount, canUploadNow, uploadsInLastHour, uploadsInLastDay, nextUploadAllowedAt } = useSubscription();

    // Check rate limits for Pro users
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
                    
                    if (hours > 1) {
                        nextUploadTime = `Please try again in ${hours} hours.`;
                    } else {
                        nextUploadTime = `Please try again in ${minutes} minutes.`;
                    }
                }
            }
            
            if (uploadsInLastHour >= 20) {
                message += `You've uploaded ${uploadsInLastHour} files in the last hour (limit: 20). ${nextUploadTime}`;
            } else if (uploadsInLastDay >= 100) {
                message += `You've uploaded ${uploadsInLastDay} files in the last day (limit: 100). ${nextUploadTime}`;
            } else {
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
                            
                            console.log("Successfully logged out - sessions cleared");
                            // Navigation will be handled by AuthContext automatically
                        } catch (error) {
                            console.error("Error during logout:", error);
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
            console.log("🟢 Step 1: handleUpload started");
            setLoading(true); //set loading state to true 

                
            //List of allowed mime types 
            const ALLOWED_MIME_TYPES = [
                'application/pdf',
                'image/jpeg',
                'image/jpg',
                'image/png',
                'image/gif',
                'image/webp'
            ];
            
            console.log("🟢 Step 2: validating file type");
            if (!ALLOWED_MIME_TYPES.includes(mime)) {
                throw new Error("Invalid file type. Please upload a PDF or image file (JPEG, PNG, GIF, WebP).");
            }

            // 2. Get current user first
            console.log("🟢 Step 3: fetching user");
            const { data: { user } } = await supabase.auth.getUser();
            console.log("User:", user); 
            if (!user) {
                throw new Error("User not authenticated. Please log in.");
            }

            // 3. Load file and validate size
            console.log("🟢 Step 4: fetching session");
            const file = await fetch(uri);
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            console.log("🟢 Step 5: validating file size");
            const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
            if (uint8Array.length > MAX_FILE_SIZE) {
                throw new Error(`File too large. Maximum size is 20MB. Your file is ${(uint8Array.length / 1024 / 1024).toFixed(1)}MB.`);
            }

            // 4. Delete all previous MCQs and files for this user
            console.log("🟢 Step 6: deleting previous files");
            const { data: previousFiles } = await supabase
                .from("files")
                .select("id, storage_path")
                .eq("user_id", user.id);
            
            console.log("🟢 Step 7: checking for previous files");
            if (previousFiles && previousFiles.length > 0) {
                const fileIds = previousFiles.map(f => f.id);
                
                // Delete MCQs
                const { error: deleteMcqError } = await supabase
                    .from("mcqs")
                    .delete()
                    .in("file_id", fileIds);
                
                if (deleteMcqError) {
                    console.warn("Failed to delete previous MCQs:", deleteMcqError);
                }
                
                // Delete storage files
                const storagePaths = previousFiles.map(f => f.storage_path);
                const { error: deleteStorageError } = await supabase.storage
                    .from("study")
                    .remove(storagePaths);
                
                if (deleteStorageError) {
                    console.warn("Failed to delete previous storage files:", deleteStorageError);
                }
                
                // Delete file records
                const { error: deleteFilesError } = await supabase
                    .from("files")
                    .delete()
                    .in("id", fileIds);
                
                if (deleteFilesError) {
                    console.warn("Failed to delete previous file records:", deleteFilesError);
                }
            }

            console.log("🟢 Step 8: creating filename and path");
            // 5. Create filename and path (include user_id for security)
            const fileExt = uri.split(".").pop() ?? "bin";
            const fileName = `${Date.now()}.${fileExt}`; 
            const filePath = `${user.id}/${fileName}`; // Include user_id in path for security

            console.log("🟢 Step 9: storing file path into upload folder");
            //store the file path into the upload folder inside storage 
            const { error: upErr } = await supabase.storage 
                .from("study") //go to the study storage 
                .upload(filePath, uint8Array, { //inside the upload folder 
                    contentType: mime, 
                    upsert: false, //prohibit from overwriting 
                }); 
            
            if (upErr) throw upErr; 

            console.log("🟢 Step 10: getting public url");
            const { data: pub } = supabase.storage.from("study").getPublicUrl(filePath); //stores an object that contains url
            const publicUrl = pub?.publicUrl; //store the public url 
            if (!publicUrl) throw new Error("Public URL is not created");

            console.log("🟢 Step 11: inserting file path and url into files table");
            //return an object with only the row you inserted the path and url into
            const { data: files, error: fErr } = await supabase 
                .from("files")
                .insert([{ 
                    storage_path: filePath, 
                    public_url: publicUrl, 
                    mime_type: mime,
                    user_id: user.id, // Associate file with current user
                }])
                .select()
                .limit(1)

            if (fErr) throw fErr; 
            const fileRow = files![0]; 

            // 6. Get user session token for authentication
            console.warn("🟢 Step 12: getting user session token");
            const { data: { session } } = await supabase.auth.getSession();
            console.log("Access Token:", session?.access_token);
            console.warn("SESSION", session); //log out the JWT sesson token
            if (!session) {
                throw new Error("No active session. Please log in again.");
            }

            // 7. Call Edge Function with user token
            console.log("🟢 Step 13: calling edge function");
            const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
            const fnRes = await fetch(`${baseUrl}${function_url}`, {
                method: "POST", 
                headers: {
                    "Content-Type": "application/json", 
                    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                    Authorization: `Bearer ${session.access_token}`, // Use user's token instead of anon key
                },
                body: JSON.stringify({ file_id: fileRow.id }), //give the file id to let the server know which file to process
            }); 
            console.log("Edge Function URL:", `${baseUrl}${function_url}`);

            console.log(await fnRes.text());
            if (!fnRes.ok){
                throw new Error(await fnRes.text()); 
            }

            console.log("🟢 Step 14: incrementing upload count");
            // Increment upload count after successful upload
            await incrementUploadCount();
            // Success haptic feedback
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowSuccessModal(true);
        } catch (e: any) {
            let errorMessage = e.message ?? String(e);
            
            // Parse errors for better user experience
            if (errorMessage.includes("Invalid file type")) {
                // Keep the original error message
            } else if (errorMessage.includes("File too large")) {
                // Keep the original error message
            } else if (errorMessage.includes("not authenticated") || errorMessage.includes("No active session")) {
                errorMessage = "Please log in to upload files.";
            } else if (errorMessage.includes("503") || errorMessage.includes("UNAVAILABLE")) {
                errorMessage = "The AI service is temporarily unavailable. Please try again in a few minutes.";
            } else if (errorMessage.includes("400") || errorMessage.includes("INVALID_ARGUMENT")) {
                errorMessage = "The file format is not supported. Please try a different file.";
            } else if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
                errorMessage = "Authentication failed. Please log in again.";
            } else if (errorMessage.includes("403") || errorMessage.includes("Access denied")) {
                errorMessage = "Access denied. You don't have permission to perform this action.";
            } else if (errorMessage.includes("413") || errorMessage.includes("PAYLOAD_TOO_LARGE")) {
                errorMessage = "The file is too large. Please use a smaller file.";
            } else if (errorMessage.includes("429") || errorMessage.includes("QUOTA_EXCEEDED")) {
                errorMessage = "API quota exceeded. Please try again later.";
            } else {
                // Generic error message for unexpected errors
                errorMessage = "An error occurred during upload. Please try again.";
            }
            
            Alert.alert("Upload Error", errorMessage); 
        } finally {
            setLoading(false); //set loading to false no matter what
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
            
            {/* Header with logout button and sparkles */}
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.logoutButton}
                    onPress={handleLogout}
                    activeOpacity={0.7}
                >
                    <Ionicons name="log-out-outline" size={24} color={colors.destructive} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edu-Shorts</Text>
                <Ionicons name="sparkles" size={24} color={colors.secondary} />
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
                    <Text style={styles.heroTitle}>Upload your materials!</Text>
                    
                    {/* Upload count badge for free users */}
                    {!isProUser && (
                        <View style={styles.uploadCountBadge}>
                            <Text style={styles.uploadCountText}>
                                Remaining: {uploadLimit - uploadCount}/{uploadLimit} uploads
                            </Text>
                        </View>
                    )}
                    
                    {/* Rate limit info for Pro users */}
                    {isProUser && (
                        <View style={styles.rateLimitBadge}>
                            <Text style={styles.rateLimitText}>
                                Pro Plan: {uploadsInLastHour}/20 per hour, {uploadsInLastDay}/100 per day
                            </Text>
                        </View>
                    )}
                    {isProUser && (
                        <View style={styles.proBadge}>
                            <Ionicons name="sparkles" size={16} color={colors.secondary} />
                            <Text style={styles.proBadgeText}>Pro - Unlimited</Text>
                        </View>
                    )}
                </View>

                {/* Upload Cards */}
                <View style={styles.cardsContainer}>
                    <TouchableOpacity
                        style={[styles.card, styles.pdfCard]}
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
                            <Text style={styles.cardTitle}>PDF Document</Text>
                            <Text style={styles.cardSubtitle}>Scan text and extract data ✨</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.card, styles.imageCard]}
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
                            <Text style={styles.cardTitle}>Image File</Text>
                            <Text style={styles.cardSubtitle}>Process visual content 📸</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Loading Overlay */}
            {loading && (
                <View style={styles.loadingOverlay}>
                    <View style={styles.loadingCard}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Processing...</Text>
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
                    <View style={styles.successModal}>
                        <View style={styles.successIconContainer}>
                            <Ionicons name="checkmark-circle" size={80} color={colors.primary} />
                        </View>
                        
                        <Text style={styles.successTitle}>MCQs are Ready! 🎉</Text>
                        <Text style={styles.successMessage}>
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
            <View style={styles.bottomCartContainer}>
                <TouchableOpacity
                    style={[styles.cartButton, loading && styles.cartButtonDisabled]}
                    onPress={() => navigation.navigate("Subscription", { source: 'upload' })}
                    activeOpacity={0.9}
                    disabled={loading}
                >
                    <LinearGradient
                        colors={[colors.secondary, colors.gold]}
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
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 20,
        backgroundColor: `${colors.primary}08`,
    },
    logoutButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: `${colors.destructive}15`,
        borderWidth: 1,
        borderColor: `${colors.destructive}30`,
    },
    backButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: `${colors.primary}15`,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.foreground,
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
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    heroTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: colors.foreground,
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 34,
    },
    heroSubtitle: {
        fontSize: 16,
        color: colors.mutedForeground,
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
        backgroundColor: colors.card,
        borderColor: `${colors.primary}33`,
        shadowColor: colors.primary,
    },
    imageCard: {
        backgroundColor: colors.card,
        borderColor: `${colors.secondary}33`,
        shadowColor: colors.secondary,
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
        color: colors.foreground,
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 14,
        color: colors.mutedForeground,
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
    accentButton: {
        backgroundColor: `${colors.accent}1A`,
        borderColor: `${colors.accent}4D`,
    },
    primaryButton: {
        backgroundColor: `${colors.primary}1A`,
        borderColor: `${colors.primary}4D`,
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
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
        backgroundColor: colors.card,
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
        color: colors.foreground,
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
        backgroundColor: colors.card,
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
        color: colors.foreground,
        marginBottom: 16,
        textAlign: 'center',
    },
    successMessage: {
        fontSize: 16,
        color: colors.mutedForeground,
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
        backgroundColor: `${colors.secondary}20`,
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: `${colors.secondary}40`,
    },
    uploadCountText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.secondary,
    },
    rateLimitBadge: {
        marginTop: 16,
        backgroundColor: `${colors.primary}20`,
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: `${colors.primary}40`,
    },
    rateLimitText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary,
        textAlign: 'center',
    },
    proBadge: {
        marginTop: 16,
        backgroundColor: `${colors.secondary}20`,
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: `${colors.secondary}40`,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    proBadgeText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.secondary,
    },
    bottomCartContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        paddingVertical: 16,
        paddingBottom: 32,
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.border,
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