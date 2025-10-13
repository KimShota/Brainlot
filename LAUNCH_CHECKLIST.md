# 🚀 アプリローンチチェックリスト

**アプリ名**: Quiz Reels / Edu-Shorts  
**プラットフォーム**: iOS & Android  
**ステータス**: ローンチ準備中

---

## 📋 ローンチ前の必須タスク

### 🔐 1. セキュリティ設定（最重要）

#### ✅ Supabaseデータベース
```bash
# Supabaseダッシュボード > SQL Editor で以下を実行
```

- [ ] **`SECURITY_HARDENING.sql` を実行**
  - パス: `backend/supabase/migrations/SECURITY_HARDENING.sql`
  - このファイルには全てのRLSポリシーとセキュリティ設定が含まれています
  - 実行後、以下を確認：
    - ✅ ストレージバケット `study` が `public = false` になっている
    - ✅ 全テーブルでRLSが有効化されている
    - ✅ サブスクリプション/使用量テーブルへの書き込みポリシーが削除されている

#### ✅ Supabase認証設定
- [ ] **匿名認証を有効化**
  - Dashboard > Authentication > Providers > Anonymous
  - "Enable anonymous sign-ins" をON

#### ✅ ストレージ設定
- [ ] **`study` バケットがprivate**
  - Dashboard > Storage > study > Settings
  - "Public bucket" がOFFであることを確認

---

### 🔑 2. 環境変数設定

#### フロントエンド
- [ ] **`.env` ファイルを作成**
  ```bash
  cd frontend
  touch .env
  ```

- [ ] **環境変数を設定**
  ```bash
  EXPO_PUBLIC_SUPABASE_URL=https://あなたのプロジェクト.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=あなたの匿名キー
  ```

- [ ] **値の取得方法**
  - Supabase Dashboard > Project Settings > API
  - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
  - **anon/public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

