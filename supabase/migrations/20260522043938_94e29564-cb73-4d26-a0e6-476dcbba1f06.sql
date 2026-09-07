create or replace function public.admin_decide_deposit_atomic(_deposit_id uuid, _status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deposit public.deposits%rowtype;
  v_profile public.profiles%rowtype;
  v_amount numeric;
  v_bonus numeric;
begin
  if _status not in ('approved', 'rejected') then
    raise exception 'Invalid deposit status';
  end if;

  select * into v_deposit
  from public.deposits
  where id = _deposit_id
  for update;

  if not found then
    raise exception 'Deposit request not found';
  end if;

  if v_deposit.status <> 'pending' then
    return;
  end if;

  if _status = 'rejected' then
    update public.deposits
      set status = 'rejected', reviewed_at = now()
      where id = _deposit_id;

    insert into public.transactions (user_id, type, amount, asset_name, status)
    values (v_deposit.user_id, 'deposit_rejected', v_deposit.amount, 'Rejected deposit ' || v_deposit.crypto_currency, 'completed');
    return;
  end if;

  select * into v_profile
  from public.profiles
  where id = v_deposit.user_id
  for update;

  if not found then
    raise exception 'User profile not found';
  end if;

  v_amount := v_deposit.amount;

  update public.profiles
    set account_balance = coalesce(account_balance, 0) + v_amount,
        available_cash = coalesce(available_cash, 0) + v_amount,
        live_balance = coalesce(live_balance, 0) + v_amount,
        updated_at = now()
    where id = v_deposit.user_id;

  update public.deposits
    set status = 'approved', reviewed_at = now()
    where id = _deposit_id;

  insert into public.transactions (user_id, type, amount, asset_name, status)
  values (v_deposit.user_id, 'deposit', v_amount, 'Approved deposit ' || v_deposit.crypto_currency, 'completed');

  if v_profile.referred_by is not null then
    v_bonus := round(v_amount * 0.20, 2);

    update public.profiles
      set account_balance = coalesce(account_balance, 0) + v_bonus,
          available_cash = coalesce(available_cash, 0) + v_bonus,
          live_balance = coalesce(live_balance, 0) + v_bonus,
          updated_at = now()
      where id = v_profile.referred_by;

    insert into public.referral_earnings (referrer_id, referred_user_id, deposit_id, amount)
    values (v_profile.referred_by, v_deposit.user_id, v_deposit.id, v_bonus)
    on conflict do nothing;

    insert into public.transactions (user_id, type, amount, asset_name, status)
    values (v_profile.referred_by, 'referral_bonus', v_bonus, 'Referral commission (20%)', 'completed');
  end if;
end;
$$;

create or replace function public.close_position_atomic(_position_id uuid, _close_price numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_position public.live_positions%rowtype;
  v_profile public.profiles%rowtype;
  v_pnl numeric;
  v_delta numeric;
begin
  select * into v_position
  from public.live_positions
  where id = _position_id
  for update;

  if not found then
    raise exception 'Position not found';
  end if;

  if v_position.status <> 'open' then
    return v_position.pnl;
  end if;

  if v_position.side = 'buy' then
    v_pnl := round((_close_price - v_position.entry_price) * v_position.quantity, 2);
  else
    v_pnl := round((v_position.entry_price - _close_price) * v_position.quantity, 2);
  end if;

  v_delta := v_position.margin + v_pnl;

  select * into v_profile
  from public.profiles
  where id = v_position.user_id
  for update;

  if not found then
    raise exception 'User profile not found';
  end if;

  update public.live_positions
    set status = 'closed', close_price = _close_price, closed_at = now(), pnl = v_pnl
    where id = _position_id;

  if v_position.account_mode = 'live' then
    update public.profiles
      set account_balance = greatest(0, coalesce(account_balance, 0) + v_delta),
          available_cash = greatest(0, coalesce(available_cash, 0) + v_delta),
          live_balance = greatest(0, coalesce(live_balance, 0) + v_delta),
          updated_at = now()
      where id = v_position.user_id;
  else
    update public.profiles
      set demo_balance = greatest(0, coalesce(demo_balance, 0) + v_delta),
          updated_at = now()
      where id = v_position.user_id;
  end if;

  insert into public.transactions (user_id, type, amount, quantity, asset_name, status)
  values (
    v_position.user_id,
    case when v_pnl >= 0 then 'trade_profit' else 'trade_loss' end,
    abs(v_pnl),
    v_position.quantity,
    'Close ' || upper(v_position.side) || ' ' || v_position.asset,
    'completed'
  );

  return v_pnl;
end;
$$;

insert into public.market_news (title, body, impact, source)
select title, body, impact, source
from (values
  ('BTC holds key support as liquidity rotates into majors', 'Digital assets remain active while traders price fresh rate expectations.', 'medium', 'Frobex Desk'),
  ('Gold volatility rises before US data release', 'Precious metals traders are watching dollar strength and bond yields.', 'high', 'Frobex Desk'),
  ('EUR/USD consolidates near weekly resistance', 'FX desks expect movement after the next macro calendar update.', 'low', 'Frobex Desk'),
  ('Energy and crypto risk appetite improves in early session', 'Market breadth is improving as buyers return to high beta assets.', 'medium', 'Frobex Desk')
) as seed(title, body, impact, source)
where not exists (select 1 from public.market_news);

revoke all on function public.admin_decide_deposit_atomic(uuid, text) from public;
revoke all on function public.close_position_atomic(uuid, numeric) from public;