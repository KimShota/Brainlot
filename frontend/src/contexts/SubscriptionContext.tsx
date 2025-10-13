import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

// Mock RevenueCat types for development
interface MockCustomerInfo {
  entitlements: {
    active: { [key: string]: any };
  };
  originalAppUserId: string;
}

interface MockOffering {
  availablePackages: {
    identifier: string;
    packageType: string;
    product: {
      identifier: string;
      priceString: string;
    };
  }[];
}

// Subscription plan types
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
  offerings: MockOffering | null;
  purchasePro: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  incrementUploadCount: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  unsubscribeFromPro: () => Promise<void>;
}

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
});

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
  const [offerings, setOfferings] = useState<MockOffering | null>(null);

  const uploadLimit = planType === 'pro' ? Infinity : 10;
  const isProUser = planType === 'pro' && subscriptionStatus === 'active';
  const canUpload = isProUser || uploadCount < uploadLimit;

  // Mock RevenueCat initialization
  useEffect(() => {
    const initializeMockRevenueCat = async () => {
      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock offerings
        const mockOfferings: MockOffering = {
          availablePackages: [
            {
              identifier: 'monthly',
              packageType: 'MONTHLY',
              product: {
                identifier: 'pro_monthly',
                priceString: '¥600',
              },
            },
          ],
        };
        
        setOfferings(mockOfferings);
        if (__DEV__) console.log('Mock RevenueCat initialized');
      } catch (error) {
        console.error('Error initializing mock RevenueCat:', error);
      }
    };

    initializeMockRevenueCat();
  }, []);

  // Fetch subscription data from Supabase
  const fetchSubscriptionData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch subscription info
      const { data: subscription, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (subError && subError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching subscription:', subError);
      } else if (subscription) {
        setPlanType(subscription.plan_type as PlanType);
        setSubscriptionStatus(subscription.status as SubscriptionStatus);
      }

      // Fetch usage stats
      const { data: usage, error: usageError } = await supabase
        .from('user_usage_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (usageError && usageError.code !== 'PGRST116') {
        console.error('Error fetching usage:', usageError);
      } else if (usage) {
        setUploadCount(usage.upload_count);
      }
    } catch (error) {
      console.error('Error in fetchSubscriptionData:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mock sync with Supabase - FOR DEVELOPMENT ONLY
  // In production, subscription updates should only be done via RevenueCat webhooks or backend functions
  const syncMockWithSupabase = async (isProSubscribed: boolean) => {
    if (!user) return;

    try {
      // SECURITY NOTE: In production, users should NOT be able to update their own subscription
      // This is only for development/testing purposes
      // Real subscription updates should come from RevenueCat webhooks or admin-only Edge Functions
      
      // For now, we just update the local state for testing
      // In production, remove the database UPDATE and only use Edge Functions with service role
      setPlanType(isProSubscribed ? 'pro' : 'free');
      setSubscriptionStatus('active');
      
      // Refresh data from database to see actual values
      await fetchSubscriptionData();
    } catch (error) {
      console.error('Error in syncMockWithSupabase:', error);
    }
  };

  // Mock purchase Pro plan
  const purchasePro = async () => {
    try {
      // Simulate purchase process
        Alert.alert(
          'Development Mode',
          'This is a mock implementation for development. No actual payment will be processed.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Enable Pro Plan (Test)', 
              onPress: async () => {
                await syncMockWithSupabase(true);
                Alert.alert(
                  'Test Complete!',
                  'Pro plan has been enabled (Development Mode)'
                );
              }
            }
          ]
        );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred during purchase');
    }
  };

  // Mock restore purchases
  const restorePurchases = async () => {
    try {
        Alert.alert(
          'Development Mode',
          'This is a mock implementation for development. No actual purchase restoration will be performed.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Restore Pro Plan (Test)', 
              onPress: async () => {
                await syncMockWithSupabase(true);
                Alert.alert('Test Complete', 'Pro plan has been restored (Development Mode)');
              }
            }
          ]
        );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred during purchase restoration');
    }
  };

  // Increment upload count
  // SECURITY NOTE: Upload count is now managed by database trigger (check_upload_limit)
  // This function just refreshes the local state from the database
  const incrementUploadCount = async () => {
    if (!user) return;

    try {
      // The upload count is automatically incremented by the database trigger
      // when a file is uploaded. We just need to refresh our local state.
      await fetchSubscriptionData();
    } catch (error) {
      console.error('Error in incrementUploadCount:', error);
    }
  };

  // Mock unsubscribe from Pro plan
  const unsubscribeFromPro = async () => {
    try {
      Alert.alert(
        'Unsubscribe from Pro',
        'Are you sure you want to unsubscribe from Pro plan? You will lose access to unlimited uploads.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Unsubscribe', 
            style: 'destructive',
            onPress: async () => {
              await syncMockWithSupabase(false);
              Alert.alert(
                'Unsubscribed',
                'You have successfully unsubscribed from Pro plan. You are now on the free plan.'
              );
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
    await fetchSubscriptionData();
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
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};