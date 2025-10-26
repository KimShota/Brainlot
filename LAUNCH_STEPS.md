# 🚀 今すぐローンチ！ステップバイステップガイド

## ✅ 現在の状況

### 完了済み
- ✅ 環境変数が設定されている（`.env` ファイル確認済み）
- ✅ セキュリティ修正が完了
- ✅ 無状態アーキテクチャが実装済み
- ✅ レート制限とキャッシュ機能が実装済み
- ✅ `app.json` の設定が完了

### まだ必要なこと

---

## 📋 今すぐやるべき5つのステップ

### Step 1: 最終テスト（15分）

アプリを起動して動作確認：

```bash
cd frontend
npm start
```

**確認項目**:
1. サインアップ/ログインが動作する
2. PDF または画像をアップロードできる
3. MCQ が生成される
4. FeedScreen で MCQ が表示される
5. 正解/不正解の表示が正しい

---

### Step 2: Supabase の確認（10分）

#### 1. データベース確認

[Supabase Dashboard](https://app.supabase.com/) にログインして確認：

**確認項目**:
- `user_subscriptions` テーブルが存在する
- `user_usage_stats` テーブルが存在する

**SQL Editor で実行**:
```sql
-- テーブルの存在確認
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_subscriptions', 'user_usage_stats');
```

#### 2. Edge Function 確認

Supabase Dashboard > Edge Functions で確認：
- ✅ `generate-mcqs` がデプロイされている

#### 3. 環境変数確認

Supabase Dashboard > Edge Functions > Settings で確認：
- `GEMINI_API_KEY` が設定されている

---

### Step 3: プライバシーポリシーの準備（30分）

**必須**: App Store と Google Play に提出するため、プライバシーポリシーが必要

#### 簡単な作成方法：

GitHub Pages で無料ホスティング：

1. GitHub で新しいリポジトリを作成（例: `edushorts-privacy`）
2. `index.html` ファイルを作成：

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Privacy Policy - Edu-Shorts</title>
</head>
<body>
    <h1>Privacy Policy for Edu-Shorts</h1>
    
    <h2>Data Collection</h2>
    <p>We collect the following data:</p>
    <ul>
        <li>Email address (for authentication)</li>
        <li>Uploaded files (PDFs and images)</li>
    </ul>
    
    <h2>Data Usage</h2>
    <p>Email: Account management and communication</p>
    <p>Files: MCQ generation (processed by Google Gemini API)</p>
    <p><strong>Note: Files are NOT permanently stored.</strong></p>
    <p>MCQs are generated on-demand and not saved in our database.</p>
    
    <h2>Third-Party Services</h2>
    <ul>
        <li>Supabase: Authentication and storage</li>
        <li>Google Gemini: AI-powered MCQ generation</li>
    </ul>
    
    <h2>Contact</h2>
    <p>Email: your-email@example.com</p>
    
    <p><em>Last updated: October 2025</em></p>
</body>
</html>
```

3. GitHub Pages を有効化：
   - Settings > Pages > Source: `main` を選択
   - 数分後に URL が生成される（例: `https://yourusername.github.io/edushorts-privacy/`）

4. この URL を App Store Connect と Google Play Console に使用

---

### Step 4: App Store アセットの準備（2-3時間）

#### iOS (App Store Connect)

**必須アセット**:

1. **スクリーンショット**
   - iPhone 14 Pro Max (6.5"): 1290 x 2796 pixels
   - 最低 3枚、最大 10枚

2. **アプリアイコン**
   - 1024 x 1024 pixels (PNG)

3. **アプリ説明文**

#### Android (Google Play Console)

**必須アセット**:

1. **スクリーンショット**
   - Phone: 1080 x 1920 または 1080 x 2340 pixels
   - 最低 2枚

2. **Feature Graphic**
   - 1024 x 500 pixels

3. **アプリアイコン**
   - 512 x 512 pixels

---

### Step 5: ビルドと提出（1-2時間）

#### A. EAS Build を使用（推奨）

```bash
# EAS CLI をインストール（初回のみ）
npm install -g eas-cli

# ログイン
eas login

# 設定
cd frontend
eas build:configure

# ビルド
eas build --platform all --profile production
```

#### B. 提出

**iOS**:
1. EAS Build で生成された `.ipa` ファイルをダウンロード
2. App Store Connect にアップロード
3. メタデータを入力
4. 提出

**Android**:
1. EAS Build で生成された `.aab` ファイルをダウンロード
2. Google Play Console にアップロード
3. メタデータを入力
4. 提出

---

## ⏱️ 想定所要時間

| ステップ | 所要時間 |
|---------|---------|
| 最終テスト | 15分 |
| Supabase 確認 | 10分 |
| プライバシーポリシー | 30分 |
| アセット準備 | 2-3時間 |
| ビルドと提出 | 1-2時間 |
| **合計** | **4-6時間** |

---

## 🎯 今日できること

**今すぐできる（約1時間）**:
1. ✅ 最終テスト（15分）
2. ✅ Supabase 確認（10分）
3. ✅ プライバシーポリシー作成（30分）

**明日できる（2-4時間）**:
1. App Store アセット準備
2. ビルドと提出

---

## 📱 ローンチ後の確認事項

### リリース後にすべきこと

1. **監視**
   - Supabase Dashboard でエラーを確認
   - クラッシュレポートを監視
   - ユーザーフィードバックを収集

2. **マーケティング**
   - SNS で告知
   - 友人や知人に共有

3. **継続的改善**
   - ユーザーレビューを読む
   - アナリティクスを分析
   - 新機能を計画

---

## 🆘 サポート

### よくある問題

**問題1**: ビルドが失敗する
- 解決策: ログを確認してエラーを特定

**問題2**: App Store レビューで却下
- 解決策: 却下理由を読んで修正

**問題3**: 環境変数が見つからない
- 解決策: `.env` ファイルが正しい場所にあるか確認

### 参考資料

- `LAUNCH_NOW_CHECKLIST.md` - 詳細なチェックリスト
- `FINAL_LAUNCH_GUIDE.md` - 完全なローンチガイド
- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
- [App Store Connect](https://developer.apple.com/app-store-connect/)
- [Google Play Console](https://support.google.com/googleplay/android-developer/)

---

## ✅ 最終確認

ローンチする前に、以下を確認：

- [ ] `.env` ファイルが正しく設定されている
- [ ] Supabase でテーブルが存在する
- [ ] Edge Function がデプロイされている
- [ ] アプリが正常に動作する
- [ ] プライバシーポリシーが公開されている
- [ ] アセットが準備完了
- [ ] ビルドが成功する

---

## 🚀 Let's Launch!

すべての準備が整ったら、以下のコマンドでビルドを開始：

```bash
cd frontend
eas build --platform all --profile production
```

**幸運を祈っています！** 🎉

