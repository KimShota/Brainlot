# 環境変数セットアップガイド (Environment Variables Setup Guide)

## 🔒 重要なセキュリティ情報

このアプリは環境変数を使用してSupabaseと安全に接続します。**絶対に実際の環境変数をGitにコミットしないでください。**

---

## 📋 必要な環境変数

### フロントエンド (frontend/)

以下の環境変数を設定する必要があります：

```bash
# Supabase URL（プロジェクトのURL）
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Supabase Anon Key（匿名キー - クライアント側で使用可能）
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### バックエンド (Edge Functions)

Edge Functionsは以下の環境変数を使用します（Supabaseダッシュボードで設定）：

```bash
# Gemini API Key（MCQ生成用）
GEMINI_API_KEY=your-gemini-api-key

# Supabase URL（自動設定）
SUPABASE_URL=https://your-project.supabase.co

# Supabase Service Role Key（Edge Functionのみ - 絶対にクライアントで使用しない）
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 🛠️ セットアップ手順

### 1. フロントエンドの環境変数設定

1. `frontend/` ディレクトリに移動
2. `.env` ファイルを作成（`.gitignore` に含まれています）
3. 以下の内容を記載：

```bash
EXPO_PUBLIC_SUPABASE_URL=https://あなたのプロジェクト.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=あなたの匿名キー
```

4. Supabaseダッシュボードから実際の値を取得：
   - **Project Settings** > **API** に移動
   - **Project URL** をコピー → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon/public key** をコピー → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### 2. Edge Functionsの環境変数設定

1. Supabaseダッシュボードを開く
2. **Edge Functions** > **Settings** に移動
3. 以下を追加：
   - `GEMINI_API_KEY`: Google AI Studioから取得したGemini APIキー

**注意**: `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` は自動的に設定されます。

### 3. Gemini APIキーの取得

1. [Google AI Studio](https://makersuite.google.com/app/apikey) にアクセス
2. **Create API Key** をクリック
3. APIキーをコピーして、Supabase Edge Functionsの環境変数に追加

---

## 🔐 セキュリティベストプラクティス

### ✅ 安全な使い方

- ✅ **Anon Key**: クライアント側（React Native）で使用可能
  - Row Level Security (RLS) によって保護されています
  - ユーザーは自分のデータのみにアクセス可能
- ✅ 環境変数ファイル (`.env`) を `.gitignore` に含める
- ✅ Edge Functionsでは必ずJWT認証を検証する

### ❌ 危険な使い方

- ❌ **Service Role Key**: **絶対にクライアント側で使用しない**
  - すべてのRLSをバイパスします
  - Edge Functionsでのみ使用
- ❌ `.env` ファイルをGitにコミットする
- ❌ APIキーをコードに直接記述する
- ❌ 環境変数をスクリーンショットで共有する

---

## 📱 プロダクション環境での注意事項

### App Store / Google Play提出時

1. **EAS Build** を使用する場合：
   ```bash
   # eas.json に環境変数を設定
   {
     "build": {
       "production": {
         "env": {
           "EXPO_PUBLIC_SUPABASE_URL": "your-url",
           "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-key"
         }
       }
     }
   }
   ```

2. **機密情報は EAS Secrets に保存**:
   ```bash
   eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-key"
   ```

---

## 🧪 開発モードでの確認

アプリを起動して、環境変数が正しく読み込まれているか確認：

```bash
cd frontend
npx expo start
```

コンソールに以下のようなログが表示されるはずです（開発モードのみ）：

```
URL from env: https://your-project.supabase.co
Anon key from env: eyJhbGc...
```

---

## ❓ トラブルシューティング

### 環境変数が読み込まれない場合

1. `.env` ファイルが `frontend/` ディレクトリの直下にあるか確認
2. ファイル名が正確に `.env` であるか確認（拡張子なし）
3. Expoサーバーを再起動:
   ```bash
   # サーバーを停止 (Ctrl+C)
   npx expo start --clear
   ```

### Edge Functionで環境変数が取得できない場合

1. Supabaseダッシュボードで環境変数が正しく設定されているか確認
2. Edge Functionを再デプロイ:
   ```bash
   supabase functions deploy generate-mcqs
   ```

---

## 📚 参考リンク

- [Expo環境変数ガイド](https://docs.expo.dev/guides/environment-variables/)
- [Supabase Edge Functions環境変数](https://supabase.com/docs/guides/functions/secrets)
- [EAS Build環境変数](https://docs.expo.dev/build-reference/variables/)

