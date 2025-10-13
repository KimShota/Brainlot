# 🎉 匿名認証への完全移行 - 完了ガイド

## ✅ 完了した変更

### 1. **AuthContext.tsx**
- 自動匿名サインイン機能を追加
- セッションがない場合、自動的に `signInAnonymously()` を実行

### 2. **App.tsx**
- AuthScreen を完全に削除
- 常に AppNavigator を表示（サインアップ/サインイン画面なし）

### 3. **UploadScreen.tsx**
- ❌ ログアウトボタンを削除
- ❌ 「Please log in」エラーメッセージを削除
- ✅ すべてのエラーメッセージを「Session error. Please restart the app.」に変更
- ✅ ヘッダーからログアウト機能を完全に削除

---

## 🔧 必須: Supabase設定（2ステップ）

### ステップ 1: 匿名認証を有効化 ✅

1. https://supabase.com/dashboard を開く
2. プロジェクトを選択
3. **Authentication** → **Providers**
4. **"Enable Anonymous Sign-ins"** を **ON** にする
5. **Save** をクリック

**✅ これは既に完了しています！**

---

### ステップ 2: データベーストリガーを修正（重要！）

**「Database error creating anonymous user」エラーを解決**

1. Supabase Dashboard → **SQL Editor**
2. `FIX_ANONYMOUS_AUTH_TRIGGER.sql` の内容をコピー&ペースト
3. **Run** をクリック

このSQLは以下を実行します:
- `handle_new_user()` 関数にエラーハンドリングを追加
- `ON CONFLICT DO NOTHING` で重複挿入を防止
- エラーが発生してもユーザー作成を成功させる

---

## 📱 動作確認

### 正常に動作する場合:

1. アプリを起動
2. ローディング画面が表示
3. **Upload画面が自動的に表示される**
4. ログイン/サインアップ画面なし
5. ファイルアップロードが正常に動作

### まだエラーが出る場合:

#### エラー: "Anonymous sign-in error"
→ Supabase Dashboardで **Anonymous Sign-ins を ON** にしてください

#### エラー: "Database error creating anonymous user"
→ `FIX_ANONYMOUS_AUTH_TRIGGER.sql` を実行してください

#### エラー: "Please log in to upload files"
→ アプリを完全に削除して再インストール（キャッシュクリア）

---

## 🔒 セキュリティ

### 何も変わりません！

- ✅ RLS (Row Level Security) は完全に機能
- ✅ ユーザーごとのデータ分離は維持
- ✅ `auth.uid()` ベースの制限は全て有効
- ✅ ファイル所有権は安全

### 匿名ユーザーの特徴:

- `role = 'authenticated'` が付与される
- 固有の `user.id` が発行される
- 既存のRLSポリシーがそのまま動作

---

## 💳 サブスクリプション連携

### RevenueCat (推奨)

```typescript
import Purchases from 'react-native-purchases';

const initRevenueCat = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await Purchases.configure({
      apiKey: 'YOUR_REVENUECAT_API_KEY',
      appUserID: user.id, // 匿名 user.id を使用
    });
  }
};
```

### 購入復元（必須実装）

```typescript
const restorePurchases = async () => {
  try {
    const purchaserInfo = await Purchases.restorePurchases();
    Alert.alert('Success', 'Purchases restored!');
  } catch (e) {
    Alert.alert('Error', 'Failed to restore purchases');
  }
};
```

### 購読管理導線（必須実装）

```typescript
import { Linking } from 'react-native';

// iOS
const openSubscriptionSettings = () => {
  Linking.openURL('https://apps.apple.com/account/subscriptions');
};

// Android
const openSubscriptionSettings = () => {
  Linking.openURL('https://play.google.com/store/account/subscriptions');
};
```

---

## 🔄 再インストール時の動作

### 何が起きるか:

1. アプリ削除 → 新しい匿名ユーザーが作成される（別の `user.id`）
2. 以前のデータは見えなくなる
3. **サブスクは「購入を復元」で再ひも付け可能**

### 対策:

- **「購入を復元」ボタンを実装**（推奨）
- 後から任意でメール/Apple/Googleアカウント連携機能を追加

---

## 📂 変更されたファイル

1. ✅ `frontend/src/contexts/AuthContext.tsx` - 匿名認証追加
2. ✅ `frontend/App.tsx` - AuthScreen削除
3. ✅ `frontend/src/screens/UploadScreen.tsx` - ログアウト削除、エラーメッセージ修正
4. 📄 `FIX_ANONYMOUS_AUTH_TRIGGER.sql` - トリガー修正SQL（要実行）

---

## 🚀 次のステップ

### 今すぐ実行:

1. ✅ Supabase Dashboard で Anonymous Sign-ins を有効化（完了）
2. ⚠️ **`FIX_ANONYMOUS_AUTH_TRIGGER.sql` を実行**（重要！）
3. アプリを完全に削除して再インストール
4. Upload画面が表示されるか確認

### 今後の実装（推奨）:

1. RevenueCat を導入してサブスク管理
2. 「購入を復元」ボタンを実装
3. 「購読を管理」ボタンを実装
4. （オプション）後からメール連携機能を追加

---

## 🆘 トラブルシューティング

### Q: まだ「Database error」が出る
A: `FIX_ANONYMOUS_AUTH_TRIGGER.sql` を実行してください。トリガーのエラーハンドリングを強化します。

### Q: アプリが起動直後にクラッシュする
A: 
1. アプリを完全削除
2. `npm run start -- --reset-cache` でキャッシュクリア
3. 再インストール

### Q: Upload画面でエラーが出る
A:
1. Supabase Dashboard → Database → Logs でエラー確認
2. RLS ポリシーが正しく設定されているか確認
3. `user_subscriptions` と `user_usage_stats` テーブルが存在するか確認

### Q: 将来的にマルチデバイス対応したい
A: 匿名ユーザーをメール/Apple/Googleアカウントにリンクする機能を追加すれば、同じ `user.id` で複数デバイスから利用可能になります。

---

## ✅ チェックリスト

- [x] AuthContext で匿名認証を実装
- [x] App.tsx で AuthScreen を削除
- [x] UploadScreen でログアウト機能を削除
- [x] すべての「log in」メッセージを削除
- [x] Anonymous Sign-ins を有効化
- [ ] **`FIX_ANONYMOUS_AUTH_TRIGGER.sql` を実行** ⬅️ **今すぐ実行！**
- [ ] アプリを再インストールしてテスト
- [ ] RevenueCat を導入
- [ ] 「購入を復元」ボタンを実装
- [ ] 「購読を管理」ボタンを実装

---

## 🎉 完了！

**これで、サインアップ/サインイン不要で安全にアプリを運用できます！**

`FIX_ANONYMOUS_AUTH_TRIGGER.sql` を実行して、アプリを再起動すれば完璧に動作します。

