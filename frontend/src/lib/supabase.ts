import { createClient } from "@supabase/supabase-js";
import { Alert } from "react-native";

// Validate environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
    const missingVars = [];
    if (!supabaseUrl) missingVars.push('EXPO_PUBLIC_SUPABASE_URL');
    if (!supabaseAnon) missingVars.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    
    const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}. Please set them in EAS Environment Variables or .env file.`;
    console.error(errorMsg);
    
    // Show alert in both dev and production to help diagnose the issue
    Alert.alert(
        'Configuration Error', 
        errorMsg,
        [{ text: 'OK' }]
    );
    
    // Don't throw error - let the app continue to show the error message
    // throw new Error(errorMsg);
}

export const supabase = createClient(supabaseUrl || '', supabaseAnon || '', {
    auth: { 
        persistSession: true, // Enable session persistence for RLS to work
        autoRefreshToken: true, // Automatically refresh tokens
        detectSessionInUrl: false // Disable for mobile apps
    },
}); 

// Only log in development environment (without exposing keys)
if (__DEV__) {
    console.log("✅ Supabase initialized successfully");
}
