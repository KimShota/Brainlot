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
            console.log('Attempting to resend confirmation email to:', email);
            console.log('Using Edge Function URL:', `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/resend-confirmation`);
            
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

            console.log('Edge Function response status:', response.status);
            const result = await response.json();
            console.log('Edge Function response:', result);

            if (!response.ok || !result.ok) {
                throw new Error(result.error || 'Failed to resend confirmation email');
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                'Verification Email Sent', 
                'A new confirmation email has been sent to your email address. Please check your inbox and spam folder.'
            ); 
        } catch (error: any){
            console.error('Resend confirmation email error:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.message || 'Failed to resend confirmation email');
        }
    }; 

    //async function to handle google sign in 
    const handleGoogleSignIn = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setLoading(true);
        try {
            const redirectTo = Linking.createURL('/');
            //return the URL of the login page of Google OAuth
            console.log("Redirect URL is:", redirectTo);
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo, //deep link to stay users on the app after they have successfully logged in 
                    skipBrowserRedirect: false, //open the browser automatically for user to sign in
                },
            });
            
            if (error) throw error; //throw error if there is an error
            
            //If the URL of the login page is returned,
            if (data?.url) {

                //open the in-app browser to sign in with google and close it automatically after they signed in
                const result = await WebBrowser.openAuthSessionAsync(
                    data.url, 
                    redirectTo //deep link to stay users on the app after they have successfully logged in 
                );
                
                //If the browser is closed due to the redirect of the deep link, 
                if (result.type === 'success') {
                    const url = result.url; //deep link URL to stay inside the app 
                    //extract the access token and refresh token from the deep link URL 
                    const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1]);
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');
                    
                    //If they both exist, 
                    if (accessToken && refreshToken) {
                        //store them in memory securely, mark the users as authenticated, and then use them to make authenticated requests to the backend
                        await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        
                        // Navigation will be handled by AuthContext automatically
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
            const redirectTo = Linking.createURL('/'); //this probably contains confirmation URL
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
                        
                        // Navigation will be handled by AuthContext automatically
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
                console.log('Attempting to sign up user with email:', email);
                console.log('Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
                console.log('Supabase Anon Key exists:', !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
                
                const { data, error } = await supabase.auth.signUp({ //creates the user id and JWT token
                    email,
                    password,
                    options: {
                        emailRedirectTo: Linking.createURL('/'), // Deep link for email confirmation
                    }
                });
                
                if (error) {
                    console.error('Sign up error:', error);
                    throw error;
                }
                
                console.log('Sign up successful:', data);
                console.log('User created:', data.user);
                console.log('Session created:', data.session);
                console.log('Email confirmation sent:', data.user?.email_confirmed_at === null);
                
                // Check if email confirmation is required
                if (data.user && !data.session) {
                    // Email confirmation is required
                    console.log('Email confirmation required - user needs to verify email');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert(
                        'Check Your Email', 
                        'Please check your email and click the verification link to complete your registration.',
                        [
                            { text: 'OK', style: 'default' },
                            { text: 'Resend Email', onPress: () => resendConfirmationEmail(email) }
                        ]
                    );
                } else if (data.session) {
                    // User is immediately signed in (email confirmation disabled)
                    console.log('User immediately signed in - email confirmation disabled');
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert('Success', 'Account created successfully!');
                    // Navigation will be handled by AuthContext
                } else {
                    console.log('Unexpected signup result:', data);
                    Alert.alert('Success', 'Account created! Please check your email for verification.');
                }
            } else { //if user has already signed up
                console.log('Attempting to sign in user with email:', email);
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                
                if (error) {
                    console.error('Sign in error:', error);
                    throw error;
                }
                
                console.log('Sign in successful:', data);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                // Navigation will be handled by AuthContext
            }
        } catch (error: any) { //handle any errors
            console.error('Authentication error:', error);
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
                Alert.alert('Error', error.message || 'An error occurred during authentication');
            }
        } finally { //set loading to false
            setLoading(false);
        }
    };

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
});
