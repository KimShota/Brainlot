# OAuth設定ガイド (Google & Apple)

このガイドでは、Edu-ShortsアプリでGoogleとAppleのサードパーティログインを有効化する手順を説明します。

## 📋 目次

1. [Supabaseの設定](#1-supabaseの設定)
2. [Google OAuth設定](#2-google-oauth設定)
3. [Apple OAuth設定](#3-apple-oauth設定)
4. [リダイレクトURLの設定](#4-リダイレクトurlの設定)
5. [テスト](#5-テスト)

---

## 1. Supabaseの設定

### 1.1 Supabaseダッシュボードにアクセス

1. [Supabase Dashboard](https://supabase.com/dashboard)にログイン
2. プロジェクトを選択
3. 左サイドバーから **Authentication** → **Providers** をクリック

---

## 2. Google OAuth設定

### 2.1 Google Cloud Consoleでプロジェクトを作成

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成（または既存のプロジェクトを選択）
3. プロジェクト名: `Edu-Shorts`

### 2.2 OAuth同意画面を設定

1. 左サイドバーから **APIs & Services** → **OAuth consent screen** を選択
2. **User Type**: `External` を選択して **CREATE** をクリック
3. 以下の情報を入力:
   - **App name**: `Edu-Shorts`
   - **User support email**: あなたのメールアドレス
   - **Developer contact information**: あなたのメールアドレス
4. **SAVE AND CONTINUE** をクリック
5. **Scopes** セクションで **ADD OR REMOVE SCOPES** をクリック
6. 以下のスコープを追加:
   - `email`
   - `profile`
   - `openid`
7. **SAVE AND CONTINUE** をクリック
8. **Test users** セクションは開発中はスキップ可能
9. **SAVE AND CONTINUE** をクリック

### 2.3 OAuth認証情報を作成

1. 左サイドバーから **APIs & Services** → **Credentials** を選択
2. **+ CREATE CREDENTIALS** → **OAuth client ID** をクリック
3. **Application type**: `Web application` を選択
4. **Name**: `Edu-Shorts Web Client`
5. **Authorized JavaScript origins** に以下を追加:
   ```
   https://<your-project-ref>.supabase.co
   ```
6. **Authorized redirect URIs** に以下を追加:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
7. **CREATE** をクリック
8. **Client ID** と **Client Secret** をコピーして保存

### 2.4 SupabaseでGoogle Providerを有効化

1. Supabaseダッシュボードの **Authentication** → **Providers** に戻る
2. **Google** を探して **Enable** をオンにする
3. 以下の情報を入力:
   - **Client ID**: Google Cloud Consoleでコピーした Client ID
   - **Client Secret**: Google Cloud Consoleでコピーした Client Secret
4. **Save** をクリック

---

## 3. Apple OAuth設定

### 3.1 Apple Developer Accountの準備

1. [Apple Developer](https://developer.apple.com/)にログイン
2. **Certificates, Identifiers & Profiles** を開く

### 3.2 App IDの作成

1. **Identifiers** → **+** ボタンをクリック
2. **App IDs** を選択して **Continue**
3. **App** を選択して **Continue**
4. 以下の情報を入力:
   - **Description**: `Edu-Shorts`
   - **Bundle ID**: `com.edushorts.app` (Explicit)
5. **Capabilities** セクションで **Sign In with Apple** をチェック
6. **Continue** → **Register** をクリック

### 3.3 Services IDの作成

1. **Identifiers** → **+** ボタンをクリック
2. **Services IDs** を選択して **Continue**
3. 以下の情報を入力:
   - **Description**: `Edu-Shorts Auth`
   - **Identifier**: `com.edushorts.app.auth`
4. **Sign In with Apple** をチェック
5. **Configure** をクリック
6. **Primary App ID**: 先ほど作成した `com.edushorts.app` を選択
7. **Domains and Subdomains** に以下を追加:
   ```
   <your-project-ref>.supabase.co
   ```
8. **Return URLs** に以下を追加:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
9. **Next** → **Done** → **Continue** → **Register** をクリック

### 3.4 Keyの作成

1. **Keys** → **+** ボタンをクリック
2. **Key Name**: `Edu-Shorts Sign In with Apple Key`
3. **Sign In with Apple** をチェック
4. **Configure** をクリック
5. **Primary App ID**: `com.edushorts.app` を選択
6. **Save** → **Continue** → **Register** をクリック
7. **Download** をクリックして `.p8` ファイルをダウンロード
8. **Key ID** をコピーして保存
9. **Team ID** もコピーして保存（画面右上に表示されています）

### 3.5 SupabaseでApple Providerを有効化

1. Supabaseダッシュボードの **Authentication** → **Providers** に戻る
2. **Apple** を探して **Enable** をオンにする
3. 以下の情報を入力:
   - **Services ID**: `com.edushorts.app.auth`
   - **Team ID**: Apple Developerでコピーした Team ID
   - **Key ID**: Apple Developerでコピーした Key ID
   - **Private Key**: ダウンロードした `.p8` ファイルの内容をペースト
4. **Save** をクリック

---

## 4. リダイレクトURLの設定

### 4.1 Supabaseのリダイレクト設定

1. Supabaseダッシュボードの **Authentication** → **URL Configuration** を開く
2. **Site URL** を設定:
   ```
   edushorts://
   ```
3. **Redirect URLs** に以下を追加:
   ```
   edushorts://
   exp://localhost:8081
   ```
   (開発環境用に Expo Dev Client の URL も追加)

### 4.2 環境変数の確認

`.env` ファイル（またはExpoの環境設定）に以下が設定されていることを確認:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

---

## 5. テスト

### 5.1 開発環境でテスト

1. アプリを起動:
   ```bash
   cd frontend
   npm start
   ```

2. 実機またはシミュレーターでアプリを開く

3. 認証画面で **Continue with Google** または **Continue with Apple** をタップ

4. ブラウザが開き、OAuth認証画面が表示されることを確認

5. 認証完了後、アプリに戻り、ログイン状態になることを確認

### 5.2 よくある問題と解決策

#### ❌ 「Redirect URL mismatch」エラー

**原因**: リダイレクトURLが正しく設定されていない

**解決策**:
- Google Cloud ConsoleとSupabaseの両方でリダイレクトURLが一致していることを確認
- Supabaseの **URL Configuration** で `edushorts://` が追加されていることを確認

#### ❌ 「Invalid Client」エラー

**原因**: Client IDまたはClient Secretが間違っている

**解決策**:
- Google Cloud ConsoleまたはApple Developerで認証情報を再確認
- Supabaseの設定を更新

#### ❌ ブラウザが開いたまま、アプリに戻らない

**原因**: Deep Linkingが正しく設定されていない

**解決策**:
- `app.json` の `scheme` が `edushorts` に設定されていることを確認
- アプリを再ビルドする必要がある場合があります

---

## 📱 本番環境への移行

### Google OAuth

1. Google Cloud Consoleで OAuth同意画面を **In Production** に変更
2. 本番環境のリダイレクトURLを追加

### Apple OAuth

1. Apple Developer Accountで本番環境用の証明書を作成
2. App Store Connectでアプリを登録

### Supabase

1. 本番環境の Supabase プロジェクトで同じ設定を行う
2. 環境変数を本番環境用に更新

---

## 🔒 セキュリティのベストプラクティス

1. **Client Secretの保護**: 決してクライアントサイドに公開しない
2. **スコープの最小化**: 必要最小限のスコープのみを要求
3. **定期的なキーのローテーション**: セキュリティキーを定期的に更新
4. **HTTPSの使用**: すべての通信で HTTPS を使用

---

## 📚 参考リンク

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Sign in with Apple Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Expo Authentication Guide](https://docs.expo.dev/guides/authentication/)

---

## ✅ チェックリスト

完了したらチェックを入れてください:

- [ ] Google Cloud Consoleでプロジェクトを作成
- [ ] Google OAuth認証情報を作成
- [ ] SupabaseでGoogle Providerを有効化
- [ ] Apple Developer AccountでApp IDを作成
- [ ] Apple Developer AccountでServices IDを作成
- [ ] Apple Developer AccountでKeyを作成
- [ ] SupabaseでApple Providerを有効化
- [ ] リダイレクトURLを設定
- [ ] 開発環境でテスト（Google）
- [ ] 開発環境でテスト（Apple）

---

完成です！これでGoogleとAppleのサードパーティログインが使用できるようになりました 🎉

