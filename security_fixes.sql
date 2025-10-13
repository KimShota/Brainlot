-- =====================================
-- セキュリティ強化のためのSQL修正
-- =====================================

-- Drop all the policies that are dangerous 
DROP POLICY IF EXISTS "Allow all operations on files" ON files;
DROP POLICY IF EXISTS "Allow all operations on mcqs" ON mcqs;
DROP POLICY IF EXISTS "Allow all operations on jobs" ON jobs;

-- 2. 適切なRLSポリシーを設定

-- Policies for files table
-- Users can view their own files if they are authenticated 
CREATE POLICY "Users can view their own files" ON files
FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own files if they are authenticated 
CREATE POLICY "Users can insert their own files" ON files
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own files if they are authenticated 
CREATE POLICY "Users can update their own files" ON files
FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own files if they are authenticated 
CREATE POLICY "Users can delete their own files" ON files
FOR DELETE USING (auth.uid() = user_id);


-- Policies for mcqs table 
-- Users can view mcqs for their own files if they are authenticated 
CREATE POLICY "Users can view mcqs for their files" ON mcqs
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM files 
        WHERE files.id = mcqs.file_id 
        AND files.user_id = auth.uid()
    )
);


-- Users can insert their mcqs for their own files if thet are authenticated 
CREATE POLICY "Users can insert mcqs for their files" ON mcqs
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM files 
        WHERE files.id = mcqs.file_id 
        AND files.user_id = auth.uid()
    )
);

-- Users can update their mcqs for their own files if they are authenticated
CREATE POLICY "Users can update mcqs for their files" ON mcqs
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM files 
        WHERE files.id = mcqs.file_id 
        AND files.user_id = auth.uid()
    )
);

-- Users can delete mcqs for their own files if they are authenticated 
CREATE POLICY "Users can delete mcqs for their files" ON mcqs
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM files 
        WHERE files.id = mcqs.file_id 
        AND files.user_id = auth.uid()
    )
);

-- Policies for jobs table
-- Users can view their jobs for their files if they are authenticated 
CREATE POLICY "Users can view jobs for their files" ON jobs
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM files 
        WHERE files.id = jobs.file_id 
        AND files.user_id = auth.uid()
    )
);

-- Users can insert jobs for their own files if they are authenticated 
CREATE POLICY "Users can insert jobs for their files" ON jobs
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM files 
        WHERE files.id = jobs.file_id 
        AND files.user_id = auth.uid()
    )
);


-- Users can update jobs for their own files if they are authenticated 
CREATE POLICY "Users can update jobs for their files" ON jobs
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM files 
        WHERE files.id = jobs.file_id 
        AND files.user_id = auth.uid()
    )
);

-- Users can delete jobs for their own files if they are authenticated 
CREATE POLICY "Users can delete jobs for their files" ON jobs
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM files 
        WHERE files.id = jobs.file_id 
        AND files.user_id = auth.uid()
    )
);


-- Policies for storage.objects table 
-- Drop policies that are dangerous 
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads" ON storage.objects;

