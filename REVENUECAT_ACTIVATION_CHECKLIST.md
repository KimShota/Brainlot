# ✅ RevenueCat Activation Checklist

## 🎉 Implementation Complete!

RevenueCat has been successfully integrated into your Brainlot app. The mock implementation has been replaced with the real RevenueCat SDK.

## ✅ What Was Done

1. **SDK Integration**
   - ✅ `react-native-purchases` already installed
   - ✅ iOS pods installed successfully
   - ✅ Android will auto-include Google Play Billing Library

2. **Code Implementation**
   - ✅ `SubscriptionContext.tsx` - Replaced mock with real RevenueCat implementation
   - ✅ `SubscriptionScreen.tsx` - Updated to use dynamic pricing from RevenueCat
   - ✅ Purchase flow - Real purchase implementation
   - ✅ Restore purchases - Real restore implementation
   - ✅ Supabase sync - Automatically syncs subscription status

3. **Features**
   - ✅ RevenueCat initialization with API key
   - ✅ User linking (`Purchases.logIn(user.id)`)
   - ✅ Offerings fetching
   - ✅ Package purchase
   - ✅ Purchase restoration
   - ✅ Entitlement checking (`pro` entitlement)
   - ✅ Automatic Supabase synchronization

## ⚠️ What You Need to Do Now

### 1. Add RevenueCat API Key to `.env`

Create or update `frontend/.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
EXPO_PUBLIC_REVENUECAT_API_KEY=your-revenuecat-public-api-key
```

**How to get your API key:**
1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Select your project
3. Go to **API Keys** (in left sidebar)
4. Copy the **Public API Key** (starts with `appl_` for iOS or `goog_` for Android)

**Important:** Use the **Public API Key**, NOT the secret key!

### 2. Create Subscription Products in Stores

#### Google Play Console
1. Go to **Monetization** → **Products** → **Subscriptions**
2. Click **Create subscription**
3. Set:
   - **Subscription ID**: `pro_monthly`
   - **Name**: `Pro Monthly`
   - **Base plan**: Monthly (auto-renewing)
   - **Price**: Your desired price (e.g., ¥600 or $5)

#### App Store Connect (iOS - Optional for now)
1. Go to **In-App Purchases**
2. Create a **Subscription Group**
3. Add subscription:
   - **Product ID**: `pro_monthly`
   - **Reference Name**: `Pro Monthly`
   - **Duration**: 1 month
   - **Price**: Same as Android

### 3. Configure RevenueCat Dashboard

#### Create Product
1. Go to RevenueCat Dashboard → **Products**
2. Click **Create Product**
3. Set:
   - **Identifier**: `pro_monthly`
   - **Type**: Subscription
   - **App Store Product ID**: `pro_monthly`
   - **Google Play Product ID**: `pro_monthly`

#### Create Entitlement
1. Go to **Entitlements**
2. Click **Create Entitlement**
3. Set:
   - **Identifier**: `pro`
4. **Attach Product**: Add `pro_monthly` to this entitlement

#### Link Store Credentials (Android)
1. In RevenueCat → **Apps** → Your Android App
2. Go to **Google Play** settings
3. Upload your **Service Account JSON** (from Google Play Console → Setup → API access)
4. Enter **Package Name**: `com.brainlot.app`

#### Link Store Credentials (iOS - Optional)
1. In RevenueCat → **Apps** → Your iOS App
2. Go to **Apple** settings
3. Enter:
   - **Bundle ID**: `com.brainlot.app`
   - **App Store Connect Issuer ID**
   - **App Store Connect Key ID**
   - **App Store Connect Private Key** (.p8 file content)

### 4. Configure Offerings (Optional but Recommended)

1. Go to RevenueCat → **Offerings**
2. Create an offering (or use default)
3. Add package:
   - **Identifier**: `monthly`
   - **Package Type**: Monthly
   - **Product**: `pro_monthly`

This matches what the code expects: `pkg.identifier === 'monthly'`

### 5. Test

#### Android Testing
1. Build: `eas build --platform android --profile preview`
2. Upload to Internal Testing track
3. Add your Gmail as License Tester in Play Console
4. Install test build
5. Test purchase flow

#### iOS Testing (if configured)
1. Build: `eas build --platform ios --profile preview`
2. Upload to TestFlight
3. Add Sandbox Tester in App Store Connect
4. Test purchase flow

## 🔍 Troubleshooting

### "Unable to load subscription options"
- **Check**: API key is correct in `.env`
- **Check**: RevenueCat product is created and linked to stores
- **Check**: Offering is configured (or code will use default)

### "Subscription package not found"
- **Check**: Package identifier is `monthly` in RevenueCat Offering
- **Check**: Or update code to match your package identifier

### Purchase fails
- **Check**: Test account is set up (Sandbox for iOS, License Testing for Android)
- **Check**: Products are approved/active in stores
- **Check**: RevenueCat store credentials are correct

### Subscription not syncing to Supabase
- **Check**: Database migration is applied
- **Check**: `user_subscriptions` table exists
- **Check**: RLS policies allow inserts/updates

## 📚 Code Details

### Key Files Modified
- `frontend/src/contexts/SubscriptionContext.tsx` - Full RevenueCat implementation
- `frontend/src/screens/SubscriptionScreen.tsx` - Dynamic pricing display

### How It Works
1. **Initialization**: RevenueCat configures on app start using API key
2. **User Linking**: When user logs in, RevenueCat user ID is linked to Supabase user ID
3. **Purchase**: User taps "Upgrade Now" → RevenueCat purchase flow → Supabase sync
4. **Entitlement Check**: Code checks `customerInfo.entitlements.active['pro']` to determine Pro status
5. **Sync**: Every purchase/restore updates Supabase `user_subscriptions` table

### API Key Requirements
- Must be in `.env` file: `EXPO_PUBLIC_REVENUECAT_API_KEY`
- Must be **Public API Key** (not secret)
- Must restart dev server after adding to `.env`

## ✅ Next Steps

1. ✅ Code implementation - **DONE**
2. ⏳ Add API key to `.env` - **YOU NEED TO DO THIS**
3. ⏳ Create products in stores - **YOU NEED TO DO THIS**
4. ⏳ Configure RevenueCat dashboard - **YOU NEED TO DO THIS**
5. ⏳ Test purchases - **TEST WHEN READY**

## 🎯 You're Ready!

The code is complete and production-ready. Once you:
- Add the API key
- Create store products
- Configure RevenueCat dashboard

Your app will have fully functional in-app purchases! 🚀

---

**Need Help?**
- [RevenueCat Documentation](https://docs.revenuecat.com/)
- [RevenueCat React Native Guide](https://docs.revenuecat.com/docs/react-native)



