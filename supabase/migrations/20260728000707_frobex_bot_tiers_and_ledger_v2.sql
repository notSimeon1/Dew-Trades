-- ============ UPDATE TRADING BOT TIERS ($100 - $1,600 range) ============
DELETE FROM public.trading_bots;

INSERT INTO public.trading_bots (name, tier_key, capital_required, duration_days, min_roi, max_roi, win_rate, perks, sort_order) VALUES
  ('Starter Bot','starter',100,10,1.0,2.0,85.0,
    '["Basic algorithmic trend following","Major crypto pairs (BTC, ETH)","Daily profit accrual","Standard risk management"]'::jsonb,1),
  ('Bronze Bot','bronze',300,10,1.5,3.0,88.0,
    '["Enhanced trend-following algorithms","Crypto + forex pairs","Daily profit accrual","Improved risk guardrails"]'::jsonb,2),
  ('Silver Bot','silver',600,10,2.0,4.0,90.0,
    '["Multi-strategy AI engine","All crypto + select commodities","Auto-compounding daily profits","Priority execution routing"]'::jsonb,3),
  ('Gold Bot','gold',1000,10,2.5,5.0,93.0,
    '["High-frequency trading execution","Cross-asset arbitrage detection","Auto-compounding enabled","VIP market signals included"]'::jsonb,4),
  ('Platinum Bot','platinum',1600,10,3.0,6.0,96.0,
    '["Institutional-grade HFT engine","Full multi-asset coverage","Maximum leverage optimization","1-on-1 VIP account manager","Instant priority withdrawals"]'::jsonb,5);

