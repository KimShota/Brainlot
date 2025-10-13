# 📚 Edu-Shorts - AI-Powered Quiz App

**学習資料をアップロードして、AI生成のクイズで学ぶモバイルアプリ**

Duolingoライクなスワイプ可能なクイズ体験で、PDFや画像から自動的にMCQ（多肢選択問題）を生成します。

---

## ✨ 主な機能

- 📤 **簡単アップロード**: PDF、画像（JPEG、PNG、GIF、WebP）をアップロード
- 🤖 **AI生成クイズ**: Google Gemini 2.5 Flash-Liteで30問のMCQを自動生成
- 📱 **スワイプ体験**: Instagram Reelsライクな全画面スワイプUI
- 🔥 **プログレストラッキング**: リアルタイムで進捗と正解数を表示
- 🎉 **祝福アニメーション**: 全問題クリアで花火アニメーション
- 🔒 **セキュア**: 匿名認証、RLS、署名URL、レート制限完備
- 💎 **フリーミアムモデル**: 無料プランで10アップロード、Pro版で無制限

---

## 🏗️ 技術スタック

### フロントエンド
- **React Native** (Expo)
- **TypeScript**
- **Supabase Client** (認証、ストレージ、データベース)
- **Expo Vector Icons**
- **React Native Linear Gradient**
- **Expo Haptics**

### バックエンド
- **Supabase** (PostgreSQL、認証、ストレージ、RLS)
- **Supabase Edge Functions** (Deno)
- **Google Gemini API** (AI MCQ生成)

---

## 📂 プロジェクト構造

```
quiz-reels/
├── frontend/                    # React Native アプリ
│   ├── src/
│   │   ├── components/         # 再利用可能なコンポーネント
│   │   │   ├── MCQCard.tsx    # クイズカード
│   │   │   └── ProgressBar.tsx # プログレスバー
│   │   ├── contexts/          # React Contexts
│   │   │   ├── AuthContext.tsx        # 匿名認証
│   │   │   └── SubscriptionContext.tsx # サブスク管理
│   │   ├── screens/           # 画面コンポーネント
│   │   │   ├── FeedScreen.tsx        # クイズ画面
│   │   │   ├── UploadScreen.tsx      # アップロード画面
│   │   │   ├── SplashScreen.tsx      # スプラッシュ画面
│   │   │   └── SubscriptionScreen.tsx # サブスク画面
│   │   └── lib/
│   │       └── supabase.ts    # Supabase クライアント設定
│   ├── app.json               # Expo 設定
│   └── package.json
│
├── backend/
│   └── supabase/
│       ├── functions/
│       │   └── generate-mcqs/ # Edge Function (MCQ生成)
│       │       └── index.ts
│       └── migrations/
│           ├── create_subscription_tables.sql
│           └── SECURITY_HARDENING.sql  # セキュリティ設定
│
├── SECURITY_AUDIT_REPORT.md   # セキュリティ監査レポート
├── LAUNCH_CHECKLIST.md         # ローンチチェックリスト
├── ENV_SETUP_GUIDE.md          # 環境変数セットアップガイド
└── README.md                   # このファイル
```

---

## 🚀 セットアップ手順

### 1. リポジトリをクローン

```bash
git clone <your-repo-url>
cd quiz-reels
```

### 2. 環境変数を設定

#### フロントエンド

```bash
cd frontend
touch .env
```

`.env` に以下を追加：

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

詳細は [`ENV_SETUP_GUIDE.md`](ENV_SETUP_GUIDE.md) を参照。

### 3. 依存関係をインストール

```bash
cd frontend
npm install
```

### 4. Supabaseを設定

