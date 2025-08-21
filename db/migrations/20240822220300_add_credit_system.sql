-- Create credit_ledger table
CREATE TABLE credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref TEXT,
  metadata JSONB,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'app',
  idempotency_key TEXT,
  CONSTRAINT idempotency_unique UNIQUE (user_id, idempotency_key)
);

-- Create activity table
CREATE TABLE activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT,
  delta INTEGER NOT NULL,
  ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_credit_ledger_user_created ON credit_ledger(user_id, created_at);
CREATE INDEX idx_activity_user_created ON activity(user_id, created_at);

-- Add comments for documentation
COMMENT ON TABLE credit_ledger IS 'Tracks all credit transactions (additions and subtractions)';
COMMENT ON COLUMN credit_ledger.amount IS 'Positive for credits added, negative for credits spent';
COMMENT ON COLUMN credit_ledger.reason IS 'Reason for the transaction (e.g., signup_bonus, book_create, publish_epub, etc.)';
COMMENT ON COLUMN credit_ledger.ref IS 'Reference ID (e.g., book_id, order_id, etc.)';
COMMENT ON COLUMN credit_ledger.source IS 'Source of the transaction (app, clerk, polar)';
COMMENT ON COLUMN credit_ledger.idempotency_key IS 'Ensures idempotency of operations';

COMMENT ON TABLE activity IS 'Tracks user activities related to credits';
COMMENT ON COLUMN activity.type IS 'Type of activity (e.g., book_created, published, purchased, etc.)';
COMMENT ON COLUMN activity.delta IS 'Change in credits (positive or negative)';

-- Add a function to get current balance
CREATE OR REPLACE FUNCTION get_user_balance(p_user_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM credit_ledger
  WHERE user_id = p_user_id
  AND (expires_at IS NULL OR expires_at > NOW());
  
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- Add a view for user balances
CREATE OR REPLACE VIEW user_balances AS
SELECT 
  user_id,
  get_user_balance(user_id) as balance,
  COUNT(*) as transaction_count,
  MIN(created_at) as first_transaction_at,
  MAX(created_at) as last_transaction_at
FROM credit_ledger
GROUP BY user_id;
