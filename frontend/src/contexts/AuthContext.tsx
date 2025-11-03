import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { log, warn, error as logError } from '../lib/logger';

//blueprint of an object 
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  hasSeenOnboarding: boolean;
  completeOnboarding: () => Promise<void>;
}

//intialize the context 
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  hasSeenOnboarding: false,
  completeOnboarding: async () => {},
});

//create a custom hook to extract the context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

//create an auth provider to provide the context to the app 
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  // Check if user has seen onboarding
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const value = await AsyncStorage.getItem('hasSeenOnboarding');
        setHasSeenOnboarding(value === 'true');
      } catch (error) {
        logError('Error checking onboarding:', error);
      }
    };
    checkOnboarding();
  }, []);

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      setHasSeenOnboarding(true);
    } catch (error) {
      logError('Error saving onboarding status:', error);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          logError('Error getting initial session:', error);
          setSession(null);
          setUser(null);
        } else {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (!session) {
            warn("No session active - redirect to login"); 
          } else {
            log("User authenticated successfully"); 
          }
        }
      } catch (error) {
        logError('Error in getInitialSession:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      log('Auth state change:', event);
      
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session) {
        log("Session updated successfully"); 
      } else {
        log("User signed out"); 
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, hasSeenOnboarding, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
};
