# 匿名認証セットアップガイド

## ✅ 完了した変更

### 1. **AuthContext.tsx** - 匿名認証の自動実行
- アプリ起動時、セッションがなければ自動的に `signInAnonymously()` を実行
- ユーザーは何もしなくても固有の `user.id` と JWT を取得

### 2. **App.tsx** - AuthScreen のスキップ
- AuthScreen を完全に削除
- ローディング後は常に AppNavigator を表示
- サインアップ/サインイン画面なしで即座にアプリを使用可能

---

## 🔧 必須: Supabase Dashboard 設定

### ステップ 1: 匿名認証を有効化

1. **Supabase Dashboard** を開く: https://supabase.com/dashboard
2. プロジェクトを選択
3. **Authentication** → **Providers** (または **Sign in / Providers**)
4. **Anonymous Sign-ins** セクションを見つける
5. **"Enable Anonymous Sign-ins"** を **ON** にする
6. **Save** をクリック

### ステップ 2: オプション設定の調整

同じページで以下も確認：

- ✅ **Allow new users to sign up**: ON（匿名ユーザー作成に必要）
- ℹ️ **Confirm email**: 任意（匿名認証には無関係）
- ℹ️ **Enable email confirmations**: 任意（今後メール連携を追加する場合は設定）

---

## 🔒 セキュリティ: RLS は維持されます

匿名ユーザーでも:
- `role = 'authenticated'` が付与されます
- 固有の `auth.uid()` が発行されます
- 既存の RLS ポリシー（`auth.uid() = user_id`）は **そのまま機能します**

つまり:
- ✅ ユーザーごとのデータ分離は維持
- ✅ ファイル所有権は安全
- ✅ ストレージパス（`{user_id}/...`）も正常動作
- ✅ サブスクリプション管理も `user.id` で可能

---

## 📱 動作フロー

### 初回起動
1. アプリ起動
2. AuthContext が `getSession()` を実行 → セッションなし
3. 自動的に `signInAnonymously()` を実行
4. 新しい匿名ユーザー作成（`user.id` + JWT 発行）
5. トリガーで `user_subscriptions` と `user_usage_stats` が自動作成
6. Upload 画面が表示される

### 2回目以降の起動
1. アプリ起動
2. AuthContext が `getSession()` を実行 → 既存セッションあり
3. そのまま同じユーザーとして継続
4. Upload 画面が表示される

### アプリ削除後の再インストール
1. 新しい匿名ユーザーが作成される（別の `user.id`）
2. **重要**: ストア課金（Apple/Google）の「購入を復元」で、新しい `user.id` にサブスクを再ひも付け可能
3. RevenueCat を使えば自動処理が簡単

---

## 💳 サブスクリプション連携（推奨設定）

### RevenueCat を使う場合

```typescript
// UploadScreen または初期化時
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

### 購入復元ボタンの実装

```typescript
const restorePurchases = async () => {
  try {
    const purchaserInfo = await Purchases.restorePurchases();
    // RevenueCat Webhook → Supabase で自動的に user_subscriptions 更新
    Alert.alert('Success', 'Purchases restored!');
  } catch (e) {
    Alert.alert('Error', 'Failed to restore purchases');
  }
};
```

### 購読管理導線（必須）

iOS:
```typescript
import { Linking } from 'react-native';

const openSubscriptionSettings = () => {
  Linking.openURL('https://apps.apple.com/account/subscriptions');
};
```

Android:
```typescript
const openSubscriptionSettings = () => {
  Linking.openURL('https://play.google.com/store/account/subscriptions');
};
```

---

## 🔄 将来的な拡張（オプション）

### メール/Apple/Google でアカウント連携

後から「アカウント設定」画面を追加して、匿名ユーザーを永続アカウントにアップグレード可能：

```typescript
// 匿名ユーザーをメールアカウントにリンク
const linkEmailAccount = async (email: string, password: string) => {
  const { error } = await supabase.auth.updateUser({
    email,
    password,
  });
  
  if (error) {
    Alert.alert('Error', error.message);
  } else {
    Alert.alert('Success', 'Email account linked! You can now sign in on other devices.');
  }
};
```

これにより:
- 同じ `user.id` を維持したままマルチデバイス同期が可能
- データやサブスクも引き継がれる

---

## ✅ チェックリスト

完了したタスク:
- [x] AuthContext で匿名認証を実装
- [x] App.tsx で AuthScreen をスキップ
- [ ] **Supabase Dashboard で Anonymous Sign-ins を有効化** ⬅️ **これを今すぐ実行**
- [ ] RevenueCat の `appUserID` を `user.id` に設定
- [ ] 「購入を復元」ボタンを実装
- [ ] 「購読を管理」ボタンを実装
- [ ] RevenueCat Webhook → Supabase 連携を設定

---

## 🚀 次のステップ

1. **今すぐ**: Supabase Dashboard で Anonymous Sign-ins を有効化
2. アプリを再起動してテスト
3. RevenueCat 連携を設定（サブスク機能が必要な場合）
4. ストア提出の準備

---

## 📞 トラブルシューティング

### エラー: "Anonymous sign-ins are disabled"
→ Supabase Dashboard で Anonymous Sign-ins を有効化してください

### エラー: "Database error saving new user"
→ `user_subscriptions` / `user_usage_stats` のトリガーを確認
→ RLS ポリシーで INSERT が許可されているか確認

### 再インストール後にデータが消える
→ 正常な動作です（新しい匿名ユーザー）
→ サブスクは「購入を復元」で再ひも付け可能
→ データ引継ぎが必要なら、メール連携機能を追加

---

## 🎉 完了！

これで、サインアップ/サインイン不要で安全にアプリを運用できます！

