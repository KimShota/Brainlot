# 決済機能のセットアップガイド

このガイドでは、決済機能をセットアップする方法を説明します。

## 1. Supabaseのデータベースマイグレーション

まず、Supabaseプロジェクトでデータベーステーブルを作成する必要があります。

1. Supabaseダッシュボードにアクセス
2. SQL Editorを開く
3. 以下のファイルの内容を実行: `/backend/supabase/migrations/create_subscription_tables.sql`

または、Supabase CLIを使用する場合：

```bash
cd backend
supabase db push
```

## 2. RevenueCatのセットアップ

### 2.1 RevenueCatアカウント作成

1. [RevenueCat](https://app.revenuecat.com/)にアクセスしてアカウントを作成
2. 新しいプロジェクトを作成

### 2.2 アプリの設定

#### iOS (App Store)
1. RevenueCatダッシュボードで "App Store" を選択
2. Bundle IDを入力（例: `com.yourcompany.edushorts`）
3. App Store Connect APIキーを設定

#### Android (Google Play)
1. RevenueCatダッシュボードで "Google Play" を選択
2. Package nameを入力（例: `com.yourcompany.edushorts`）
3. Google Play Service Credentialsを設定

### 2.3 プロダクトの作成

1. RevenueCatダッシュボードで "Products" を選択
2. 新しいプロダクトを作成:
   - Identifier: `pro_monthly`
   - Type: `Subscription`
   - Duration: `1 month`
   - Price: `¥600` ($5)

3. App Store ConnectとGoogle Play Consoleでも同じプロダクトIDを作成

### 2.4 Entitlementsの作成

1. RevenueCatダッシュボードで "Entitlements" を選択
2. 新しいEntitlementを作成:
   - Identifier: `pro`
   - Products: `pro_monthly` を追加

### 2.5 APIキーの取得

1. RevenueCatダッシュボードで "API Keys" を選択
2. 以下のキーをコピー:
   - iOS用: App Store API Key
   - Android用: Google Play API Key

## 3. 環境変数の設定

`.env`ファイルを作成し、以下の変数を追加:

```bash
# Supabase Configuration (既存)
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# RevenueCat Configuration (新規追加)
EXPO_PUBLIC_REVENUECAT_API_KEY=your_revenuecat_api_key_here
```

**注意**: 
- iOSとAndroidで異なるAPIキーが必要な場合は、プラットフォーム別に設定してください
- 本番環境とテスト環境で異なるキーを使用することをお勧めします

## 4. App Store ConnectとGoogle Play Consoleの設定

### App Store Connect (iOS)

1. [App Store Connect](https://appstoreconnect.apple.com/)にログイン
2. "My Apps" → アプリを選択
3. "Features" → "In-App Purchases" を選択
4. 新しいサブスクリプションを作成:
   - Reference Name: `Pro Monthly`
   - Product ID: `pro_monthly`
   - Duration: `1 month`
   - Price: `¥600`

### Google Play Console (Android)

1. [Google Play Console](https://play.google.com/console/)にログイン
2. アプリを選択
3. "Monetization" → "Products" → "Subscriptions" を選択
4. 新しいサブスクリプションを作成:
   - Product ID: `pro_monthly`
   - Name: `Pro Monthly`
   - Billing period: `1 month`
   - Price: `¥600`

## 5. テスト

### 5.1 テストユーザーの設定

#### iOS
1. App Store Connectで "Users and Access" → "Sandbox Testers" を選択
2. テストユーザーを作成

#### Android
1. Google Play Consoleで "License Testing" を選択
2. テストアカウントを追加

### 5.2 アプリでのテスト

1. アプリをビルド: `npm run ios` または `npm run android`
2. テストアカウントでログイン
3. アップロード画面で "Proにアップグレード" ボタンをタップ
4. サブスクリプションを購入（テスト環境では課金されません）
5. アップロード制限が解除されることを確認

## 6. プランの詳細

### 無料プラン
- 料金: 無料
- アップロード回数: 10回まで
- MCQ生成数: 合計300個（30個 × 10回）

### Proプラン
- 料金: 月額¥600 ($5)
- アップロード回数: 無制限
- MCQ生成数: 無制限
- 自動更新: はい
- キャンセル: いつでも可能

## 7. トラブルシューティング

### RevenueCatの初期化エラー
- APIキーが正しいか確認
- Bundle IDまたはPackage nameがRevenueCatの設定と一致しているか確認

### 購入が完了しない
- テストアカウントでログインしているか確認
- App Store ConnectまたはGoogle Play Consoleでプロダクトが承認されているか確認

### アップロード制限が更新されない
- Supabaseのテーブルが正しく作成されているか確認
- RevenueCatのWebhookが正しく設定されているか確認（オプション）

## 8. 本番環境へのデプロイ

1. 環境変数を本番用に更新
2. RevenueCatのAPIキーを本番用に変更
3. App Store ConnectとGoogle Play Consoleでサブスクリプションを公開
4. アプリをストアに提出

## サポート

問題が発生した場合は、以下のドキュメントを参照してください：
- [RevenueCat Documentation](https://docs.revenuecat.com/)
- [Supabase Documentation](https://supabase.com/docs)
- [Expo Documentation](https://docs.expo.dev/)