#### Edge Functions
- [ ] **Gemini APIキーを設定**
  - Dashboard > Edge Functions > Settings > Environment Variables
  - 変数名: `GEMINI_API_KEY`
  - 値: Google AI Studio から取得したAPIキー
  - [Google AI Studio](https://makersuite.google.com/app/apikey)

---

### ⚙️ 3. Edge Function デプロイ

- [ ] **Supabase CLIをインストール**（未インストールの場合）
  ```bash
  npm install -g supabase
  ```

- [ ] **Supabaseにログイン**
  ```bash
  supabase login
  ```

- [ ] **プロジェクトをリンク**
  ```bash
  cd backend/supabase
  supabase link --project-ref あなたのプロジェクトID
  ```

- [ ] **Edge Functionをデプロイ**
  ```bash
  supabase functions deploy generate-mcqs
  ```

- [ ] **デプロイ成功を確認**
  - ターミナルに "Deployed Function generate-mcqs" と表示されることを確認

---

### 🧪 4. 機能テスト

#### 基本機能
- [ ] **アプリが起動する**
  ```bash
  cd frontend
  npx expo start
  ```

- [ ] **スプラッシュスクリーンが表示される**
  - Edu-Shortsロゴとアニメーション

- [ ] **匿名ログインが自動的に実行される**
  - エラーなく Upload Screen に遷移

#### アップロード機能
- [ ] **PDFファイルをアップロードできる**
  - 20MB以下のPDFファイルでテスト

- [ ] **画像ファイルをアップロードできる**
  - JPEG, PNG, GIF, WebPでテスト

- [ ] **MCQが生成される**
  - アップロード後、約30秒〜1分でMCQが生成される
  - Feed Screenに遷移してMCQが表示される

- [ ] **不正なファイルタイプが拒否される**
  - .txt, .docx などでテスト → エラーメッセージが表示される

- [ ] **大きすぎるファイルが拒否される**
  - 20MB以上のファイルでテスト → エラーメッセージが表示される

#### クイズ機能
- [ ] **MCQが正しく表示される**
  - 質問文が表示される
  - 4つの選択肢が表示される

- [ ] **回答が機能する**
  - 正解を選ぶと緑色になる
  - 不正解を選ぶと赤色になり、正解が緑色で表示される

- [ ] **一度回答したMCQは再回答できない**
  - 同じMCQに戻っても選択できない
  - "Answered" バッジが表示される

- [ ] **プログレスバーが機能する**
  - 問題番号（例: 6/30）が表示される
  - 🔥アイコンに正解数が表示される
  - バーがアニメーションで進む

- [ ] **スワイプヒントが表示される**
  - 最初のMCQに回答後、"Swipe down for next question" が表示される

- [ ] **祝福アニメーションが表示される**
  - 全てのMCQに回答すると花火アニメーション
  - "Back to MCQs" ボタンが表示される

#### アップロード制限
- [ ] **無料プランで10回までアップロードできる**
  - 10回目のアップロード後、制限メッセージが表示される

- [ ] **11回目のアップロードが拒否される**
  - "Upload Limit Reached" アラートが表示される
  - "View Plans" ボタンが表示される

#### セキュリティテスト
- [ ] **他のユーザーのデータにアクセスできない**
  - 2つの異なるデバイス/エミュレータでテスト
  - 各ユーザーは自分のMCQのみ表示される

- [ ] **Supabaseダッシュボードでストレージを確認**
  - ファイルが `user_id/filename` の形式で保存されている
  - 各ユーザーのファイルが分離されている

---

### 📱 5. アプリメタデータ設定

#### app.json の確認
- [ ] **アプリ名が正しい**
  - `name`: "Edu-Shorts"
  - `slug`: "edu-shorts"

- [ ] **バージョン情報**
  - `version`: "1.0.0"
  - `ios.buildNumber`: "1"
  - `android.versionCode`: 1

- [ ] **Bundle IDとPackage Name**
  - `ios.bundleIdentifier`: "com.yourcompany.edushorts"
  - `android.package`: "com.yourcompany.edushorts"
  - ⚠️ これらは一意である必要があります！

- [ ] **アプリアイコンとスプラッシュスクリーン**
  - `icon`: アイコン画像パスが正しい
  - `splash.image`: スプラッシュ画像パスが正しい

- [ ] **プライバシーの説明文**
  - `ios.infoPlist.NSPhotoLibraryUsageDescription`
  - `ios.infoPlist.NSCameraUsageDescription`
  - `android.permissions`

---

### 📄 6. 法的文書の準備

#### 必須文書
- [ ] **プライバシーポリシー**
  - 収集するデータ（アップロードしたファイル、使用統計）
  - データの使用目的（MCQ生成、学習体験の提供）
  - データの保管期間
  - ユーザーの権利（データ削除など）
  - 連絡先情報

- [ ] **利用規約**
  - サービスの説明
  - ユーザーの責任
  - 禁止事項
  - サービスの変更・終了に関する条項
  - 免責事項

- [ ] **文書のホスティング**
  - プライバシーポリシーと利用規約をWebサイトでホスト
  - URLを `app.json` に追加
    ```json
    "privacy": "https://your-website.com/privacy",
    "terms": "https://your-website.com/terms"
    ```

---

### 🏪 7. App Store 準備（iOS）

#### Apple Developer Account
- [ ] **Apple Developer Programに登録**
  - 年間 $99 USD
  - [Apple Developer](https://developer.apple.com/)

- [ ] **App Store Connect でアプリを作成**
  - Bundle ID: `app.json` の `ios.bundleIdentifier` と一致させる

#### アプリ情報
- [ ] **アプリ名**: Edu-Shorts
- [ ] **サブタイトル**: "Learn on the go with AI-powered quizzes"
- [ ] **カテゴリ**: Education
- [ ] **キーワード**: "quiz, education, AI, learning, study, MCQ"
- [ ] **説明文**（日本語と英語）

#### スクリーンショット
- [ ] **iPhone 6.7" (Pro Max)** スクリーンショット x5
- [ ] **iPhone 6.5" (Plus)** スクリーンショット x5
- [ ] **iPad Pro 12.9"** スクリーンショット x5（オプション）

#### アプリレビュー情報
- [ ] **連絡先情報**: メールアドレス、電話番号
- [ ] **デモアカウント**: 不要（匿名ログイン）
- [ ] **Notes**: アプリの使い方を簡潔に説明

---

### 🤖 8. Google Play 準備（Android）

#### Google Play Console
- [ ] **Google Play Developer アカウントを作成**
  - 一回限り $25 USD
  - [Google Play Console](https://play.google.com/console)

- [ ] **アプリを作成**
  - Package name: `app.json` の `android.package` と一致させる

#### ストアリスティング
- [ ] **アプリ名**: Edu-Shorts
- [ ] **簡単な説明**: 80文字以内
- [ ] **詳細な説明**: 4000文字以内
- [ ] **カテゴリ**: 教育
- [ ] **タグ**: quiz, education, AI, learning

#### グラフィック
- [ ] **アプリアイコン**: 512x512 PNG
- [ ] **フィーチャーグラフィック**: 1024x500 PNG
- [ ] **スクリーンショット**: 最低2枚、最大8枚

#### コンテンツレーティング
- [ ] **質問票に回答**: すべての年齢層向け（Everyone）

---

### 🔨 9. ビルドとデプロイ

#### EAS Build の準備
- [ ] **EAS CLIをインストール**
  ```bash
  npm install -g eas-cli
  ```

- [ ] **Expo アカウントでログイン**
  ```bash
  eas login
  ```

- [ ] **プロジェクトを設定**
  ```bash
  cd frontend
  eas build:configure
  ```

#### iOS ビルド
- [ ] **iOS本番ビルドを作成**
  ```bash
  eas build --platform ios --profile production
  ```

- [ ] **ビルド完了を待つ**（約15-30分）

- [ ] **IPA ファイルをダウンロード**

- [ ] **App Store Connect にアップロード**
  ```bash
  eas submit --platform ios
  ```

#### Android ビルド
- [ ] **Android本番ビルドを作成**
  ```bash
  eas build --platform android --profile production
  ```

- [ ] **ビルド完了を待つ**（約15-30分）

- [ ] **AAB ファイルをダウンロード**

- [ ] **Google Play Console にアップロード**
  ```bash
  eas submit --platform android
  ```

---

### 🧹 10. クリーンアップとコード品質

- [ ] **未使用のコードを削除**
  - コメントアウトされたコード
  - 使用されていないインポート

- [ ] **コンソールログを削除**
  - `console.log` は `__DEV__` フラグでラップされているか確認

- [ ] **リンターエラーを修正**
  ```bash
  cd frontend
  npm run lint
  ```

- [ ] **TypeScriptエラーを修正**
  ```bash
  npx tsc --noEmit
  ```

---

### 📊 11. 分析とモニタリング（オプションだが推奨）

- [ ] **Firebase Analytics を設定**（オプション）
- [ ] **Sentry でエラー追跡を設定**（推奨）
- [ ] **Supabase Logs を確認する習慣をつける**

---

### ✅ 12. 最終確認

- [ ] **全ての環境変数が正しく設定されている**
- [ ] **SECURITY_HARDENING.sql が実行されている**
- [ ] **Edge Function がデプロイされている**
- [ ] **アプリが iOS/Android 実機で動作する**
- [ ] **全ての主要機能が正常に動作する**
- [ ] **プライバシーポリシーと利用規約がホストされている**
- [ ] **App Store / Google Play の情報が全て入力されている**

---

## 🎉 ローンチ！

全てのチェックボックスにチェックが入ったら、以下を実行：

### iOS
1. App Store Connect > アプリ > "レビューに提出"
2. Apple の審査を待つ（通常1-3日）
3. 承認されたら公開！

### Android
1. Google Play Console > アプリ > "審査に送信"
2. Googleの審査を待つ（通常数時間〜1日）
3. 承認されたら公開！

---

## 📞 サポートとトラブルシューティング

### よくある問題

#### ビルドエラー
- [ ] `eas.json` の設定を確認
- [ ] `app.json` のバージョン番号を確認
- [ ] EAS Build ログを確認

#### 審査リジェクト
- [ ] プライバシーポリシーのURLが有効か確認
- [ ] スクリーンショットがガイドラインに準拠しているか確認
- [ ] アプリの説明が正確か確認

#### 実行時エラー
- [ ] Supabase ログを確認
- [ ] 環境変数が正しく設定されているか確認
- [ ] RLSポリシーが正しく設定されているか確認

---

## 🚀 ローンチ後のタスク

- [ ] ユーザーフィードバックを収集
- [ ] エラーログを定期的に確認
- [ ] パフォーマンスメトリクスを監視
- [ ] アップデートを計画（新機能、バグ修正）
- [ ] マーケティング戦略を実行

---

**頑張ってください！あなたのアプリは素晴らしいです！🎊**

