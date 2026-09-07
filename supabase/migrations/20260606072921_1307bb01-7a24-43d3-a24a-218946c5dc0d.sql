CREATE OR REPLACE FUNCTION public.open_position_atomic(_user_id uuid, _asset text, _side text, _quantity numeric, _leverage numeric, _margin numeric, _entry_price numeric, _account_mode text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_profile public.profiles%rowtype;
  v_position_id uuid;
begin
  if _side not in ('buy', 'sell') then
    raise exception 'Invalid trade side';
  end if;

  if _account_mode not in ('demo', 'live') then
    raise exception 'Invalid account mode';
  end if;

  if _margin <= 0 or _quantity <= 0 or _entry_price <= 0 then
    raise exception 'Invalid trade values';
  end if;

  select * into v_profile
  from public.profiles
  where id = _user_id
  for update;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_profile.is_suspended then
    raise exception 'Account is suspended';
  end if;

  if _account_mode = 'live' then
    if coalesce(v_profile.live_balance, 0) < _margin or coalesce(v_profile.available_cash, 0) < _margin then
      raise exception 'Insufficient live balance';
    end if;

    update public.profiles
      set live_balance = greatest(0, coalesce(live_balance, 0) - _margin),
          available_cash = greatest(0, coalesce(available_cash, 0) - _margin),
          account_balance = greatest(0, coalesce(account_balance, 0) - _margin),
          updated_at = now()
      where id = _user_id;
  else
    if coalesce(v_profile.demo_balance, 0) < _margin then
      raise exception 'Insufficient demo balance';
    end if;

    update public.profiles
      set demo_balance = greatest(0, coalesce(demo_balance, 0) - _margin),
          updated_at = now()
      where id = _user_id;
  end if;

  insert into public.live_positions (user_id, asset, side, quantity, leverage, margin, entry_price, account_mode)
  values (_user_id, _asset, _side, _quantity, _leverage, _margin, _entry_price, _account_mode)
  returning id into v_position_id;

  insert into public.transactions (user_id, type, amount, quantity, asset_name, status)
  values (_user_id, 'trade_open', _margin, _quantity, 'Open ' || upper(_side) || ' ' || _asset || ' (' || _account_mode || ')', 'completed');

  return v_position_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_decide_deposit_atomic(_deposit_id uuid, _status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_deposit public.deposits%rowtype;
  v_profile public.profiles%rowtype;
  v_amount numeric;
  v_bonus numeric;
  v_tx_id uuid;
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

  v_amount := v_deposit.amount;

  if _status = 'rejected' then
    update public.deposits
      set status = 'rejected', reviewed_at = now()
      where id = _deposit_id;

    select id into v_tx_id
    from public.transactions
    where user_id = v_deposit.user_id
      and amount = v_amount
      and status = 'pending'
      and type = 'deposit_request'
    order by created_at desc
    limit 1;

    if v_tx_id is not null then
      update public.transactions
        set type = 'deposit_rejected', asset_name = 'Rejected deposit ' || v_deposit.crypto_currency, status = 'completed', source_table = 'deposits', source_id = v_deposit.id
        where id = v_tx_id;
    else
      insert into public.transactions (user_id, type, amount, asset_name, status, source_table, source_id)
      values (v_deposit.user_id, 'deposit_rejected', v_amount, 'Rejected deposit ' || v_deposit.crypto_currency, 'completed', 'deposits', v_deposit.id);
    end if;
    return;
  end if;

  select * into v_profile
  from public.profiles
  where id = v_deposit.user_id
  for update;

  if not found then
    raise exception 'User profile not found';
  end if;

  update public.profiles
    set account_balance = coalesce(account_balance, 0) + v_amount,
        available_cash = coalesce(available_cash, 0) + v_amount,
        live_balance = coalesce(live_balance, 0) + v_amount,
        updated_at = now()
    where id = v_deposit.user_id;

  update public.deposits
    set status = 'approved', reviewed_at = now()
    where id = _deposit_id;

  select id into v_tx_id
  from public.transactions
  where user_id = v_deposit.user_id
    and amount = v_amount
    and status = 'pending'
    and type = 'deposit_request'
  order by created_at desc
  limit 1;

  if v_tx_id is not null then
    update public.transactions
      set type = 'deposit', asset_name = 'Approved deposit ' || v_deposit.crypto_currency, status = 'completed', source_table = 'deposits', source_id = v_deposit.id
      where id = v_tx_id;
  else
    insert into public.transactions (user_id, type, amount, asset_name, status, source_table, source_id)
    values (v_deposit.user_id, 'deposit', v_amount, 'Approved deposit ' || v_deposit.crypto_currency, 'completed', 'deposits', v_deposit.id);
  end if;

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

    insert into public.transactions (user_id, type, amount, asset_name, status, source_table, source_id)
    values (v_profile.referred_by, 'referral_bonus', v_bonus, 'Referral commission (20%)', 'completed', 'deposits', v_deposit.id)
    on conflict (source_table, source_id, type) where source_table is not null and source_id is not null do nothing;
  end if;
end;
$function$;

UPDATE public.profiles p
SET kyc_status = latest.status,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (user_id) user_id, status
  FROM public.kyc_submissions
  ORDER BY user_id, created_at DESC
) latest
WHERE p.id = latest.user_id
  AND p.kyc_status IS DISTINCT FROM latest.status;