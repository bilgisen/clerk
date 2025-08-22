-- Add unique constraint to clerk_id
ALTER TABLE users ADD CONSTRAINT users_clerk_id_unique UNIQUE (clerk_id);

-- Drop any existing duplicate clerk_ids (keep the latest one)
DELETE FROM users 
WHERE id IN (
  SELECT id 
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (PARTITION BY clerk_id ORDER BY created_at DESC) as rn
    FROM users
    WHERE clerk_id IS NOT NULL
  ) t 
  WHERE t.rn > 1
);
