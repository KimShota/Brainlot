# パスワードリセットシステム ガイド

このガイドでは、Edu-Shortsアプリに実装されたパスワードリセットシステムの使い方と仕組みを説明します。

## 📋 目次

1. [機能概要](#1-機能概要)
2. [ユーザーフロー](#2-ユーザーフロー)
3. [実装詳細](#3-実装詳細)
4. [Supabase設定](#4-supabase設定)
5. [テスト方法](#5-テスト方法)
6. [トラブルシューティング](#6-トラブルシューティング)

---

## 1. 機能概要

### 実装された機能

✅ **「Forgot Password?」リンク**
- サインイン画面にのみ表示
- タップするとパスワードリセットモーダルが開く

✅ **パスワードリセットモーダル**
- メールアドレス入力
- リセットメール送信
- ユーザーフレンドリーなUI

✅ **パスワードリセットフロー**
- メールでリセットリンクを受信
- アプリで新しいパスワードを設定
- 自動的にサインアウトして再ログインを促す

---

## 2. ユーザーフロー

### 完全なパスワードリセットプロセス

```
1. ユーザーがサインイン画面で「Forgot Password?」をタップ
   ↓
2. パスワードリセットモーダルが表示される
   ↓
3. ユーザーがメールアドレスを入力
   ↓
4. 「Send Reset Link」をタップ
   ↓
5. Supabaseがパスワードリセットメールを送信
   ↓
6. ユーザーがメールを開いてリンクをタップ
   ↓
7. アプリが開き、パスワードリセット画面が表示される
   ↓
8. ユーザーが新しいパスワードを入力（2回）
   ↓
9. 「Reset Password」をタップ
   ↓
10. パスワードが更新され、ユーザーは自動的にサインアウト
   ↓
11. 新しいパスワードでサインイン
```

---

## 3. 実装詳細

### AuthScreen.tsx の主要機能

#### 1. **状態管理**

```typescript
const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
const [resetEmail, setResetEmail] = useState('');
const [resetLoading, setResetLoading] = useState(false);
const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
const [newPassword, setNewPassword] = useState('');
const [confirmPassword, setConfirmPassword] = useState('');
```

#### 2. **パスワードリセットイベントの検出**

```typescript
useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            setIsPasswordRecovery(true);
        }
    });

    return () => {
        authListener.subscription.unsubscribe();
    };
}, []);
```

#### 3. **リセットメール送信**

```typescript
const handlePasswordReset = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: Linking.createURL('/'),
    });
    // エラーハンドリングと成功メッセージ
};
```

#### 4. **新しいパスワードの設定**

```typescript
const handleSetNewPassword = async () => {
    const { error } = await supabase.auth.updateUser({
        password: newPassword
    });
    // パスワード更新後、自動的にサインアウト
    supabase.auth.signOut();
};
```

### UI コンポーネント

#### 1. **「Forgot Password?」リンク**
- サインイン画面でのみ表示（`!isSignUp` 条件）
- パスワード入力欄の下に配置
- アクセント色でスタイリング

#### 2. **パスワードリセットモーダル**
- 半透明のオーバーレイ
- 下からスライドアニメーション
- キーアイコン付きヘッダー
- メール入力フィールド
- 「Send Reset Link」と「Cancel」ボタン

#### 3. **新パスワード設定画面**
- `isPasswordRecovery` が `true` の時に表示
- 鍵アイコン付きヘッダー
- 2つのパスワード入力フィールド
  - 新しいパスワード
  - 確認用パスワード
- パスワード表示/非表示トグル

---

## 4. Supabase設定

### 必要な設定

#### 1. **Email Templates の確認**

Supabaseダッシュボードで:
1. **Authentication** → **Email Templates** を開く
2. **Reset Password** テンプレートを確認
3. デフォルトのテンプレートで動作しますが、カスタマイズも可能

#### 2. **URL Configuration**

Supabaseダッシュボードで:
1. **Authentication** → **URL Configuration** を開く
2. **Site URL** を設定:
   ```
   edushorts://
   ```
3. **Redirect URLs** に以下を追加:
   ```
   edushorts://
   exp://localhost:8081
   ```

#### 3. **Email Settings**

Supabaseダッシュボードで:
1. **Project Settings** → **Authentication** を開く
2. **Email Auth** が有効になっていることを確認
3. 本番環境では、カスタムSMTPサーバーの設定を推奨

---

## 5. テスト方法

### 開発環境でのテスト

#### ステップ1: アプリを起動

```bash
cd frontend
npm start
```

#### ステップ2: テストユーザーでサインアップ

1. アプリでサインアップ
2. メールを確認してアカウントを有効化
3. サインアウト

#### ステップ3: パスワードリセットをテスト

1. サインイン画面で「Forgot Password?」をタップ
2. メールアドレスを入力
3. 「Send Reset Link」をタップ
4. メールを確認（開発環境ではSupabase Inbucketで確認可能）

#### ステップ4: メールからアプリに戻る

1. メール内のリセットリンクをタップ
2. アプリが開き、パスワードリセット画面が表示されることを確認
3. 新しいパスワードを入力（2回）
4. 「Reset Password」をタップ

#### ステップ5: 新しいパスワードでサインイン

1. サインイン画面に戻る
2. 新しいパスワードでサインイン
3. 正常にサインインできることを確認

### Supabase Inbucketでメールを確認

開発環境では、Supabaseが送信したメールをInbucketで確認できます:

```
http://localhost:54324/monitor
```

**注意**: この URL は Supabase CLI でローカル開発している場合のみ有効です。

---

## 6. トラブルシューティング

### ❌ 「Reset Email Sent」が表示されるが、メールが届かない

**原因**: メールアドレスが間違っているか、メール設定に問題がある

**解決策**:
- メールアドレスのスペルを確認
- 迷惑メールフォルダを確認
- Supabaseダッシュボードで Email Settings を確認
- 開発環境では Inbucket を確認

### ❌ リセットリンクをタップしてもアプリが開かない

**原因**: Deep Linking が正しく設定されていない

**解決策**:
- `app.json` の `scheme` が `edushorts` に設定されていることを確認
- Supabase の Redirect URLs が正しいことを確認
- アプリを再ビルド:
  ```bash
  npx expo run:ios
  # または
  npx expo run:android
  ```

### ❌ 「Invalid password reset link」エラー

**原因**: リセットリンクの有効期限が切れている

**解決策**:
- パスワードリセットリンクは1時間で期限切れになります
- 新しいリセットリンクをリクエストしてください

### ❌ パスワード更新後、サインインできない

**原因**: 古いパスワードを使用している可能性がある

**解決策**:
- 設定した新しいパスワードを使用していることを確認
- パスワードは最低6文字必要です
- それでもサインインできない場合は、もう一度パスワードリセットを実行

### ❌ 「Passwords do not match」エラー

**原因**: 2つのパスワード入力が一致していない

**解決策**:
- 両方のフィールドに同じパスワードを入力してください
- パスワード表示トグル（目のアイコン）を使用して確認

---

## 🎨 UI/UX の特徴

### デザイン要素

- **モーダルスタイル**: 半透明オーバーレイ + 下からスライド
- **アイコン**: パスワード関連は鍵アイコン
- **カラー**: Edu-Shortsのブランドカラー（グリーン + ブルーのグラデーション）
- **ハプティックフィードバック**: タップ時の触覚フィードバック

### アクセシビリティ

- **明確なラベル**: すべての入力フィールドにプレースホルダー
- **エラーメッセージ**: わかりやすいエラー表示
- **成功メッセージ**: 操作完了時の確認メッセージ
- **キーボードナビゲーション**: KeyboardAvoidingView でキーボード対応

---

## 🔒 セキュリティ

### 実装されているセキュリティ対策

1. **メール検証**: 有効なメールアドレスのみ受け付け
2. **パスワード検証**: 最低6文字のパスワード要件
3. **確認入力**: パスワードの二重入力で誤入力を防止
4. **セッション管理**: パスワード変更後は自動サインアウト
5. **タイムアウト**: リセットリンクは1時間で期限切れ
6. **Supabase Auth**: エンタープライズグレードの認証システム

---

## 📚 関連ドキュメント

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Password Reset](https://supabase.com/docs/guides/auth/auth-password-reset)
- [Expo Linking](https://docs.expo.dev/guides/linking/)

---

## ✅ チェックリスト

実装確認用チェックリスト:

- [x] 「Forgot Password?」リンクが表示される（サインイン画面のみ）
- [x] パスワードリセットモーダルが正しく動作する
- [x] リセットメールが送信される
- [x] メールのリンクからアプリに戻れる
- [x] 新しいパスワードを設定できる
- [x] パスワード検証が機能する
- [x] パスワード更新後にサインアウトする
- [x] 新しいパスワードでサインインできる
- [x] エラーハンドリングが適切
- [x] ハプティックフィードバックが動作する

---

完成です！ユーザーがパスワードを忘れても、簡単にリセットできるようになりました 🎉

