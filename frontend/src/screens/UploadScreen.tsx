import React, { useState, useCallback } from "react";
import { View, Text, Button, Alert, ActivityIndicator, TouchableOpacity, SafeAreaView, StatusBar, StyleSheet, Modal, Animated, TextInput, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from 'expo-haptics';
import { supabase } from "../lib/supabase";
import { log, warn, error as logError } from "../lib/logger";
import { getUserFriendlyError } from "../lib/errorUtils";
import { LinearGradient } from "expo-linear-gradient"; 
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSubscription } from "../contexts/SubscriptionContext"; 
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useLocalLLM } from "../contexts/LocalLLMContext";
import * as WebBrowser from "expo-web-browser"; 
import TextRecognition from 'react-native-text-recognition';

//URL to supabase edge function
const function_url = "/functions/v1/generate-mcqs"; 

//main function 
export default function UploadScreen({ navigation }: any ){
    const { colors, isDarkMode, toggleTheme } = useTheme();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showTextInputModal, setShowTextInputModal] = useState(false);
    const [textInput, setTextInput] = useState('');
    const MAX_TEXT_LENGTH = 4000;

    const runLocalGeneration = async (material: string, source: 'text' | 'image') => {
        try {
            if (!material || material.trim().length < 20) {
                throw new Error("We need at least 20 characters to generate meaningful MCQs.");
            }
            log(`🟣 Local LLM generation started (${source})`);
            setLoading(true);
            await ensureLocalReady();
            const mcqs = await generateBatch(material.trim());
            log(`🟣 Local LLM returned ${mcqs.length} MCQs`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            navigation.navigate('Feed', { 
                mcqs,
                generated_at: new Date().toISOString(),
                count: mcqs.length,
                cached: false,
                generationStrategy: 'local',
                studyMaterial: material.trim(),
            });
        } catch (error: any) {
            logError('Local LLM generation failed:', error);
            Alert.alert(
                "Local Model Error",
                error?.message || "The offline model could not generate questions. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };
    const { canUpload, uploadCount, uploadLimit, isProUser, incrementUploadCount, refreshSubscription, addRecentUpload, fetchSubscriptionData, canUploadNow, uploadsInLastHour, uploadsInLastDay, nextUploadAllowedAt } = useSubscription();
    const { mode: generationMode, generateBatch, ensureLocalReady } = useLocalLLM();
    const shouldUseLocalLLM = !isProUser && generationMode === 'local';

    // Check and reset daily uploads when screen comes into focus
    // This ensures daily_reset_at is checked every time user navigates to upload screen
    // regardless of whether they logged in or not
    useFocusEffect(
        useCallback(() => {
            if (!user) return; // Only check if user is logged in
            
            // Check and reset daily uploads if daily_reset_at has passed
            // This is non-blocking and runs in the background
            void (async () => {
                try {
                    await supabase.rpc('check_and_reset_daily_uploads_on_login', {
                        user_id_param: user.id,
                    });
                    log("Daily upload reset checked on upload screen focus");
                    
                    // Immediately fetch subscription data to update UI with latest upload count
                    // This ensures "Today: X/Y files" and "uploads remaining" update immediately
                    await fetchSubscriptionData();
                } catch (error: any) {
                    // Silently handle errors - this is non-critical
                    logError('Error checking daily reset on upload screen focus:', error);
                    // Even if reset fails, try to fetch data to update UI
                    try {
                        await fetchSubscriptionData();
                    } catch (fetchError) {
                        logError('Error fetching subscription data after reset error:', fetchError);
                    }
                }
            })();
        }, [user, fetchSubscriptionData])
    );

    //Function to check rate limits for pro users 
    const checkRateLimits = () => {
        if (shouldUseLocalLLM) return true;
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
            } else if (uploadsInLastDay >= 50) { //if the user uploaded more than 50 files in the day 
                message += `You've uploaded ${uploadsInLastDay} files in the last day. ${nextUploadTime}`;
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
                            // Clear Supabase session with timeout
                            const signOutPromise = supabase.auth.signOut();
                            const signOutTimeoutPromise = new Promise<never>((_, reject) => {
                                setTimeout(() => reject(new Error('Logout timeout. Please try again.')), 10000); // 10 seconds timeout
                            });
                            
                            const { error } = await Promise.race([signOutPromise, signOutTimeoutPromise]);
                            
                            if (error) {
                                Alert.alert("Error", error.message);
                                return;
                            }
                            
                            // Clear WebBrowser session to ensure Google auth session is cleared
                            try {
                                await WebBrowser.dismissBrowser();
                            } catch (dismissError) {
                                // Non-critical error, continue
                                logError("Error dismissing browser:", dismissError);
                            }
                            
                            log("Successfully logged out - sessions cleared");
                            // Navigation will be handled by AuthContext automatically
                        } catch (error: any) {
                            logError("Error during logout:", error);
                            const errorMessage = error.message || "Failed to logout properly";
                            Alert.alert("Error", errorMessage);
                        }
                    }
                }
            ]
        );
    }; 

    //function to open text input modal
    function openTextInput(){
        // Haptic feedback on button press
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        // Check upload limit for all users
        if (!shouldUseLocalLLM && !canUpload) {
            const limitText = isProUser ? 'unlimited' : `${uploadLimit} files per day`;
            Alert.alert(
                "Upload Limit Reached",
                `You've reached your daily upload limit (${limitText}). ${isProUser ? 'Please try again tomorrow.' : 'Upgrade to Pro plan for unlimited uploads!'}`,
                [
                    { text: "Cancel", style: "cancel" },
                    ...(isProUser ? [] : [{
                        text: "View Plans", 
                        onPress: () => navigation.navigate("Subscription", { source: 'upload' })
                    }])
                ]
            );
            return;
        }

        setTextInput('');
        setShowTextInputModal(true);
    }

    // Function to handle text input submission
    async function handleTextInput() {
        if (!textInput || textInput.trim().length === 0) {
            Alert.alert("Input Required", "Please enter some text to generate MCQs.");
            return;
        }

        if (textInput.trim().length < 50) {
            Alert.alert("Text Too Short", "Please enter at least 50 characters to generate meaningful MCQs.");
            return;
        }

        // Close modal
        setShowTextInputModal(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (shouldUseLocalLLM) {
            await runLocalGeneration(textInput.trim(), 'text');
            return;
        }

        try {
            log("🟢 Step 1: Starting text processing");
            setLoading(true);

            // Check upload limit
            if (!shouldUseLocalLLM && !canUpload) {
                const limitText = `${uploadLimit} files per day`;
                Alert.alert(
                    "Upload Limit Reached",
                    `You've reached your daily upload limit (${limitText}). ${isProUser ? 'Please try again tomorrow.' : 'Upgrade to Pro plan for unlimited uploads!'}`,
                    [
                        { text: "Cancel", style: "cancel" },
                        ...(isProUser ? [] : [{
                            text: "View Plans", 
                            onPress: () => navigation.navigate("Subscription", { source: 'upload' })
                        }])
                    ]
                );
                return;
            }

            log(`🟢 Step 2: Processing ${textInput.length} characters of text`);

            // Get current user
            log("🟢 Step 3: Authenticating user");
            const getUserPromise = supabase.auth.getUser();
            const getUserTimeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Authentication timeout. Please check your internet connection and try again.')), 15000);
            });
            
            const { data: { user }, error: getUserError } = await Promise.race([getUserPromise, getUserTimeoutPromise]);
            
            if (getUserError) {
                throw new Error(`Authentication error: ${getUserError.message}`);
            }
            
            if (!user) {
                throw new Error("User not authenticated. Please log in.");
            }

            // Get user session token
            log("🟢 Step 4: Getting session token");
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error("No active session. Please log in again.");
            }

            // Call Edge Function with text content
            log("🟢 Step 5: Calling Edge Function with text content");
            const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
            
            const timeoutPromise = new Promise<Response>((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout. Please check your internet connection and try again.')), 120000);
            });
            
            const fetchPromise = fetch(`${baseUrl}${function_url}`, {
                method: "POST", 
                headers: {
                    "Content-Type": "application/json", 
                    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ 
                    text_content: textInput.trim(),
                    content_type: "text"
                }),
            });
            
            const fnRes = await Promise.race([fetchPromise, timeoutPromise]); 

            if (!fnRes.ok){
                let errorMessage = "Something went wrong. Please try again.";
                try {
                    const errorData = await fnRes.json();
                    if (errorData.error) {
                        errorMessage = errorData.error;
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch (parseError) {
                    try {
                        const errorText = await fnRes.text();
                        if (errorText) {
                            errorMessage = errorText;
                        }
                    } catch (textError) {
                        // Use default message
                    }
                }
                
                if (fnRes.status === 429) {
                    setLoading(false);
                    Alert.alert(
                        "Upload Limit Reached",
                        errorMessage,
                        [
                            { text: "OK", style: "default" },
                            ...(isProUser ? [] : [{
                                text: "View Plans", 
                                onPress: () => navigation.navigate("Subscription", { source: 'upload' })
                            }])
                        ]
                    );
                    await fetchSubscriptionData();
                    return;
                }
                
                throw new Error(errorMessage);
            }

            // Parse response and get MCQs
            log("🟢 Step 6: Parsing MCQs");
            const result = await fnRes.json();
            
            if (!result.ok || !result.mcqs) {
                throw new Error("Failed to generate MCQs");
            }

            log(`🟢 Step 7: Generated ${result.mcqs.length} MCQs successfully`);

            if (!shouldUseLocalLLM) {
                await fetchSubscriptionData();
                addRecentUpload();
            }

            // Navigate to Feed
            log("🟢 Step 8: Navigating to Feed");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            navigation.navigate('Feed', { 
                mcqs: result.mcqs,
                generated_at: result.generated_at,
                count: result.count,
                cached: result.cached || false,
                rate_limit: result.rate_limit
            });
        } catch (e: any) {
            logError('Text processing error:', e);
            setLoading(false);
            
            let errorMessage = "Something went wrong. Please try again.";
            
            if (e.message) {
                if (e.message.includes('timeout') || e.message.includes('Request timeout')) {
                    errorMessage = "Request timed out. Please check your internet connection and try again.";
                } else if (e.message.includes('Network') || e.message.includes('Failed to fetch')) {
                    errorMessage = "Network error. Please check your internet connection and try again.";
                } else {
                    errorMessage = getUserFriendlyError(e);
                }
            } else {
                errorMessage = getUserFriendlyError(e);
            }
            
            Alert.alert("Processing Error", errorMessage, [
                { text: "OK", style: "default" }
            ]);
        } finally {
            setLoading(false);
        }
    }

    //function to load images 
    async function loadImage(){
        // Haptic feedback on button press
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        // Check upload limit for all users
        if (!shouldUseLocalLLM && !canUpload) {
            const limitText = isProUser ? 'unlimited' : `${uploadLimit} files per day`;
            Alert.alert(
                "Upload Limit Reached",
                `You've reached your daily upload limit (${limitText}). ${isProUser ? 'Please try again tomorrow.' : 'Upgrade to Pro plan for unlimited uploads!'}`,
                [
                    { text: "Cancel", style: "cancel" },
                    ...(isProUser ? [] : [{
                        text: "View Plans", 
                        onPress: () => navigation.navigate("Subscription", { source: 'upload' })
                    }])
                ]
            );
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
        
        const uri = result.assets[0].uri;
        
        // Extract text from image using OCR
        await handleImageOCR(uri); 
    }

    // Function to extract text from image using OCR
    async function handleImageOCR(uri: string) {
        try {
            log("🟢 Step 1: Starting OCR process");
            setLoading(true);

            // 0. Check upload limit BEFORE processing (immediate check)
            if (!shouldUseLocalLLM && !canUpload) {
                const limitText = `${uploadLimit} files per day`;
                Alert.alert(
                    "Upload Limit Reached",
                    `You've reached your daily upload limit (${limitText}). ${isProUser ? 'Please try again tomorrow.' : 'Upgrade to Pro plan for unlimited uploads!'}`,
                    [
                        { text: "Cancel", style: "cancel" },
                        ...(isProUser ? [] : [{
                            text: "View Plans", 
                            onPress: () => navigation.navigate("Subscription", { source: 'upload' })
                        }])
                    ]
                );
                return;
            }

            // 1. Perform OCR on the image
            log("🟢 Step 2: Extracting text from image using ML Kit");
            const recognizedTextArray = await TextRecognition.recognize(uri);
            
            // Join array of text blocks into a single string
            const recognizedText = Array.isArray(recognizedTextArray) 
                ? recognizedTextArray.join('\n') 
                : recognizedTextArray;
            
            if (!recognizedText || recognizedText.trim().length === 0) {
                throw new Error("No text found in the image. Please upload an image with visible text.");
            }

            log(`🟢 Step 3: Extracted ${recognizedText.length} characters of text`);

            if (shouldUseLocalLLM) {
                await runLocalGeneration(recognizedText, 'image');
                return;
            }

            // 2. Get current user
            log("🟢 Step 4: Authenticating user");
            const getUserPromise = supabase.auth.getUser();
            const getUserTimeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Authentication timeout. Please check your internet connection and try again.')), 15000);
            });
            
            const { data: { user }, error: getUserError } = await Promise.race([getUserPromise, getUserTimeoutPromise]);
            
            if (getUserError) {
                throw new Error(`Authentication error: ${getUserError.message}`);
            }
            
            if (!user) {
                throw new Error("User not authenticated. Please log in.");
            }

            // 3. Get user session token
            log("🟢 Step 5: Getting session token");
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error("No active session. Please log in again.");
            }

            // 4. Call Edge Function with extracted text only
            log("🟢 Step 6: Calling Edge Function with extracted text");
            const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
            
            const timeoutPromise = new Promise<Response>((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout. Please check your internet connection and try again.')), 120000);
            });
            
            const fetchPromise = fetch(`${baseUrl}${function_url}`, {
                method: "POST", 
                headers: {
                    "Content-Type": "application/json", 
                    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ 
                    text_content: recognizedText,  // Send extracted text only
                    content_type: "text"
                }),
            });
            
            const fnRes = await Promise.race([fetchPromise, timeoutPromise]); 

            if (!fnRes.ok){
                let errorMessage = "Something went wrong. Please try again.";
                try {
                    const errorData = await fnRes.json();
                    if (errorData.error) {
                        errorMessage = errorData.error;
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch (parseError) {
                    try {
                        const errorText = await fnRes.text();
                        if (errorText) {
                            errorMessage = errorText;
                        }
                    } catch (textError) {
                        // Use default message
                    }
                }
                
                if (fnRes.status === 429) {
                    setLoading(false);
                    Alert.alert(
                        "Upload Limit Reached",
                        errorMessage,
                        [
                            { text: "OK", style: "default" },
                            ...(isProUser ? [] : [{
                                text: "View Plans", 
                                onPress: () => navigation.navigate("Subscription", { source: 'upload' })
                            }])
                        ]
                    );
                    await fetchSubscriptionData();
                    return;
                }
                
                throw new Error(errorMessage);
            }

            // 5. Parse response and get MCQs
            log("🟢 Step 7: Parsing MCQs");
            const result = await fnRes.json();
            
            if (!result.ok || !result.mcqs) {
                throw new Error("Failed to generate MCQs");
            }

            log(`🟢 Step 8: Generated ${result.mcqs.length} MCQs successfully`);

            if (!shouldUseLocalLLM) {
                await fetchSubscriptionData();
                addRecentUpload();
            }

            // 7. Navigate to Feed
            log("🟢 Step 9: Navigating to Feed");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            navigation.navigate('Feed', { 
                mcqs: result.mcqs,
                generated_at: result.generated_at,
                count: result.count,
                cached: result.cached || false,
                rate_limit: result.rate_limit
            });
        } catch (e: any) {
            logError('OCR error:', e);
            setLoading(false);
            
            let errorMessage = "Something went wrong. Please try again.";
            
            if (e.message) {
                if (e.message.includes('timeout') || e.message.includes('Request timeout')) {
                    errorMessage = "Request timed out. Please check your internet connection and try again.";
                } else if (e.message.includes('Network') || e.message.includes('Failed to fetch')) {
                    errorMessage = "Network error. Please check your internet connection and try again.";
                } else if (e.message.includes('No text found')) {
                    errorMessage = e.message;
                } else {
                    errorMessage = getUserFriendlyError(e);
                }
            } else {
                errorMessage = getUserFriendlyError(e);
            }
            
            Alert.alert("Upload Error", errorMessage, [
                { text: "OK", style: "default" }
            ]);
        } finally {
            setLoading(false);
        }
    }


    async function handleUpload(uri: string, mime: string){
        try {
            log("🟢 Step 1: Starting upload process");
            
            // 0. Check upload limit BEFORE processing file (immediate check)
            if (!shouldUseLocalLLM && !canUpload) {
                const limitText = `${uploadLimit} files per day`;
                Alert.alert(
                    "Upload Limit Reached",
                    `You've reached your daily upload limit (${limitText}). ${isProUser ? 'Please try again tomorrow.' : 'Upgrade to Pro plan for unlimited uploads!'}`,
                    [
                        { text: "Cancel", style: "cancel" },
                        ...(isProUser ? [] : [{
                            text: "View Plans", 
                            onPress: () => navigation.navigate("Subscription", { source: 'upload' })
                        }])
                    ]
                );
                return;
            }
            
            setLoading(true);
                
            // 1. Validate MIME type
            const ALLOWED_MIME_TYPES = [
                'image/jpeg',
                'image/jpg',
                'image/png',
                'image/gif',
                'image/webp'
            ];
            
            log("🟢 Step 2: Validating file type");
            if (!ALLOWED_MIME_TYPES.includes(mime)) {
                throw new Error("Invalid file type. Please upload an image file (JPEG, PNG, GIF, WebP).");
            }

            // 2. Get current user with timeout
            log("🟢 Step 3: Authenticating user");
            const getUserPromise = supabase.auth.getUser();
            const getUserTimeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Authentication timeout. Please check your internet connection and try again.')), 15000); // 15 seconds timeout
            });
            
            const { data: { user }, error: getUserError } = await Promise.race([getUserPromise, getUserTimeoutPromise]);
            
            if (getUserError) {
                throw new Error(`Authentication error: ${getUserError.message}`);
            }
            
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
            
            // Add timeout to prevent infinite loading
            const timeoutPromise = new Promise<Response>((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout. Please check your internet connection and try again.')), 120000); // 2 minutes timeout
            });
            
            const fetchPromise = fetch(`${baseUrl}${function_url}`, {
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
            
            const fnRes = await Promise.race([fetchPromise, timeoutPromise]); 

            if (!fnRes.ok){
                // Try to parse JSON error response first
                let errorMessage = "Something went wrong. Please try again.";
                try {
                    const errorData = await fnRes.json();
                    if (errorData.error) {
                        errorMessage = errorData.error;
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch (parseError) {
                    // If JSON parsing fails, try text
                    try {
                        const errorText = await fnRes.text();
                        if (errorText) {
                            errorMessage = errorText;
                        }
                    } catch (textError) {
                        // Use default message
                    }
                }
                
                // Handle rate limit errors (429) immediately
                if (fnRes.status === 429) {
                    setLoading(false);
                    Alert.alert(
                        "Upload Limit Reached",
                        errorMessage,
                        [
                            { text: "OK", style: "default" },
                            ...(isProUser ? [] : [{
                                text: "View Plans", 
                                onPress: () => navigation.navigate("Subscription", { source: 'upload' })
                            }])
                        ]
                    );
                    // Refresh subscription data to update UI
                    await fetchSubscriptionData();
                    return;
                }
                
                throw new Error(errorMessage);
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

            // 9. Refresh subscription data (backend already incremented the count)
            // Note: Backend increments the count, so we just refresh the frontend state
            // Use fetchSubscriptionData directly to avoid loading state conflicts
            await fetchSubscriptionData();
            // Add to recent uploads for Pro user rate limiting
            addRecentUpload();

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
            
            // Ensure loading is stopped immediately
            setLoading(false);
            
            // Use user-friendly error message
            let errorMessage = "Something went wrong. Please try again.";
            
            // Handle specific error types
            if (e.message) {
                if (e.message.includes('timeout') || e.message.includes('Request timeout')) {
                    errorMessage = "Request timed out. Please check your internet connection and try again.";
                } else if (e.message.includes('Network') || e.message.includes('Failed to fetch')) {
                    errorMessage = "Network error. Please check your internet connection and try again.";
                } else if (e.message.includes('JSON')) {
                    errorMessage = "Invalid response from server. Please try again.";
                } else {
                    errorMessage = getUserFriendlyError(e);
                }
            } else {
                errorMessage = getUserFriendlyError(e);
            }
            
            // Show error alert immediately
            Alert.alert("Upload Error", errorMessage, [
                { text: "OK", style: "default" }
            ]);
        } finally {
            // Ensure loading is always stopped
            setLoading(false);
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
                    
                    {/* Upload count badge for free users only */}
                    {!isProUser && (
                        <View style={[styles.uploadCountBadge, { 
                            backgroundColor: `${colors.secondary}20`,
                            borderColor: `${colors.secondary}40`,
                        }]}>
                            <Text style={[styles.uploadCountText, { color: colors.secondary }]}>
                                Today: {uploadCount}/{uploadLimit} files
                            </Text>
                        </View>
                    )}
                    
                    {/* Pro badge - only for Pro users */}
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
                        style={[styles.card, styles.textCard, {
                            backgroundColor: colors.card,
                            borderColor: `${colors.primary}33`,
                        }]}
                        onPress={openTextInput}
                        activeOpacity={0.95}
                        disabled={loading}
                    >
                        <LinearGradient
                            colors={[colors.primary, colors.primary + 'CC']}
                            style={styles.cardIcon}
                        >
                            <Ionicons name="text" size={36} color="white" />
                        </LinearGradient>
                        <View style={styles.cardContent}>
                            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Text Input</Text>
                            <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>Enter your study material ✍️</Text>
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

            {/* Text Input Modal */}
            <Modal
                visible={showTextInputModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowTextInputModal(false)}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={[styles.textInputModal, { backgroundColor: colors.card }]}>
                        <View style={styles.textInputHeader}>
                            <Text style={[styles.textInputTitle, { color: colors.foreground }]}>Enter Your Study Material</Text>
                            <TouchableOpacity onPress={() => setShowTextInputModal(false)}>
                                <Ionicons name="close" size={28} color={colors.mutedForeground} />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView style={styles.textInputScrollView}>
                            <TextInput
                                style={[styles.textInputField, { 
                                    color: colors.foreground,
                                    borderColor: colors.border,
                                    backgroundColor: colors.background
                                }]}
                                multiline
                                placeholder="Paste or type your study material here (max 4,000 characters)..."
                                placeholderTextColor={colors.mutedForeground}
                                value={textInput}
                                onChangeText={(text) => setTextInput(text.slice(0, MAX_TEXT_LENGTH))}
                                maxLength={MAX_TEXT_LENGTH}
                                autoFocus
                            />
                        </ScrollView>
                        
                        <View style={styles.textInputFooter}>
                            <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
                                {textInput.length}/{MAX_TEXT_LENGTH} characters
                            </Text>
                            
                            <TouchableOpacity
                                style={styles.submitButton}
                                onPress={handleTextInput}
                                disabled={textInput.trim().length < 50}
                            >
                                <LinearGradient
                                    colors={textInput.trim().length >= 50 ? [colors.primary, colors.accent] : [colors.mutedForeground, colors.mutedForeground]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.submitButtonGradient}
                                >
                                    <Ionicons name="checkmark" size={24} color="white" />
                                    <Text style={styles.submitButtonText}>Generate MCQs</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

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
                    style={styles.cartButton}
                    onPress={() => {
                        // Navigate immediately without waiting for any processing
                        navigation.navigate("Subscription", { source: 'upload' });
                    }}
                    activeOpacity={0.9}
                    disabled={loading}
                >
                    <LinearGradient
                        colors={[colors.secondary, colors.gold!]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.cartButtonGradient, loading && { opacity: 0.5 }]}
                    >
                        <Ionicons name="cart" size={24} color="white" />
                        <Text style={styles.cartButtonText}>
                            {isProUser ? 'Manage Plan' : 'Upgrade to Pro'}
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
    textCard: {
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
    textInputModal: {
        flex: 1,
        marginTop: 100,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
    },
    textInputHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    textInputTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    textInputScrollView: {
        flex: 1,
        padding: 20,
    },
    textInputField: {
        minHeight: 300,
        fontSize: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        textAlignVertical: 'top',
    },
    textInputFooter: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)',
        gap: 16,
    },
    charCount: {
        fontSize: 14,
        textAlign: 'right',
    },
    submitButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    submitButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        gap: 8,
    },
    submitButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
