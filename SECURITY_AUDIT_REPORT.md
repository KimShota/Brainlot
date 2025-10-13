# 🔒 セキュリティ監査レポート - Edu-Shorts Mobile App

**監査日時**: 2025年10月12日  
**対象**: モバイルアプリケーション（React Native + Expo）およびSupabaseバックエンド  
**監査範囲**: 全セキュリティ領域

---

## 📊 総合評価

| カテゴリ | 評価 | 重大度 |
|---------|------|--------|
| APIキー・シークレット管理 | ⚠️ 要改善 | 中 |
| Row Level Security (RLS) | ✅ 良好 | - |
| SQL インジェクション対策 | ✅ 良好 | - |
| 認証・認可 | ⚠️ 要改善 | 中 |
| Edge Function セキュリティ | ⚠️ 要改善 | 高 |
| ストレージセキュリティ | ❌ 脆弱 | 高 |
| 入力検証 | ⚠️ 要改善 | 中 |

**総合スコア**: 65/100（改善が必要）

---

## 🚨 重大な脆弱性（即座に対応が必要）

### 1. ストレージバケットがパブリックアクセス可能 🔴 **重大**

**問題**:
- `study`バケットがパブリック設定になっている
- 誰でもファイルをアップロード・ダウンロード可能
- ユーザー間のデータ分離が不十分

**影響**:
- 悪意のあるユーザーが無制限にファイルをアップロード可能
- 他のユーザーのファイルにアクセス可能
- ストレージ容量の悪用
- プライバシー侵害

**対策**: `security_fixes.sql`を実行して、ストレージポリシーを強化する

```sql
-- ストレージパスに user_id を含める構造に変更
-- 例: study/{user_id}/{filename}

CREATE POLICY "Authenticated users can upload to study bucket" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'study' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own files in study bucket" ON storage.objects
FOR SELECT USING (
    bucket_id = 'study' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
```

**追加対応**:
- ファイルアップロード時にパスを`{user_id}/{filename}`形式に変更する必要があります

---

### 2. Edge Function の JWT 検証が不完全 🟠 **高**

**問題**:
```typescript
// backend/supabase/functions/generate-mcqs/index.ts
// verify_jwt = true が config.toml で設定されているが、
// 関数内で明示的なユーザー検証がない
```

**影響**:
- 認証されていないリクエストが処理される可能性
- 他のユーザーの file_id を指定して MCQ 生成が可能

**対策**:
```typescript
// Edge Function の最初で必ずユーザー認証を確認
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(
    JSON.stringify({ ok: false, error: "Unauthorized" }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}

// file_id がユーザーのものか確認
const { data: fileOwner } = await supabase
  .from('files')
  .select('user_id')
  .eq('id', file_id)
  .single();

if (!fileOwner || fileOwner.user_id !== user.id) {
  return new Response(
    JSON.stringify({ ok: false, error: "Unauthorized access to file" }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );
}
```

---

### 3. クライアントサイドでのAPI呼び出しにサービスキーを使用 🟠 **高**

**問題**:
```typescript
// frontend/src/screens/UploadScreen.tsx:222-223
Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}`,
```

クライアント側で直接 Edge Function を呼び出していますが、anon key がクライアントに露出しています。

**影響**:
- anon key はクライアントに公開されるため、誰でも API を呼び出せる
- レート制限がない場合、悪用される可能性

**対策**:
1. **Supabase の Auth ヘッダーを使用**（推奨）:
```typescript
const { data: { session } } = await supabase.auth.getSession();

