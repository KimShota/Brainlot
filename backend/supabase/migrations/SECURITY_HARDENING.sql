-- ========================================
-- COMPREHENSIVE SECURITY HARDENING
-- Run this SQL to secure the app before launch
-- ========================================

-- ========================================
-- 1. STORAGE BUCKET SECURITY
-- ========================================

-- Make the 'study' bucket PRIVATE (not public)
-- This prevents direct access to files without signed URLs
UPDATE storage.buckets
SET public = false
WHERE id = 'study';

-- Remove all existing public storage policies
DROP POLICY IF EXISTS "Authenticated users can upload to study bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view files in study bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files 2" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files 2" ON storage.objects;

-- Create strict storage policies for PRIVATE bucket
-- Users can only upload files to their own user_id folder
CREATE POLICY "Users can upload files to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'study' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can only read their own files
CREATE POLICY "Users can read their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'study' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can only delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'study' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- ========================================
-- 2. SUBSCRIPTION & USAGE SECURITY
-- ========================================

-- Drop dangerous INSERT/UPDATE policies that allow users to modify their own data
DROP POLICY IF EXISTS "Users can insert their own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can insert their own usage stats" ON user_usage_stats;
DROP POLICY IF EXISTS "Users can update their own usage stats" ON user_usage_stats;

-- Keep only SELECT policies (users can read their own data)
-- The SELECT policies already exist and are safe

-- ========================================
-- 3. FILES TABLE SECURITY
-- ========================================

-- Ensure RLS is enabled
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Drop any overly permissive policies
DROP POLICY IF EXISTS "Anyone can view files" ON files;
DROP POLICY IF EXISTS "Public read access" ON files;

-- Ensure users can only see their own files
DROP POLICY IF EXISTS "Users can view their own files" ON files;
CREATE POLICY "Users can view their own files"
ON files FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Ensure users can only insert files with their own user_id
DROP POLICY IF EXISTS "Users can insert their own files" ON files;
CREATE POLICY "Users can insert their own files"
ON files FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Ensure users can only delete their own files
DROP POLICY IF EXISTS "Users can delete their own files" ON files;
CREATE POLICY "Users can delete their own files"
ON files FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ========================================
-- 4. MCQS TABLE SECURITY
-- ========================================

-- Ensure RLS is enabled
ALTER TABLE mcqs ENABLE ROW LEVEL SECURITY;

-- Drop any overly permissive policies
DROP POLICY IF EXISTS "Anyone can view MCQs" ON mcqs;
DROP POLICY IF EXISTS "Public read access" ON mcqs;

-- Ensure users can only see their own MCQs (via file ownership)
DROP POLICY IF EXISTS "Users can view their own MCQs" ON mcqs;
CREATE POLICY "Users can view their own MCQs"
ON mcqs FOR SELECT
TO authenticated
USING (
    file_id IN (
        SELECT id FROM files WHERE user_id = auth.uid()
    )
);

-- Only the Edge Function (using service role) can insert MCQs
-- No INSERT policy for regular users

-- Ensure users can only delete their own MCQs
DROP POLICY IF EXISTS "Users can delete their own MCQs" ON mcqs;
CREATE POLICY "Users can delete their own MCQs"
ON mcqs FOR DELETE
TO authenticated
USING (
    file_id IN (
        SELECT id FROM files WHERE user_id = auth.uid()
    )
);

-- ========================================
-- 5. JOBS TABLE SECURITY
-- ========================================

-- Ensure RLS is enabled
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Drop any overly permissive policies
DROP POLICY IF EXISTS "Anyone can view jobs" ON jobs;
DROP POLICY IF EXISTS "Public access" ON jobs;

-- Ensure users can only see their own jobs
DROP POLICY IF EXISTS "Users can view their own jobs" ON jobs;
CREATE POLICY "Users can view their own jobs"
ON jobs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Ensure users can only insert jobs with their own user_id
DROP POLICY IF EXISTS "Users can insert their own jobs" ON jobs;
CREATE POLICY "Users can insert their own jobs"
ON jobs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users should not be able to update jobs (only Edge Function can)
DROP POLICY IF EXISTS "Users can update their own jobs" ON jobs;

-- ========================================
-- 6. ENHANCED TRIGGER FUNCTIONS
-- ========================================

-- Update the user_id assignment trigger to be more robust
CREATE OR REPLACE FUNCTION set_file_user_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure user_id is always set to the authenticated user
    NEW.user_id := auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS set_file_user_id_trigger ON files;
CREATE TRIGGER set_file_user_id_trigger
BEFORE INSERT ON files
FOR EACH ROW
EXECUTE FUNCTION set_file_user_id();

-- Update the subscription/stats creation trigger to be resilient
CREATE OR REPLACE FUNCTION create_user_subscription_and_stats()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        -- Insert subscription (skip if already exists)
        INSERT INTO user_subscriptions (user_id, plan_type, status)
        VALUES (NEW.id, 'free', 'active')
        ON CONFLICT (user_id) DO NOTHING;

        -- Insert usage stats (skip if already exists)
        INSERT INTO user_usage_stats (user_id, upload_count)
        VALUES (NEW.id, 0)
        ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'create_user_subscription_and_stats error for %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 7. USAGE LIMIT FUNCTIONS
-- ========================================

-- Enhanced check_upload_limit function
CREATE OR REPLACE FUNCTION check_upload_limit()
RETURNS TRIGGER AS $$
DECLARE
    user_plan TEXT;
    current_count INTEGER;
    max_uploads INTEGER;
BEGIN
    -- Get user's current plan and upload count
    SELECT us.plan_type, uus.upload_count
    INTO user_plan, current_count
    FROM user_subscriptions us
    JOIN user_usage_stats uus ON us.user_id = uus.user_id
    WHERE us.user_id = NEW.user_id;

    -- Determine upload limit based on plan
    IF user_plan = 'pro' THEN
        max_uploads := -1; -- Unlimited
    ELSE
        max_uploads := 10; -- Free plan limit
    END IF;

    -- Check if user has exceeded limit (skip if pro)
    IF max_uploads > 0 AND current_count >= max_uploads THEN
        RAISE EXCEPTION 'Upload limit reached. Please upgrade to Pro plan for unlimited uploads.';
    END IF;

    -- Increment upload count
    UPDATE user_usage_stats
    SET upload_count = upload_count + 1,
        last_upload_at = NOW(),
        updated_at = NOW()
    WHERE user_id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS check_upload_limit_trigger ON files;
CREATE TRIGGER check_upload_limit_trigger
BEFORE INSERT ON files
FOR EACH ROW
EXECUTE FUNCTION check_upload_limit();

-- ========================================
-- 8. GRANT NECESSARY PERMISSIONS
-- ========================================

-- Grant authenticated users SELECT access to their own data
GRANT SELECT ON user_subscriptions TO authenticated;
GRANT SELECT ON user_usage_stats TO authenticated;
GRANT SELECT, INSERT, DELETE ON files TO authenticated;
GRANT SELECT, DELETE ON mcqs TO authenticated;
GRANT SELECT, INSERT ON jobs TO authenticated;

-- Service role has full access (for Edge Functions)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ========================================
-- SECURITY HARDENING COMPLETE
-- ========================================

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Security hardening complete! All policies updated.';
END $$;

