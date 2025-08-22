-- Drop existing constraints and indexes
ALTER TABLE credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_user_id_fkey;
ALTER TABLE activity DROP CONSTRAINT IF EXISTS activity_user_id_fkey;
DROP INDEX IF EXISTS ledger_user_idx;
DROP INDEX IF EXISTS activity_user_idx;

-- Add temporary columns with correct type
ALTER TABLE credit_ledger ADD COLUMN temp_user_id UUID;
ALTER TABLE activity ADD COLUMN temp_user_id UUID;

-- Convert text to UUID
UPDATE credit_ledger SET temp_user_id = user_id::UUID;
UPDATE activity SET temp_user_id = user_id::UUID;

-- Drop old columns
ALTER TABLE credit_ledger DROP COLUMN user_id;
ALTER TABLE activity DROP COLUMN user_id;

-- Add new columns with correct type
ALTER TABLE credit_ledger RENAME COLUMN temp_user_id TO user_id;
ALTER TABLE activity RENAME COLUMN temp_user_id TO user_id;

-- Add constraints and indexes back
ALTER TABLE credit_ledger 
  ALTER COLUMN user_id SET NOT NULL,
  ADD CONSTRAINT credit_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE activity 
  ALTER COLUMN user_id SET NOT NULL,
  ADD CONSTRAINT activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX ledger_user_idx ON credit_ledger(user_id, created_at);
CREATE INDEX activity_user_idx ON activity(user_id, created_at);
