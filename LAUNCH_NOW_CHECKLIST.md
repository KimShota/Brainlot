# 🚀 今すぐローンチ！最終チェックリスト

**日付**: 2025年10月12日  
**アプリ**: Brainlot  
**ステータス**: ✅ ローンチ準備完了！

---

## ⚡ 今すぐやるべきこと

### 1. ✅ 環境変数の確認（CRITICAL）

#### 手順1: `.env` ファイルの作成

フロントエンドディレクトリに移動：
```bash
cd frontend
```

`.env` ファイルを作成または編集：
```bash
nano .env  # または vi .env, code .env
```

以下の内容を追加：
```bash
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# RevenueCat Configuration (オプション - モック使用中)
EXPO_PUBLIC_REVENUECAT_API_KEY=your-revenuecat-key-here
```

**確認方法**:
```bash
# frontendディレクトリで確認
cat .env
```

**⚠️ 重要**: `.env` ファイルはGitにコミットしないでください！

---

### 2. ✅ Supabase データベースの確認

#### 手順1: Supabase Dashboardにアクセス
1. [Supabase Dashboard](https://app.supabase.com/) にログイン
2. プロジェクトを選択

#### 手順2: テーブルの確認

**SQL Editor**を開いて、以下を実行：

```sql
-- user_subscriptionsテーブルの確認
SELECT * FROM user_subscriptions LIMIT 1;

-- user_usage_statsテーブルの確認
SELECT * FROM user_usage_stats LIMIT 1;

-- RLSが有効か確認
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('user_subscriptions', 'user_usage_stats');
```

✅ **確認項目**:
- `user_subscriptions` テーブルが存在する
- `user_usage_stats` テーブルが存在する
- `rowsecurity = true` である

#### 手順3: マイグレーションの実行（未実行の場合）

まだ実行していない場合：
```bash
cd backend
# SQLファイルの内容を確認
cat supabase/migrations/create_subscription_tables.sql
```

Supabase Dashboard > SQL Editor で実行：
1. SQL Editorを開く
2. `backend/supabase/migrations/create_subscription_tables.sql` の内容をコピー
3. 実行ボタンをクリック

---

### 3. ✅ Edge Function の確認

#### 手順1: Gemini API Key の設定

1. Supabase Dashboard > Edge Functions > Settings
2. 環境変数を確認：
   ```
   GEMINI_API_KEY=your-gemini-api-key
   ENVIRONMENT=production
   ```

#### 手順2: Edge Function がデプロイされているか確認

Dashboard > Edge Functions で以下が存在することを確認：
- ✅ `generate-mcqs`

---

### 4. ✅ アプリのローカルテスト

#### 手順1: 依存関係のインストール（未インストールの場合）

```bash
cd frontend
npm install
```

#### 手順2: アプリの起動

```bash
# 開発モードで起動
npx expo start

# または
npm start
```

#### 手順3: テスト用デバイスで実行

**開発ビルドを使用（推奨）**:
```bash
# iOS シミュレーター
npm run ios

# Android エミュレーター
npm run android
```

**Expo Go を使用**:
- iOS: App Store から Expo Go をダウンロード
- Android: Play Store から Expo Go をダウンロード
- QRコードをスキャンしてアプリを開く

---

### 5. 🧪 必須テスト項目

#### テスト1: サインアップ
- [ ] 新しいメールアドレスでサインアップ
- [ ] 確認メールが届く
- [ ] パスワードが6文字未満でエラー
- [ ] 無効なメール形式でエラー

#### テスト2: ログイン
- [ ] 正しい認証情報でログイン
- [ ] 誤ったパスワードでエラー表示

#### テスト3: PDFアップロード
- [ ] PDFファイルを選択
- [ ] MCQが生成される
- [ ] FeedScreenでMCQが表示される

#### テスト4: 画像アップロード
- [ ] JPEG/PNG画像を選択
- [ ] MCQが生成される

#### テスト5: ファイルサイズ制限
- [ ] 20MB以上のファイルでエラー表示

#### テスト6: 空状態
- [ ] 新規ユーザーで空状態が表示される
- [ ] "Get Started" ボタンが動作する

#### テスト7: MCQ 回答
- [ ] 正しい答えを選ぶ → 緑色
- [ ] 間違った答えを選ぶ → 赤色
- [ ] 次の質問にスワイプできる

#### テスト8: アップロード制限
- [ ] 無料プランで10回アップロード
- [ ] 11回目で制限ダイアログ表示

---

### 6. 📦 ビルドの準備

#### Option A: EAS Build（推奨）

**手順1: EAS CLI のインストール**
```bash
npm install -g eas-cli
```

**手順2: EAS にログイン**
```bash
eas login
```

**手順3: プロジェクト設定**
```bash
cd frontend
eas build:configure
```

**手順4: iOS ビルド**
```bash
eas build --platform ios --profile production
```

**手順5: Android ビルド**
```bash
eas build --platform android --profile production
```

#### Option B: ローカルビルド

詳細は `FINAL_LAUNCH_GUIDE.md` を参照

---

### 7. 📱 App Store Connect の準備

#### 必須項目チェックリスト

- [ ] Apple Developer Program に登録（$99/年）
- [ ] App Store Connect にログイン
- [ ] アプリを作成（Bundle ID: `com.edushorts.app`）
- [ ] スクリーンショットを準備（最低3枚）
- [ ] アプリアイコン（1024x1024）
- [ ] アプリ説明文を書く
- [ ] プライバシーポリシーURLを準備

#### App Store Connect 設定例

**App Information**:
```
Name: Edu-Shorts
Subtitle: AI-Powered MCQ Generator
Category: Education
```

**Description**:
```
Edu-Shortsは、学習資料を自動的にMCQ（多肢選択問題）に変換する学習アプリです。

主な機能：
📄 PDFアップロード
📸 画像アップロード
🎯 TikTokスタイルUI
💎 無料プランとProプラン

AIを使用して効率的に学習しましょう！
```

---

### 8. 🤖 Google Play Console の準備

#### 必須項目チェックリスト

- [ ] Google Play Developer に登録（$25 一回限り）
- [ ] Google Play Console にログイン
- [ ] アプリを作成（Package name: `com.edushorts.app`）
- [ ] スクリーンショットを準備
- [ ] Feature Graphic（1024x500）
- [ ] アプリ説明文を書く
- [ ] プライバシーポリシーURLを準備
- [ ] Content Rating を取得

---

### 9. 📝 プライバシーポリシー

#### 必須作成項目

1. **プライバシーポリシー**（必須）
   - どのようなデータを収集するか
   - データの使用方法
   - データの保存期間
   - サードパーティの使用（Supabase, Google Gemini）

2. **利用規約**（推奨）
   - サービスの利用条件
   - ユーザーの責任
   - 免責事項

#### 簡単なテンプレート

GitHub Pages または Netlify で無料ホスティング：
```markdown
# Privacy Policy for Edu-Shorts

## Data Collection
We collect the following data:
- Email address (for authentication)
- Uploaded files (PDFs and images)
- Generated MCQs

## Data Usage
- Email: Account management and communication
- Files: MCQ generation (processed by Google Gemini API)
- MCQs: Display in the app

## Data Storage
- Files are NOT permanently stored
- MCQs are generated on-demand and not saved
- All data is processed using Supabase

## Third-Party Services
- Supabase: Authentication and storage
- Google Gemini: AI-powered MCQ generation

## Contact
Email: your-email@example.com
```

---

### 10. 🔍 最終確認

#### 以下をすべてチェック：

- [ ] `.env` ファイルが正しく設定されている
- [ ] Supabase のマイグレーションが実行済み
- [ ] Edge Function がデプロイされている
- [ ] Gemini API Key が設定されている
- [ ] アプリがローカルで正常に動作する
- [ ] すべての必須テストをパスしている
- [ ] App Store Connect のアセットが準備完了
- [ ] Google Play Console のアセットが準備完了
- [ ] プライバシーポリシーが公開されている
- [ ] 利用規約が公開されている（推奨）

---

## 🎯 ローンチまでのタイムライン

### Day 1（今日）
- [x] 環境変数を設定
- [x] Supabase を確認
- [x] アプリをテスト
- [ ] ビルドを実行

### Day 2
- [ ] App Store アセットを準備
- [ ] プライバシーポリシーを公開
- [ ] 最終テスト

### Day 3
- [ ] App Store Connect に提出
- [ ] Google Play Console に提出

### Day 4-7
- [ ] レビュー待ち（Apple: 1-3日、Google: 数時間-1日）
- [ ] 承認後、公開！

---

## 📞 サポートが必要な場合

### よくあるエラー

**エラー1**: `EXPO_PUBLIC_SUPABASE_URL is undefined`
- 解決策: `.env` ファイルが正しく配置されているか確認

**エラー2**: Edge Function が404エラー
- 解決策: Supabase Dashboard で Edge Function がデプロイされているか確認

**エラー3**: Gemini API エラー
- 解決策: Gemini API Key が正しく設定されているか確認

### 参考ドキュメント

- `FINAL_LAUNCH_GUIDE.md` - 詳細なローンチガイド
- `SETUP_PAYMENT.md` - 決済機能のセットアップ
- `REVENUECAT_SETUP_GUIDE.md` - RevenueCat の設定
- `DEVELOPMENT_MODE_GUIDE.md` - 開発モードガイド

---

## ✅ 準備完了！

すべてのチェックが完了したら、以下のコマンドでビルドを開始してください：

```bash
cd frontend
eas build --platform all --profile production
```

ビルドが完了したら、App Store Connect と Google Play Console に提出してください！

**幸運を祈っています！** 🚀

