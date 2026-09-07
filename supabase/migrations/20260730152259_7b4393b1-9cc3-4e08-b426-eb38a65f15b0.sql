-- 1. BOT SCHEMA
ALTER TABLE public.trading_bots
  ADD COLUMN IF NOT EXISTS payout_interval text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS hourly_payout numeric(20,2) NOT NULL DEFAULT 0;

ALTER TABLE public.user_active_bots
  ADD COLUMN IF NOT EXISTS last_payout_at timestamptz NOT NULL DEFAULT now();

UPDATE public.trading_bots SET capital_required = 300, payout_interval = 'hourly', hourly_payout = 8,
  duration_days = 30, min_roi = 2.66, max_roi = 2.66, status = 'active', sort_order = 2
  WHERE tier_key = 'bronze';
UPDATE public.trading_bots SET capital_required = 300, payout_interval = 'hourly', hourly_payout = 11,
  duration_days = 30, min_roi = 3.66, max_roi = 3.66, status = 'active', sort_order = 4
  WHERE tier_key = 'gold';
UPDATE public.trading_bots SET min_roi = 10, max_roi = 15, payout_interval = 'daily'
  WHERE tier_key IN ('starter','silver','platinum');

INSERT INTO public.trading_bots (name, tier_key, capital_required, duration_days, min_roi, max_roi, win_rate, perks, status, sort_order, payout_interval)
VALUES
 ('Titanium Grid', 'titanium', 2500, 30, 10, 15, 91.4, '["Dynamic 10-15% daily ROI","Grid + trend hybrid engine","Priority execution routing"]'::jsonb, 'active', 6, 'daily'),
 ('Diamond Momentum', 'diamond', 5000, 30, 10, 15, 93.2, '["Dynamic 10-15% daily ROI","Multi-exchange liquidity","Dedicated strategist review"]'::jsonb, 'active', 7, 'daily'),
 ('Obsidian Quant', 'obsidian', 10000, 45, 10, 15, 94.6, '["Dynamic 10-15% daily ROI","Institutional quant models","24/7 risk desk monitoring"]'::jsonb, 'active', 8, 'daily'),
 ('Sovereign Apex', 'sovereign', 25000, 60, 10, 15, 96.1, '["Dynamic 10-15% daily ROI","Bespoke allocation mandate","Private banker support"]'::jsonb, 'active', 9, 'daily')
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_uab_status ON public.user_active_bots(status);
CREATE INDEX IF NOT EXISTS idx_uab_user ON public.user_active_bots(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_user_created ON public.transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ucb_user ON public.user_crypto_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_user ON public.deposits(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON public.withdrawals(user_id, created_at DESC);

-- 2. UNIFIED ACCRUAL ENGINE (hourly + daily)
CREATE OR REPLACE FUNCTION public.accrue_bot_profits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record; v_units numeric; v_profit numeric; v_pct numeric;
  v_processed int := 0; v_total numeric := 0; v_label text;
BEGIN
  FOR r IN
    SELECT ab.id, ab.user_id, ab.invested_amount, ab.last_payout_at, ab.expiration_date,
           tb.name, tb.min_roi, tb.max_roi, tb.payout_interval, tb.hourly_payout, tb.capital_required
    FROM public.user_active_bots ab
    JOIN public.trading_bots tb ON tb.id = ab.bot_id
    WHERE ab.status = 'running'
    FOR UPDATE OF ab
  LOOP
    v_profit := 0; v_label := '';
    IF r.payout_interval = 'hourly' THEN
      v_units := floor(extract(epoch FROM (now() - r.last_payout_at)) / 3600.0);
      IF v_units >= 1 THEN
        v_profit := round((r.hourly_payout * (r.invested_amount / NULLIF(r.capital_required,0)) * v_units)::numeric, 2);
        v_label := r.name || ' — hourly payout ($' || r.hourly_payout::text || '/hr x ' || v_units::text || ')';
      END IF;
    ELSE
      v_units := floor(extract(epoch FROM (now() - r.last_payout_at)) / 86400.0);
      IF v_units >= 1 THEN
        v_pct := round((r.min_roi + (r.max_roi - r.min_roi) * random())::numeric, 2);
        v_profit := round((r.invested_amount * v_pct / 100.0 * v_units)::numeric, 2);
        v_label := r.name || ' — daily profit +' || v_pct::text || '%';
      END IF;
    END IF;

    IF v_profit > 0 THEN
      UPDATE public.user_active_bots
        SET current_profit = coalesce(current_profit,0) + v_profit,
            last_payout_at = now()
        WHERE id = r.id;

      UPDATE public.profiles
        SET available_cash = greatest(0, coalesce(available_cash,0) + v_profit),
            account_balance = greatest(0, coalesce(account_balance,0) + v_profit),
            live_balance = greatest(0, coalesce(live_balance,0) + v_profit),
            updated_at = now()
        WHERE id = r.user_id;

      INSERT INTO public.transactions (user_id, type, amount, asset_name, status, source_table, source_id)
      VALUES (r.user_id, 'bot_profit', v_profit, v_label, 'completed', 'user_active_bots', r.id);

      v_processed := v_processed + 1;
      v_total := v_total + v_profit;
    END IF;

    IF now() >= r.expiration_date THEN
      UPDATE public.user_active_bots SET status = 'completed' WHERE id = r.id;
    END IF;
  END LOOP;

  UPDATE public.profiles p
    SET available_cash = coalesce(available_cash,0) + ab.invested_amount,
        account_balance = coalesce(account_balance,0) + ab.invested_amount,
        live_balance = coalesce(live_balance,0) + ab.invested_amount,
        updated_at = now()
    FROM public.user_active_bots ab
    WHERE ab.user_id = p.id AND ab.status = 'completed' AND ab.expiration_date <= now()
      AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.source_table='user_active_bots' AND t.source_id=ab.id AND t.type='bot_principal_return');

  INSERT INTO public.transactions (user_id, type, amount, asset_name, status, source_table, source_id)
  SELECT ab.user_id, 'bot_principal_return', ab.invested_amount, tb.name || ' — principal returned', 'completed', 'user_active_bots', ab.id
  FROM public.user_active_bots ab
  JOIN public.trading_bots tb ON tb.id = ab.bot_id
  WHERE ab.status = 'completed' AND ab.expiration_date <= now()
    AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.source_table='user_active_bots' AND t.source_id=ab.id AND t.type='bot_principal_return');

  RETURN jsonb_build_object('processed', v_processed, 'total_credited', v_total, 'ran_at', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.accrue_daily_bot_profits()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.accrue_bot_profits() $$;

GRANT EXECUTE ON FUNCTION public.accrue_bot_profits() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accrue_daily_bot_profits() TO authenticated, service_role;

-- 3. COPY TRADING EXPANSION
ALTER TABLE public.copy_trading_tiers
  ADD COLUMN IF NOT EXISTS profit_share numeric(6,2) NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS risk_rating text NOT NULL DEFAULT 'Medium',
  ADD COLUMN IF NOT EXISTS lock_in_days integer NOT NULL DEFAULT 30;

UPDATE public.copy_trading_tiers SET profit_share = 15, risk_rating = 'Low', lock_in_days = 14 WHERE tier_key = 'veteran';
UPDATE public.copy_trading_tiers SET profit_share = 20, risk_rating = 'Medium', lock_in_days = 30 WHERE tier_key = 'pro';
UPDATE public.copy_trading_tiers SET profit_share = 25, risk_rating = 'High', lock_in_days = 45 WHERE tier_key = 'elite';

INSERT INTO public.copy_trading_tiers (tier_key, tier_name, strategist_name, required_capital, win_rate, monthly_roi_min, monthly_roi_max, perks, is_active, sort_order, profit_share, risk_rating, lock_in_days)
VALUES
 ('starter','The Starter Desk','Marcus Vale',100,74.5,8,14,'["Mirror entry & exit signals","Weekly performance digest","Cancel anytime after 7 days"]'::jsonb,true,0,10,'Low',7),
 ('momentum','The Momentum Desk','Alina Kovacs',300,81.2,14,22,'["Intraday momentum mirroring","Risk-capped position sizing","Priority support"]'::jsonb,true,1,12,'Low',14),
 ('institutional','The Institutional Desk','Rajiv Menon',5000,89.7,45,68,'["Institutional order flow","Custom drawdown limits","Dedicated account strategist"]'::jsonb,true,4,28,'High',60),
 ('sovereign','The Sovereign Syndicate','Elena Whitmore',25000,93.4,70,110,'["Private mandate allocation","Bespoke hedging overlay","Direct strategist line"]'::jsonb,true,5,30,'High',90)
ON CONFLICT (tier_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.activate_copy_trading(_tier_id uuid, _allocated_amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_tier public.copy_trading_tiers%rowtype; v_p public.profiles%rowtype; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_tier FROM public.copy_trading_tiers WHERE id = _tier_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tier not available'; END IF;
  IF _allocated_amount < v_tier.required_capital THEN
    RAISE EXCEPTION 'Minimum allocation for % is $%', v_tier.tier_name, v_tier.required_capital;
  END IF;
  SELECT * INTO v_p FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF coalesce(v_p.available_cash,0) < _allocated_amount THEN
    RAISE EXCEPTION 'Insufficient available cash. Top up your balance first.';
  END IF;

  UPDATE public.profiles
    SET available_cash = coalesce(available_cash,0) - _allocated_amount,
        account_balance = greatest(0, coalesce(account_balance,0) - _allocated_amount),
        live_balance = greatest(0, coalesce(live_balance,0) - _allocated_amount),
        updated_at = now()
    WHERE id = v_uid;

  INSERT INTO public.user_copy_allocations (user_id, tier_id, allocated_amount, current_profit, status)
  VALUES (v_uid, _tier_id, _allocated_amount, 0, 'active') RETURNING id INTO v_id;

  INSERT INTO public.transactions (user_id, type, amount, asset_name, status, source_table, source_id)
  VALUES (v_uid, 'copy_allocation', _allocated_amount, v_tier.tier_name || ' — copy trading allocation', 'completed', 'user_copy_allocations', v_id);

  PERFORM public.notify_user(v_uid, 'Copy trading activated',
    'You are now copying ' || v_tier.strategist_name || ' with $' || _allocated_amount::text || '.', 'system');
  RETURN v_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.activate_copy_trading(uuid, numeric) TO authenticated;

-- 4. ADMIN CRYPTO CREDIT -> INDIVIDUAL WALLET SYNC
CREATE OR REPLACE FUNCTION public.admin_adjust_crypto(_target uuid, _symbol text, _amount numeric, _action text, _reason text, _fiat_usd numeric DEFAULT NULL::numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_current numeric; v_new numeric; v_email text; v_caller_email text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _action NOT IN ('credit','debit') THEN RAISE EXCEPTION 'Invalid action'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = _target;
  SELECT lower(email) INTO v_caller_email FROM auth.users WHERE id = auth.uid();
  IF v_email = 'simonosawaru255@gmail.com' AND v_caller_email IS DISTINCT FROM 'simonosawaru255@gmail.com' THEN
    RAISE EXCEPTION 'Action Denied: You cannot modify Primary Super Admin balances.';
  END IF;
  SELECT COALESCE((crypto_balances->>upper(_symbol))::numeric, 0) INTO v_current FROM public.profiles WHERE id = _target;
  v_new := CASE WHEN _action='credit' THEN v_current + _amount ELSE GREATEST(0, v_current - _amount) END;
  UPDATE public.profiles SET crypto_balances = COALESCE(crypto_balances,'{}'::jsonb) || jsonb_build_object(upper(_symbol), v_new), updated_at = now()
    WHERE id = _target;

  INSERT INTO public.user_crypto_balances (user_id, asset_symbol, balance, updated_at)
  VALUES (_target, upper(_symbol), v_new, now())
  ON CONFLICT (user_id, asset_symbol) DO UPDATE SET balance = EXCLUDED.balance, updated_at = now();

  INSERT INTO public.admin_balance_logs(admin_id, target_user_id, balance_type, asset_symbol, action, amount, fiat_value_usd, reason)
    VALUES (auth.uid(), _target, 'crypto', upper(_symbol), _action, _amount, _fiat_usd, _reason);
  IF _action='credit' THEN
    PERFORM public.notify_user(_target,'Account credited',
      'Your account has been credited with '||_amount::text||' '||upper(_symbol)||'. Your new '||upper(_symbol)||' balance is '||v_new::text||'.','credit');
  ELSE
    PERFORM public.notify_user(_target,'Account debited',
      'Your account has been debited by '||_amount::text||' '||upper(_symbol)||'. Your updated '||upper(_symbol)||' balance is '||v_new::text||'.','debit');
  END IF;
END; $$;

-- 5. SUPER ADMIN HIERARCHY
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id AND lower(email) = 'simonosawaru255@gmail.com') $$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_grant_admin(_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Action Denied: Only the Super Admin can assign admin privileges.';
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES(_target, 'admin') ON CONFLICT DO NOTHING;
  PERFORM public.notify_user(_target,'Account level updated','Your account level has been updated to Pro status.','system');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_revoke_admin(_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Action Denied: Only the Super Admin can revoke admin privileges.';
  END IF;
  IF public.is_super_admin(_target) THEN
    RAISE EXCEPTION 'Action Denied: You cannot modify the Primary Super Admin account.';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _target AND role = 'admin';
END; $$;

DROP TRIGGER IF EXISTS trg_protect_primary_super_admin ON public.user_roles;
CREATE TRIGGER trg_protect_primary_super_admin
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_primary_super_admin();

-- 6. HOURLY CRON
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname IN ('daily-bot-accrual','frobex-bot-accrual');
SELECT cron.schedule('frobex-bot-accrual', '0 * * * *', $$ SELECT public.accrue_bot_profits() $$);