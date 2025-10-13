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

// Color theme
const colors = {
  background: '#f8fdf9',
  foreground: '#1a1f2e',
  primary: '#58cc02',
  secondary: '#ff9600',
  accent: '#1cb0f6',
  muted: '#f0f9f1',
  mutedForeground: '#6b7280',
  card: '#ffffff',
  border: '#e8f5e8',
  destructive: '#dc2626',
  gold: '#ffd700',
};

interface SubscriptionScreenProps {
  navigation: any;
  route?: {
    params?: {
      source?: 'upload' | 'settings';
    };
  };
}

export default function SubscriptionScreen({ navigation, route }: SubscriptionScreenProps) {
  const {
    planType,
    isProUser,
    uploadCount,
    uploadLimit,
    loading,
    purchasePro,
    restorePurchases,
    unsubscribeFromPro,
  } = useSubscription();

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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Plan</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={[colors.gold, colors.secondary]}
            style={styles.heroIconContainer}
          >
            <Ionicons name="trophy" size={48} color="white" />
          </LinearGradient>
          <Text style={styles.heroTitle}>Learn Without Limits!</Text>
          <Text style={styles.heroSubtitle}>
            {isProUser
              ? 'You are using Pro plan 🎉'
              : `${uploadLimit - uploadCount} uploads remaining`}
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
              <Text style={styles.planName}>Free Plan</Text>
              <Text style={styles.planPrice}>$0</Text>
            </View>
            <View style={styles.planIcon}>
              <Ionicons name="rocket-outline" size={32} color={colors.primary} />
            </View>
          </View>

          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              <Text style={styles.featureText}>Up to 10 uploads</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              <Text style={styles.featureText}>Generate 300 MCQs total</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
              <Text style={[styles.featureText, styles.disabledFeature]}>Unlimited access</Text>
            </View>
          </View>

          {!isProUser && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>Current Plan</Text>
            </View>
          )}
        </View>

        {/* Pro Plan Card */}
        <View style={[styles.planCard, styles.proPlanCard, isProUser && styles.activePlanCard]}>
          <LinearGradient
            colors={[`${colors.gold}15`, `${colors.secondary}15`]}
            style={styles.proGradient}
          >
            <View style={styles.popularBadge}>
              <Text style={styles.popularBadgeText}>Popular</Text>
            </View>

            <View style={styles.planHeader}>
              <View>
                <Text style={styles.planName}>Pro Plan</Text>
                <View style={styles.priceContainer}>
                  <Text style={styles.planPrice}>$5</Text>
                  <Text style={styles.pricePeriod}>/month</Text>
                </View>
              </View>
              <View style={[styles.planIcon, styles.proIcon]}>
                <Ionicons name="sparkles" size={32} color={colors.gold} />
              </View>
            </View>

            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={colors.gold} />
                <Text style={styles.featureText}>Unlimited uploads</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={colors.gold} />
                <Text style={styles.featureText}>Unlimited MCQ generation</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={colors.gold} />
                <Text style={styles.featureText}>Priority support</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={colors.gold} />
                <Text style={styles.featureText}>Ad-free</Text>
              </View>
            </View>

            {!isProUser && (
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={handlePurchase}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[colors.gold, colors.secondary]}
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
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Current Plan</Text>
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
          <Text style={styles.restoreButtonText}>Restore Purchases</Text>
        </TouchableOpacity>

        {/* Unsubscribe Button - Only show for Pro users */}
        {isProUser && (
          <TouchableOpacity
            style={styles.unsubscribeButton}
            onPress={unsubscribeFromPro}
            activeOpacity={0.7}
          >
            <Text style={styles.unsubscribeButtonText}>Unsubscribe from Pro</Text>
          </TouchableOpacity>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>💡 Tips</Text>
          <Text style={styles.infoText}>
            • Pro plan is $5/month and can be cancelled anytime{'\n'}
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
    backgroundColor: colors.background,
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
    backgroundColor: `${colors.primary}08`,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.foreground,
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
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.foreground,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: colors.mutedForeground,
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
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  activePlanCard: {
    borderColor: colors.primary,
  },
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
    backgroundColor: colors.gold,
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
    color: colors.foreground,
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  pricePeriod: {
    fontSize: 16,
    color: colors.mutedForeground,
    marginLeft: 4,
  },
  planIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  proIcon: {
    backgroundColor: `${colors.gold}15`,
  },
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
    color: colors.foreground,
  },
  disabledFeature: {
    color: colors.mutedForeground,
    textDecorationLine: 'line-through',
  },
  currentBadge: {
    marginTop: 20,
    backgroundColor: `${colors.primary}20`,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'center',
  },
  currentBadgeText: {
    color: colors.primary,
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
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  unsubscribeButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
    marginBottom: 24,
    backgroundColor: `${colors.destructive}15`,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${colors.destructive}30`,
  },
  unsubscribeButtonText: {
    color: colors.destructive,
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: `${colors.accent}10`,
    padding: 20,
    borderRadius: 16,
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: colors.mutedForeground,
    lineHeight: 22,
  },
});