const fnRes = await fetch(`${baseUrl}${function_url}`, {
    method: "POST", 
    headers: {
        "Content-Type": "application/json", 
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${session?.access_token}`, // ユーザーのトークンを使用
    },
    body: JSON.stringify({ file_id: fileRow.id }),
});
```

2. **Edge Function でレート制限を実装**

---

## ⚠️ 中程度の脆弱性

### 4. 環境変数の console.log 出力 🟡 **中**

**問題**:
```typescript
// frontend/src/lib/supabase.ts:14-15
console.log("URL from env:", process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log("Anon key from env:", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 15) + "...");
```

**影響**:
- プロダクション環境でのログ露出
- デバッグ情報の漏洩

**対策**:
```typescript
// 開発環境でのみログ出力
if (__DEV__) {
  console.log("URL from env:", process.env.EXPO_PUBLIC_SUPABASE_URL);
  console.log("Anon key from env:", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 15) + "...");
}
```

---

### 5. ファイルサイズ制限が不十分 🟡 **中**

**問題**:
```typescript
// backend/supabase/functions/generate-mcqs/index.ts:40-44
if (fileSizeMB > 20) {
    throw new Error(`File too large: ${fileSizeMB.toFixed(1)}MB...`);
}
```

Gemini API の制限は適用されていますが、Supabase Storage 側での制限も必要です。

**対策**:
```typescript
// frontend/src/screens/UploadScreen.tsx での事前チェック
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// ファイルサイズをチェック
const fileInfo = await fetch(uri);
const blob = await fileInfo.blob();
if (blob.size > MAX_FILE_SIZE) {
    Alert.alert(
        "File Too Large", 
        `File size must be less than 20MB. Current size: ${(blob.size / 1024 / 1024).toFixed(1)}MB`
    );
    return;
}
```

また、Supabase Storage の設定も確認:
```toml
# backend/supabase/config.toml:103
file_size_limit = "50MiB"  # これを "20MiB" に変更することを推奨
```

---

### 6. ファイルタイプの検証が不十分 🟡 **中**

**問題**:
```typescript
// MIME タイプの検証が緩い
// 悪意のあるファイルをアップロードされる可能性
```

**対策**:
```typescript
// UploadScreen.tsx に MIME タイプ検証を追加
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
];

async function handleUpload(uri: string, mime: string) {
    // MIME タイプをチェック
    if (!ALLOWED_MIME_TYPES.includes(mime)) {
        Alert.alert(
            "Invalid File Type",
            "Please upload a PDF or image file (JPEG, PNG, GIF, WebP)"
        );
        return;
    }
    
    // ... 既存のコード
}
```

---

### 7. エラーメッセージが詳細すぎる 🟡 **中**

**問題**:
```typescript
// backend/supabase/functions/generate-mcqs/index.ts:96
throw new Error(`Gemini API failed: ${errorText}`);
```

**影響**:
- 詳細なエラー情報が攻撃者に漏洩
- システムの内部構造が露出

**対策**:
```typescript
// プロダクション環境では一般的なエラーメッセージを返す
const isDevelopment = Deno.env.get("ENVIRONMENT") === "development";

if (!res.ok) {
    const errorText = await res.text();
    console.error('Gemini API Error:', errorText); // サーバーログに記録
    
    const userMessage = isDevelopment 
        ? `Gemini API failed: ${errorText}` 
        : 'AI service is temporarily unavailable. Please try again later.';
    
    throw new Error(userMessage);
}
```

---

## ✅ 良好な実装

### 1. Row Level Security (RLS) の実装 ✅

**評価**: 適切に実装されています

- `files`, `mcqs`, `jobs`, `user_subscriptions`, `user_usage_stats` テーブルで RLS が有効化
- ユーザーは自分のデータのみアクセス可能
- `security_fixes.sql` で追加のセキュリティ強化が準備済み

```sql
-- 良好な例
CREATE POLICY "Users can view their own files" ON files
FOR SELECT USING (auth.uid() = user_id);
```

---

### 2. SQL インジェクション対策 ✅

**評価**: Supabase クライアントライブラリを使用しているため、SQL インジェクションのリスクは低い

```typescript
// パラメータ化されたクエリの使用
const { data } = await supabase
    .from("files")
    .select("id")
    .eq("user_id", user.id);
```

---

### 3. 認証の実装 ✅

**評価**: Supabase Auth を適切に使用

- セッション永続化が有効
- 自動トークン更新
- Auth Context で全体の認証状態を管理

---

### 4. HTTPS の使用 ✅

**評価**: Supabase は自動的に HTTPS を使用

---

## 🔧 推奨される改善事項

### 1. レート制限の実装 🔵 **推奨**

**現状**: レート制限がない

**推奨対策**:
```typescript
// Edge Function にレート制限を追加
import { RateLimiter } from 'https://deno.land/x/rate_limiter/mod.ts';

const rateLimiter = new RateLimiter({
    tokensPerInterval: 10, // 10リクエスト
    interval: "hour",      // 1時間あたり
});

// リクエストごとにチェック
const remainingRequests = await rateLimiter.removeTokens(user.id, 1);
if (remainingRequests < 0) {
    return new Response(
        JSON.stringify({ ok: false, error: "Rate limit exceeded" }),
        { status: 429 }
    );
}
```

---

### 2. ファイルのウイルススキャン 🔵 **推奨**

**推奨対策**:
- Supabase Storage の前に VirusTotal API などでスキャン
- または、AWS S3 + Lambda でマルウェアスキャン

---

### 3. 監査ログの実装 🔵 **推奨**

**推奨対策**:
```sql
-- 監査ログテーブルの作成
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

---

### 4. CSP (Content Security Policy) の実装 🔵 **推奨**

モバイルアプリでは必須ではありませんが、Web バージョンを展開する場合は実装を推奨。

---

### 5. CORS の適切な設定 🔵 **推奨**

**現状**: Supabase のデフォルト設定

**推奨**: 本番環境では特定のオリジンのみ許可

---

## 📋 実装チェックリスト

### 即座に実装すべき（ローンチ前に必須）

- [ ] **ストレージポリシーの強化**: `security_fixes.sql` を実行
- [ ] **ファイルパスの変更**: `{user_id}/{filename}` 形式に変更
- [ ] **Edge Function の認証強化**: ユーザー検証を追加
- [ ] **Authorization ヘッダーの修正**: ユーザートークンを使用
- [ ] **console.log の削除**: 本番環境での不要なログを削除
- [ ] **MIME タイプ検証**: 許可されたファイルタイプのみ受け入れ
- [ ] **ファイルサイズ制限**: クライアント側で事前チェック

### 短期的に実装すべき（ローンチ後1週間以内）

- [ ] **レート制限**: Edge Function にレート制限を追加
- [ ] **エラーハンドリング**: 詳細なエラーメッセージを隠蔽
- [ ] **監査ログ**: 重要なアクションを記録

### 中長期的に実装すべき（ローンチ後1ヶ月以内）

- [ ] **ファイルのウイルススキャン**: マルウェア対策
- [ ] **CSP**: Web バージョン用
- [ ] **セキュリティヘッダー**: X-Frame-Options, X-Content-Type-Options など

---

## 🔐 セキュリティベストプラクティス

### 1. 環境変数の管理

✅ **良好**:
- `.gitignore` に `.env*.local` が追加されている
- `EXPO_PUBLIC_` プレフィックスでクライアント公開変数を明示

⚠️ **改善点**:
- `.env.example` ファイルを作成して、必要な変数を文書化

```bash
# .env.example
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
EXPO_PUBLIC_REVENUECAT_API_KEY=your_revenuecat_key_here
```

---

### 2. データ検証

✅ **良好**:
- TypeScript による型安全性
- Supabase のスキーマ検証

⚠️ **改善点**:
- クライアント側でのより厳格な検証
- Zod や Yup などの検証ライブラリの使用を検討

---

### 3. 認証フロー

✅ **良好**:
- Supabase Auth による安全な認証
- セッション管理が適切

⚠️ **改善点**:
- パスワードポリシーの強化（最小8文字、大文字小文字数字記号を含む）
- 2FA (二要素認証) の実装を検討

---

## 📝 コード修正例

### 修正1: UploadScreen.tsx - 安全なファイルアップロード

```typescript
// frontend/src/screens/UploadScreen.tsx
async function handleUpload(uri: string, mime: string){
    try {
        setLoading(true);

        // 1. MIME タイプ検証
        const ALLOWED_MIME_TYPES = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp'
        ];
        
        if (!ALLOWED_MIME_TYPES.includes(mime)) {
            throw new Error("Invalid file type. Please upload a PDF or image file.");
        }

        // 2. ユーザー認証確認
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            throw new Error("User not authenticated");
        }

        // 3. ファイルサイズ確認
        const file = await fetch(uri);
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
        if (uint8Array.length > MAX_FILE_SIZE) {
            throw new Error(`File too large. Maximum size is 20MB. Your file is ${(uint8Array.length / 1024 / 1024).toFixed(1)}MB.`);
        }

        // 4. 前回のファイルを削除（既存のコード）
        const { data: previousFiles } = await supabase
            .from("files")
            .select("id, storage_path")
            .eq("user_id", user.id);
        
        if (previousFiles && previousFiles.length > 0) {
            const fileIds = previousFiles.map(f => f.id);
            
            // MCQs削除
            await supabase.from("mcqs").delete().in("file_id", fileIds);
            
            // ストレージからファイル削除
            const storagePaths = previousFiles.map(f => f.storage_path);
            await supabase.storage.from("study").remove(storagePaths);
            
            // files レコード削除
            await supabase.from("files").delete().in("id", fileIds);
        }

        // 5. ファイルアップロード（user_id をパスに含める）
        const fileExt = uri.split(".").pop() ?? "bin";
        const fileName = `${Date.now()}.${fileExt}`; 
        const filePath = `${user.id}/${fileName}`; // ★ user_id を含める

        const { error: upErr } = await supabase.storage 
            .from("study")
            .upload(filePath, uint8Array, { 
                contentType: mime, 
                upsert: false,
            }); 
        
        if (upErr) throw upErr;

        // 6. public URL 取得
        const { data: pub } = supabase.storage.from("study").getPublicUrl(filePath);
        const publicUrl = pub?.publicUrl;
        if (!publicUrl) throw new Error("Public URL is not created");

        // 7. files テーブルに挿入
        const { data: files, error: fErr } = await supabase 
            .from("files")
            .insert([{ 
                storage_path: filePath, 
                public_url: publicUrl, 
                mime_type: mime,
                user_id: user.id,
            }])
            .select()
            .limit(1)

        if (fErr) throw fErr;
        const fileRow = files![0];

        // 8. Edge Function 呼び出し（ユーザートークンを使用）
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("No active session");

        const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
        const fnRes = await fetch(`${baseUrl}${function_url}`, {
            method: "POST", 
            headers: {
                "Content-Type": "application/json", 
                apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                Authorization: `Bearer ${session.access_token}`, // ★ ユーザートークンを使用
            },
            body: JSON.stringify({ file_id: fileRow.id }),
        });

        if (!fnRes.ok){
            throw new Error(await fnRes.text()); 
        }

        // 9. 使用量更新
        await incrementUploadCount();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowSuccessModal(true);

    } catch (e: any) {
        let errorMessage = e.message ?? String(e);
        
        // エラーメッセージの整形
        if (errorMessage.includes("503") || errorMessage.includes("UNAVAILABLE")) {
            errorMessage = "The AI service is temporarily unavailable. Please try again in a few minutes.";
        } else if (errorMessage.includes("Invalid file type")) {
            errorMessage = e.message;
        } else if (errorMessage.includes("File too large")) {
            errorMessage = e.message;
        } else if (errorMessage.includes("not authenticated")) {
            errorMessage = "Please log in to upload files.";
        }
        
        Alert.alert("Upload Error", errorMessage);
    } finally {
        setLoading(false);
    }
}
```

---

### 修正2: Edge Function - 認証強化

```typescript
// backend/supabase/functions/generate-mcqs/index.ts
Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ ok: false, error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    // 1. Authorization ヘッダーの確認
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized: Missing or invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. トークンからユーザー情報を取得
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. リクエストボディの解析
    const { file_id, job_id }: Body = await req.json();
    if (!file_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "file_id is missing" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. ファイルの所有権確認
    const { data: fileOwnership, error: ownershipError } = await supabase
      .from("files")
      .select("user_id")
      .eq("id", file_id)
      .single();

    if (ownershipError || !fileOwnership) {
      return new Response(
        JSON.stringify({ ok: false, error: "File not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (fileOwnership.user_id !== user.id) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized: Access denied to this file" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // 5. 以降は既存のコード（job 作成、MCQ 生成など）
    // ... 既存のコード ...
    
  } catch (e) {
    console.error("Edge function error:", e);
    
    // 本番環境では詳細なエラーを隠蔽
    const isDevelopment = Deno.env.get("ENVIRONMENT") === "development";
    const errorMessage = isDevelopment ? String(e) : "An unexpected error occurred";
    
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

---

### 修正3: supabase.ts - ログの条件付き出力

```typescript
// frontend/src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { 
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
    },
}); 

// 開発環境でのみログ出力
if (__DEV__) {
    console.log("URL from env:", process.env.EXPO_PUBLIC_SUPABASE_URL);
    console.log("Anon key from env:", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 15) + "...");
}
```

---

## 🎯 優先順位付きアクションプラン

### Phase 1: ローンチ前（必須）- 1-2日

1. ✅ `security_fixes.sql` を Supabase で実行
2. 🔧 `UploadScreen.tsx` を修正（ファイルパスに user_id を含める）
3. 🔧 Edge Function に認証チェックを追加
4. 🔧 `UploadScreen.tsx` で Authorization ヘッダーを修正
5. 🔧 MIME タイプとファイルサイズの検証を追加
6. 🗑️ 本番環境用の console.log を削除

### Phase 2: ローンチ直後（推奨）- 1週間

1. 📊 レート制限の実装
2. 🛡️ エラーハンドリングの改善
3. 📝 .env.example の作成
4. 🔍 監査ログの実装

### Phase 3: 継続的改善 - 1ヶ月

1. 🦠 ファイルのウイルススキャン
2. 🔐 パスワードポリシーの強化
3. 🛡️ 2FA の実装検討
4. 🌐 Web バージョン用の CSP 実装

---

## 📞 サポートとリソース

- Supabase セキュリティドキュメント: https://supabase.com/docs/guides/auth/row-level-security
- OWASP Mobile Security: https://owasp.org/www-project-mobile-top-10/
- React Native Security Guide: https://reactnative.dev/docs/security

---

## ✅ 監査完了

この監査レポートは、現時点でのセキュリティ状態を示しています。上記の推奨事項を実装することで、アプリケーションのセキュリティを大幅に向上させることができます。

**次のステップ**:
1. Phase 1 のアクションアイテムをすべて完了
2. セキュリティテストの実施
3. 定期的なセキュリティ監査の実施（3ヶ月ごと）

---

**監査担当**: AI セキュリティアナリスト  
**レポート作成日**: 2025年10月12日

