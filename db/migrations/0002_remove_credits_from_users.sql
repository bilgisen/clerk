-- Migration to remove credits column from users table
-- This migration assumes all credits have been migrated to the credit_ledger table

-- First, verify the migration was successful
DO $$
DECLARE
    user_count INTEGER;
    ledger_count INTEGER;
    mismatch_count INTEGER;
BEGIN
    -- Count users with credits
    SELECT COUNT(*) INTO user_count FROM users WHERE credits > 0;
    
    -- Count users with ledger entries
    SELECT COUNT(DISTINCT user_id) INTO ledger_count FROM credit_ledger;
    
    -- Count users with mismatched credits
    SELECT COUNT(*) INTO mismatch_count
    FROM users u
    LEFT JOIN (
        SELECT user_id, SUM(amount) as total_credits
        FROM credit_ledger
        GROUP BY user_id
    ) l ON u.id = l.user_id
    WHERE u.credits > 0 AND (l.total_credits IS NULL OR u.credits != l.total_credits);
    
    -- Verify counts match
    IF user_count != ledger_count OR mismatch_count > 0 THEN
        RAISE EXCEPTION 'Credit migration verification failed. Users with credits: %, Users in ledger: %, Mismatched credits: %', 
            user_count, ledger_count, mismatch_count;
    END IF;
END $$;

-- If we get here, verification passed - drop the column
ALTER TABLE users DROP COLUMN IF EXISTS credits;
