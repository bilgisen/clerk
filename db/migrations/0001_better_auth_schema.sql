-- Drop existing indexes that might be affected
DROP INDEX IF EXISTS users_email_idx;

-- Add new auth columns
ALTER TABLE users 
  DROP COLUMN IF EXISTS clerk_id,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS salt TEXT,
  ADD COLUMN IF NOT EXISTS email_verified TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS verification_token TEXT,
  ADD COLUMN IF NOT EXISTS reset_token TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;

-- Recreate indexes
CREATE INDEX users_email_idx ON users (email);
CREATE INDEX users_email_verified_idx ON users (email_verified);
CREATE INDEX users_reset_token_idx ON users (reset_token) WHERE reset_token IS NOT NULL;
