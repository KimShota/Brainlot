import { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    TextInput, 
    TouchableOpacity, 
    StyleSheet, 
    SafeAreaView, 
    StatusBar,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Modal,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const colors = {
    background: '#f8fdf9',
    foreground: '#1a1f2e',
    primary: '#58cc02',
    secondary: '#ff9600',
    accent: '#1cb0f6',
    muted: '#f0f9f1',
    mutedForeground: '#6b7280',
    card: '#ffffff',
    border: '#e8f5e8',
    destructive: '#dc2626',
};

export default function AuthScreen({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Check for password recovery event
    useEffect(() => {
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsPasswordRecovery(true);
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    // Email validation function
    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    //Function to validate the password to be at least 6 characters
    const validatePassword = (password: string): string | null => {
        if (password.length < 6) {
            return 'Password must be at least 6 characters';
        }
        return null;
    };

    //resend the confirmation email using Edge Function
    const resendConfirmationEmail = async (email: string) => {
        try {
            // Call the resend-confirmation Edge Function without authentication
            const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/resend-confirmation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, 
                    'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}`,
                },
                body: JSON.stringify({ email }),
            });

            const result = await response.json();

            if (!result.ok) {
                throw new Error(result.error || 'Failed to resend confirmation email');
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                'Verification Email Sent', 
                'A new confirmation email has been sent to your email address. Please open it and let the page load completely.'
            ); 
        } catch (error: any){
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.message);
        }
    }; 

    // OAuth: Continue with Google
    const handleGoogleSignIn = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setLoading(true);
        try {
            const redirectTo = Linking.createURL('/');
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                    skipBrowserRedirect: false,
                },
            });
            
            if (error) throw error;
            
            if (data?.url) {
                const result = await WebBrowser.openAuthSessionAsync(
                    data.url,
                    redirectTo
                );
                
                if (result.type === 'success') {
                    const url = result.url;
                    const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1]);
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');
                    
                    if (accessToken && refreshToken) {
                        await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                    }
                }
            }
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    // OAuth: Continue with Apple
    const handleAppleSignIn = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setLoading(true);
        try {
            const redirectTo = Linking.createURL('/');
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'apple',
                options: {
                    redirectTo,
                    skipBrowserRedirect: false,
                },
            });
            
            if (error) throw error;
            
            if (data?.url) {
                const result = await WebBrowser.openAuthSessionAsync(
                    data.url,
                    redirectTo
                );
                
                if (result.type === 'success') {
                    const url = result.url;
                    const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1]);
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');
                    
                    if (accessToken && refreshToken) {
                        await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                    }
                }
            }
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    // Handle password reset request
    const handlePasswordReset = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        if (!resetEmail) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', 'Please enter your email address');
            return;
        }

        if (!validateEmail(resetEmail)) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', 'Please enter a valid email address');
            return;
        }

        setResetLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: Linking.createURL('/'),
            });

            if (error) throw error;

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                'Reset Email Sent',
                'Check your email for a password reset link. Please open the link and let the page load completely.',
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            setShowForgotPasswordModal(false);
                            setResetEmail('');
                        }
                    }
                ]
            );
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.message);
        } finally {
            setResetLoading(false);
        }
    };

    // Handle setting new password after password reset
    const handleSetNewPassword = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (!newPassword || !confirmPassword) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', passwordError);
            return;
        }

        if (newPassword !== confirmPassword) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                'Password Reset Successful',
                'Your password has been reset successfully. You can now sign in with your new password.',
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            setIsPasswordRecovery(false);
                            setNewPassword('');
                            setConfirmPassword('');
                            // Sign out to force re-login with new password
                            supabase.auth.signOut();
                        }
                    }
                ]
            );
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    //function to handle authentication 
    const handleAuth = async () => {
        // Haptic feedback on button press
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        if (!email || !password) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (!validateEmail(email)) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', 'Please enter a valid email address');
            return;
        }

        const passwordError = validatePassword(password);
        if (isSignUp && passwordError) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', passwordError);
            return;
        }

        setLoading(true);
        try {
            if (isSignUp) { //if user is sigining up
                const { error } = await supabase.auth.signUp({ //creates the user id and JWT token
                    email,
                    password,
                });
                if (error) throw error;
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Success', 'Check your email for verification link');
            } else { //if user has already signed up
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                // Navigation will be handled by AuthContext
            }
        } catch (error: any) { //handle any errors
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            if (error.message?.toLowerCase().includes('email not confirmed')){
                Alert.alert(
                    'Email Not Verified', 
                    'Your email has not been verified yet. Would you like to resend the verification email?', 
                    [
                        { text: 'Cancel', style: 'cancel'}, 
                        { text: 'Resend', onPress: () => resendConfirmationEmail(email) }, 
                    ]
                ); 
            } else {
                Alert.alert('Error', error.message);
            }
        } finally { //set loading to false
            setLoading(false);
        }
    };

    // If password recovery mode, show password reset form
    if (isPasswordRecovery) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.content}>
                            {/* Header */}
                            <View style={styles.header}>
                                <LinearGradient
                                    colors={[colors.primary, colors.accent]}
                                    style={styles.iconContainer}
                                >
                                    <Ionicons name="lock-closed" size={48} color="white" />
                                </LinearGradient>
                                <Text style={styles.title}>Set New Password</Text>
                                <Text style={styles.subtitle}>
                                    Create a new password for your account
                                </Text>
                            </View>

                            {/* Form */}
                            <View style={styles.form}>
                                <View style={styles.inputContainer}>
                                    <Ionicons name="lock-closed" size={20} color={colors.mutedForeground} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="New Password"
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                        secureTextEntry={!showNewPassword}
                                        autoCapitalize="none"
                                    />
                                    <TouchableOpacity
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            setShowNewPassword(!showNewPassword);
                                        }}
                                        style={styles.eyeButton}
                                    >
                                        <Ionicons
                                            name={showNewPassword ? "eye-off" : "eye"}
                                            size={20}
                                            color={colors.mutedForeground}
                                        />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.inputContainer}>
                                    <Ionicons name="lock-closed" size={20} color={colors.mutedForeground} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Confirm New Password"
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry={!showConfirmPassword}
                                        autoCapitalize="none"
                                    />
                                    <TouchableOpacity
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            setShowConfirmPassword(!showConfirmPassword);
                                        }}
                                        style={styles.eyeButton}
                                    >
                                        <Ionicons
                                            name={showConfirmPassword ? "eye-off" : "eye"}
                                            size={20}
                                            color={colors.mutedForeground}
                                        />
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    style={styles.authButton}
                                    onPress={handleSetNewPassword}
                                    disabled={loading}
                                >
                                    <LinearGradient
                                        colors={[colors.primary, colors.accent]}
                                        style={styles.authButtonGradient}
                                    >
                                        {loading ? (
                                            <ActivityIndicator color="white" />
                                        ) : (
                                            <Text style={styles.authButtonText}>
                                                Reset Password
                                            </Text>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
            
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.content}>
                        {/* Header */}
                        <View style={styles.header}>
                            <LinearGradient
                                colors={[colors.primary, colors.accent]}
                                style={styles.iconContainer}
                            >
                                <Ionicons name="school" size={48} color="white" />
                            </LinearGradient>
                            <Text style={styles.title}>Edu-Shorts</Text>
                            <Text style={styles.subtitle}>
                                {isSignUp ? 'Create your account' : 'Welcome back!'}
                            </Text>
                        </View>

                        {/* Form */}
                        <View style={styles.form}>
                            <View style={styles.inputContainer}>
                                <Ionicons name="mail" size={20} color={colors.mutedForeground} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Email"
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            <View style={styles.inputContainer}>
                                <Ionicons name="lock-closed" size={20} color={colors.mutedForeground} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Password"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                />
                                <TouchableOpacity
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setShowPassword(!showPassword);
                                    }}
                                    style={styles.eyeButton}
                                >
                                    <Ionicons 
                                        name={showPassword ? "eye-off" : "eye"} 
                                        size={20} 
                                        color={colors.mutedForeground} 
                                    />
                                </TouchableOpacity>
                            </View>

                            {/* Forgot Password Link - Only show on Sign In */}
                            {!isSignUp && (
                                <TouchableOpacity
                                    style={styles.forgotPasswordButton}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setResetEmail(email);
                                        setShowForgotPasswordModal(true);
                                    }}
                                >
                                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={styles.authButton}
                                onPress={handleAuth}
                                disabled={loading}
                            >
                                <LinearGradient
                                    colors={[colors.primary, colors.accent]}
                                    style={styles.authButtonGradient}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text style={styles.authButtonText}>
                                            {isSignUp ? 'Sign Up' : 'Sign In'}
                                        </Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Separator */}
                            <View style={styles.separatorRow}>
                                <View style={styles.separatorLine} />
                                <Text style={styles.separatorText}>Or continue with</Text>
                                <View style={styles.separatorLine} />
                            </View>

                            {/* OAuth buttons */}
                            <View style={styles.oauthRow}>
                                <TouchableOpacity
                                    style={[styles.oauthButton, styles.oauthGoogle]}
                                    onPress={handleGoogleSignIn}
                                    disabled={loading}
                                >
                                    <Ionicons name="logo-google" size={18} color="#ffffff" />
                                    <Text style={styles.oauthButtonText}>Google</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.oauthButton, styles.oauthApple]}
                                    onPress={handleAppleSignIn}
                                    disabled={loading}
                                >
                                    <Ionicons name="logo-apple" size={20} color="#000000" />
                                    <Text style={[styles.oauthButtonText, { color: '#000000' }]}>Apple</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={styles.switchButton}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setIsSignUp(!isSignUp);
                                }}
                            >
                                <Text style={styles.switchText}>
                                    {isSignUp 
                                        ? 'Already have an account? Sign In' 
                                        : "Don't have an account? Sign Up"
                                    }
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Password Reset Modal */}
            <Modal
                visible={showForgotPasswordModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowForgotPasswordModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.modalKeyboardView}
                    >
                        <View style={styles.modalContent}>
                            {/* Modal Header */}
                            <View style={styles.modalHeader}>
                                <View style={styles.modalIconContainer}>
                                    <Ionicons name="key" size={32} color={colors.primary} />
                                </View>
                                <Text style={styles.modalTitle}>Reset Password</Text>
                                <Text style={styles.modalSubtitle}>
                                    Enter your email address and we'll send you a link to reset your password.
                                </Text>
                            </View>

                            {/* Email Input */}
                            <View style={styles.modalInputContainer}>
                                <Ionicons name="mail" size={20} color={colors.mutedForeground} />
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Email"
                                    value={resetEmail}
                                    onChangeText={setResetEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoFocus={true}
                                />
                            </View>

                            {/* Buttons */}
                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={styles.modalResetButton}
                                    onPress={handlePasswordReset}
                                    disabled={resetLoading}
                                >
                                    <LinearGradient
                                        colors={[colors.primary, colors.accent]}
                                        style={styles.modalResetButtonGradient}
                                    >
                                        {resetLoading ? (
                                            <ActivityIndicator color="white" />
                                        ) : (
                                            <Text style={styles.modalResetButtonText}>Send Reset Link</Text>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.modalCancelButton}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setShowForgotPasswordModal(false);
                                        setResetEmail('');
                                    }}
                                    disabled={resetLoading}
                                >
                                    <Text style={styles.modalCancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
        minHeight: 600,
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
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
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: colors.foreground,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: colors.mutedForeground,
        fontWeight: '500',
    },
    form: {
        gap: 20,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderWidth: 2,
        borderColor: colors.border,
        gap: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: colors.foreground,
    },
    eyeButton: {
        padding: 4,
    },
    authButton: {
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 8,
    },
    authButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    authButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
    },
    separatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
    },
    separatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border,
    },
    separatorText: {
        fontSize: 12,
        color: colors.mutedForeground,
        fontWeight: '600',
    },
    oauthRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    oauthButton: {
        flex: 1,
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        borderWidth: 2,
    },
    oauthGoogle: {
        backgroundColor: '#4285F4',
        borderColor: '#3b78e7',
    },
    oauthApple: {
        backgroundColor: '#ffffff',
        borderColor: colors.border,
    },
    oauthButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
    switchButton: {
        alignItems: 'center',
        marginTop: 16,
    },
    switchText: {
        fontSize: 14,
        color: colors.accent,
        fontWeight: '600',
    },
    forgotPasswordButton: {
        alignSelf: 'flex-end',
        marginTop: 8,
        marginBottom: 4,
    },
    forgotPasswordText: {
        fontSize: 14,
        color: colors.accent,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalKeyboardView: {
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    modalIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.muted,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.foreground,
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        color: colors.mutedForeground,
        textAlign: 'center',
        lineHeight: 20,
    },
    modalInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderWidth: 2,
        borderColor: colors.border,
        gap: 12,
        marginBottom: 20,
    },
    modalInput: {
        flex: 1,
        fontSize: 16,
        color: colors.foreground,
    },
    modalButtons: {
        gap: 12,
    },
    modalResetButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    modalResetButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    modalResetButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
    },
    modalCancelButton: {
        paddingVertical: 16,
        alignItems: 'center',
        backgroundColor: colors.muted,
        borderRadius: 16,
    },
    modalCancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.foreground,
    },
});
