import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

//blueprint of an object 
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

//intialize the context 
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
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

  useEffect(() => {
    // Get initial session, or create anonymous user if none exists
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        // No session exists, sign in anonymously
        const { error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error('Anonymous sign-in error:', error);
        }
        // Get the new session after anonymous sign-in
        const { data: { session: newSession } } = await supabase.auth.getSession();
        setSession(newSession);
        setUser(newSession?.user ?? null);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
