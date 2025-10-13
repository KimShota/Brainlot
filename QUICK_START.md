# 🚀 クイックスタートガイド

**5分でアプリを起動しましょう！**

---

## 📋 前提条件

- Node.js 18以上
- npm または yarn
- Supabaseアカウント（無料）
- Google AI Studio APIキー（無料）

---

## ⚡ 3ステップでセットアップ

### ステップ 1: Supabaseプロジェクトを作成

1. [Supabase](https://supabase.com)にアクセス
2. **New Project** をクリック
3. プロジェクト名を入力（例: `quiz-reels`）
4. データベースパスワードを設定
5. リージョンを選択（日本の場合: Northeast Asia (Tokyo)）
6. **Create new project** をクリック

### ステップ 2: データベースとセキュリティを設定

#### 2.1 ストレージバケットを作成

1. Supabaseダッシュボード > **Storage** に移動
2. **New bucket** をクリック
3. 名前: `study`
4. **Public bucket** を **OFF** にする（重要！）
5. **Create bucket** をクリック

#### 2.2 SQLを実行

1. Supabaseダッシュボード > **SQL Editor** に移動
2. 以下のSQLファイルを順番に実行：

**a) テーブル作成**:
```sql
-- backend/supabase/migrations/create_subscription_tables.sql の内容をコピペ
```

**b) セキュリティ設定**（最重要！）:
```sql
-- backend/supabase/migrations/SECURITY_HARDENING.sql の内容をコピペ
```

#### 2.3 匿名認証を有効化

1. Supabaseダッシュボード > **Authentication** > **Providers** に移動
2. **Anonymous** を探す
3. **Enable anonymous sign-ins** をONにする
4. **Save** をクリック

### ステップ 3: 環境変数を設定

#### 3.1 Supabase認証情報を取得

1. Supabaseダッシュボード > **Project Settings** > **API** に移動
2. 以下をコピー：
   - **Project URL** （例: `https://xxxxx.supabase.co`）
   - **anon public key** （`eyJh...` で始まる長い文字列）

#### 3.2 `.env` ファイルを作成

```bash
cd frontend
touch .env
```

`.env` に以下を貼り付け（値は実際のものに置き換え）：

```bash
EXPO_PUBLIC_SUPABASE_URL=https://あなたのプロジェクト.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=あなたの匿名キー
```

#### 3.3 Gemini APIキーを取得

1. [Google AI Studio](https://makersuite.google.com/app/apikey) にアクセス
2. **Create API Key** をクリック
3. APIキーをコピー

#### 3.4 Edge Functionの環境変数を設定

1. Supabaseダッシュボード > **Edge Functions** > **Settings** に移動
2. **Add variable** をクリック
3. 変数名: `GEMINI_API_KEY`
4. 値: コピーしたGemini APIキー
5. **Save** をクリック

---

## 🛠️ Edge Functionをデプロイ

### Supabase CLIをインストール

```bash
npm install -g supabase
```

### プロジェクトをリンク

```bash
cd backend/supabase
supabase login
supabase link --project-ref あなたのプロジェクトID
```

**プロジェクトIDの確認方法**:
- Supabaseダッシュボード > Project Settings > General
- "Reference ID" をコピー

### デプロイ

```bash
supabase functions deploy generate-mcqs
```

✅ "Deployed Function generate-mcqs" と表示されたら成功！

---

## 📱 アプリを起動

### 依存関係をインストール

```bash
cd frontend
npm install
```

### アプリを起動

```bash
npx expo start
```

### デバイスで確認

- **iOS**: Expo Goアプリをダウンロードして、QRコードをスキャン
- **Android**: Expo Goアプリをダウンロードして、QRコードをスキャン
- **エミュレータ**: `i` (iOS) または `a` (Android) を押す

---

## ✅ 動作確認

1. **スプラッシュスクリーン**が表示される
2. **Upload Screen**に自動遷移
3. **Upload Material** ボタンをタップ
4. PDFまたは画像を選択
5. アップロード中... → "Upload Successful!"
6. **Go to Quizzes** をタップ
7. MCQが表示される（約30秒〜1分かかります）
8. クイズに回答して楽しむ！

---

## 🐛 トラブルシューティング

### アプリが起動しない

**原因**: `.env` ファイルが読み込まれていない

**解決策**:
```bash
# Expoサーバーを停止（Ctrl+C）してから
npx expo start --clear
```

### MCQが生成されない

**原因1**: Edge Functionがデプロイされていない
```bash
cd backend/supabase
supabase functions deploy generate-mcqs
```

**原因2**: Gemini APIキーが設定されていない
- Supabaseダッシュボード > Edge Functions > Settings を確認

**原因3**: エラーが発生している
- Supabaseダッシュボード > Logs > Edge Functions を確認

### ファイルがアップロードできない

**原因**: ストレージバケットが作成されていない、または公開設定が間違っている

**解決策**:
1. Supabaseダッシュボード > Storage を確認
2. `study` バケットが存在するか確認
3. バケットが **Private** であることを確認
4. `SECURITY_HARDENING.sql` を再度実行

### "Upload Limit Reached" エラー

**原因**: 無料プランで10回アップロードした

**これは正常な動作です！** 制限を解除するには：
- Option 1: Supabaseダッシュボードで手動で `user_usage_stats` テーブルの `upload_count` を0にリセット
- Option 2: Pro版機能を実装（RevenueCat等）

---

## 📚 次のステップ

✅ アプリが動作したら：

1. **[セキュリティ監査レポート](SECURITY_AUDIT_REPORT.md)** を読んで、実装されているセキュリティ対策を理解
2. **[ローンチチェックリスト](LAUNCH_CHECKLIST.md)** に従って、App Store / Google Play提出の準備
3. カスタマイズ:
   - `frontend/constants/theme.ts` で色を変更
   - `frontend/app.json` でアプリ名やアイコンを変更
   - プロンプトを編集してMCQの質を調整

---

## 💡 ヒント

- **開発環境**: `__DEV__` フラグで開発環境のみのログが有効化されています
- **リアルタイムログ**: Supabaseダッシュボード > Logs で全てのリクエストを監視できます
- **エラー追跡**: Edge Functionのエラーは Supabase Logs > Edge Functions で確認できます

---

## 🎉 完了！

これであなたのAI-powered Quiz Appが稼働しています！

質問や問題があれば、GitHubのIssuesで報告してください。

**Happy Coding! 🚀**

