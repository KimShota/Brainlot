import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useTheme } from '../contexts/ThemeContext';

interface SubscriptionScreenProps {
  navigation: any;
  route?: {
    params?: {
      source?: 'upload' | 'settings';
    };
  };
}

export default function SubscriptionScreen({ navigation, route }: SubscriptionScreenProps) {
  const { colors } = useTheme();
  const [isPurchasing, setIsPurchasing] = React.useState(false);
  const {
    planType,
    isProUser,
    uploadCount,
    uploadLimit,
    loading,
    offerings,
    purchasePro,
    restorePurchases,
    unsubscribeFromPro,
    refreshSubscription,
  } = useSubscription();

  // Refresh subscription data when screen comes into focus
  // Use a ref to prevent multiple simultaneous refreshes
  const isRefreshingRef = React.useRef(false);
  
  useFocusEffect(
    React.useCallback(() => {
      // Prevent multiple simultaneous refreshes
      if (isRefreshingRef.current) {
        return;
      }
      
      isRefreshingRef.current = true;
      // Always refresh in background without showing loading screen
      // Content is displayed immediately with default/cached values
      refreshSubscription(false).finally(() => {
        // Reset after a short delay to allow the refresh to complete
        setTimeout(() => {
          isRefreshingRef.current = false;
        }, 1000);
      });
    }, [refreshSubscription])
  );

  // Get price from RevenueCat offerings
  const getProPrice = () => {
    if (offerings?.current?.availablePackages) {
      // RevenueCat may use $rc_monthly or monthly as identifier
      const monthlyPackage = offerings.current.availablePackages.find(
        pkg => pkg.identifier === 'monthly' || 
               pkg.identifier === '$rc_monthly' ||
               pkg.packageType === 'MONTHLY'
      );
      if (monthlyPackage?.product.priceString) {
        const priceString = monthlyPackage.product.priceString;
        // Replace "600 yen" or "¥600" with "$3.99 / month"
        if (priceString.includes('600') && (priceString.includes('yen') || priceString.includes('¥'))) {
          return '$3.99 / month';
        }
        return priceString;
      }
    }
    return '$3.99 / month'; // Fallback
  };

  const source = route?.params?.source || 'settings';

  const handlePurchase = async () => {
    if (isPurchasing) return; // Prevent multiple simultaneous purchases
    
    setIsPurchasing(true);
    try {
      await purchasePro();
      // Wait a moment for state to update before navigating
      // This ensures the UI reflects the new subscription status
      await new Promise(resolve => setTimeout(resolve, 500));
      // Navigate back after successful purchase
      if (source === 'upload') {
        navigation.goBack();
      }
    } catch (error: any) {
      // Error handling is done in purchasePro, but ensure we show something if it fails
      console.error('Purchase error:', error);
      if (error && !error.userCancelled) {
        Alert.alert(
          'Purchase Error',
          error.message || 'An error occurred during purchase. Please try again.'
        );
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    await restorePurchases();
  };

  const openTermsOfUse = async () => {
    const url = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open Terms of Use');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open Terms of Use');
    }
  };

  const openPrivacyPolicy = async () => {
    const url = 'https://kimshota.github.io/Brainlot/privacy-policy.html';
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open Privacy Policy');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open Privacy Policy');
    }
  };

  // Removed loading screen - always show content with default values
  // Data will be updated in the background via refreshSubscription

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: `${colors.primary}15` }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Choose Plan</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={[colors.gold!, colors.secondary]}
            style={[styles.heroIconContainer, { shadowColor: colors.gold }]}
          >
            <Ionicons name="trophy" size={48} color="white" />
          </LinearGradient>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>Learn Without Limits!</Text>
          <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
            {isProUser
              ? 'You are using Pro plan 🎉'
              : `${Math.max(0, uploadLimit - uploadCount)} uploads remaining`}
          </Text>
        </View>

        {/* Current Plan Badge */}
        {isProUser && (
          <View style={styles.currentPlanBadge}>
            <LinearGradient
              colors={[colors.primary, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.badgeGradient}
            >
              <Ionicons name="checkmark-circle" size={20} color="white" />
              <Text style={styles.badgeText}>Current Plan</Text>
            </LinearGradient>
          </View>
        )}

        {/* Free Plan Card */}
        <View style={[styles.planCard, !isProUser && styles.activePlanCard]}>
            <View style={styles.planHeader}>
              <View>
                <Text style={[styles.planName, { color: colors.foreground }]}>Free Plan</Text>
                <Text style={[styles.planPrice, { color: colors.foreground }]}>$0</Text>
              </View>
              <View style={[styles.planIcon, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons name="rocket-outline" size={32} color={colors.primary} />
            </View>
          </View>

          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              <Text style={[styles.featureText, { color: colors.foreground }]}>Up to 5 uploads per day</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              <Text style={[styles.featureText, { color: colors.foreground }]}>Generate 150 MCQs total</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
              <Text style={[styles.featureText, styles.disabledFeature, { color: colors.mutedForeground }]}>Unlimited access</Text>
            </View>
          </View>

          {!isProUser && (
            <View style={[styles.currentBadge, { backgroundColor: `${colors.primary}20` }]}>
              <Text style={[styles.currentBadgeText, { color: colors.secondary }]}>Current Plan</Text>
            </View>
          )}
        </View>

        {/* Pro Plan Card */}
        <View style={[styles.planCard, styles.proPlanCard, isProUser && styles.activePlanCard]}>
          <LinearGradient
            colors={[`${colors.gold}15`, `${colors.secondary}15`]}
            style={styles.proGradient}
          >
            <View style={[styles.popularBadge, { backgroundColor: colors.gold }]}>
              <Text style={styles.popularBadgeText}>Popular</Text>
            </View>

            <View style={styles.planHeader}>
                <View>
                  <Text style={[styles.planName, { color: colors.foreground }]}>Pro Plan</Text>
                  <View style={styles.priceContainer}>
                    <Text style={[styles.planPrice, { color: colors.foreground }]}>{getProPrice()}</Text>
                  </View>
                </View>
              <View style={[styles.planIcon, styles.proIcon, { backgroundColor: `${colors.gold}15` }]}>
                <Ionicons name="sparkles" size={32} color={colors.gold} />
              </View>
            </View>

            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={colors.gold} />
                <Text style={[styles.featureText, { color: colors.foreground }]}>Unlimited uploads</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={colors.gold} />
                <Text style={[styles.featureText, { color: colors.foreground }]}>Unlimited MCQ generation</Text>
              </View>
            </View>

            {!isProUser && (
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={handlePurchase}
                activeOpacity={0.9}
                disabled={isPurchasing || loading}
              >
                <LinearGradient
                  colors={[colors.gold!, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.upgradeButtonGradient, (isPurchasing || loading) && { opacity: 0.6 }]}
                >
                  {isPurchasing || loading ? (
                    <>
                      <ActivityIndicator size="small" color="white" />
                      <Text style={styles.upgradeButtonText}>Processing...</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
                      <Ionicons name="arrow-forward" size={20} color="white" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            {isProUser && (
              <View style={[styles.currentBadge, { backgroundColor: `${colors.primary}20` }]}>
                <Text style={[styles.currentBadgeText, { color: colors.secondary }]}>Current Plan</Text>
              </View>
            )}
          </LinearGradient>
        </View>

        {/* Restore Purchases Button */}
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          activeOpacity={0.7}
        >
          <Text style={[styles.restoreButtonText, { color: colors.secondary }]}>Restore Purchases</Text>
        </TouchableOpacity>

        {/* Legal Links Section */}
        <View style={styles.legalLinksContainer}>
          <TouchableOpacity
            onPress={openTermsOfUse}
            activeOpacity={0.7}
            style={[styles.legalLink, { 
              backgroundColor: `${colors.primary}10`,
              borderColor: `${colors.primary}20`,
            }]}
          >
            <Ionicons name="document-text-outline" size={20} color={colors.primary} />
            <Text style={[styles.legalLinkText, { color: colors.primary }]}>Terms of Use (EULA)</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={openPrivacyPolicy}
            activeOpacity={0.7}
            style={[styles.legalLink, { 
              backgroundColor: `${colors.primary}10`,
              borderColor: `${colors.primary}20`,
            }]}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
            <Text style={[styles.legalLinkText, { color: colors.primary }]}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Unsubscribe Button - Only show for Pro users */}
        {isProUser && (
          <TouchableOpacity
            style={[styles.unsubscribeButton, { 
              backgroundColor: `${colors.destructive}15`,
              borderColor: `${colors.destructive}30`,
            }]}
            onPress={unsubscribeFromPro}
            activeOpacity={0.7}
          >
            <Text style={[styles.unsubscribeButtonText, { color: colors.destructive }]}>Unsubscribe from Pro</Text>
          </TouchableOpacity>
        )}

        {/* Info Section */}
        <View style={[styles.infoSection, { backgroundColor: `${colors.accent}10` }]}>
          <Text style={[styles.infoTitle, { color: colors.foreground }]}>💡 Tips</Text>
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            • Pro plan is {getProPrice()} and can be cancelled anytime{'\n'}
            • Purchases auto-renew{'\n'}
            • Free plan allows up to 5 uploads{'\n'}
            • You can unsubscribe from Pro plan anytime
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  heroIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  currentPlanBadge: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  badgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  badgeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  planCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  activePlanCard: {},
  proPlanCard: {
    padding: 0,
    overflow: 'hidden',
  },
  proGradient: {
    padding: 24,
  },
  popularBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  planName: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  pricePeriod: {
    fontSize: 16,
    marginLeft: 4,
  },
  planIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  proIcon: {},
  featureList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 16,
  },
  disabledFeature: {
    textDecorationLine: 'line-through',
  },
  currentBadge: {
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'center',
  },
  currentBadgeText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  upgradeButton: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  upgradeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  upgradeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  restoreButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
    marginBottom: 24,
  },
  restoreButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  unsubscribeButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
    marginBottom: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  unsubscribeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
  },
  legalLinksContainer: {
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
    gap: 12,
  },
  legalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  legalLinkText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
});

