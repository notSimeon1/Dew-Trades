/*
# Create accrue_daily_bot_profits and accrue_copy_trading_profits RPCs

## Changes
1. Creates `accrue_daily_bot_profits` SECURITY DEFINER function:
   - Iterates all running user_active_bots
   - For hourly bots: accrues hourly_payout for each hour since last_payout_at
   - For daily bots: accrues daily_payout for each day since last_payout_at
   - Updates current_profit on the bot record
   - Credits the user's balance (demo or live based on account_mode)
   - Logs a transaction for each accrual
   - Marks bots as 'completed' when past expiration_date
2. Creates `accrue_copy_trading_profits` SECURITY DEFINER function:
   - Iterates all active user_copy_allocations
   - Accrues daily profit based on monthly ROI midpoint
   - Credits user balance and logs transactions
3. Grants EXECUTE to authenticated role (for cron/edge function invocation)
*/

CREATE OR REPLACE FUNCTION public.accrue_daily_bot_profits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bot record;
  _profit numeric;
  _hours_elapsed numeric;
  _days_elapsed numeric;
  _total_accrued numeric := 0;
  _bots_processed int := 0;
  _mode text;
  _payout numeric;
BEGIN
  FOR _bot IN
    SELECT uab.*, tb.payout_interval, tb.hourly_payout, tb.daily_payout, tb.name as bot_name
    FROM user_active_bots uab
    JOIN trading_bots tb ON uab.bot_id = tb.id
    WHERE uab.status = 'running'
  LOOP
    _profit := 0;

    IF _bot.payout_interval = 'hourly' THEN
      _hours_elapsed := EXTRACT(EPOCH FROM (now() - COALESCE(_bot.last_payout_at, _bot.activation_date))) / 3600;
      IF _hours_elapsed >= 1 THEN
        _payout := COALESCE(_bot.hourly_payout, 0);
        _profit := FLOOR(_hours_elapsed) * _payout;
      END IF;
    ELSE
      _days_elapsed := EXTRACT(EPOCH FROM (now() - COALESCE(_bot.last_payout_at, _bot.activation_date))) / 86400;
      IF _days_elapsed >= 1 THEN
        _payout := COALESCE(_bot.daily_payout, 0);
        IF _payout = 0 THEN
          _payout := (_bot.invested_amount * 0.04);
        END IF;
        _profit := FLOOR(_days_elapsed) * _payout;
      END IF;
    END IF;

    IF _profit > 0 THEN
      _mode := _bot.account_mode;

      UPDATE user_active_bots
      SET current_profit = current_profit + _profit,
          last_payout_at = now()
      WHERE id = _bot.id;

      IF _mode = 'live' THEN
        UPDATE profiles SET live_balance = live_balance + _profit, updated_at = now() WHERE id = _bot.user_id;
      ELSE
        UPDATE profiles SET demo_balance = demo_balance + _profit, updated_at = now() WHERE id = _bot.user_id;
      END IF;

      INSERT INTO transactions (user_id, type, amount, status, asset_name, account_mode)
      VALUES (_bot.user_id, 'bot_profit', _profit, 'completed', _bot.bot_name, _mode);

      _total_accrued := _total_accrued + _profit;
      _bots_processed := _bots_processed + 1;
    END IF;

    IF now() >= _bot.expiration_date AND _bot.status = 'running' THEN
      UPDATE user_active_bots SET status = 'completed' WHERE id = _bot.id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'bots_processed', _bots_processed,
    'total_accrued', _total_accrued,
    'timestamp', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accrue_copy_trading_profits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _alloc record;
  _daily_profit numeric;
  _days_elapsed numeric;
  _total_accrued numeric := 0;
  _allocs_processed int := 0;
  _mode text;
BEGIN
  FOR _alloc IN
    SELECT uca.*, ctt.monthly_roi_min, ctt.monthly_roi_max, ctt.tier_name, ctt.strategist_name
    FROM user_copy_allocations uca
    JOIN copy_trading_tiers ctt ON uca.tier_id = ctt.id
    WHERE uca.status = 'active'
  LOOP
    _days_elapsed := EXTRACT(EPOCH FROM (now() - COALESCE(_alloc.created_at, now()))) / 86400;
    IF _days_elapsed < 1 THEN
      _days_elapsed := 0.5;
    END IF;

    _daily_profit := (_alloc.allocated_amount * ((_alloc.monthly_roi_min + _alloc.monthly_roi_max) / 2.0) / 100.0 / 30.0);

    IF _daily_profit > 0 THEN
      _mode := _alloc.account_mode;

      UPDATE user_copy_allocations
      SET current_profit = current_profit + (_daily_profit * LEAST(_days_elapsed, 1))
      WHERE id = _alloc.id;

      IF _mode = 'live' THEN
        UPDATE profiles SET live_balance = live_balance + (_daily_profit * LEAST(_days_elapsed, 1)), updated_at = now() WHERE id = _alloc.user_id;
      ELSE
        UPDATE profiles SET demo_balance = demo_balance + (_daily_profit * LEAST(_days_elapsed, 1)), updated_at = now() WHERE id = _alloc.user_id;
      END IF;

      INSERT INTO transactions (user_id, type, amount, status, asset_name, account_mode)
      VALUES (_alloc.user_id, 'copy_profit', _daily_profit * LEAST(_days_elapsed, 1), 'completed', _alloc.tier_name || ' - ' || _alloc.strategist_name, _mode);

      _total_accrued := _total_accrued + _daily_profit;
      _allocs_processed := _allocs_processed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'allocs_processed', _allocs_processed,
    'total_accrued', _total_accrued,
    'timestamp', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accrue_daily_bot_profits() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accrue_copy_trading_profits() TO authenticated;
