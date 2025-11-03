import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { log, error as logError } from '../lib/logger';

type ThemeMode = 'light' | 'dark';

interface Colors {
  background: string;
  foreground: string;
  primary: string;
  secondary: string;
  accent: string;
  muted: string;
  mutedForeground: string;
  card: string;
  border: string;
  destructive: string;
  gold?: string;
}

interface ThemeContextType {
  isDarkMode: boolean;
  themeMode: ThemeMode;
  colors: Colors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const darkColors: Colors = {
  background: '#2a2a3a',
  foreground: '#ffffff',
  primary: '#8B5CF6',
  secondary: '#A78BFA',
  accent: '#60A5FA',
  muted: '#3a3a4a',
  mutedForeground: '#d0d0e0',
  card: '#3a3a4a',
  border: '#5a5a7e',
  destructive: '#F87171',
  gold: '#ffd700',
};

const lightColors: Colors = {
  background: '#f8f9fa',
  foreground: '#1a1a28',
  primary: '#8B5CF6',
  secondary: '#A78BFA',
  accent: '#60A5FA',
  muted: '#f0f0f0',
  mutedForeground: '#6b7280',
  card: '#ffffff',
  border: '#e5e7eb',
  destructive: '#F87171',
  gold: '#ffa500',
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setThemeModeState(savedTheme);
      }
    } catch (error) {
      logError('Error loading theme:', error);
    }
  };

  const saveTheme = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem('theme', mode);
    } catch (error) {
      logError('Error saving theme:', error);
    }
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeModeState(mode);
    saveTheme(mode);
  };

  const toggleTheme = () => {
    const newMode = themeMode === 'dark' ? 'light' : 'dark';
    setTheme(newMode);
  };

  const colors = themeMode === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode: themeMode === 'dark',
        themeMode,
        colors,
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

