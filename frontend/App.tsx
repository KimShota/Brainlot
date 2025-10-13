import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { SubscriptionProvider } from './src/contexts/SubscriptionContext';
import AppNavigator from "./AppNavigator";
import SplashScreen from './src/screens/SplashScreen';

function AppContent() {
  const { loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  // Show splash screen first
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // Show loading indicator while auth is initializing
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

  // Always show AppNavigator - anonymous auth is handled in AuthContext
  return <AppNavigator />;
}

export default function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <AppContent />
      </SubscriptionProvider>
    </AuthProvider>
  );
}
