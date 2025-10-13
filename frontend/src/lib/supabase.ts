import { createClient } from "@supabase/supabase-js"; //create connection between your app and supabase backend using the supabase SDK's 

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!; //supabase public url
const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!; //supabase anon key

export const supabase = createClient(supabaseUrl, supabaseAnon, { //users can edit the supabase storage within the rules that we defined
    auth: { 
        persistSession: true, // FIXED: Enable session persistence for RLS to work
        autoRefreshToken: true, // Automatically refresh tokens
        detectSessionInUrl: false // Disable for mobile apps
    },
}); 

// Only log in development environment
if (__DEV__) {
    console.log("URL from env:", process.env.EXPO_PUBLIC_SUPABASE_URL);
    console.log("Anon key from env:", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 15) + "...");
}
