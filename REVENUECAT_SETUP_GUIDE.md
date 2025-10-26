# RevenueCat セットアップ完全ガイド

このガイドでは、Apple Developer Program と Google Play Console に登録されているアプリでRevenueCatを有効化する方法を説明します。

## 📋 前提条件

- ✅ Apple Developer Program に登録済み
- ✅ Google Play Console に登録済み
- ✅ Supabase でデータベースマイグレーション済み（`create_subscription_tables.sql`）
- ✅ React Native アプリが動作している

## 🚀 Step 1: RevenueCat アカウントの作成

1. [RevenueCat](https://app.revenuecat.com/) にアクセス
2. アカウントを作成またはログイン
3. 新しいプロジェクトを作成（例: "Edu-Shorts"）

## 📱 Step 2: iOS の設定（App Store Connect）

### 2.1 App Store Connect でプロダクトを作成

1. [App Store Connect](https://appstoreconnect.apple.com/) にログイン
2. "My Apps" → アプリを選択
3. "Features" → "In-App Purchases" を選択
4. 新しいサブスクリプションを作成:
   - Reference Name: `Pro Monthly`
   - Product ID: `pro_monthly`
   - Subscription Group: 新規作成（例: "Edu-Shorts Subscriptions"）
   - Duration: `1 month`
   - Price: `¥600`（または `$5`）

### 2.2 App Store Connect API キーの作成

1. App Store Connect で "Users and Access" を選択
2. "Keys" タブを選択
3. "App Store Connect API" セクションで新しいキーを作成
4. キーをダウンロード（`.p8` ファイル）
5. Issuer ID と Key ID をメモ

### 2.3 RevenueCat で iOS アプリを設定

1. RevenueCat ダッシュボードで "Apps" を選択
2. アプリを選択または新規作成
3. "Apple" を選択
4. 以下の情報を入力:
   - Bundle ID: `com.yourcompany.edushorts`（あなたのBundle ID）
   - App Store Connect Shared Secret: あなたの共有シークレット
   - App Store Connect Issuer ID: あなたのIssuer ID
   - App Store Connect Key ID: あなたのKey ID
   - App Store Connect Private Key: `.p8` ファイルの内容

## 🤖 Step 3: Android の設定（Google Play Console）

### 3.1 Google Play Console でプロダクトを作成

1. [Google Play Console](https://play.google.com/console/) にログイン
2. アプリを選択
3. "Monetization" → "Products" → "Subscriptions" を選択
4. 新しいサブスクリプションを作成:
   - Product ID: `pro_monthly`
   - Name: `Pro Monthly`
   - Billing period: `1 month`
   - Price: `¥600`（または `$5`）

### 3.2 Google Play Service Credentials の作成

1. Google Cloud Console でプロジェクトを作成または選択
2. "APIs & Services" → "Credentials" を選択
3. "Create Credentials" → "Service Account" を選択
4. サービスアカウントを作成
5. "Manage service account permissions" を選択
6. "Grant this service account access to the project" を選択
7. 以下のロールを付与:
   - Google Play Service Account
   - Google Play Developer
8. サービスアカウントのキーをダウンロード（JSON ファイル）

### 3.3 Google Play Console でサービスアカウントをリンク

1. Google Play Console で "Setup" → "API access" を選択
2. サービスアカウントのEmailを追加
3. "Link" をクリックしてアプリに接続
4. "Financial data" と "View app information and download bulk reports" の権限を付与

### 3.4 RevenueCat で Android アプリを設定

1. RevenueCat ダッシュボードで "Apps" を選択
2. アプリを選択
3. "Google Play" を選択
4. 以下の情報を入力:
   - Package Name: `com.yourcompany.edushorts`（あなたのPackage Name）
   - Service Account Credentials: JSON ファイルの内容

## 💰 Step 4: プロダクトとEntitlementの作成

### 4.1 RevenueCat でプロダクトを作成

1. RevenueCat ダッシュボードで "Products" を選択
2. 新しいプロダクトを作成:
   - Identifier: `pro_monthly`
   - Type: `Subscription`
   - App Store Product ID: `pro_monthly`
   - Google Play Product ID: `pro_monthly`
   - Duration: `1 month`

### 4.2 RevenueCat でEntitlementを作成

1. RevenueCat ダッシュボードで "Entitlements" を選択
2. 新しいEntitlementを作成:
   - Identifier: `pro`
   - Products: `pro_monthly` を追加

## 🔑 Step 5: API キーの取得

1. RevenueCat ダッシュボードで "API Keys" を選択
2. Public API Key をコピー（例: `appl_xxxxxxxxxx` または `goog_xxxxxxxxxx`）

## ⚙️ Step 6: アプリのコードを更新

### 6.1 環境変数の設定

`.env` ファイルを作成または更新：

```bash
# Supabase（既存）
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# RevenueCat（新規追加）
EXPO_PUBLIC_REVENUECAT_API_KEY=your_revenuecat_public_key
```

### 6.2 SubscriptionContext.tsx を更新

現在、`SubscriptionContext.tsx` はモック実装になっています。RevenueCatを統合するには、以下のコードで置き換えてください：

```typescript
import Purchases from 'react-native-purchases';

// RevenueCatの初期化
useEffect(() => {
  const initializeRevenueCat = async () => {
    try {
      if (Platform.OS === 'ios') {
        await Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY! });
      } else if (Platform.OS === 'android') {
        await Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY! });
      }

      // Set app user ID
      if (user?.id) {
        await Purchases.logIn(user.id);
      }

      // Fetch offerings
      const offerings = await Purchases.getOfferings();
      setOfferings(offerings);

      log('RevenueCat initialized');
    } catch (error) {
      logError('Error initializing RevenueCat:', error);
    }
  };

  initializeRevenueCat();
}, [user]);
```

### 6.3 購入機能の実装

```typescript
const purchasePro = async () => {
  try {
    if (!offerings) {
      Alert.alert('Error', 'Unable to load products');
      return;
    }

    const packageToPurchase = offerings.current?.availablePackages.find(
      pkg => pkg.identifier === 'monthly'
    );

    if (!packageToPurchase) {
      Alert.alert('Error', 'Product not found');
      return;
    }

    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    
    // Update Supabase
    await syncWithSupabase(customerInfo.entitlements.active['pro'] !== undefined);
    
    Alert.alert('Success', 'Pro plan purchased successfully!');
  } catch (error: any) {
    if (error.userCancelled) {
      return;
    }
    Alert.alert('Error', error.message || 'Purchase failed');
  }
};
```

### 6.4 復元機能の実装

```typescript
const restorePurchases = async () => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    
    const isProActive = customerInfo.entitlements.active['pro'] !== undefined;
    
    if (isProActive) {
      await syncWithSupabase(true);
      Alert.alert('Success', 'Purchases restored successfully!');
    } else {
      Alert.alert('No purchases found', 'No active subscriptions found');
    }
  } catch (error: any) {
    Alert.alert('Error', error.message || 'Failed to restore purchases');
  }
};
```

### 6.5 Supabaseとの同期

```typescript
const syncWithSupabase = async (isProSubscribed: boolean) => {
  if (!user) return;

  try {
    const { error } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: user.id,
        plan_type: isProSubscribed ? 'pro' : 'free',
        status: isProSubscribed ? 'active' : 'cancelled',
        updated_at: new Date().toISOString(),
      });

    if (error) {
      logError('Error syncing subscription:', error);
    } else {
      setPlanType(isProSubscribed ? 'pro' : 'free');
      setSubscriptionStatus(isProSubscribed ? 'active' : 'cancelled');
    }
  } catch (error) {
    logError('Error in syncWithSupabase:', error);
  }
};
```

## 🧪 Step 7: テスト

### 7.1 テストユーザーの設定

#### iOS
1. App Store Connect で "Users and Access" → "Sandbox Testers" を選択
2. テストユーザーを作成（実際のApple IDは使用しない）

#### Android
1. Google Play Console で "License Testing" を選択
2. テストアカウントのメールアドレスを追加（Gmail アカウント）

### 7.2 アプリでのテスト

1. アプリをビルド: `npm run ios` または `npm run android`
2. テストアカウントでログイン
3. Subscription 画面で "Upgrade Now" をタップ
4. サブスクリプションを購入（テスト環境では課金されません）
5. Pro プランの機能が有効になることを確認

## 📊 Step 8: 本番環境の確認

### 8.1 チェックリスト

- [ ] App Store Connect でサブスクリプションが "Ready to Submit" 状態
- [ ] Google Play Console でサブスクリプションが "Active" 状態
- [ ] RevenueCat で iOS と Android アプリが正しく設定されている
- [ ] API キーが正しく設定されている
- [ ] テストで正常に動作することを確認

### 8.2 アプリの提出

1. App Store Connect でアプリを提出
2. Google Play Console でアプリを提出
3. 審査が完了したら、RevenueCat ダッシュボードで収益を確認

## 🔍 トラブルシューティング

### プロダクトが見つからない

- App Store Connect と Google Play Console でプロダクトが作成されているか確認
- Product ID が一致しているか確認
- 審査が承認されているか確認

### 購入が完了しない

- テストアカウントでログインしているか確認
- インターネット接続を確認
- RevenueCat ダッシュボードでエラーがないか確認

### サブスクリプションが更新されない

- Supabase のデータベーステーブルが作成されているか確認
- RevenueCat の Webhook が正しく設定されているか確認（オプション）
- アプリがRevenueCat と正しく同期されているか確認

## 📚 参考資料

- [RevenueCat Documentation](https://docs.revenuecat.com/)
- [App Store Connect Help](https://developer.apple.com/help/app-store-connect/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [React Native Purchases Documentation](https://docs.revenuecat.com/docs/react-native)

## 💡 次のステップ

1. RevenueCat ダッシュボードでアナリティクスを確認
2. サブスクリプションの無料トライアルを追加（オプション）
3. 年間プランを追加（オプション）
4. プロモーションコードを設定（オプション）

