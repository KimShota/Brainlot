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

export type PlanType = 'free' | 'pro'; //subscription plan types 
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired'; //subscription status 

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
  // Rate limiting for Pro users
  canUploadNow: boolean;
  uploadsInLastHour: number;
  uploadsInLastDay: number;
  nextUploadAllowedAt: Date | null;
}

//default values for the subscription context
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
  // Rate limiting defaults
  canUploadNow: true,
  uploadsInLastHour: 0,
  uploadsInLastDay: 0,
  nextUploadAllowedAt: null,
});

//function to use the subscription context across my app 
export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [planType, setPlanType] = useState<PlanType>('free'); //default plan is set to free
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('active'); //set status to active 
  const [uploadCount, setUploadCount] = useState(0); //set upload count to 0
  const [loading, setLoading] = useState(true); //set loading to true 
  const [offerings, setOfferings] = useState<MockOffering | null>(null); //set offerings to null 
  
  //settings for rate limiting 
  const [uploadsInLastHour, setUploadsInLastHour] = useState(0); //set uploads in last hour to 0
  const [uploadsInLastDay, setUploadsInLastDay] = useState(0); //set uploads in last day to 0
  const [nextUploadAllowedAt, setNextUploadAllowedAt] = useState<Date | null>(null); //set next upload allowed at to null 
  const [recentUploads, setRecentUploads] = useState<Date[]>([]); //set recent uploads to an empty array 

  const uploadLimit = planType === 'pro' ? Infinity : 10; //if the user plan is pro, set the upload limit to infinity
  const isProUser = planType === 'pro' && subscriptionStatus === 'active'; //if the user plan is pro, set isProUser to true 
  const canUpload = isProUser || uploadCount < uploadLimit; //if the user is pro or if the upload count is less than upload limit, set canUpload to true 

  //Configurations for rate limits  
  const RATE_LIMITS = {
    PRO_HOURLY_LIMIT: 20, //pro users can upload 20 files per hour 
    PRO_DAILY_LIMIT: 100, //pro users can upload 100 files per day 
    PRO_MIN_INTERVAL: 30, //pro users can upload a file every 30 second 
  };

  // Pure helper function to calculate rate limit values (no state updates)
  const getRateLimitValues = (uploads: Date[], isPro: boolean) => {
    const now = new Date(); //get the current time 
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); //get the time one hour ago in milliseconds
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); //get the time one day ago 

    const uploadsInHour = uploads.filter(date => date > oneHourAgo).length; //extract the number of uploads within the last one hour
    const uploadsInDay = uploads.filter(date => date > oneDayAgo).length; //extract the number of uploads within the last one day

    let canUploadNow = true; //set canUploadNow to true
    let nextAllowedAt: Date | null = null; //set next allowed at to null

    //If the plan is pro, 
    if (isPro) {
      //If the number of uploads within the last one hour exceeded the limit, restrict user from uploading 
      if (uploadsInHour >= RATE_LIMITS.PRO_HOURLY_LIMIT) {
        canUploadNow = false;

        //calculate when the user is going to be able to upload again
        const oldestUploadInHour = uploads
          .filter(date => date > oneHourAgo)
          .sort((a, b) => a.getTime() - b.getTime())[0];
        if (oldestUploadInHour) {
          nextAllowedAt = new Date(oldestUploadInHour.getTime() + 60 * 60 * 1000);
        }
      }

      //Check the daily limit for the pro user 
      if (uploadsInDay >= RATE_LIMITS.PRO_DAILY_LIMIT) {
        canUploadNow = false;

        //calculate when the user is going to be able to upload again
        const oldestUploadInDay = uploads
          .filter(date => date > oneDayAgo)
          .sort((a, b) => a.getTime() - b.getTime())[0];
        if (oldestUploadInDay) {
          nextAllowedAt = new Date(oldestUploadInDay.getTime() + 24 * 60 * 60 * 1000);
        }
      }

      //If the user has uploaded a file within the last 30 seconds, restrict user from uploading 
      if (uploads.length > 0) {
        const lastUpload = uploads[uploads.length - 1];
        const timeSinceLastUpload = now.getTime() - lastUpload.getTime();
        if (timeSinceLastUpload < RATE_LIMITS.PRO_MIN_INTERVAL * 1000) {
          canUploadNow = false; //set canUploadNow to false 
          nextAllowedAt = new Date(lastUpload.getTime() + RATE_LIMITS.PRO_MIN_INTERVAL * 1000);
        }
      }
    }

    //return the current state of the user in terms of rate limiting 
    return {
      uploadsInHour,
      uploadsInDay,
      canUploadNow,
      nextAllowedAt,
    };
  };

  //Update rate limits whenever recentUploads changes or user's plan changes 
  useEffect(() => {
    const rateLimitValues = getRateLimitValues(recentUploads, isProUser); //get the rate limit for the user 
    //update the values for the rate limits 
    setUploadsInLastHour(rateLimitValues.uploadsInHour);
    setUploadsInLastDay(rateLimitValues.uploadsInDay);
    setNextUploadAllowedAt(rateLimitValues.nextAllowedAt);

    //update the rate-limit state right when the user is allowed to upload a file again
    if (rateLimitValues.nextAllowedAt) {
      const now = new Date();
      const timeUntilNext = rateLimitValues.nextAllowedAt.getTime() - now.getTime(); //calculate the time until the user can upload a file again
      if (timeUntilNext > 0) {
        const timer = setTimeout(() => {
          // Trigger a re-calculation by updating a dummy state
          setRecentUploads(prev => [...prev]);
        }, timeUntilNext);
        
        return () => clearTimeout(timer);
      }
    }
  }, [recentUploads, isProUser]);

  // Mock RevenueCat initialization
  useEffect(() => {
    const initializeMockRevenueCat = async () => {
      try {
        //Simulate API call delay, stopping for one second
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock offerings
        const mockOfferings: MockOffering = {
          availablePackages: [
            {
              identifier: 'monthly', //identifies which package we are using in the revenuecat 
              packageType: 'MONTHLY',
              product: {
                identifier: 'pro_monthly',
                priceString: '¥600',
              },
            },
          ],
        };
        
        setOfferings(mockOfferings);
        if (__DEV__) console.log('Mock RevenueCat initialized'); //print only during development mode
      } catch (error) {
        console.error('Error initializing mock RevenueCat:', error);
      }
    };

    initializeMockRevenueCat(); //mock the revenue cat
  }, []);

  // Fetch subscription data from Supabase
  const fetchSubscriptionData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {

      //authenticate the user 
      const { data: { session } } = await supabase.auth.getSession();
      console.log(session?.access_token); //prints out the JWT token 

      //get the subscription data for the user 
      const { data: subscription, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (subError && subError.code !== 'PGRST116') { //PGRST116 means no rows returned
        console.error('Error fetching subscription:', subError);
      } else if (subscription) {
        setPlanType(subscription.plan_type as PlanType);
        setSubscriptionStatus(subscription.status as SubscriptionStatus);
      }

      //get usage stats for the user
      const { data: usage, error: usageError } = await supabase
        .from('user_usage_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (usageError && usageError.code !== 'PGRST116') {
        console.error('Error fetching usage:', usageError);
      } else if (usage) {
        setUploadCount(usage.uploads_this_month);
      }
    } catch (error) {
      console.error('Error in fetchSubscriptionData:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mock sync with Supabase
  const syncMockWithSupabase = async (isProSubscribed: boolean) => {
    if (!user) return;

    try {
      // Update Supabase subscription
      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          plan_type: isProSubscribed ? 'pro' : 'free',
          status: 'active',
          revenue_cat_customer_id: `mock_${user.id}`,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error syncing subscription:', error);
      } else {
        setPlanType(isProSubscribed ? 'pro' : 'free');
        setSubscriptionStatus('active');
      }
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

  // Increment upload count with rate limiting
  const incrementUploadCount = async () => {
    if (!user) return;

    // Check rate limits for Pro users using the pure helper function
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
          // last_upload_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error incrementing upload count:', error);
      } else {
        setUploadCount(newCount);
      }
    } catch (error) {
      console.error('Error in incrementUploadCount:', error);
      throw error;
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
        // Rate limiting values - derive canUploadNow from state instead of calling function
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