-- ============ ACTIVATE BOT RPC ============
CREATE OR REPLACE FUNCTION public.activate_bot(_bot_id uuid, _invested_amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_bot public.trading_bots%ROWTYPE;
  v_balance numeric;
  v_record uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_bot FROM public.trading_bots WHERE id = _bot_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Bot not found or inactive'; END IF;

  IF _invested_amount < v_bot.capital_required THEN
    RAISE EXCEPTION 'Minimum investment for % is $%', v_bot.name, v_bot.capital_required;
  END IF;

  SELECT COALESCE(account_balance, 0) INTO v_balance FROM public.profiles WHERE id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

  IF v_balance < _invested_amount THEN
    RAISE EXCEPTION 'Insufficient balance. You need $% but have $%', _invested_amount, v_balance;
  END IF;

  UPDATE public.profiles SET
    account_balance = account_balance - _invested_amount,
    available_cash = available_cash - _invested_amount,
    updated_at = now()
  WHERE id = v_uid;

  INSERT INTO public.user_active_bots (user_id, bot_id, invested_amount, expiration_date, status)
  VALUES (v_uid, _bot_id, _invested_amount, now() + (v_bot.duration_days || ' days')::interval, 'running')
  RETURNING id INTO v_record;

  INSERT INTO public.transactions (user_id, type, amount, asset_name, status, source_table, source_id)
  VALUES (v_uid, 'bot_activation', _invested_amount, 'AI Bot: ' || v_bot.name, 'completed', 'user_active_bots', v_record);

  RETURN v_record;
END;
$$;

-- ============ DAILY BOT PROFIT ACCRUAL RPC ============
CREATE OR REPLACE FUNCTION public.accrue_daily_bot_profits()
RETURNS TABLE(updated_count int, total_profit numeric) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count int := 0;
  v_total numeric := 0;
  v_record RECORD;
  v_daily_roi numeric;
  v_profit numeric;
BEGIN
  FOR v_record IN
    SELECT uab.id, uab.user_id, uab.invested_amount, uab.current_profit,
           uab.expiration_date, tb.min_roi, tb.max_roi, tb.name
    FROM public.user_active_bots uab
    JOIN public.trading_bots tb ON uab.bot_id = tb.id
    WHERE uab.status = 'running'
      AND uab.expiration_date > now()
  LOOP
    v_daily_roi := v_record.min_roi + random() * (v_record.max_roi - v_record.min_roi);
    v_profit := ROUND(v_record.invested_amount * v_daily_roi / 100.0, 2);

    UPDATE public.user_active_bots
    SET current_profit = current_profit + v_profit
    WHERE id = v_record.id;

    UPDATE public.profiles
    SET account_balance = account_balance + v_profit,
        available_cash = available_cash + v_profit,
        live_balance = live_balance + v_profit,
        updated_at = now()
    WHERE id = v_record.user_id;

    INSERT INTO public.transactions (user_id, type, amount, asset_name, status, source_table, source_id)
    VALUES (v_record.user_id, 'bot_profit', v_profit, 'Daily bot profit: ' || v_record.name || ' (' || v_daily_roi::text || '%)', 'completed', 'user_active_bots', v_record.id);

    v_count := v_count + 1;
    v_total := v_total + v_profit;
  END LOOP;

  UPDATE public.user_active_bots SET status = 'completed' WHERE status = 'running' AND expiration_date <= now();

  RETURN QUERY SELECT v_count, v_total;
END;
$$;

-- ============ ACTIVATE COPY TRADING RPC ============
CREATE OR REPLACE FUNCTION public.activate_copy_trading(_tier_id uuid, _allocated_amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tier public.copy_trading_tiers%ROWTYPE;
  v_balance numeric;
  v_record uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_tier FROM public.copy_trading_tiers WHERE id = _tier_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Copy trading tier not found'; END IF;

  IF _allocated_amount < v_tier.required_capital THEN
    RAISE EXCEPTION 'Minimum allocation for % is $%', v_tier.tier_name, v_tier.required_capital;
  END IF;

  SELECT COALESCE(account_balance, 0) INTO v_balance FROM public.profiles WHERE id = v_uid;
  IF v_balance < _allocated_amount THEN
    RAISE EXCEPTION 'Insufficient balance. You need $% but have $%', _allocated_amount, v_balance;
  END IF;

  UPDATE public.profiles SET
    account_balance = account_balance - _allocated_amount,
    available_cash = available_cash - _allocated_amount,
    updated_at = now()
  WHERE id = v_uid;

  INSERT INTO public.user_copy_allocations (user_id, tier_id, allocated_amount, status)
  VALUES (v_uid, _tier_id, _allocated_amount, 'active')
  RETURNING id INTO v_record;

  INSERT INTO public.transactions (user_id, type, amount, asset_name, status, source_table, source_id)
  VALUES (v_uid, 'copy_trading_activation', _allocated_amount, 'Copy Trading: ' || v_tier.tier_name, 'completed', 'user_copy_allocations', v_record);

  RETURN v_record;
END;
$$;

-- ============ ALLOCATE PRE-MARKET RPC ============
CREATE OR REPLACE FUNCTION public.allocate_pre_market(_token_id uuid, _usd_amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token public.pre_market_tokens%ROWTYPE;
  v_balance numeric;
  v_tokens numeric;
  v_record uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_token FROM public.pre_market_tokens WHERE id = _token_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pre-market token not found'; END IF;

  IF _usd_amount < v_token.min_allocation THEN
    RAISE EXCEPTION 'Minimum allocation for % is $%', v_token.token_name, v_token.min_allocation;
  END IF;

  SELECT COALESCE(account_balance, 0) INTO v_balance FROM public.profiles WHERE id = v_uid;
  IF v_balance < _usd_amount THEN
    RAISE EXCEPTION 'Insufficient balance. You need $% but have $%', _usd_amount, v_balance;
  END IF;

  v_tokens := _usd_amount / v_token.listing_price;

  UPDATE public.profiles SET
    account_balance = account_balance - _usd_amount,
    available_cash = available_cash - _usd_amount,
    updated_at = now()
  WHERE id = v_uid;

  INSERT INTO public.user_pre_market_allocations (user_id, token_id, usd_invested, tokens_allocated, status)
  VALUES (v_uid, _token_id, _usd_amount, v_tokens, 'escrowed')
  RETURNING id INTO v_record;

  INSERT INTO public.transactions (user_id, type, amount, asset_name, status, source_table, source_id)
  VALUES (v_uid, 'pre_market_allocation', _usd_amount, 'Pre-Market: ' || v_token.symbol, 'completed', 'user_pre_market_allocations', v_record);

  RETURN v_record;
END;
$$;

-- ============ ADMIN RPCs ============
CREATE OR REPLACE FUNCTION public.admin_post_announcement(_title text, _content text, _category text, _is_urgent boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_record uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;

  INSERT INTO public.platform_announcements (title, content, category, is_urgent)
  VALUES (_title, _content, _category, _is_urgent)
  RETURNING id INTO v_record;

  RETURN v_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_post_signal(
  _asset_pair text, _direction text, _entry_low numeric, _entry_high numeric,
  _tp1 numeric, _tp2 numeric, _tp3 numeric, _sl numeric, _leverage text, _confidence numeric
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_record uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;

  INSERT INTO public.trading_signals (asset_pair, direction, entry_low, entry_high, tp_1, tp_2, tp_3, stop_loss, leverage, confidence)
  VALUES (_asset_pair, _direction, _entry_low, _entry_high, _tp1, _tp2, _tp3, _sl, _leverage, _confidence)
  RETURNING id INTO v_record;

  RETURN v_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_pre_market_token(
  _token_name text, _symbol text, _listing_price numeric, _pool_cap numeric,
  _min_allocation numeric, _tge_days int, _perks jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_record uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;

  INSERT INTO public.pre_market_tokens (token_name, symbol, listing_price, pool_cap, min_allocation, tge_date, perks)
  VALUES (_token_name, _symbol, _listing_price, _pool_cap, _min_allocation, now() + (_tge_days || ' days')::interval, _perks)
  RETURNING id INTO v_record;

  RETURN v_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_payment_method(
  _method_key text, _method_name text, _identifier_label text,
  _recipient_name text, _identifier text, _is_active boolean, _sort_order int
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_record uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;

  INSERT INTO public.admin_payment_methods (method_key, method_name, identifier_label, recipient_name, identifier, is_active, sort_order)
  VALUES (_method_key, _method_name, _identifier_label, _recipient_name, _identifier, _is_active, _sort_order)
  ON CONFLICT (method_key) DO UPDATE SET
    method_name = EXCLUDED.method_name,
    identifier_label = EXCLUDED.identifier_label,
    recipient_name = EXCLUDED.recipient_name,
    identifier = EXCLUDED.identifier,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = now()
  RETURNING id INTO v_record;

  RETURN v_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_platform_setting(_key_name text, _value jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;

  UPDATE public.platform_settings SET value = _value, updated_at = now() WHERE key_name = _key_name;
END;
$$;

-- ============ LEDGER COLUMNS ON DEPOSITS ============
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS base_amount numeric(20,2),
  ADD COLUMN IF NOT EXISTS gas_fee_amount numeric(20,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_payable numeric(20,2),
  ADD COLUMN IF NOT EXISTS payment_method_key text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS source_table text,
  ADD COLUMN IF NOT EXISTS source_id uuid;
