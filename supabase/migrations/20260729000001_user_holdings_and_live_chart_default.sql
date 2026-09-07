-- ============================================================
-- 1. Create user_holdings table for crypto asset balances
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_holdings (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol      text        NOT NULL,
  quantity    numeric(28, 8) NOT NULL DEFAULT 0,
  network     text        DEFAULT 'spot',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, symbol)
);

-- RLS
ALTER TABLE public.user_holdings ENABLE ROW LEVEL SECURITY;

-- Users can view their own holdings
DROP POLICY IF EXISTS "Users view own holdings" ON public.user_holdings;
CREATE POLICY "Users view own holdings"
  ON public.user_holdings FOR SELECT
  USING (auth.uid() = user_id);

-- Admins (owner + user_roles) can manage all holdings
DROP POLICY IF EXISTS "Admins manage all holdings" ON public.user_holdings;
CREATE POLICY "Admins manage all holdings"
  ON public.user_holdings FOR ALL
  USING (
    auth.email() = 'simonosawaru255@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    auth.email() = 'simonosawaru255@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_holdings_updated_at ON public.user_holdings;
CREATE TRIGGER trg_user_holdings_updated_at
  BEFORE UPDATE ON public.user_holdings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. Set default chart_mode to 'live' for new user profiles
-- ============================================================

ALTER TABLE public.profiles
  ALTER COLUMN chart_mode SET DEFAULT 'live';

-- ============================================================
-- 3. Expose user_holdings to PostgREST schema cache
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_holdings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_holdings TO service_role;
