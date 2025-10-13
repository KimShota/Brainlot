-- =====================================
-- セキュリティ設定確認用SQLクエリ
-- Edu-Shorts アプリのセキュリティ状態を検証
-- =====================================

-- 1. RLS (Row Level Security) の有効化確認
-- すべてのテーブルで RLS が有効になっていることを確認
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Enabled' 
        ELSE '❌ RLS Disabled - SECURITY RISK!' 
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('files', 'mcqs', 'jobs', 'user_subscriptions', 'user_usage_stats')
ORDER BY tablename;

-- 2. ストレージポリシーの確認
-- 危険なパブリックポリシーが存在しないことを確認
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check,
    CASE 
        WHEN policyname LIKE '%public%' OR policyname LIKE '%all%' THEN '⚠️ POTENTIAL RISK'
        ELSE '✅ OK'
    END as security_status
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
ORDER BY policyname;

-- 3. テーブル別のRLSポリシー確認
-- 各テーブルのポリシーが適切に設定されていることを確認

-- files テーブルのポリシー
SELECT 
    'files' as table_name,
    policyname,
    cmd as operation,
    CASE 
        WHEN qual LIKE '%auth.uid()%' THEN '✅ User-based access'
        WHEN qual LIKE '%true%' THEN '❌ Public access - SECURITY RISK!'
        ELSE '⚠️ Check manually'
    END as security_status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'files'
ORDER BY cmd;

-- mcqs テーブルのポリシー
SELECT 
    'mcqs' as table_name,
    policyname,
    cmd as operation,
    CASE 
        WHEN qual LIKE '%auth.uid()%' OR qual LIKE '%files.user_id%' THEN '✅ User-based access'
        WHEN qual LIKE '%true%' THEN '❌ Public access - SECURITY RISK!'
        ELSE '⚠️ Check manually'
    END as security_status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'mcqs'
ORDER BY cmd;

-- jobs テーブルのポリシー
SELECT 
    'jobs' as table_name,
    policyname,
    cmd as operation,
    CASE 
        WHEN qual LIKE '%auth.uid()%' OR qual LIKE '%files.user_id%' THEN '✅ User-based access'
        WHEN qual LIKE '%true%' THEN '❌ Public access - SECURITY RISK!'
        ELSE '⚠️ Check manually'
    END as security_status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'jobs'
ORDER BY cmd;

-- user_subscriptions テーブルのポリシー
SELECT 
    'user_subscriptions' as table_name,
    policyname,
    cmd as operation,
    CASE 
        WHEN qual LIKE '%auth.uid()%' THEN '✅ User-based access'
        WHEN qual LIKE '%true%' THEN '❌ Public access - SECURITY RISK!'
        ELSE '⚠️ Check manually'
    END as security_status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'user_subscriptions'
ORDER BY cmd;

-- user_usage_stats テーブルのポリシー
SELECT 
    'user_usage_stats' as table_name,
    policyname,
    cmd as operation,
    CASE 
        WHEN qual LIKE '%auth.uid()%' THEN '✅ User-based access'
        WHEN qual LIKE '%true%' THEN '❌ Public access - SECURITY RISK!'
        ELSE '⚠️ Check manually'
    END as security_status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'user_usage_stats'
ORDER BY cmd;

-- 4. ストレージバケットの確認
-- study バケットが存在し、適切に設定されていることを確認
SELECT 
    id as bucket_id,
    name as bucket_name,
    public as is_public,
    CASE 
        WHEN public THEN '⚠️ Public bucket - Check policies'
        ELSE '✅ Private bucket'
    END as security_status,
    created_at
FROM storage.buckets 
WHERE id = 'study';

-- 5. 危険なポリシーの検索
-- パブリックアクセスを許可する危険なポリシーがないか確認
SELECT 
    'DANGEROUS POLICIES CHECK' as check_type,
    schemaname,
    tablename,
    policyname,
    '❌ SECURITY RISK!' as status,
    'This policy allows public access' as reason
FROM pg_policies 
WHERE (
    qual LIKE '%true%' 
    OR with_check LIKE '%true%'
    OR policyname ILIKE '%public%'
    OR policyname ILIKE '%all%'
)
AND schemaname IN ('public', 'storage')
AND tablename IN ('files', 'mcqs', 'jobs', 'user_subscriptions', 'user_usage_stats', 'objects');

-- 6. 関数とトリガーの確認
-- セキュリティ関連の関数が正しく作成されていることを確認
SELECT 
    routine_name as function_name,
    routine_type,
    CASE 
        WHEN routine_name = 'set_file_user_id' THEN '✅ Auto user_id setting'
        WHEN routine_name = 'check_upload_limit' THEN '✅ Upload limit check'
        WHEN routine_name = 'update_usage_stats' THEN '✅ Usage tracking'
        WHEN routine_name = 'reset_monthly_usage' THEN '✅ Monthly reset'
        WHEN routine_name = 'create_user_subscription_and_stats' THEN '✅ Auto user setup'
        WHEN routine_name = 'update_updated_at_column' THEN '✅ Timestamp update'
        ELSE '⚠️ Unknown function'
    END as security_function_status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'set_file_user_id',
    'check_upload_limit', 
    'update_usage_stats',
    'reset_monthly_usage',
    'create_user_subscription_and_stats',
    'update_updated_at_column'
)
ORDER BY routine_name;