1. [Supabase](https://supabase.com) でプロジェクトを作成
2. `backend/supabase/migrations/create_subscription_tables.sql` を実行
3. **`backend/supabase/migrations/SECURITY_HARDENING.sql` を実行**（重要！）
4. 匿名認証を有効化: Dashboard > Authentication > Providers > Anonymous

### 5. Edge Functionをデプロイ

```bash
cd backend/supabase
supabase login
supabase link --project-ref your-project-id
supabase functions deploy generate-mcqs
```

Edge Functionsの環境変数を設定：
- Dashboard > Edge Functions > Settings
- `GEMINI_API_KEY`: Google AI Studioから取得

### 6. アプリを起動

```bash
cd frontend
npx expo start
```

---

## 🔐 セキュリティ機能

このアプリは本番環境に適したセキュリティ対策を実装しています：

✅ **匿名認証**: 全ユーザーに自動的にJWTトークンを発行  
✅ **Row Level Security (RLS)**: 全テーブルで有効化、ユーザーは自分のデータのみアクセス可能  
✅ **Privateストレージ**: ファイルは署名URL経由でのみアクセス可能  
✅ **レート制限**: Edge Functionで1分あたり10リクエスト制限  
✅ **入力検証**: ファイルタイプ、サイズ、UUID形式を厳格に検証  
✅ **エラーハンドリング**: 本番環境で詳細エラーを非表示  
✅ **環境変数保護**: `.env` を `.gitignore` に含め、Service Role Keyはサーバーサイドのみ  

詳細は [`SECURITY_AUDIT_REPORT.md`](SECURITY_AUDIT_REPORT.md) を参照。

---

## 📱 ローンチ準備

アプリをApp Store / Google Playに公開する準備ができています。

詳細な手順は [`LAUNCH_CHECKLIST.md`](LAUNCH_CHECKLIST.md) を参照してください。

### クイックチェック

- [ ] `SECURITY_HARDENING.sql` を実行済み
- [ ] 環境変数が設定済み
- [ ] Edge Functionがデプロイ済み
- [ ] アプリが正常に動作することを確認
- [ ] プライバシーポリシーと利用規約を準備

---

## 🧪 テスト

### 基本機能テスト

```bash
cd frontend
npx expo start
```

1. アプリが起動し、スプラッシュスクリーンが表示される
2. Upload Screenに自動遷移
3. PDFまたは画像をアップロード
4. MCQが生成され、Feed Screenに表示される
5. クイズに回答し、プログレスバーが更新される
6. 全問正解で祝福アニメーションが表示される

### セキュリティテスト

- 他のユーザーのデータにアクセスできないことを確認
- 不正なファイルタイプがアップロードできないことを確認
- アップロード制限（無料: 10回）が機能することを確認

---

## 📚 ドキュメント

- **[セキュリティ監査レポート](SECURITY_AUDIT_REPORT.md)**: 実装済みセキュリティ対策の詳細
- **[ローンチチェックリスト](LAUNCH_CHECKLIST.md)**: App Store / Google Play 提出の完全ガイド
- **[環境変数セットアップガイド](ENV_SETUP_GUIDE.md)**: 環境変数の設定方法

---

## 🛠️ トラブルシューティング

### アプリが起動しない

1. `node_modules` を削除して再インストール:
   ```bash
   rm -rf node_modules
   npm install
   ```
2. Expoキャッシュをクリア:
   ```bash
   npx expo start --clear
   ```

### MCQが生成されない

1. Supabase Logsを確認: Dashboard > Logs > Edge Functions
2. Gemini APIキーが正しく設定されているか確認
3. Edge Functionが最新版にデプロイされているか確認

### ファイルアップロードエラー

1. ストレージバケット `study` が存在するか確認
2. `SECURITY_HARDENING.sql` が実行されているか確認
3. 署名URLが正しく生成されているか確認（Supabase Logs）

---

## 🤝 貢献

このプロジェクトへの貢献を歓迎します！

1. このリポジトリをフォーク
2. 新しいブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

---

## 📄 ライセンス

このプロジェクトはMITライセンスの下でライセンスされています。

---

## 📧 お問い合わせ

質問や提案がある場合は、Issuesセクションで新しいIssueを作成してください。

---

## 🙏 謝辞

- **Google Gemini**: AI-powered MCQ generation
- **Supabase**: Backend infrastructure
- **Expo**: React Native development platform
- **Duolingo**: UI/UX inspiration

---

**Made with ❤️ using React Native, Supabase, and Google Gemini**

