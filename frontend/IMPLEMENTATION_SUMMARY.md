# 決済機能実装まとめ

## 実装した機能

### 1. データベーススキーマ

#### user_subscriptions テーブル
- ユーザーのサブスクリプション情報を管理
- フィールド:
  - `user_id`: ユーザーID
  - `plan_type`: プランタイプ（'free' または 'pro'）
  - `status`: サブスクリプションステータス（'active', 'cancelled', 'expired'）
  - `revenue_cat_customer_id`: RevenueCatの顧客ID
  - `revenue_cat_subscription_id`: RevenueCatのサブスクリプションID
  - `started_at`: 開始日時
  - `expires_at`: 有効期限

#### user_usage_stats テーブル
- ユーザーのアップロード回数を追跡
- フィールド:
  - `user_id`: ユーザーID
  - `upload_count`: アップロード回数
  - `last_upload_at`: 最終アップロード日時
  - `reset_at`: リセット日時

### 2. コンポーネント・コンテキスト

#### SubscriptionContext (`src/contexts/SubscriptionContext.tsx`)
- サブスクリプション状態を管理するReact Context
- 主な機能:
  - ユーザーのプラン情報取得
  - アップロード回数の管理
  - RevenueCatとSupabaseの同期
  - プラン購入・復元機能

#### SubscriptionScreen (`src/screens/SubscriptionScreen.tsx`)
- プラン選択・購入画面
- 特徴:
  - 無料プランとProプランの比較表示
  - 購入ボタン
  - 購入復元ボタン
  - 現在のプラン表示

#### UploadScreen の更新
- アップロード制限チェック機能を追加
- ショッピングカートボタンを画面下部に追加
- アップロード回数の表示
- 制限到達時のアップグレードプロンプト

### 3. ナビゲーション

#### AppNavigator の更新
- SubscriptionScreenをルートに追加
- Upload画面からSubscription画面への遷移を実装

### 4. プラン詳細

#### 無料プラン
```
- 料金: ¥0
- アップロード制限: 10回
- MCQ生成数: 300個（30個 × 10回）
```

#### Proプラン
```
- 料金: ¥600/月（$5/月）
- アップロード制限: 無制限
- MCQ生成数: 無制限
- 自動更新: あり
```

## アーキテクチャ

### データフロー

```
1. ユーザーログイン
   ↓
2. AuthContext がユーザー情報を管理
   ↓
3. SubscriptionContext がサブスクリプション情報を取得
   ↓
4. Supabase から user_subscriptions と user_usage_stats を取得
   ↓
5. RevenueCat と同期
   ↓
6. UI に反映（アップロード可能回数、プラン表示など）
```

### 購入フロー

```
1. ユーザーが「Proにアップグレード」をタップ
   ↓
2. SubscriptionScreen に遷移
   ↓
3. プランカードの「今すぐアップグレード」をタップ
   ↓
4. RevenueCat の購入フローを開始
   ↓
5. App Store / Google Play の決済画面
   ↓
6. 購入完了後、RevenueCat からコールバック
   ↓
7. Supabase の user_subscriptions を更新
   ↓
8. SubscriptionContext の状態を更新
   ↓
9. UI が自動的に更新される
```

### アップロード制限フロー

```
1. ユーザーがPDFまたは画像をアップロードしようとする
   ↓
2. SubscriptionContext の canUpload をチェック
   ↓
3. 無料ユーザーで制限に達している場合
   → アラートダイアログを表示
   → 「プランを見る」ボタンで SubscriptionScreen に遷移
   ↓
4. Pro ユーザーまたは制限内の場合
   → アップロード処理を実行
   → user_usage_stats の upload_count をインクリメント
```

## 使用技術

- **React Native**: モバイルアプリフレームワーク
- **Expo**: React Nativeの開発ツール
- **Supabase**: バックエンドサービス（データベース、認証）
- **RevenueCat**: サブスクリプション管理サービス
- **TypeScript**: 型安全性のための言語
- **React Context API**: 状態管理

## ファイル構成

```
frontend/
├── src/
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   └── SubscriptionContext.tsx      # 新規作成
│   ├── screens/
│   │   ├── AuthScreen.tsx
│   │   ├── UploadScreen.tsx             # 更新
│   │   ├── FeedScreen.tsx
│   │   └── SubscriptionScreen.tsx       # 新規作成
│   └── lib/
│       └── supabase.ts
├── App.tsx                               # 更新（SubscriptionProvider追加）
├── AppNavigator.tsx                      # 更新（Subscription画面追加）
├── package.json                          # 更新（react-native-purchases追加）
├── SETUP_PAYMENT.md                      # 新規作成
└── IMPLEMENTATION_SUMMARY.md            # このファイル

backend/
└── supabase/
    └── migrations/
        └── create_subscription_tables.sql  # 新規作成
```

## セットアップ手順

1. **依存関係のインストール**
   ```bash
   npm install
   ```

2. **Supabaseのマイグレーション実行**
   - Supabase SQL Editorで`create_subscription_tables.sql`を実行

3. **RevenueCatの設定**
   - RevenueCatアカウント作成
   - プロダクト設定（`pro_monthly`）
   - Entitlement設定（`pro`）
   - APIキー取得

4. **環境変数の設定**
   ```bash
   EXPO_PUBLIC_REVENUECAT_API_KEY=your_key_here
   ```

5. **App Store Connect / Google Play Consoleの設定**
   - サブスクリプションプロダクト作成
   - テスター追加

6. **テスト**
   ```bash
   npm run ios
   # または
   npm run android
   ```

## 今後の拡張案

1. **年間プランの追加**
   - 割引価格での年間サブスクリプション

2. **ファミリープラン**
   - 複数ユーザーでのプラン共有

3. **プロモーションコード**
   - 特別価格や無料トライアル

4. **使用状況の詳細統計**
   - ダッシュボードでの使用履歴表示

5. **オフライン対応**
   - ダウンロードしたMCQをオフラインで学習

## トラブルシューティング

### RevenueCatの初期化エラー
- APIキーが正しいか確認
- Bundle IDが一致しているか確認

### アップロード制限が更新されない
- Supabaseテーブルの確認
- Row Level Security (RLS) ポリシーの確認
- ブラウザのコンソールでエラーチェック

### 購入が完了しない
- テストアカウントでログインしているか確認
- App Store Connect/Google Play Consoleでプロダクトが承認されているか確認
- RevenueCatダッシュボードでトランザクションを確認

## サポート

質問や問題がある場合は、以下のドキュメントを参照してください：
- [RevenueCat Documentation](https://docs.revenuecat.com/)
- [Supabase Documentation](https://supabase.com/docs)
- [Expo Documentation](https://docs.expo.dev/)

