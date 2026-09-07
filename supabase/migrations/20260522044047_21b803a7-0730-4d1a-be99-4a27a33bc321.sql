create or replace function public.open_position_atomic(
  _user_id uuid,
  _asset text,
  _side text,
  _quantity numeric,
  _leverage numeric,
  _margin numeric,
  _entry_price numeric,
  _account_mode text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
    if v_profile.kyc_status <> 'approved' then
      raise exception 'KYC approval is required for live trading';
    end if;

    if coalesce(v_profile.live_balance, 0) < _margin or coalesce(v_profile.available_cash, 0) < _margin then
      raise exception 'Insufficient live balance';
    end if;

    update public.profiles
      set live_balance = live_balance - _margin,
          available_cash = greatest(0, available_cash - _margin),
          account_balance = greatest(0, account_balance - _margin),
          updated_at = now()
      where id = _user_id;
  else
    if coalesce(v_profile.demo_balance, 0) < _margin then
      raise exception 'Insufficient demo balance';
    end if;

    update public.profiles
      set demo_balance = demo_balance - _margin,
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
$$;

revoke all on function public.open_position_atomic(uuid, text, text, numeric, numeric, numeric, numeric, text) from public, anon, authenticated;
grant execute on function public.open_position_atomic(uuid, text, text, numeric, numeric, numeric, numeric, text) to service_role;