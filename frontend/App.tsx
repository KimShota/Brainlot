import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { SubscriptionProvider } from './src/contexts/SubscriptionContext';
import AuthScreen from './src/screens/AuthScreen';
import AppNavigator from "./AppNavigator";
import SplashScreen from './src/components/SplashScreen';
import { supabase } from './src/lib/supabase';
import * as Linking from 'expo-linking'; 
import { NavigationContainer } from '@react-navigation/native';

const prefix = Linking.createURL('/'); 
//redirect users to the update password screen 
const linking = {
  prefixes: ['edushorts://', prefix], 
  config: {
    screens: {
      UpdatePassword: 'update-password', 
    },
  },
}; 

//function to control which screen to display based on the user's authentication status
function AppContent() {
  const { user, loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  // Handle splash screen completion
  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  // Show splash screen first
  if (showSplash) {
    return <SplashScreen onAnimationComplete={handleSplashComplete} />;
  }

  //show a loading screen while the app is checking the user's status 
  if (loading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#f8fdf9' 
      }}>
        <LinearGradient 
          colors={['#58cc02', '#1cb0f6']} 
          style={{ 
            width: 96, 
            height: 96, 
            borderRadius: 24, 
            justifyContent: 'center', 
            alignItems: 'center',
            marginBottom: 24,
            shadowColor: '#58cc02',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Ionicons name="school" size={48} color="white" />
        </LinearGradient>
        <ActivityIndicator size="large" color="#58cc02" />
      </View>
    );
  }

  //If the user is not authenticated yet, show the auth screen
  if (!user) {
    return <AuthScreen />;
  }

  //Display the main navigation stack if the user is authenticated 
  return <AppNavigator />;
}

//we can remove this function in production to avoid the user being logged out every time the app is launched 
export default function App() {
  // Remove automatic session clearing in development
  // This was causing issues with OAuth login persistence
  // useEffect(() => {
  //   const clearOldSession = async () => {
  //     try {
  //       await supabase.auth.signOut(); 
  //       // Clear WebBrowser session to ensure Google auth session is cleared
  //       const { dismissBrowser } = await import('expo-web-browser');
  //       await dismissBrowser();
  //       console.log("Old Supabase session cleared — please sign in again.");
  //     } catch (error) {
  //       console.error("Error clearing old session:", error);
  //     }
  //   }; 
  //   clearOldSession(); 
  // }, []); 
  
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <NavigationContainer linking={linking}>
          <AppContent />
        </NavigationContainer>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
