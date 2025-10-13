# 開発モードでの決済機能テストガイド

Apple Developer Programに登録していない場合でも、決済機能のUIとロジックをテストできます。

## 開発モードでの動作

現在の実装では、RevenueCatの代わりにモック実装を使用しています：

### 主な特徴
- ✅ **UI/UXのテスト**: プラン選択画面、アップロード制限、ショッピングカートボタン
- ✅ **データベース連携**: Supabaseでのサブスクリプション管理
- ✅ **アップロード制限**: 無料プランの10回制限
- ✅ **状態管理**: React Contextでのサブスクリプション状態
- ❌ **実際の決済**: Apple Developer Programが必要

## テスト手順

### 1. 環境変数の設定

`.env`ファイルを作成（RevenueCatのAPIキーは不要）:
```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_DEV_MODE=true
```

### 2. Supabaseのセットアップ

```bash
# Supabase SQL Editorで実行
backend/supabase/migrations/create_subscription_tables.sql
```

### 3. アプリの起動

```bash
cd frontend
npm install
npx expo start
```

### 4. 機能テスト

#### アップロード制限のテスト
1. Upload画面で「残り: 10/10 アップロード」を確認
2. PDFまたは画像をアップロード
3. アップロード回数が減ることを確認
4. 10回アップロード後、制限ダイアログが表示されることを確認

#### プラン選択のテスト
1. Upload画面下部の「Proにアップグレード」ボタンをタップ
2. Subscription画面でプラン比較を確認
3. 「今すぐアップグレード」をタップ
4. 開発モードのアラートが表示されることを確認
5. 「Proプランを有効化（テスト）」をタップ
6. Proプランが有効になり、無制限アップロードが可能になることを確認

#### 購入復元のテスト
1. Subscription画面で「購入を復元」をタップ
2. 開発モードのアラートが表示されることを確認
3. 「Proプランを復元（テスト）」をタップ
4. Proプランが復元されることを確認

## 本番環境への移行

Apple Developer Programに登録後、以下の手順で本番実装に移行：

### 1. RevenueCatのセットアップ
- [RevenueCat](https://app.revenuecat.com/)でアカウント作成
- プロダクトID `pro_monthly` を作成
- Entitlement `pro` を設定
- APIキーを取得

### 2. App Store Connectの設定
- Apple Developer Programに登録
- App Store Connectでサブスクリプション作成
- Bundle IDを設定

### 3. コードの更新
```typescript
// SubscriptionContext.tsx で以下を変更
import Purchases from 'react-native-purchases'; // 実際のRevenueCat
// モック実装を実際のRevenueCat実装に置き換え
```

### 4. 環境変数の更新
```bash
EXPO_PUBLIC_REVENUECAT_API_KEY=your_actual_revenuecat_api_key
EXPO_PUBLIC_DEV_MODE=false
```

## 現在の制限事項

### 開発モードでの制限
- 実際の決済は行われない
- App Store/Google Playの決済フローはテストできない
- RevenueCatのWebhookは動作しない

### テスト可能な機能
- ✅ サブスクリプション状態の管理
- ✅ アップロード制限の動作
- ✅ UI/UXの確認
- ✅ データベースの連携
- ✅ 状態管理の動作

## トラブルシューティング

### Supabaseのエラー
```bash
# テーブルが存在しない場合
# Supabase SQL Editorで以下を実行
CREATE TABLE IF NOT EXISTS user_subscriptions (...);
CREATE TABLE IF NOT EXISTS user_usage_stats (...);
```

### アップロード制限が動作しない
1. Supabaseの`user_usage_stats`テーブルを確認
2. Row Level Security (RLS) ポリシーが正しく設定されているか確認
3. ブラウザのコンソールでエラーを確認

### 状態が更新されない
1. React Contextが正しく設定されているか確認
2. `useSubscription`フックが正しく使用されているか確認
3. Supabaseの認証状態を確認

## 次のステップ

1. **UI/UXの改善**: 開発モードでのテスト結果を基にUIを調整
2. **Apple Developer Programへの登録**: 実際の決済機能を実装
3. **Google Play Consoleの設定**: Android版の決済機能を実装
4. **テストユーザーの設定**: 実際の決済フローをテスト

## サポート

開発モードでの問題がある場合は、以下を確認してください：
- Supabaseの接続設定
- データベーステーブルの存在
- React Contextの設定
- 環境変数の設定

実際の決済機能の実装については、Apple Developer Programへの登録後に`SETUP_PAYMENT.md`を参照してください。
