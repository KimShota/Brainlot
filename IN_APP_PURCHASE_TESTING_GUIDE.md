# 🧪 アプリ内課金テストガイド

このガイドでは、iOSとAndroidの両方でアプリ内課金をテストする方法を説明します。

## 📋 前提条件

### 1. RevenueCatの設定が完了していること
- ✅ RevenueCat Dashboardで製品が作成されている
- ✅ Entitlement (`pro`) が作成されている
- ✅ Offeringが設定されている（またはデフォルトを使用）
- ✅ API Keyが `.env` に設定されている

### 2. ストアで製品が作成されていること
- ✅ Google Play Console: サブスクリプション製品が作成済み
- ✅ App Store Connect: サブスクリプション製品が作成済み（iOSの場合）

---

## 🍎 iOS（Apple）でのテスト

### ステップ1: App Store ConnectでSandbox Testerを作成

1. **App Store Connect** にログイン
   - https://appstoreconnect.apple.com

2. **Users and Access** → **Sandbox Testers** を開く

3. **+** ボタンをクリックして新しいSandbox Testerを追加
   - **First Name**: テスト用の名前
   - **Last Name**: テスト用の名前
   - **Email**: **実際には存在しない**メールアドレス（例: `test+brainlot@example.com`）
   - **Password**: テスト用のパスワード
   - **Country**: 日本（またはテストしたい国）

4. **Create** をクリック

**重要**: Sandbox Testerのメールアドレスは、実際のApple IDとして使用されているものは使えません。

### ステップ2: テストビルドを作成・配布

1. **EAS Buildでビルド**:
   ```bash
   cd frontend
   eas build --platform ios --profile preview --clear-cache
   ```

2. **ビルドが完了したら、TestFlightにアップロード**:
   ```bash
   eas submit --platform ios --profile preview
   ```
   
   または、Expo DashboardからTestFlightにアップロード

3. **TestFlightでテストユーザーを追加**:
   - App Store Connect → **TestFlight** → あなたのアプリ
   - **Internal Testing** または **External Testing** を選択
   - テストユーザーを追加（Sandbox Testerと同じメールアドレスを使用）

### ステップ3: テストデバイスでテスト

1. **iPhone/iPadでテスト**:
   - TestFlightアプリをインストール
   - テストビルドをインストール
   - アプリを開く

2. **サインアウト**:
   - **設定** → **App Store** → 既存のApple IDからサインアウト（重要！）

3. **サブスクリプション画面を開く**:
   - アプリ内でサブスクリプション画面に移動
   - 「Upgrade Now」または「購入」ボタンをタップ

4. **Sandbox Testerでログイン**:
   - 購入ダイアログが表示されたら、Sandbox Testerのメールアドレスとパスワードを入力
   - **実際のApple IDは使用しない**（Sandbox環境で動作しない）

5. **テスト購入を実行**:
   - 購入が完了すると、Sandbox環境では実際の請求は発生しません
   - アプリ内でProプランが有効になっていることを確認

### ステップ4: テスト購入の確認

- ✅ アプリ内で「Pro User」として表示される
- ✅ Supabaseの `user_subscriptions` テーブルにレコードが作成される
- ✅ RevenueCat Dashboardで購入が表示される

### ⚠️ iOSテストの注意点

1. **Sandbox環境の制限**:
   - Sandbox購入は実際の請求を発生させません
   - サブスクリプションは自動更新されません（手動でテストする必要があります）
   - サブスクリプションの有効期限は通常、数分～数時間に短縮されます

2. **よくある問題**:
   - 「このApple IDは使用できません」: そのメールアドレスが実際のApple IDとして使用されている可能性
   - 「購入に失敗しました」: Sandbox Testerが正しく設定されていない可能性

---

## 🤖 Android（Google Play）でのテスト

### ステップ1: Google Play ConsoleでLicense Testerを設定

1. **Google Play Console** にログイン
   - https://play.google.com/console

2. **設定** → **License Testing** を開く

3. **License testers** セクションに、テスト用のGmailアドレスを追加
   - カンマ区切りで複数のメールアドレスを追加可能
   - 例: `your-email@gmail.com, test@gmail.com`

4. **Save** をクリック

**重要**: License Testerとして追加されたアカウントは、実際の請求なしで購入をテストできます。

### ステップ2: テストビルドを作成・配布

1. **EAS Buildでビルド**:
   ```bash
   cd frontend
   eas build --platform android --profile preview --clear-cache
   ```

2. **ビルドが完了したら、Internal Testingにアップロード**:
   ```bash
   eas submit --platform android --profile preview
   ```
   
   または、Google Play Consoleから直接APKをアップロード

3. **Internal Testingトラックを設定**:
   - Google Play Console → **Release** → **Testing** → **Internal testing**
   - 新しいリリースを作成して、ビルドしたAPKをアップロード
   - **Testers** セクションで、License Testerとして追加したメールアドレスを追加

### ステップ3: テストデバイスでテスト

1. **Androidデバイスでテスト**:
   - License Testerとして追加したGoogleアカウントでデバイスにログイン
   - Internal Testingトラックからアプリをインストール

