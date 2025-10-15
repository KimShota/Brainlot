import { useState } from 'react';
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
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

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
