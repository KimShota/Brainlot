# 認証削除の手順

## オプション1: 認証を完全に削除（推奨）

### 1. AuthContextの削除
- `frontend/src/contexts/AuthContext.tsx` を削除
- `App.tsx` からAuthProviderを削除

### 2. AuthScreenの削除
- `frontend/src/screens/AuthScreen.tsx` を削除
- ナビゲーションから認証画面を削除

### 3. Supabase RLSの調整
```sql
-- 認証不要でアクセス可能にする
ALTER TABLE files DISABLE ROW LEVEL SECURITY;
ALTER TABLE mcqs DISABLE ROW LEVEL SECURITY;
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;

-- または、パブリックアクセスを許可
DROP POLICY IF EXISTS "Users can view own files" ON files;
DROP POLICY IF EXISTS "Users can insert own files" ON files;
DROP POLICY IF EXISTS "Users can update own files" ON files;
DROP POLICY IF EXISTS "Users can delete own files" ON files;

CREATE POLICY "Public access" ON files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON mcqs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON jobs FOR ALL USING (true) WITH CHECK (true);
```

### 4. UploadScreenの修正
- 認証チェックを削除
- ファイルパスからuser_idを削除
- アップロード制限を削除

### 5. FeedScreenの修正
- 認証チェックを削除
- ユーザー固有のデータ取得を削除

## オプション2: 認証問題の修正

### 1. Supabase Dashboard設定
- Authentication > Settings > General
- "Enable email confirmations" を無効にする
- "Enable email change confirmations" を無効にする

### 2. データベーストリガーの修正
```sql
-- ユーザー作成時のトリガーを修正
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- エラーハンドリングを追加
    BEGIN
        INSERT INTO user_subscriptions (user_id, plan_type, created_at, updated_at)
        VALUES (NEW.id, 'free', NOW(), NOW());
        
        INSERT INTO user_usage_stats (user_id, upload_count, reset_at, created_at, updated_at)
        VALUES (NEW.id, 0, NOW(), NOW(), NOW());
        
        RETURN NEW;
    EXCEPTION
        WHEN OTHERS THEN
            -- エラーをログに記録
            RAISE LOG 'Error creating user records: %', SQLERRM;
            -- エラーを再発生させない（認証は成功させる）
            RETURN NEW;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. エラーハンドリングの改善
- より詳細なエラーメッセージ
- リトライ機能の追加
- フォールバック処理

## 推奨事項

**認証が不要であれば、オプション1（認証削除）を推奨します。**

理由：
- ユーザー体験が向上
- 開発・保守が簡単
- エラーの原因がなくなる
- より多くのユーザーがアプリを使用可能

認証が必要な場合のみ、オプション2で問題を修正してください。