2. **アプリを開く**:
   - アプリを起動
   - 必要に応じてログイン

3. **サブスクリプション画面を開く**:
   - アプリ内でサブスクリプション画面に移動
   - 「Upgrade Now」または「購入」ボタンをタップ

4. **テスト購入を実行**:
   - Google Playの購入ダイアログが表示される
   - 購入を完了すると、License Testerとして追加されたアカウントでは実際の請求は発生しません
   - アプリ内でProプランが有効になっていることを確認

### ステップ4: テスト購入の確認

- ✅ アプリ内で「Pro User」として表示される
- ✅ Supabaseの `user_subscriptions` テーブルにレコードが作成される
- ✅ RevenueCat Dashboardで購入が表示される
- ✅ Google Play Console → **Monetization** → **Subscriptions** で購入が表示される

### ⚠️ Androidテストの注意点

1. **License Testingの制限**:
   - License Testerとして追加されたアカウントのみがテスト購入できます
   - テスト購入は実際の請求を発生させません
   - サブスクリプションは自動更新されますが、テスト環境では無料です

2. **よくある問題**:
   - 「購入に失敗しました」: License Testerとして追加されていない可能性
   - 「製品が見つかりません」: 製品がまだ承認されていない、またはRevenueCatで正しくリンクされていない可能性

---

## 🔍 トラブルシューティング

### 問題1: 「Unable to load subscription options」が表示される

**原因**: RevenueCatの設定が不完全

**解決方法**:
1. `.env` ファイルにAPI Keyが正しく設定されているか確認
2. RevenueCat Dashboardで製品とEntitlementが作成されているか確認
3. Offeringが設定されているか確認（デフォルトのOfferingを使用する場合は不要）

### 問題2: 「Subscription package not found」が表示される

**原因**: OfferingのPackage Identifierがコードと一致していない

**解決方法**:
1. RevenueCat Dashboard → **Offerings** を確認
2. Package Identifierが `monthly` になっているか確認
3. または、`SubscriptionContext.tsx` のコードを修正して、実際のPackage Identifierに合わせる

### 問題3: 購入が完了してもProプランが有効にならない

**原因**: Supabaseへの同期が失敗している可能性

**解決方法**:
1. Supabase Dashboardで `user_subscriptions` テーブルを確認
2. RLS（Row Level Security）ポリシーが正しく設定されているか確認
3. アプリのログを確認してエラーがないか確認

### 問題4: iOSでSandbox購入ができない

**原因**: Sandbox Testerが正しく設定されていない、または既存のApple IDでログインしている

**解決方法**:
1. **設定** → **App Store** でApple IDからサインアウト
2. App Store ConnectでSandbox Testerが正しく作成されているか確認
3. Sandbox Testerのメールアドレスが実際のApple IDとして使用されていないか確認

### 問題5: Androidで購入ができない

**原因**: License Testerとして追加されていない、または製品が承認されていない

**解決方法**:
1. Google Play ConsoleでLicense Testerとして追加されているか確認
2. 製品が「承認済み」または「アクティブ」になっているか確認
3. Internal Testingトラックにビルドがアップロードされているか確認

---

## 📊 テストチェックリスト

### iOSテスト
- [ ] Sandbox Testerが作成されている
- [ ] TestFlightにビルドがアップロードされている
- [ ] デバイスでApp Storeからサインアウトしている
- [ ] アプリ内でサブスクリプション画面が表示される
- [ ] 購入フローが正常に動作する
- [ ] 購入後、Proプランが有効になる
- [ ] Supabaseにレコードが作成される
- [ ] RevenueCat Dashboardで購入が表示される

### Androidテスト
- [ ] License Testerが追加されている
- [ ] Internal Testingトラックにビルドがアップロードされている
- [ ] License TesterのGoogleアカウントでデバイスにログインしている
- [ ] アプリ内でサブスクリプション画面が表示される
- [ ] 購入フローが正常に動作する
- [ ] 購入後、Proプランが有効になる
- [ ] Supabaseにレコードが作成される
- [ ] RevenueCat Dashboardで購入が表示される
- [ ] Google Play Consoleで購入が表示される

---

## 🎯 実機テストのベストプラクティス

1. **常にテストアカウントを使用**: 本番環境のアカウントでテスト購入をしない
2. **ログを確認**: エラーが発生した場合は、アプリのログとRevenueCat Dashboardのログを確認
3. **段階的にテスト**: まず製品の読み込みが正常に動作するか確認し、その後購入フローをテスト
4. **複数のデバイスでテスト**: 異なるデバイスやOSバージョンでテストする
5. **購入の復元をテスト**: 「Restore Purchases」機能も必ずテストする

---

## 📚 参考リンク

- [RevenueCat Documentation](https://docs.revenuecat.com/)
- [RevenueCat React Native Guide](https://docs.revenuecat.com/docs/react-native)
- [Apple Sandbox Testing Guide](https://developer.apple.com/apple-pay/sandbox-testing/)
- [Google Play License Testing](https://support.google.com/googleplay/android-developer/answer/6062777)

---

**質問や問題があれば、ログを確認してからトラブルシューティングセクションを参照してください！**

