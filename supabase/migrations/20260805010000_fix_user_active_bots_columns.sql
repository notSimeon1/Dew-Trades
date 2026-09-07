-- ============ FIX USER_ACTIVE_BOTS COLUMNS & RPC ============

-- 1. Ensure all required columns exist on user_active_bots
ALTER TABLE public.user_active_bots ADD COLUMN IF NOT EXISTS daily_payout numeric DEFAULT 0;
ALTER TABLE public.user_active_bots ADD COLUMN IF NOT EXISTS hourly_payout numeric DEFAULT 0;
ALTER TABLE public.user_active_bots ADD COLUMN IF NOT EXISTS payout_interval text DEFAULT 'hourly';
ALTER TABLE public.user_active_bots ADD COLUMN IF NOT EXISTS account_mode text DEFAULT 'live';
ALTER TABLE public.user_active_bots ADD COLUMN IF NOT EXISTS last_payout_at timestamptz DEFAULT now();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_active_bots TO authenticated;
GRANT ALL ON public.user_active_bots TO service_role;

-- 2. Drop legacy signatures if present to prevent signature mismatch
DROP FUNCTION IF EXISTS public.activate_bot(uuid, numeric);

-- 3. Unified activate_bot RPC handling p_bot_id & _bot_id
CREATE OR REPLACE FUNCTION public.activate_bot(
  p_bot_id uuid DEFAULT NULL,
  p_invested_amount numeric DEFAULT NULL,
  _bot_id uuid DEFAULT NULL,
  _invested_amount numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_target_bot_id uuid;
  v_amount numeric;
  v_bot record;
  v_mode text;
  v_balance numeric;
  v_expiration timestamptz;
  v_new_id uuid;
  v_hourly numeric;
  v_daily numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_target_bot_id := COALESCE(p_bot_id, _bot_id);
  v_amount := COALESCE(p_invested_amount, _invested_amount);

  IF v_target_bot_id IS NULL OR v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid bot ID or investment amount';
  END IF;

  SELECT * INTO v_bot FROM public.trading_bots WHERE id = v_target_bot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trading bot not found';
  END IF;

  IF v_amount < COALESCE(v_bot.capital_required, 0) THEN
    RAISE EXCEPTION 'Minimum investment is $%', v_bot.capital_required;
  END IF;

  SELECT account_mode, 
         CASE WHEN account_mode = 'demo' THEN demo_balance ELSE live_balance END
  INTO v_mode, v_balance
  FROM public.profiles WHERE id = v_user_id;

  v_mode := COALESCE(v_mode, 'live');

  IF COALESCE(v_balance, 0) < v_amount THEN
    RAISE EXCEPTION 'Insufficient balance in % account', v_mode;
  END IF;

  -- Deduct balance
  IF v_mode = 'demo' THEN
    UPDATE public.profiles SET demo_balance = demo_balance - v_amount, updated_at = now() WHERE id = v_user_id;
  ELSE
    UPDATE public.profiles SET live_balance = live_balance - v_amount, updated_at = now() WHERE id = v_user_id;
  END IF;

  v_daily := COALESCE(v_bot.daily_payout, (v_amount * COALESCE(v_bot.min_roi, 5) / 100));
  v_hourly := COALESCE(v_bot.hourly_payout, v_daily / 24);
  v_expiration := now() + (COALESCE(v_bot.duration_days, 30) || ' days')::interval;

  INSERT INTO public.user_active_bots (
    user_id,
    bot_id,
    invested_amount,
    daily_payout,
    hourly_payout,
    payout_interval,
    current_profit,
    status,
    account_mode,
    activation_date,
    expiration_date,
    last_payout_at
  )
  VALUES (
    v_user_id,
    v_target_bot_id,
    v_amount,
    v_daily,
    v_hourly,
    COALESCE(v_bot.payout_interval, 'hourly'),
    0,
    'active',
    v_mode,
    now(),
    v_expiration,
    now()
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.transactions (user_id, type, amount, status, asset_name, account_mode)
  VALUES (v_user_id, 'bot_activation', v_amount, 'completed', 'Activated AI Bot: ' || v_bot.name, v_mode);

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_bot(uuid, numeric, uuid, numeric) TO authenticated, anon;

-- Force PostgREST to reload schema cache
SELECT pg_notify('pgrst', 'reload schema');
