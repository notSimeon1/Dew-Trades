/*
# Add activate_bot and subscribe_copy_trader RPCs + account_mode columns

## Changes
1. Adds `account_mode` column to user_active_bots and user_copy_allocations
2. Creates `activate_bot` SECURITY DEFINER function: deducts from user balance, inserts bot record
3. Creates `subscribe_copy_trader` SECURITY DEFINER function: deducts tier price, inserts allocation
4. Grants EXECUTE to authenticated role
5. Adds RLS policies for user_active_bots and user_copy_allocations (owner-scoped CRUD)
*/

ALTER TABLE user_active_bots ADD COLUMN IF NOT EXISTS account_mode text DEFAULT 'demo';
ALTER TABLE user_copy_allocations ADD COLUMN IF NOT EXISTS account_mode text DEFAULT 'demo';

CREATE OR REPLACE FUNCTION public.activate_bot(
  _bot_id uuid,
  _invested_amount numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _bot record;
  _balance numeric;
  _expiration timestamptz;
  _new_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _bot FROM trading_bots WHERE id = _bot_id AND status = 'active' AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bot not available';
  END IF;

  IF _invested_amount < _bot.capital_required THEN
    RAISE EXCEPTION 'Minimum investment is $%', _bot.capital_required;
  END IF;

  SELECT account_mode INTO _balance FROM profiles WHERE id = _user_id;
  IF _balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  DECLARE
    _mode text;
    _avail numeric;
  BEGIN
    SELECT account_mode, 
           CASE WHEN account_mode = 'live' THEN live_balance ELSE demo_balance END
    INTO _mode, _avail
    FROM profiles WHERE id = _user_id;

    IF _avail < _invested_amount THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;

    _expiration := now() + (_bot.duration_days || ' days')::interval;

    INSERT INTO user_active_bots (user_id, bot_id, invested_amount, current_profit, status, activation_date, expiration_date, account_mode)
    VALUES (_user_id, _bot_id, _invested_amount, 0, 'running', now(), _expiration, _mode)
    RETURNING id INTO _new_id;

    IF _mode = 'live' THEN
      UPDATE profiles SET live_balance = live_balance - _invested_amount, updated_at = now() WHERE id = _user_id;
    ELSE
      UPDATE profiles SET demo_balance = demo_balance - _invested_amount, updated_at = now() WHERE id = _user_id;
    END IF;

    INSERT INTO transactions (user_id, type, amount, status, asset_name, account_mode)
    VALUES (_user_id, 'bot_activation', _invested_amount, 'completed', _bot.name, _mode);
  END;

  RETURN _new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.subscribe_copy_trader(
  _tier_id uuid,
  _allocated_amount numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _tier record;
  _mode text;
  _avail numeric;
  _new_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _tier FROM copy_trading_tiers WHERE id = _tier_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tier not available';
  END IF;

  IF _allocated_amount < _tier.required_capital THEN
    RAISE EXCEPTION 'Minimum allocation is $%', _tier.required_capital;
  END IF;

  SELECT account_mode,
         CASE WHEN account_mode = 'live' THEN live_balance ELSE demo_balance END
  INTO _mode, _avail
  FROM profiles WHERE id = _user_id;

  IF _avail IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF _avail < _allocated_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  INSERT INTO user_copy_allocations (user_id, tier_id, allocated_amount, current_profit, status, account_mode)
  VALUES (_user_id, _tier_id, _allocated_amount, 0, 'active', _mode)
  RETURNING id INTO _new_id;

  IF _mode = 'live' THEN
    UPDATE profiles SET live_balance = live_balance - _allocated_amount, updated_at = now() WHERE id = _user_id;
  ELSE
    UPDATE profiles SET demo_balance = demo_balance - _allocated_amount, updated_at = now() WHERE id = _user_id;
  END IF;

  INSERT INTO transactions (user_id, type, amount, status, asset_name, account_mode)
  VALUES (_user_id, 'copy_trading', _allocated_amount, 'completed', _tier.tier_name || ' - ' || _tier.strategist_name, _mode);

  RETURN _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_bot(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.subscribe_copy_trader(uuid, numeric) TO authenticated;
