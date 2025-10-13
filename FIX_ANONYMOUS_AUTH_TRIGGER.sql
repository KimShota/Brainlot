-- 匿名ユーザー作成時のトリガーエラーを修正するSQL
-- Supabase SQL Editorで実行してください

-- 1. 既存のトリガーを確認
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_schema = 'auth' 
AND event_object_table = 'users';

-- 2. 新規ユーザー作成時のトリガー関数を修正（エラーハンドリング強化）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- エラーハンドリングを追加
    BEGIN
        -- user_subscriptions レコードを作成
        INSERT INTO public.user_subscriptions (user_id, plan_type, created_at, updated_at)
        VALUES (NEW.id, 'free', NOW(), NOW())
        ON CONFLICT (user_id) DO NOTHING; -- 既に存在する場合はスキップ
        
        -- user_usage_stats レコードを作成
        INSERT INTO public.user_usage_stats (user_id, upload_count, reset_at, created_at, updated_at)
        VALUES (NEW.id, 0, NOW(), NOW(), NOW())
        ON CONFLICT (user_id) DO NOTHING; -- 既に存在する場合はスキップ
        
        RETURN NEW;
    EXCEPTION
        WHEN OTHERS THEN
            -- エラーをログに記録
            RAISE LOG 'Error creating user records for user %: %', NEW.id, SQLERRM;
            -- エラーが発生しても、ユーザー作成は成功させる
            RETURN NEW;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. トリガーが存在するか確認し、なければ作成
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'on_auth_user_created' 
        AND event_object_table = 'users'
    ) THEN
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_new_user();
    END IF;
END
$$;

-- 4. user_subscriptions テーブルに一意制約があるか確認
-- user_id が一意でない場合は追加
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_subscriptions_user_id_key'
    ) THEN
        ALTER TABLE public.user_subscriptions 
        ADD CONSTRAINT user_subscriptions_user_id_key UNIQUE (user_id);
    END IF;
END
$$;

-- 5. user_usage_stats テーブルに一意制約があるか確認
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_usage_stats_user_id_key'
    ) THEN
        ALTER TABLE public.user_usage_stats 
        ADD CONSTRAINT user_usage_stats_user_id_key UNIQUE (user_id);
    END IF;
END
$$;

-- 6. 検証: トリガーが正しく作成されたか確認
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 実行後の確認事項:
-- 1. トリガーが作成されていることを確認
-- 2. アプリを再起動して匿名ユーザーが作成できるか確認
-- 3. user_subscriptions と user_usage_stats にレコードが作成されているか確認

-- トラブルシューティング:
-- もしまだエラーが出る場合は、以下を確認:
-- 1. RLS ポリシーで INSERT が許可されているか
-- 2. user_subscriptions と user_usage_stats のカラム定義が正しいか
-- 3. Supabase Dashboard > Database > Logs でエラーログを確認

