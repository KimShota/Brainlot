import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import Purchases, { 
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';
import { supabase } from '../lib/supabase';
import { log, error as logError } from '../lib/logger';
import { useAuth } from './AuthContext';

export type PlanType = 'free' | 'pro';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';

// Subscription context interface
interface SubscriptionContextType {
  planType: PlanType;
  subscriptionStatus: SubscriptionStatus;
  uploadCount: number;
  uploadLimit: number;
  isProUser: boolean;
  canUpload: boolean;
  loading: boolean;
  offerings: PurchasesOfferings | null;
  purchasePro: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  incrementUploadCount: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  unsubscribeFromPro: () => Promise<void>;
  // Rate limiting for Pro users
  canUploadNow: boolean;
  uploadsInLastHour: number;
  uploadsInLastDay: number;
  nextUploadAllowedAt: Date | null;
}

// Default values for the subscription context
const SubscriptionContext = createContext<SubscriptionContextType>({
  planType: 'free',
  subscriptionStatus: 'active',
  uploadCount: 0,
  uploadLimit: 10,
  isProUser: false,
  canUpload: true,
  loading: true,
  offerings: null,
  purchasePro: async () => {},
  restorePurchases: async () => {},
  incrementUploadCount: async () => {},
  refreshSubscription: async () => {},
  unsubscribeFromPro: async () => {},
  canUploadNow: true,
  uploadsInLastHour: 0,
  uploadsInLastDay: 0,
  nextUploadAllowedAt: null,
});

// Hook to use the subscription context
export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [planType, setPlanType] = useState<PlanType>('free');
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('active');
  const [uploadCount, setUploadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  
  // Rate limiting settings
  const [uploadsInLastHour, setUploadsInLastHour] = useState(0);
  const [uploadsInLastDay, setUploadsInLastDay] = useState(0);
  const [nextUploadAllowedAt, setNextUploadAllowedAt] = useState<Date | null>(null);
  const [recentUploads, setRecentUploads] = useState<Date[]>([]);

  const uploadLimit = planType === 'pro' ? Infinity : 10;
  const isProUser = planType === 'pro' && subscriptionStatus === 'active';
  const canUpload = isProUser || uploadCount < uploadLimit;

  // Rate limit configurations
  const RATE_LIMITS = {
    PRO_HOURLY_LIMIT: 20,
    PRO_DAILY_LIMIT: 100,
  };

  // Helper function to calculate rate limit values
  const getRateLimitValues = (uploads: Date[], isPro: boolean) => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const uploadsInHour = uploads.filter(date => date > oneHourAgo).length;
    const uploadsInDay = uploads.filter(date => date > oneDayAgo).length;

    let canUploadNow = true;
    let nextAllowedAt: Date | null = null;

    if (isPro) {
      if (uploadsInHour >= RATE_LIMITS.PRO_HOURLY_LIMIT) {
        canUploadNow = false;
        const oldestUploadInHour = uploads
          .filter(date => date > oneHourAgo)
          .sort((a, b) => a.getTime() - b.getTime())[0];
        if (oldestUploadInHour) {
          nextAllowedAt = new Date(oldestUploadInHour.getTime() + 60 * 60 * 1000);
        }
      }

      if (uploadsInDay >= RATE_LIMITS.PRO_DAILY_LIMIT) {
        canUploadNow = false;
        const oldestUploadInDay = uploads
          .filter(date => date > oneDayAgo)
          .sort((a, b) => a.getTime() - b.getTime())[0];
        if (oldestUploadInDay) {
          nextAllowedAt = new Date(oldestUploadInDay.getTime() + 24 * 60 * 60 * 1000);
        }
      }
    }

    return {
      uploadsInHour,
      uploadsInDay,
      canUploadNow,
      nextAllowedAt,
    };
  };

  // Update rate limits whenever recentUploads changes or user's plan changes
  useEffect(() => {
    const rateLimitValues = getRateLimitValues(recentUploads, isProUser);
    setUploadsInLastHour(rateLimitValues.uploadsInHour);
    setUploadsInLastDay(rateLimitValues.uploadsInDay);
    setNextUploadAllowedAt(rateLimitValues.nextAllowedAt);

    if (rateLimitValues.nextAllowedAt) {
      const now = new Date();
      const timeUntilNext = rateLimitValues.nextAllowedAt.getTime() - now.getTime();
      if (timeUntilNext > 0) {
        const timer = setTimeout(() => {
          setRecentUploads(prev => [...prev]);
        }, timeUntilNext);
        
        return () => clearTimeout(timer);
      }
    }
  }, [recentUploads, isProUser]);

  // Initialize RevenueCat
  useEffect(() => {
    const initializeRevenueCat = async () => {
      try {
        // Get platform-specific API key
        const iosApiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS;
        const androidApiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID;
        const fallbackApiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY; // For backwards compatibility
        
        // Select API key based on platform
        let apiKey: string | undefined;
        if (Platform.OS === 'ios' && iosApiKey) {
          apiKey = iosApiKey;
        } else if (Platform.OS === 'android' && androidApiKey) {
          apiKey = androidApiKey;
        } else if (fallbackApiKey) {
          apiKey = fallbackApiKey;
        }
        
        if (!apiKey) {
          const platform = Platform.OS === 'ios' ? 'iOS' : 'Android';
          logError(`RevenueCat API key not found for ${platform}. Please add EXPO_PUBLIC_REVENUECAT_API_KEY_${Platform.OS.toUpperCase()} or EXPO_PUBLIC_REVENUECAT_API_KEY to your .env file.`);
          setLoading(false);
          return;
        }

        // Configure RevenueCat
        await Purchases.configure({ apiKey });

        // Set app user ID if user is logged in
        if (user?.id) {
          await Purchases.logIn(user.id);
        }

        // Fetch offerings
        const offerings = await Purchases.getOfferings();
        setOfferings(offerings);

        log('RevenueCat initialized successfully');
      } catch (error) {
        logError('Error initializing RevenueCat:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeRevenueCat();
  }, []);

  // Link RevenueCat user when auth state changes
  useEffect(() => {
    const linkRevenueCatUser = async () => {
      if (user?.id) {
        try {
          await Purchases.logIn(user.id);
          log('RevenueCat user linked:', user.id);
          
          // Refresh customer info after linking
          const customerInfo = await Purchases.getCustomerInfo();
          await syncWithSupabase(customerInfo);
        } catch (error) {
          logError('Error linking RevenueCat user:', error);
        }
      } else {
        // Log out when user signs out
        try {
          await Purchases.logOut();
          log('RevenueCat user logged out');
        } catch (error) {
          logError('Error logging out RevenueCat user:', error);
        }
      }
    };

    linkRevenueCatUser();
  }, [user?.id]);

  // Sync subscription status with Supabase
  const syncWithSupabase = async (customerInfo: CustomerInfo) => {
    if (!user) return;

    try {
      const isProActive = customerInfo.entitlements.active['pro'] !== undefined;

      // Update Supabase subscription
      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          plan_type: isProActive ? 'pro' : 'free',
          status: isProActive ? 'active' : 'cancelled',
          revenue_cat_customer_id: customerInfo.originalAppUserId,
          revenue_cat_subscription_id: customerInfo.entitlements.active['pro']?.productIdentifier || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        logError('Error syncing subscription to Supabase:', error);
      } else {
        setPlanType(isProActive ? 'pro' : 'free');
        setSubscriptionStatus(isProActive ? 'active' : 'cancelled');
        log('Subscription synced with Supabase:', isProActive ? 'pro' : 'free');
      }
    } catch (error) {
      logError('Error in syncWithSupabase:', error);
    }
  };

  // Fetch subscription data from Supabase
  const fetchSubscriptionData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // First, get latest customer info from RevenueCat
      try {
        const customerInfo = await Purchases.getCustomerInfo();
        await syncWithSupabase(customerInfo);
      } catch (rcError) {
        logError('Error fetching RevenueCat customer info:', rcError);
        // Fallback to Supabase if RevenueCat fails
      }

      // Get usage stats from Supabase
      const { data: usage, error: usageError } = await supabase
        .from('user_usage_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (usageError && usageError.code !== 'PGRST116') {
        logError('Error fetching usage:', usageError);
      } else if (usage) {
        setUploadCount(usage.uploads_this_month);
      }
    } catch (error) {
      logError('Error in fetchSubscriptionData:', error);
    } finally {
      setLoading(false);
    }
  };

  // Purchase Pro plan
  const purchasePro = async () => {
    try {
      if (!offerings || !offerings.current) {
        Alert.alert('Error', 'Unable to load subscription options. Please try again later.');
        return;
      }

      // Find the monthly package
      const packageToPurchase = offerings.current.availablePackages.find(
        (pkg: PurchasesPackage) => pkg.identifier === 'monthly' || pkg.packageType === 'MONTHLY'
      );

      if (!packageToPurchase) {
        Alert.alert('Error', 'Subscription package not found. Please contact support.');
        return;
      }

      // Purchase the package
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);

      // Sync with Supabase
      await syncWithSupabase(customerInfo);

      Alert.alert('Success', 'Pro plan purchased successfully!');
    } catch (error: any) {
      if (error.userCancelled) {
        // User cancelled, no action needed
        return;
      }
      
      logError('Purchase error:', error);
      Alert.alert('Purchase Failed', error.message || 'An error occurred during purchase. Please try again.');
    }
  };

  // Restore purchases
  const restorePurchases = async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();

      const isProActive = customerInfo.entitlements.active['pro'] !== undefined;

      if (isProActive) {
        await syncWithSupabase(customerInfo);
        Alert.alert('Success', 'Purchases restored successfully!');
      } else {
        Alert.alert('No Purchases Found', 'No active subscriptions found on this account.');
      }
    } catch (error: any) {
      logError('Restore purchases error:', error);
      Alert.alert('Error', error.message || 'Failed to restore purchases. Please try again.');
    }
  };

  // Increment upload count with rate limiting
  const incrementUploadCount = async () => {
    if (!user) return;

    // Check rate limits for Pro users
    const rateLimitValues = getRateLimitValues(recentUploads, isProUser);
    if (isProUser && !rateLimitValues.canUploadNow) {
      throw new Error('Rate limit exceeded. Please wait before uploading again.');
    }

    try {
      const newCount = uploadCount + 1;
      
      // Add current upload to recent uploads for rate limiting
      const now = new Date();
      setRecentUploads(prev => [...prev, now]);
      
      const { error } = await supabase
        .from('user_usage_stats')
        .update({
          uploads_this_month: newCount,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) {
        logError('Error incrementing upload count:', error);
      } else {
        setUploadCount(newCount);
      }
    } catch (error) {
      logError('Error in incrementing upload count:', error);
      throw error;
    }
  };

  // Unsubscribe from Pro plan (cancel subscription)
  const unsubscribeFromPro = async () => {
    try {
      Alert.alert(
        'Unsubscribe from Pro',
        'Are you sure you want to cancel your Pro subscription? You will lose access to unlimited uploads after your current billing period ends.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Cancel Subscription', 
            style: 'destructive',
            onPress: async () => {
              try {
                // Note: RevenueCat doesn't provide a direct cancel method
                // Users need to cancel through App Store/Play Store
                Alert.alert(
                  'Cancel Subscription',
                  'To cancel your subscription:\n\niOS: Settings → Apple ID → Subscriptions\n\nAndroid: Play Store → Subscriptions',
                  [{ text: 'OK' }]
                );
              } catch (error: any) {
                Alert.alert('Error', error.message || 'An error occurred');
              }
            }
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred during unsubscription');
    }
  };

  // Refresh subscription data
  const refreshSubscription = async () => {
    setLoading(true);
    try {
      // Fetch latest from RevenueCat
      const customerInfo = await Purchases.getCustomerInfo();
      await syncWithSupabase(customerInfo);
      
      // Fetch usage stats
      await fetchSubscriptionData();
    } catch (error) {
      logError('Error refreshing subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  // Listen to auth state and fetch subscription data
  useEffect(() => {
    if (user) {
      fetchSubscriptionData();
    } else {
      setPlanType('free');
      setSubscriptionStatus('active');
      setUploadCount(0);
      setLoading(false);
    }
  }, [user]);

  return (
    <SubscriptionContext.Provider
      value={{
        planType,
        subscriptionStatus,
        uploadCount,
        uploadLimit,
        isProUser,
        canUpload,
        loading,
        offerings,
        purchasePro,
        restorePurchases,
        incrementUploadCount,
        refreshSubscription,
        unsubscribeFromPro,
        canUploadNow: isProUser ? (nextUploadAllowedAt === null || nextUploadAllowedAt <= new Date()) : true,
        uploadsInLastHour,
        uploadsInLastDay,
        nextUploadAllowedAt,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};