-- 7. トリガーの確認
-- セキュリティ関連のトリガーが正しく設定されていることを確認
SELECT 
    trigger_name,
    event_manipulation as event,
    event_object_table as table_name,
    action_timing as timing,
    CASE 
        WHEN trigger_name = 'set_file_user_id_trigger' THEN '✅ Auto user_id setting'
        WHEN trigger_name = 'check_upload_limit_trigger' THEN '✅ Upload limit enforcement'
        WHEN trigger_name = 'update_usage_stats_trigger' THEN '✅ Usage tracking'
        WHEN trigger_name = 'on_auth_user_created' THEN '✅ Auto user setup'
        WHEN trigger_name LIKE '%updated_at%' THEN '✅ Timestamp management'
        ELSE '⚠️ Unknown trigger'
    END as security_trigger_status
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
AND trigger_name IN (
    'set_file_user_id_trigger',
    'check_upload_limit_trigger',
    'update_usage_stats_trigger',
    'on_auth_user_created',
    'update_user_subscriptions_updated_at',
    'update_user_usage_stats_updated_at'
)
ORDER BY trigger_name;

-- 8. インデックスの確認
-- パフォーマンスとセキュリティに重要なインデックスが存在することを確認
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef,
    CASE 
        WHEN indexname LIKE '%user_id%' THEN '✅ User-based index'
        WHEN indexname LIKE '%created_at%' THEN '✅ Time-based index'
        WHEN indexname LIKE '%status%' THEN '✅ Status index'
        ELSE '⚠️ Check manually'
    END as index_purpose
FROM pg_indexes 
WHERE schemaname = 'public'
AND tablename IN ('files', 'mcqs', 'jobs', 'user_subscriptions', 'user_usage_stats')
AND indexname NOT LIKE '%pkey%'  -- Primary key indexes を除外
ORDER BY tablename, indexname;

-- 9. 外部キー制約の確認
-- データ整合性を保つ外部キーが正しく設定されていることを確認
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    CASE 
        WHEN ccu.table_name = 'auth.users' THEN '✅ References auth.users'
        WHEN ccu.table_name = 'files' THEN '✅ References files'
        ELSE '⚠️ Check manually'
    END as constraint_purpose
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
AND tc.table_name IN ('files', 'mcqs', 'jobs', 'user_subscriptions', 'user_usage_stats')
ORDER BY tc.table_name;

-- 10. セキュリティサマリー
-- 全体のセキュリティ状態を要約
WITH security_summary AS (
    SELECT 
        'RLS Status' as check_type,
        COUNT(*) as total_tables,
        COUNT(CASE WHEN rowsecurity THEN 1 END) as secure_tables,
        CASE 
            WHEN COUNT(CASE WHEN rowsecurity THEN 1 END) = COUNT(*) THEN '✅ All tables secured'
            ELSE '❌ Some tables not secured'
        END as status
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('files', 'mcqs', 'jobs', 'user_subscriptions', 'user_usage_stats')
    
    UNION ALL
    
    SELECT 
        'Storage Policies' as check_type,
        COUNT(*) as total_policies,
        COUNT(CASE WHEN policyname NOT LIKE '%public%' AND policyname NOT LIKE '%all%' THEN 1 END) as secure_policies,
        CASE 
            WHEN COUNT(CASE WHEN policyname LIKE '%public%' OR policyname LIKE '%all%' THEN 1 END) = 0 THEN '✅ No public policies'
            ELSE '❌ Public policies found'
        END as status
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
    
    UNION ALL
    
    SELECT 
        'Security Functions' as check_type,
        COUNT(*) as total_functions,
        COUNT(*) as secure_functions,
        '✅ Security functions present' as status
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name IN (
        'set_file_user_id',
        'check_upload_limit', 
        'update_usage_stats',
        'reset_monthly_usage',
        'create_user_subscription_and_stats',
        'update_updated_at_column'
    )
)
SELECT 
    check_type,
    total_tables as total_items,
    secure_tables as secure_items,
    status
FROM security_summary
ORDER BY check_type;

-- =====================================
-- 実行後の確認事項
-- =====================================

/*
実行後、以下を確認してください：

✅ 正常な状態:
- すべてのテーブルで RLS が有効 (rowsecurity = true)
- ストレージポリシーに 'public' や 'all' を含む名前がない
- セキュリティ関数がすべて存在
- セキュリティトリガーがすべて存在
- 外部キー制約が正しく設定されている

❌ 問題がある場合:
- RLS が無効なテーブルがある
- パブリックアクセスを許可するポリシーがある
- セキュリティ関数やトリガーが不足している
- 外部キー制約が設定されていない

⚠️ 警告:
- 不明な関数やトリガーがある
- インデックスが不足している可能性

問題が見つかった場合は、security_fixes.sql を再実行してください。
*/
