-- ========================================
-- SECURITY HARDENING - FIXED VERSION
-- This version checks for table existence before applying policies
-- ========================================

-- First, let's check what tables exist and their structure
-- Run this query first to see your current database structure:
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
-- ORDER BY table_name, ordinal_position;

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
-- 2. CREATE MISSING TABLES IF THEY DON'T EXIST
-- ========================================

-- Create files table if it doesn't exist
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    mime_type TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create mcqs table if it doesn't exist
CREATE TABLE IF NOT EXISTS mcqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options TEXT[] NOT NULL,
    answer_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create jobs table if it doesn't exist
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'done', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- 3. ENABLE RLS ON ALL TABLES
-- ========================================

ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 4. DROP EXISTING POLICIES (SAFELY)
-- ========================================

-- Drop any existing policies on files table
DROP POLICY IF EXISTS "Anyone can view files" ON files;
DROP POLICY IF EXISTS "Public read access" ON files;
DROP POLICY IF EXISTS "Users can view their own files" ON files;
DROP POLICY IF EXISTS "Users can insert their own files" ON files;
DROP POLICY IF EXISTS "Users can delete their own files" ON files;

-- Drop any existing policies on mcqs table
DROP POLICY IF EXISTS "Anyone can view MCQs" ON mcqs;
DROP POLICY IF EXISTS "Public read access" ON mcqs;
DROP POLICY IF EXISTS "Users can view their own MCQs" ON mcqs;
DROP POLICY IF EXISTS "Users can delete their own MCQs" ON mcqs;

-- Drop any existing policies on jobs table
DROP POLICY IF EXISTS "Anyone can view jobs" ON jobs;
DROP POLICY IF EXISTS "Public access" ON jobs;
DROP POLICY IF EXISTS "Users can view their own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can insert their own jobs" ON jobs;

-- ========================================
-- 5. CREATE SECURE RLS POLICIES
-- ========================================

-- Files table policies
CREATE POLICY "Users can view their own files"
ON files FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files"
ON files FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files"
ON files FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- MCQs table policies
CREATE POLICY "Users can view their own MCQs"
ON mcqs FOR SELECT
TO authenticated
USING (
    file_id IN (
        SELECT id FROM files WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete their own MCQs"
ON mcqs FOR DELETE
TO authenticated
USING (
    file_id IN (
        SELECT id FROM files WHERE user_id = auth.uid()
    )
);

-- Jobs table policies
CREATE POLICY "Users can view their own jobs"
ON jobs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jobs"
ON jobs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ========================================
-- 6. SUBSCRIPTION TABLES (IF THEY EXIST)
-- ========================================

-- Only apply policies if subscription tables exist
DO $$
BEGIN
    -- Check if user_subscriptions table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subscriptions' AND table_schema = 'public') THEN
        -- Enable RLS
        ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
        
        -- Drop dangerous policies
        DROP POLICY IF EXISTS "Users can insert their own subscription" ON user_subscriptions;
        DROP POLICY IF EXISTS "Users can update their own subscription" ON user_subscriptions;
        
        -- Keep only safe SELECT policy
        DROP POLICY IF EXISTS "Users can view their own subscription" ON user_subscriptions;
        CREATE POLICY "Users can view their own subscription"
        ON user_subscriptions FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id);
    END IF;
    
    -- Check if user_usage_stats table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_usage_stats' AND table_schema = 'public') THEN
        -- Enable RLS
        ALTER TABLE user_usage_stats ENABLE ROW LEVEL SECURITY;
        
        -- Drop dangerous policies
        DROP POLICY IF EXISTS "Users can insert their own usage stats" ON user_usage_stats;
        DROP POLICY IF EXISTS "Users can update their own usage stats" ON user_usage_stats;
        
        -- Keep only safe SELECT policy
        DROP POLICY IF EXISTS "Users can view their own usage stats" ON user_usage_stats;
        CREATE POLICY "Users can view their own usage stats"
        ON user_usage_stats FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- ========================================
-- 7. CREATE HELPFUL FUNCTIONS
-- ========================================

-- Function to automatically set user_id on file insert
CREATE OR REPLACE FUNCTION set_file_user_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.user_id := auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for files table
DROP TRIGGER IF EXISTS set_file_user_id_trigger ON files;
CREATE TRIGGER set_file_user_id_trigger
BEFORE INSERT ON files
FOR EACH ROW
EXECUTE FUNCTION set_file_user_id();

-- ========================================
-- 8. GRANT NECESSARY PERMISSIONS
-- ========================================

-- Grant authenticated users SELECT access to their own data
GRANT SELECT ON files TO authenticated;
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
    RAISE NOTICE 'Tables created: files, mcqs, jobs';
    RAISE NOTICE 'RLS enabled on all tables';
    RAISE NOTICE 'Storage bucket study is now private';
END $$;
