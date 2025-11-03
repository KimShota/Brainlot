import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
  } = useSubscription();

  // Get price from RevenueCat offerings
  const getProPrice = () => {
    if (offerings?.current?.availablePackages) {
      const monthlyPackage = offerings.current.availablePackages.find(
        pkg => pkg.identifier === 'monthly' || pkg.packageType === 'MONTHLY'
      );
      if (monthlyPackage?.product.priceString) {
        return monthlyPackage.product.priceString;
      }
    }
    return '$5/month'; // Fallback
  };

  const source = route?.params?.source || 'settings';

  const handlePurchase = async () => {
    await purchasePro();
    // Navigate back after successful purchase
    if (source === 'upload') {
      navigation.goBack();
    }
  };

  const handleRestore = async () => {
    await restorePurchases();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

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
              <Text style={[styles.featureText, { color: colors.foreground }]}>Up to 10 uploads</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              <Text style={[styles.featureText, { color: colors.foreground }]}>Generate 300 MCQs total</Text>
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
              >
                <LinearGradient
                  colors={[colors.gold!, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.upgradeButtonGradient}
                >
                  <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
                  <Ionicons name="arrow-forward" size={20} color="white" />
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
            • Free plan allows up to 10 uploads{'\n'}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
});

