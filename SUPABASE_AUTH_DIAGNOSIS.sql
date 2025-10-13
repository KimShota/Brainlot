-- Supabase認証問題の診断クエリ
-- このクエリをSupabaseのSQL Editorで実行して問題を特定してください

-- 1. ユーザーサブスクリプションテーブルの構造確認
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_subscriptions' 
ORDER BY ordinal_position;

-- 2. ユーザー使用統計テーブルの構造確認
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_usage_stats' 
ORDER BY ordinal_position;

-- 3. トリガー関数の確認
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table IN ('user_subscriptions', 'user_usage_stats');

-- 4. RLSポリシーの確認
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('user_subscriptions', 'user_usage_stats');

-- 5. 認証設定の確認（Supabase Dashboardで確認）
-- Authentication > Settings > General で以下を確認：
-- - Enable email confirmations: 無効にするか確認
-- - Enable email change confirmations: 無効にするか確認
-- - Rate limiting: 適切に設定されているか確認

-- 6. テスト用のユーザー作成（開発環境でのみ実行）
-- 注意: 本番環境では実行しないでください
/*
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'test@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    '',
    '',
    ''
);
*/
