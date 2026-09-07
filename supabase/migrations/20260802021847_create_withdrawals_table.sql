/*
# Create withdrawals table

1. New Tables
- `withdrawals` — stores user withdrawal requests.
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `amount` (numeric, withdrawal amount in USD)
  - `crypto_currency` (text, e.g. "BTC", "ETH")
  - `wallet_address` (text, destination wallet)
  - `status` (text, "pending" | "approved" | "rejected")
  - `tax_fee` (numeric, calculated tax fee)
  - `payout_amount` (numeric, amount after fee)
  - `fee_wallet_address` (text, where fee is sent)
  - `reviewed_at` (timestamptz, when admin reviewed)
  - `created_at` (timestamptz, default now)

2. Security
- RLS enabled.
- Users can read their own withdrawals (auth.uid() = user_id).
- Users can insert their own withdrawals.
- Admins (role = 'admin' or 'super_admin') can read all withdrawals.
- No update/delete from client — admin server functions handle updates via service role.
*/

CREATE TABLE IF NOT EXISTS withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  crypto_currency text NOT NULL DEFAULT 'USDT',
  wallet_address text,
  status text NOT NULL DEFAULT 'pending',
  tax_fee numeric DEFAULT 0,
  payout_amount numeric DEFAULT 0,
  fee_wallet_address text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_withdrawals" ON withdrawals;
CREATE POLICY "select_own_withdrawals"
ON withdrawals FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
  )
);

DROP POLICY IF EXISTS "insert_own_withdrawals" ON withdrawals;
CREATE POLICY "insert_own_withdrawals"
ON withdrawals FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON withdrawals(created_at DESC);