-- Authenticated users can upload to study bucket 
CREATE POLICY "Authenticated users can upload to study bucket" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'study' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can vuew their own files in study bucket 
CREATE POLICY "Users can view their own files in study bucket" ON storage.objects
FOR SELECT USING (
    bucket_id = 'study' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can update their own files in study bucket 
CREATE POLICY "Users can update their own files in study bucket" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'study' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can delete their own files in study bucket 
CREATE POLICY "Users can delete their own files in study bucket" ON storage.objects
FOR DELETE USING (
    bucket_id = 'study' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. セキュリティ強化のための関数

-- Set user_id automatically when a new file is inserted 
CREATE OR REPLACE FUNCTION set_file_user_id()
RETURNS TRIGGER AS $$ -- this will be executed when a new file is inserted 
BEGIN
    -- Raise exception if user is not authenticated properly 
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    
    -- set the user_id automatically 
    NEW.user_id = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger to set the user_id automatically when a new file is inserted 
CREATE TRIGGER set_file_user_id_trigger
    BEFORE INSERT ON files -- this will be executed before the new file is inserted 
    FOR EACH ROW -- this will be executed for each file (row) that is inserted
    EXECUTE FUNCTION set_file_user_id(); -- execute the function called set_file_user_id 

-- function to check the upload limit 
CREATE OR REPLACE FUNCTION check_upload_limit() -- create the function called check_upload_limit 
RETURNS TRIGGER AS $$
DECLARE
    user_plan TEXT;
    current_upload_count INTEGER;
    max_uploads INTEGER;
BEGIN
    -- check the user's plan if they are authenticated properly  
    SELECT plan_type INTO user_plan
    FROM user_subscriptions
    WHERE user_id = auth.uid();
    
    -- get the current upload count if they are authenticated 
    SELECT upload_count INTO current_upload_count
    FROM user_usage_stats
    WHERE user_id = auth.uid();
    
    -- Set the limit based on the plan 
    CASE user_plan
        WHEN 'free' THEN max_uploads := 10; -- max upload is 10 for free plan 
        WHEN 'pro' THEN max_uploads := -1; -- unlimited uploads for pro plan (-1 means unlimited)
        ELSE max_uploads := 0; -- if the plan is not free or pro, then the max upload is 0 
    END CASE;
    
    -- check if the user already exceeds the upload limit or not (skip check for pro plan)
    IF max_uploads > 0 AND current_upload_count >= max_uploads THEN
        RAISE EXCEPTION 'Upload limit exceeded for % plan. Current: %, Limit: %',  -- raise exception if the user exceeds the upload limit 
            user_plan, current_upload_count, max_uploads;
    END IF;
    
    RETURN NEW; -- return the new file 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Call the function before a new file is inserted 
CREATE TRIGGER check_upload_limit_trigger
    BEFORE INSERT ON files
    FOR EACH ROW
    EXECUTE FUNCTION check_upload_limit();

-- create the function to automatically update the usage stats when a new file is inserted 
CREATE OR REPLACE FUNCTION update_usage_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- update the usage stats when a new file is inserted 
    UPDATE user_usage_stats 
    SET 
        upload_count = upload_count + 1, -- increment the upload count
        last_upload_at = NOW(), -- set the last upload time to the current time 
        updated_at = NOW() -- set the upload time to the current time  
    WHERE user_id = auth.uid();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger to run the function after a new file is inserted 
CREATE TRIGGER update_usage_stats_trigger
    AFTER INSERT ON files
    FOR EACH ROW
    EXECUTE FUNCTION update_usage_stats();

-- create the function to rest the usage stats monthly 
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void AS $$
BEGIN
    UPDATE user_usage_stats 
    SET 
        upload_count = 0, -- set the upload count to 0
        reset_at = NOW(),
        updated_at = NOW()
    WHERE 
        reset_at < date_trunc('month', NOW()) -- reset only the last reset was done before the start of the month
        AND EXISTS (
            SELECT 1 FROM user_subscriptions 
            WHERE user_subscriptions.user_id = user_usage_stats.user_id 
            AND user_subscriptions.plan_type = 'free' -- reset only users with the free plan (pro users keep their count)
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- create the function to allow the admin to get all the files from the files table 
CREATE OR REPLACE FUNCTION admin_get_all_files()
RETURNS TABLE ( -- return the files' info from the files table 
    file_id UUID,
    user_id UUID,
    storage_path TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    -- 管理者権限チェック（必要に応じて実装）
    -- IF NOT auth.jwt() ->> 'role' = 'admin' THEN
    --     RAISE EXCEPTION 'Admin access required';
    -- END IF;
    
    RETURN QUERY
    SELECT f.id, f.user_id, f.storage_path, f.created_at
    FROM files f
    ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
