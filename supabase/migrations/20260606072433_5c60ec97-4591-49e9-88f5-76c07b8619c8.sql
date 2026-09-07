GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_trading_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS source_table text,
  ADD COLUMN IF NOT EXISTS source_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_source_unique
  ON public.transactions (source_table, source_id, type)
  WHERE source_table IS NOT NULL AND source_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_positions TO authenticated;
GRANT ALL ON public.live_positions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kyc_submissions TO authenticated;
GRANT ALL ON public.kyc_submissions TO service_role;