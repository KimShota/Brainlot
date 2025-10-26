# アプリ名変更サマリー：Edu-Shorts → Brainlot

**日付**: 2025年10月12日  
**変更内容**: アプリ名を "Edu-Shorts" から "Brainlot" に変更

---

## ✅ 変更済みファイル

### 1. `frontend/app.json`
- `name`: "Edu-Shorts" → "Brainlot"
- `slug`: "edu-shorts" → "brainlot"
- `scheme`: "edushorts" → "brainlot"
- `bundleIdentifier`: "com.edushorts.app" → "com.brainlot.app"
- `package`: "com.edushorts.app" → "com.brainlot.app"
- `description`: "Brainlot - AI-Powered Learning Platform" に更新
- `associatedDomains`: "applinks:edushorts.app" → "applinks:brainlot.app"

### 2. `frontend/README.md`
- タイトル: "# Edu-Shorts" → "# Brainlot"
- 説明文を "Brainlot" に更新

### 3. `frontend/App.tsx`
- `prefixes`: ['edushorts://', prefix] → ['brainlot://', prefix]

### 4. `frontend/src/screens/AuthScreen.tsx`
- タイトル: "Edu-Shorts" → "Brainlot"

### 5. `frontend/src/screens/UploadScreen.tsx`
- ヘッダータイトル: "Edu-Shorts" → "Brainlot"

### 6. `frontend/ios/EduShorts/Info.plist`
- `CFBundleDisplayName`: "Edu-Shorts" → "Brainlot"
- `CFBundleURLSchemes`: "edushorts" → "brainlot"
- `CFBundleURLSchemes`: "com.edushorts.app" → "com.brainlot.app"
- 権限の説明文を "Brainlot" に更新

### 7. `LAUNCH_NOW_CHECKLIST.md`
- アプリ名を "Brainlot" に更新

---

## ⚠️ 注意事項

### Bundle ID と Package Name の変更について

**重要な変更**:
- iOS: `com.edushorts.app` → `com.brainlot.app`
- Android: `com.edushorts.app` → `com.brainlot.app`

**影響**:
- 既存のアプリインストール（TestFlight や開発版）に影響する可能性があります
- App Store / Google Play に提出する際、新しい Bundle ID を使用する必要があります

### ローカルビルドが必要

iOS の Info.plist を変更したので、以下のコマンドで再ビルドしてください：

```bash
cd frontend
npx expo prebuild --clean
```

または、iOS ディレクトリを削除して再ビルド：

```bash
cd frontend
rm -rf ios
npx expo prebuild
```

---

## 🔄 次のステップ

### 1. ローカルでビルド

```bash
cd frontend
npm start
```

### 2. EAS Build でビルド

```bash
cd frontend
eas build --platform all --profile production
```

### 3. Supabase の設定確認

Supabase の設定は変更不要ですが、以下の点を確認：

- ✅ Bundle ID: `com.brainlot.app`
- ✅ Package Name: `com.brainlot.app`

---

## 📱 App Store と Google Play での変更

### App Store Connect
- Bundle Identifier を `com.brainlot.app` に更新
- App Name を "Brainlot" に更新
- すべての説明文で "Brainlot" を使用

### Google Play Console
- Package Name を `com.brainlot.app` に更新
- App Name を "Brainlot" に更新
- すべての説明文で "Brainlot" を使用

---

## ✅ 完了

アプリ名の変更が完了しました！

**変更されたファイル数**: 7個  
**変更された場所**:
- 2 つの設定ファイル（app.json, Info.plist）
- 2 つのソースファイル（AuthScreen, UploadScreen）
- 3 つのドキュメントファイル

すべての主要な参照が "Brainlot" に更新されました！

