import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Alert, Platform, AppState, AppStateStatus } from 'react-native';
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
  refreshSubscription: (showLoading?: boolean) => Promise<void>;
  addRecentUpload: () => void;
  fetchSubscriptionData: () => Promise<void>;
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
  addRecentUpload: () => {},
  fetchSubscriptionData: async () => {},
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
  
  // Refs to store latest function references for use in useEffect
  const fetchSubscriptionDataRef = useRef<(() => Promise<void>) | null>(null);
  const syncWithSupabaseRef = useRef<((customerInfo: CustomerInfo) => Promise<void>) | null>(null);

  // Upload limits configuration
  const UPLOAD_LIMITS = {
    FREE_DAILY_LIMIT: 5,
    PRO_DAILY_LIMIT: 50,
    PRO_HOURLY_LIMIT: 20,
  };

  const uploadLimit = planType === 'pro' ? UPLOAD_LIMITS.PRO_DAILY_LIMIT : UPLOAD_LIMITS.FREE_DAILY_LIMIT;
  const isProUser = planType === 'pro' && subscriptionStatus === 'active';

  // Helper function to calculate rate limit values
  const getRateLimitValues = (uploads: Date[], isPro: boolean) => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const uploadsInHour = uploads.filter(date => date > oneHourAgo).length;
    const uploadsInDay = uploads.filter(date => date > oneDayAgo).length;

    let canUploadNow = true;
    let nextAllowedAt: Date | null = null;

    // Check daily limit for both Free and Pro users
    const dailyLimit = isPro ? UPLOAD_LIMITS.PRO_DAILY_LIMIT : UPLOAD_LIMITS.FREE_DAILY_LIMIT;
    
    if (uploadsInDay >= dailyLimit) {
      canUploadNow = false;
      const oldestUploadInDay = uploads
        .filter(date => date > oneDayAgo)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      if (oldestUploadInDay) {
        nextAllowedAt = new Date(oldestUploadInDay.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    // Check hourly limit for Pro users only
    if (isPro && uploadsInHour >= UPLOAD_LIMITS.PRO_HOURLY_LIMIT) {
      canUploadNow = false;
      const oldestUploadInHour = uploads
        .filter(date => date > oneHourAgo)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      if (oldestUploadInHour) {
        const hourlyResetTime = new Date(oldestUploadInHour.getTime() + 60 * 60 * 1000);
        // Use the earlier reset time (hourly or daily)
        if (!nextAllowedAt || hourlyResetTime < nextAllowedAt) {
          nextAllowedAt = hourlyResetTime;
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

  // Calculate canUpload based on daily limits
  const rateLimitValues = getRateLimitValues(recentUploads, isProUser);
  
  // Check database upload count against limit (primary check)
  const dailyLimit = isProUser ? UPLOAD_LIMITS.PRO_DAILY_LIMIT : UPLOAD_LIMITS.FREE_DAILY_LIMIT;
  const canUploadFromDB = uploadCount < dailyLimit;
  
  // Combine both checks: must pass database limit AND rate limit (for Pro users)
  const canUpload = canUploadFromDB && (isProUser ? rateLimitValues.canUploadNow : true);

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
        log('Offerings loaded:', {
          hasCurrent: !!offerings.current,
          identifier: offerings.current?.identifier,
          availablePackages: offerings.current?.availablePackages.length || 0,
          packageIdentifiers: offerings.current?.availablePackages.map(p => p.identifier) || []
        });
        
        if (!offerings.current) {
          logError('No current offering found!');
          logError('All offerings:', Object.keys(offerings.all));
        }
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
          if (syncWithSupabaseRef.current) {
            await syncWithSupabaseRef.current(customerInfo);
          }
          
          // Immediately fetch subscription data to update upload counts
          // This ensures "Today: X/Y files" updates right after login
          if (fetchSubscriptionDataRef.current) {
            await fetchSubscriptionDataRef.current();
          }
        } catch (error) {
          logError('Error linking RevenueCat user:', error);
          // Even if RevenueCat fails, try to fetch subscription data from Supabase
          if (user?.id && fetchSubscriptionDataRef.current) {
            try {
              await fetchSubscriptionDataRef.current();
            } catch (fetchError) {
              logError('Error fetching subscription data after RevenueCat error:', fetchError);
            }
          }
        }
      } else {
        // Log out when user signs out
        try {
          await Purchases.logOut();
          log('RevenueCat user logged out');
          // Reset subscription data when user signs out
          setPlanType('free');
          setSubscriptionStatus('active');
          setUploadCount(0);
        } catch (error) {
          logError('Error logging out RevenueCat user:', error);
        }
      }
    };

    linkRevenueCatUser();
  }, [user?.id]);

  // Sync subscription status with Supabase
  const syncWithSupabase = useCallback(async (customerInfo: CustomerInfo) => {
    if (!user) {
      logError('syncWithSupabase: No user found');
      return;
    }

    try {
      // Log customer info for debugging
      log('CustomerInfo received:', {
        originalAppUserId: customerInfo.originalAppUserId,
        activeEntitlements: Object.keys(customerInfo.entitlements.active),
        allEntitlements: Object.keys(customerInfo.entitlements.all),
        activeEntitlementDetails: Object.entries(customerInfo.entitlements.active).map(([key, value]) => ({
          key,
          identifier: value.identifier,
          productIdentifier: value.productIdentifier,
          isActive: value.isActive,
        })),
      });

      // Check for pro entitlement - try multiple possible names
      const proEntitlement = customerInfo.entitlements.active['pro'] || 
                            customerInfo.entitlements.active['Pro'] ||
                            customerInfo.entitlements.active['PRO'] ||
                            Object.values(customerInfo.entitlements.active).find(
                              (entitlement: any) => 
                                entitlement.identifier?.toLowerCase().includes('pro') ||
                                entitlement.productIdentifier?.toLowerCase().includes('pro')
                            );
      
      // Check if subscription is truly active (not cancelled and not expired)
      // RevenueCat keeps cancelled subscriptions in active until expiration date
      let isProActive = false;
      if (proEntitlement) {
        // willRenew can be boolean, string, or null - convert to boolean
        const willRenewValue = proEntitlement.willRenew;
        const willRenew: boolean = typeof willRenewValue === 'boolean' 
          ? willRenewValue 
          : (willRenewValue !== null && willRenewValue !== false && willRenewValue !== 'false');
        const expirationDate = proEntitlement.expirationDate;
        const now = new Date();
        
        // Subscription is active if:
        // 1. It will renew (not cancelled), OR
        // 2. It hasn't expired yet (even if cancelled, user has access until expiration)
        const isNotExpired = expirationDate ? new Date(expirationDate) > now : false;
        isProActive = willRenew || isNotExpired;
        
        log('Subscription status check:', {
          willRenew,
          expirationDate,
          isExpired: expirationDate ? new Date(expirationDate) <= now : false,
          isProActive,
        });
      }
      
      log('Pro status determined:', {
        isProActive,
        proEntitlement: proEntitlement ? {
          identifier: proEntitlement.identifier,
          productIdentifier: proEntitlement.productIdentifier,
          isActive: proEntitlement.isActive,
        } : null,
      });

      const subscriptionData = {
        user_id: user.id,
        plan_type: isProActive ? 'pro' : 'free',
        status: isProActive ? 'active' : 'cancelled',
        revenue_cat_customer_id: customerInfo.originalAppUserId,
        revenue_cat_subscription_id: proEntitlement?.productIdentifier || null,
        updated_at: new Date().toISOString(),
      };

      log('Attempting to upsert subscription data:', subscriptionData);

      // Update Supabase subscription with timeout
      const upsertPromise = supabase
        .from('user_subscriptions')
        .upsert(subscriptionData, {
          onConflict: 'user_id'
        })
        .select();
      
      const upsertTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database update timeout. Please check your internet connection.')), 30000); // 30 seconds timeout
      });
      
      const { data, error } = await Promise.race([upsertPromise, upsertTimeoutPromise]);

      if (error) {
        logError('Error syncing subscription to Supabase:', error);
        logError('Error details:', JSON.stringify(error, null, 2));
        // Don't show alert here - let the calling function handle it
        // This prevents multiple alerts and UI loops
        throw new Error(`Failed to update subscription: ${error.message}`);
      } else {
        log('Subscription successfully synced with Supabase:', {
          data,
          planType: isProActive ? 'pro' : 'free',
        });
        setPlanType(isProActive ? 'pro' : 'free');
        setSubscriptionStatus(isProActive ? 'active' : 'cancelled');
      }
    } catch (error: any) {
      logError('Error in syncWithSupabase:', error);
      logError('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      // Re-throw the error so calling functions can handle it appropriately
      // This prevents the error from being silently swallowed
      throw error;
    }
  }, [user]);

  // Update refs when functions are defined
  useEffect(() => {
    syncWithSupabaseRef.current = syncWithSupabase;
  }, [syncWithSupabase]);

  // Fetch subscription data from Supabase
  const fetchSubscriptionData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // First, get latest customer info from RevenueCat with timeout
      try {
        const customerInfoPromise = Purchases.getCustomerInfo();
        const customerInfoTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Failed to fetch customer info. Please check your internet connection.')), 15000); // 15 seconds timeout
        });
        
        const customerInfo = await Promise.race([customerInfoPromise, customerInfoTimeoutPromise]);
        try {
          await syncWithSupabase(customerInfo);
        } catch (syncError: any) {
          // Handle sync error gracefully - don't block the data fetch
          logError('Error syncing with Supabase during fetch:', syncError);
          // Don't show alert here - let refreshSubscription handle it
        }
      } catch (rcError) {
        logError('Error fetching RevenueCat customer info:', rcError);
        // Fallback to Supabase if RevenueCat fails
      }

      // Get usage stats from Supabase using RPC function (automatically checks and resets daily count)
      // Add timeout to prevent blocking UI updates
      try {
        const rpcPromise = supabase.rpc('get_user_usage_stats', {
          user_id_param: user.id,
        });
        const rpcTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('RPC timeout')), 5000); // 5 seconds timeout - faster fallback
        });
        
        const { data: usageData, error: usageError } = await Promise.race([
          rpcPromise,
          rpcTimeoutPromise
        ]);

        if (usageError) {
          throw usageError;
        }

        if (usageData && usageData.length > 0) {
          const usage = usageData[0];
          setUploadCount(usage.uploads_today || 0);
          if (usage.daily_reset_at) {
            setNextUploadAllowedAt(new Date(usage.daily_reset_at));
          }
          return; // Success, exit early
        }
      } catch (rpcError: any) {
        // If RPC fails or times out, immediately fallback to direct query
        logError('Error fetching usage via RPC (using fallback):', rpcError);
      }

      // Fallback to direct query for faster response
      // This ensures UI updates immediately even if RPC is slow
      try {
        const { data: usage, error: fallbackError } = await supabase
          .from('user_usage_stats')
          .select('uploads_today, daily_reset_at')
          .eq('user_id', user.id)
          .single();

        if (fallbackError && fallbackError.code !== 'PGRST116') {
          logError('Error fetching usage (fallback):', fallbackError);
        } else if (usage) {
          setUploadCount(usage.uploads_today || 0);
          if (usage.daily_reset_at) {
            setNextUploadAllowedAt(new Date(usage.daily_reset_at));
          }
        }
      } catch (fallbackError: any) {
        logError('Error in fallback query:', fallbackError);
      }
    } catch (error) {
      logError('Error in fetchSubscriptionData:', error);
    } finally {
      setLoading(false);
    }
  }, [user, syncWithSupabase]);

  // Update ref when fetchSubscriptionData is defined
  useEffect(() => {
    fetchSubscriptionDataRef.current = fetchSubscriptionData;
  }, [fetchSubscriptionData]);

  // Purchase Pro plan
  const purchasePro = async () => {
    try {
      // Try to refresh offerings if not available
      let currentOfferings = offerings;
      
      if (!currentOfferings || !currentOfferings.current) {
        log('Offerings not available, attempting to refresh...');
        try {
          log('Fetching fresh offerings from RevenueCat...');
          const refreshedOfferings = await Purchases.getOfferings();
          setOfferings(refreshedOfferings);
          currentOfferings = refreshedOfferings;
          
          log('Refreshed offerings:', {
            hasCurrent: !!refreshedOfferings.current,
            identifier: refreshedOfferings.current?.identifier,
            availablePackages: refreshedOfferings.current?.availablePackages.length || 0
          });
          
          if (!refreshedOfferings || !refreshedOfferings.current) {
            logError('Offerings still not available after refresh');
            logError('All available offerings:', Object.keys(refreshedOfferings.all || {}));
            
            Alert.alert(
              'Unable to Load Subscriptions',
              'Please check your internet connection and try again. If the problem persists, the subscription service may not be configured yet. Please check RevenueCat Dashboard settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Retry', onPress: () => purchasePro() }
              ]
            );
            return;
          }
        } catch (refreshError) {
          logError('Error refreshing offerings:', refreshError);
          Alert.alert(
            'Connection Error',
            'Unable to connect to subscription service. Please check your internet connection and try again.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Retry', onPress: () => purchasePro() }
            ]
          );
          return;
        }
      }

      // Use current offerings (either original or refreshed)
      if (!currentOfferings.current) {
        Alert.alert('Error', 'Subscription service is not available. Please try again later.');
        return;
      }

      // Find the monthly package
      // RevenueCat may use $rc_monthly or monthly as identifier
      const packageToPurchase = currentOfferings.current.availablePackages.find(
        (pkg: PurchasesPackage) => 
          pkg.identifier === 'monthly' || 
          pkg.identifier === '$rc_monthly' ||
          pkg.packageType === 'MONTHLY'
      );
      
      // Log available packages for debugging
      log('Available packages:', currentOfferings.current.availablePackages.map(p => ({
        identifier: p.identifier,
        type: p.packageType,
        productId: p.product.identifier
      })));

      if (!packageToPurchase) {
        logError('Monthly package not found. Available packages:', currentOfferings.current.availablePackages.map(p => ({
          id: p.identifier,
          type: p.packageType,
          productId: p.product.identifier
        })));
        
        Alert.alert(
          'Package Not Found',
          'The subscription package is not configured. Please contact support or try again later.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => purchasePro() }
          ]
        );
        return;
      }

      // Purchase the package with timeout
      let customerInfo: CustomerInfo;
      try {
        const purchasePromise = Purchases.purchasePackage(packageToPurchase);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Purchase timeout. Please try again.')), 60000); // 1 minute timeout
        });
        
        const result = await Promise.race([purchasePromise, timeoutPromise]);
        customerInfo = result.customerInfo;
        
        if (!customerInfo) {
          throw new Error('Purchase completed but customer info is missing. Please try again.');
        }
      } catch (purchaseError: any) {
        if (purchaseError.userCancelled) {
          throw purchaseError; // Re-throw to be handled by outer catch
        }
        throw new Error(purchaseError.message || 'Purchase failed. Please try again.');
      }

      // Sync with Supabase immediately with timeout
      try {
        const syncPromise = syncWithSupabase(customerInfo);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Sync timeout. Purchase was successful but sync failed.')), 30000); // 30 seconds timeout
        });
        await Promise.race([syncPromise, timeoutPromise]);
      } catch (syncError: any) {
        logError('Error syncing with Supabase after purchase:', syncError);
        // Show user-friendly error message
        if (syncError.message && syncError.message.includes('Network request failed')) {
          Alert.alert(
            'Sync Error',
            'Your purchase was successful, but we couldn\'t sync your subscription status. Please check your internet connection and try refreshing your subscription status later.'
          );
        } else if (syncError.message && !syncError.message.includes('timeout')) {
          Alert.alert(
            'Sync Error',
            `Your purchase was successful, but we couldn't sync your subscription status: ${syncError.message}. Please try refreshing your subscription status later.`
          );
        }
        // Don't throw - purchase was successful, sync can be retried
      }

      // Wait a moment for RevenueCat to fully process the purchase
      // Sometimes the entitlement might not be immediately available
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refresh subscription data to ensure UI is updated
      // This is important because RevenueCat may need a moment to process the purchase
      try {
        const refreshPromise = refreshSubscription();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Refresh timeout')), 30000); // 30 seconds timeout
        });
        await Promise.race([refreshPromise, timeoutPromise]);
      } catch (refreshError: any) {
        logError('Error refreshing subscription after purchase:', refreshError);
        // Don't throw - purchase was successful, refresh can be retried
      }

      // Double-check the subscription status after refresh
      let finalCustomerInfo: CustomerInfo = customerInfo;
      try {
        const customerInfoPromise = Purchases.getCustomerInfo();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Get customer info timeout')), 15000); // 15 seconds timeout
        });
        finalCustomerInfo = await Promise.race([customerInfoPromise, timeoutPromise]);
      } catch (customerInfoError: any) {
        logError('Error getting final customer info:', customerInfoError);
        // Use the customerInfo from purchase if available
        if (!finalCustomerInfo) {
          finalCustomerInfo = customerInfo;
        }
      }
      const finalProEntitlement = finalCustomerInfo.entitlements.active['pro'] || 
                                 finalCustomerInfo.entitlements.active['Pro'] ||
                                 finalCustomerInfo.entitlements.active['PRO'] ||
                                 Object.values(finalCustomerInfo.entitlements.active).find(
                                   (entitlement: any) => 
                                     entitlement.identifier?.toLowerCase().includes('pro') ||
                                     entitlement.productIdentifier?.toLowerCase().includes('pro')
                                 );
      
      if (finalProEntitlement) {
        // Final sync to ensure Supabase is up to date
        await syncWithSupabase(finalCustomerInfo);
        Alert.alert('Success', 'Pro plan purchased successfully!');
      } else {
        // If still no entitlement, log warning but show success (might be delayed)
        logError('Warning: Pro entitlement not found after purchase, but purchase was successful. This might be a timing issue.');
        Alert.alert(
          'Purchase Successful', 
          'Your purchase was successful! If your subscription status doesn\'t update immediately, please wait a moment and refresh, or use "Restore Purchases".'
        );
      }
    } catch (error: any) {
      if (error.userCancelled) {
        // User cancelled, no action needed
        return;
      }
      
      logError('Purchase error:', error);
      logError('Purchase error details:', JSON.stringify(error, null, 2));
      Alert.alert('Purchase Failed', error.message || 'An error occurred during purchase. Please try again.');
    }
  };

  // Restore purchases
  const restorePurchases = async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();

      // Check for pro entitlement - try multiple possible names (same logic as syncWithSupabase)
      const proEntitlement = customerInfo.entitlements.active['pro'] || 
                            customerInfo.entitlements.active['Pro'] ||
                            customerInfo.entitlements.active['PRO'] ||
                            Object.values(customerInfo.entitlements.active).find(
                              (entitlement: any) => 
                                entitlement.identifier?.toLowerCase().includes('pro') ||
                                entitlement.productIdentifier?.toLowerCase().includes('pro')
                            );
      
      const isProActive = proEntitlement !== undefined;

      if (isProActive) {
        await syncWithSupabase(customerInfo);
        // Refresh subscription data to ensure UI is updated
        await refreshSubscription();
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
      // Add current upload to recent uploads for rate limiting
      const now = new Date();
      setRecentUploads(prev => [...prev, now]);
      
      // Use RPC function to increment (automatically handles daily reset)
      const { error } = await supabase.rpc('increment_upload_count', {
        user_id_param: user.id,
      });

      if (error) {
        logError('Error incrementing upload count:', error);
        // Fallback to manual update if RPC doesn't exist (daily limit only)
        const { data: current } = await supabase
          .from('user_usage_stats')
          .select('uploads_today')
          .eq('user_id', user.id)
          .single();

        if (current) {
          const newDailyCount = (current.uploads_today || 0) + 1;
          
          await supabase
            .from('user_usage_stats')
            .update({
              uploads_today: newDailyCount,
            })
            .eq('user_id', user.id);
          
          setUploadCount(newDailyCount);
        }
      } else {
        // Refresh usage stats after increment
        await fetchSubscriptionData();
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

  // Add recent upload timestamp (for Pro user rate limiting)
  const addRecentUpload = () => {
    const now = new Date();
    setRecentUploads(prev => [...prev, now]);
  };

  // Refresh subscription data
  const refreshSubscription = useCallback(async (showLoading: boolean = false) => {
    // Only show loading if explicitly requested (e.g., initial load)
    // This prevents white screen on every screen focus
    if (showLoading) {
      setLoading(true);
    }
    try {
      // Fetch latest from RevenueCat with timeout
      const customerInfoPromise = Purchases.getCustomerInfo();
      const customerInfoTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Failed to fetch subscription info. Please check your internet connection.')), 15000); // 15 seconds timeout
      });
      
      const customerInfo = await Promise.race([customerInfoPromise, customerInfoTimeoutPromise]);
      try {
        await syncWithSupabase(customerInfo);
      } catch (syncError: any) {
        // Handle sync error gracefully - don't block the refresh
        logError('Error syncing with Supabase during refresh:', syncError);
        // Only show alert if it's a critical error (not network timeout)
        if (syncError.message && !syncError.message.includes('timeout')) {
          Alert.alert(
            'Sync Error',
            `Failed to update subscription: ${syncError.message}. Please check your internet connection.`
          );
        }
      }
      
      // Fetch usage stats (even if sync failed)
      await fetchSubscriptionData();
    } catch (error) {
      logError('Error refreshing subscription:', error);
      // Don't show alert here - let specific error handlers show it
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [fetchSubscriptionData]); // Only depend on fetchSubscriptionData (which already depends on user and syncWithSupabase)

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

  // Refresh subscription when app comes to foreground
  // This ensures cancelled subscriptions are detected when user returns to app
  useEffect(() => {
    if (!user) return;

    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App has come to the foreground, refresh subscription status
        log('App came to foreground, refreshing subscription status...');
        try {
          const customerInfo = await Purchases.getCustomerInfo();
          await syncWithSupabase(customerInfo);
        } catch (error) {
          logError('Error refreshing subscription on app state change:', error);
        }
      }
    });

    return () => {
      subscription.remove();
    };
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
        addRecentUpload,
        fetchSubscriptionData,
        unsubscribeFromPro,
        canUploadNow: rateLimitValues.canUploadNow,
        uploadsInLastHour,
        uploadsInLastDay,
        nextUploadAllowedAt,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};
