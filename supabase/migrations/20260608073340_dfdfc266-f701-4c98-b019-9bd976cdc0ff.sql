
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS tax_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_wallet_address text;

CREATE OR REPLACE FUNCTION public.admin_decide_withdrawal_atomic(_withdrawal_id uuid, _status text, _fee_wallet text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_w public.withdrawals%ROWTYPE;
  v_p public.profiles%ROWTYPE;
  v_amount numeric;
  v_tax numeric;
  v_payout numeric;
  v_tx_id uuid;
BEGIN
  IF _status NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Invalid withdrawal status';
  END IF;

  SELECT * INTO v_w FROM public.withdrawals WHERE id = _withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF v_w.status <> 'pending' THEN RETURN; END IF;

  v_amount := v_w.amount;
  v_tax := round(v_amount * 0.05, 2);
  v_payout := greatest(0, round(v_amount - v_tax, 2));

  IF _status = 'rejected' THEN
    UPDATE public.withdrawals
      SET status='rejected', reviewed_at=now(), tax_fee=v_tax, payout_amount=v_payout, fee_wallet_address=_fee_wallet
      WHERE id=_withdrawal_id;

    SELECT id INTO v_tx_id FROM public.transactions
      WHERE user_id=v_w.user_id AND amount=v_amount AND status='pending' AND type='withdrawal_request'
      ORDER BY created_at DESC LIMIT 1;
    IF v_tx_id IS NOT NULL THEN
      UPDATE public.transactions SET type='withdrawal_rejected', asset_name='Rejected withdrawal '||v_w.crypto_currency, status='completed', source_table='withdrawals', source_id=v_w.id
        WHERE id=v_tx_id;
    ELSE
      INSERT INTO public.transactions(user_id,type,amount,asset_name,status,source_table,source_id)
        VALUES (v_w.user_id,'withdrawal_rejected',v_amount,'Rejected withdrawal '||v_w.crypto_currency,'completed','withdrawals',v_w.id);
    END IF;
    RETURN;
  END IF;

  SELECT * INTO v_p FROM public.profiles WHERE id=v_w.user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User profile not found'; END IF;
  IF coalesce(v_p.available_cash,0) < v_amount THEN RAISE EXCEPTION 'Insufficient available cash'; END IF;

  UPDATE public.profiles
    SET account_balance=greatest(0,coalesce(account_balance,0)-v_amount),
        available_cash=greatest(0,coalesce(available_cash,0)-v_amount),
        live_balance=greatest(0,coalesce(live_balance,0)-v_amount),
        updated_at=now()
    WHERE id=v_w.user_id;

  UPDATE public.withdrawals
    SET status='approved', reviewed_at=now(), tax_fee=v_tax, payout_amount=v_payout, fee_wallet_address=_fee_wallet
    WHERE id=_withdrawal_id;

  SELECT id INTO v_tx_id FROM public.transactions
    WHERE user_id=v_w.user_id AND amount=v_amount AND status='pending' AND type='withdrawal_request'
    ORDER BY created_at DESC LIMIT 1;
  IF v_tx_id IS NOT NULL THEN
    UPDATE public.transactions SET type='withdrawal', asset_name='Approved withdrawal '||v_w.crypto_currency||' · payout $'||v_payout||' · tax $'||v_tax, status='completed', source_table='withdrawals', source_id=v_w.id
      WHERE id=v_tx_id;
  ELSE
    INSERT INTO public.transactions(user_id,type,amount,asset_name,status,source_table,source_id)
      VALUES (v_w.user_id,'withdrawal',v_amount,'Approved withdrawal '||v_w.crypto_currency,'completed','withdrawals',v_w.id);
  END IF;

  INSERT INTO public.transactions(user_id,type,amount,asset_name,status,source_table,source_id)
    VALUES (v_w.user_id,'withdrawal_tax_fee',v_tax,'5% withdrawal tax to '||_fee_wallet,'completed','withdrawals',v_w.id);
END;
$$;
