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
    Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { log, error as logError } from '../lib/logger';
import { getUserFriendlyError } from '../lib/errorUtils';
import { useTheme } from '../contexts/ThemeContext';

WebBrowser.maybeCompleteAuthSession();


//function to handle the authentication screen 
export default function AuthScreen({ navigation }: any) {
    const { colors } = useTheme();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    //function to validate email 
    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    //Use arrow function to validate the password
    const validatePassword = (password: string): string | null => {
        if (password.length < 6) {
            return 'Password must be at least 6 characters';
        }
        return null;
    };

    //resend the confirmation email by sending HTTP request to the edge function
    const resendConfirmationEmail = async (email: string) => {
        try {
            log('Attempting to resend confirmation email to:', email);
            log('Using Edge Function URL:', `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/resend-confirmation`);
            
            //Send HTTP request with POST method to edge function with json string email 
            const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/resend-confirmation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, 
                    'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}`,
                },
                body: JSON.stringify({ email }),
            });

            log('Edge Function response status:', response.status);
            const result = await response.json(); //take the http response body and convert it into Javascript object
            log('Edge Function response:', result);

            if (!response.ok || !result.ok) {
                throw new Error(result.error || 'Failed to resend confirmation email');
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
                'Verification Email Sent', 
                'A new confirmation email has been sent to your email address. Please check your inbox and spam folder.'
            ); 
        } catch (error: any){
            logError('Resend confirmation email error:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.message || 'Failed to resend confirmation email');
        }
    }; 

    //async function to handle google sign in 
    const handleGoogleSignIn = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setLoading(true);
        try {
            // Use explicit scheme for better reliability on physical devices
            const redirectTo = 'brainlot://';
            log("Redirect URL is:", redirectTo); //return the URL of the login page of Google OAuth
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo, //deep link to the app 
                    skipBrowserRedirect: false, //open the browser automatically
                },
            });
            
            if (error) throw error; 
            
            //If the URL of the login page is returned,
            if (data?.url) {

                //open the in-app browser to sign in with google and close it automatically after they signed in
                const result = await WebBrowser.openAuthSessionAsync(
                    data.url, 
                    redirectTo //deep link to the app
                );
                
                log('WebBrowser result:', result.type);
                
                //If the browser is closed due to the redirect of the deep link, 
                if (result.type === 'success' && 'url' in result) {
                    const url = result.url; //deep link URL to stay inside the app 
                    log('Processing redirect URL:', url);
                    //extract the access token and refresh token from the deep link URL 
                    // Try fragment first (OAuth 2.0 standard), then query params
                    const hashIndex = url.indexOf('#');
                    const queryIndex = url.indexOf('?');
                    
                    let params: URLSearchParams;
                    if (hashIndex !== -1) {
                        params = new URLSearchParams(url.substring(hashIndex + 1));
                    } else if (queryIndex !== -1) {
                        params = new URLSearchParams(url.substring(queryIndex + 1));
                    } else {
                        // Try to parse entire URL if no separator found
                        params = new URLSearchParams(url);
                    }
                    
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');
                    
                    log('Extracted tokens:', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });
                    
                    //If they both exist, 
                    if (accessToken && refreshToken) {
                        //store them in memory securely, mark the users as authenticated, and then use them to make authenticated requests to the backend
                        await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        
                        // Navigation will be handled by AuthContext automatically
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } else {
                        // If tokens are not in URL, check if session was created automatically
                        log('Tokens not found in URL, checking session...');
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session) {
                            logError('No session found after OAuth redirect');
                            Alert.alert('Sign In Error', 'Authentication may have failed. Please try again.');
                        }
                    }
                } else if (result.type === 'cancel') {
                    log('User cancelled authentication');
                } else {
                    log('Unexpected result type:', result.type);
                }
            }
        } catch (error: any) {
            logError('Google sign-in error:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.message || 'Failed to sign in with Google');
        } finally {
            setLoading(false);
        }
    };

    // OAuth: Continue with Apple
    const handleAppleSignIn = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setLoading(true);
        try {
            // Use explicit scheme for better reliability on physical devices
            const redirectTo = 'brainlot://';
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
                
                log('Apple WebBrowser result:', result.type);
                
                if (result.type === 'success' && 'url' in result) {
                    const url = result.url;
                    // Try fragment first (OAuth 2.0 standard), then query params
                    const hashIndex = url.indexOf('#');
                    const queryIndex = url.indexOf('?');
                    
                    let params: URLSearchParams;
                    if (hashIndex !== -1) {
                        params = new URLSearchParams(url.substring(hashIndex + 1));
                    } else if (queryIndex !== -1) {
                        params = new URLSearchParams(url.substring(queryIndex + 1));
                    } else {
                        params = new URLSearchParams(url);
                    }
                    
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');
                    
                    log('Extracted tokens:', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });
                    
                    if (accessToken && refreshToken) {
                        await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        
                        // Navigation will be handled by AuthContext automatically
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } else {
                        // If tokens are not in URL, check if session was created automatically
                        log('Tokens not found in URL, checking session...');
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session) {
                            logError('No session found after OAuth redirect');
                            Alert.alert('Sign In Error', 'Authentication may have failed. Please try again.');
                        }
                    }
                } else if (result.type === 'cancel') {
                    log('User cancelled authentication');
                }
            }
        } catch (error: any) {
            logError('Apple sign-in error:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.message || 'Failed to sign in with Apple');
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
                log('Attempting to sign up user');
                
                const { data, error } = await supabase.auth.signUp({ //creates the user id and JWT token
                    email,
                    password,
                    options: {
                        emailRedirectTo: Linking.createURL('/'), // Deep link for email confirmation
                    }
                });
                
                if (error) {
                    logError('Sign up error:', error);
                    throw error;
                }
                
                log('Sign up successful:', data);
                log('User created:', data.user);
                log('Session created:', data.session);
                log('Email confirmation sent:', data.user?.email_confirmed_at === null);
                
                // Check if email confirmation is required
                if (data.user && !data.session) {
                    // Email confirmation is required
                    log('Email confirmation required - user needs to verify email');
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
                    log('User immediately signed in - email confirmation disabled');
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert('Success', 'Account created successfully!');
                    // Navigation will be handled by AuthContext
                } else {
                    log('Unexpected signup result:', data);
                    Alert.alert('Success', 'Account created! Please check your email for verification.');
                }
            } else { //if user has already signed up
                log('Attempting to sign in user with email:', email);
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                
                if (error) {
                    logError('Sign in error:', error);
                    throw error;
                }
                
                log('Sign in successful:', data);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                // Navigation will be handled by AuthContext
            }
        } catch (error: any) { //handle any errors
            logError('Authentication error:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            // Check for specific email verification error
            if (error.message?.toLowerCase().includes('email not confirmed')){
                Alert.alert(
                    'Email Not Verified', 
                    'Your email has not been verified yet. Would you like to resend the verification email?', 
                    [
                        { text: 'Cancel', style: 'cancel'}, 
                        { text: 'Resend', onPress: () => resendConfirmationEmail(email) }, 
                    ]
                ); 
                return;
            }
            
            // Use user-friendly error message
            const userFriendlyMessage = getUserFriendlyError(error);
            Alert.alert('Error', userFriendlyMessage);
        } finally { //set loading to false
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
                            <Image 
                                source={require('../../assets/images/icon.png')}
                                style={[styles.logoImage, { shadowColor: colors.primary }]}
                                resizeMode="contain"
                            />
                            <Text style={[styles.title, { color: colors.foreground }]}>Brainlot</Text>
                            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                                {isSignUp ? 'Create your account' : 'Welcome back!'}
                            </Text>
                        </View>

                        {/* Form */}
                        <View style={styles.form}>
                            <View style={[styles.inputContainer, { 
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                            }]}>
                                <Ionicons name="mail" size={20} color={colors.mutedForeground} />
                                <TextInput
                                    style={[styles.input, { color: colors.foreground }]}
                                    placeholder="Email"
                                    placeholderTextColor={colors.mutedForeground}
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            <View style={[styles.inputContainer, { 
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                            }]}>
                                <Ionicons name="lock-closed" size={20} color={colors.mutedForeground} />
                                <TextInput
                                    style={[styles.input, { color: colors.foreground }]}
                                    placeholder="Password"
                                    placeholderTextColor={colors.mutedForeground}
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
                                <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
                                <Text style={[styles.separatorText, { color: colors.mutedForeground }]}>Or continue with</Text>
                                <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
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
                                    style={[styles.oauthButton, styles.oauthApple, { borderColor: colors.border }]}
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
                                <Text style={[styles.switchText, { color: colors.accent }]}>
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
    logoImage: {
        width: 120,
        height: 120,
        borderRadius: 24,
        marginBottom: 24,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '500',
    },
    form: {
        gap: 20,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderWidth: 2,
        gap: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
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
    },
    separatorText: {
        fontSize: 12,
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
        fontWeight: '600',
    },
});
