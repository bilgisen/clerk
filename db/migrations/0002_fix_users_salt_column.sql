-- First, check if the salt column exists and has NULL values
DO $$
BEGIN
    -- Add the column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'users' AND column_name = 'salt') THEN
        ALTER TABLE users ADD COLUMN salt text;
    END IF;
    
    -- Update any NULL values to an empty string
    UPDATE users SET salt = '' WHERE salt IS NULL;
    
    -- Add NOT NULL constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'users' AND constraint_name = 'users_salt_not_null'
    ) THEN
        ALTER TABLE users ALTER COLUMN salt SET NOT NULL;
        ALTER TABLE users ALTER COLUMN salt SET DEFAULT '';
    END IF;
END $$;
