-- Step 1: Drop any existing constraints that might be causing issues
DO $$
BEGIN
    -- Drop NOT NULL constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'salt' AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE users ALTER COLUMN salt DROP NOT NULL;
    END IF;
    
    -- Set default value if not set
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'salt' AND column_default IS NOT NULL
    ) THEN
        ALTER TABLE users ALTER COLUMN salt SET DEFAULT '';
    END IF;
    
    -- Update any NULL values to empty string
    UPDATE users SET salt = '' WHERE salt IS NULL;
    
    -- Re-add NOT NULL constraint
    ALTER TABLE users ALTER COLUMN salt SET NOT NULL;
    
    -- Add a comment for future reference
    COMMENT ON COLUMN users.salt IS 'Used for password hashing, empty string means no salt';
    
EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the migration
    RAISE NOTICE 'Error fixing salt column: %', SQLERRM;
END $$;
