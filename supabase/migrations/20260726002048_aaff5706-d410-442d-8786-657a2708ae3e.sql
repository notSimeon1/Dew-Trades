
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL, message text NOT NULL, type text NOT NULL DEFAULT 'system',
  is_read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_notifs_select" ON public.notifications;
CREATE POLICY "own_notifs_select" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_notifs_update" ON public.notifications;
CREATE POLICY "own_notifs_update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_notifs_delete" ON public.notifications;
CREATE POLICY "own_notifs_delete" ON public.notifications FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "admin_notifs_all" ON public.notifications;
CREATE POLICY "admin_notifs_all" ON public.notifications FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_notifs_user_created ON public.notifications(user_id, created_at DESC);

DO $mig$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $mig$;

CREATE OR REPLACE FUNCTION public.notify_user(_user_id uuid, _title text, _message text, _type text DEFAULT 'system')
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $fn$
  INSERT INTO public.notifications(user_id, title, message, type) VALUES (_user_id, _title, _message, _type);
$fn$;

CREATE TABLE IF NOT EXISTS public.support_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text DEFAULT 'Customer Support', status text NOT NULL DEFAULT 'open',
  last_message_at timestamptz DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.support_threads TO authenticated;
GRANT ALL ON public.support_threads TO service_role;
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_thread" ON public.support_threads;
CREATE POLICY "own_thread" ON public.support_threads FOR ALL
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('user','support','bot')),
  body text NOT NULL, attachment_url text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_msgs_select" ON public.support_messages;
CREATE POLICY "own_msgs_select" ON public.support_messages FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "own_msgs_insert" ON public.support_messages;
CREATE POLICY "own_msgs_insert" ON public.support_messages FOR INSERT
  WITH CHECK ((auth.uid() = user_id AND sender = 'user') OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "own_msgs_update" ON public.support_messages;
CREATE POLICY "own_msgs_update" ON public.support_messages FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_msgs_thread_created ON public.support_messages(thread_id, created_at);

DO $mig$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='support_messages') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='support_threads') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.support_threads';
  END IF;
END $mig$;

CREATE TABLE IF NOT EXISTS public.bank_deposit_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method_type text NOT NULL, method_name text NOT NULL,
  account_name text NOT NULL, account_number text, routing_number text,
  swift_code text, bank_address text, notes text,
  min_amount numeric NOT NULL DEFAULT 0, max_amount numeric NOT NULL DEFAULT 1000000,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bank_deposit_methods TO authenticated;
GRANT ALL ON public.bank_deposit_methods TO service_role;
ALTER TABLE public.bank_deposit_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "banks_active_read" ON public.bank_deposit_methods;
CREATE POLICY "banks_active_read" ON public.bank_deposit_methods FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "banks_admin_all" ON public.bank_deposit_methods;
CREATE POLICY "banks_admin_all" ON public.bank_deposit_methods FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'crypto';
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS bank_method_id uuid REFERENCES public.bank_deposit_methods(id);
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS receipt_url text;
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS fiat_currency text DEFAULT 'USD';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signals_trial_started_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signals_trial_expires_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signals_lifetime boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_currency text DEFAULT 'USD';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS crypto_balances jsonb DEFAULT '{}'::jsonb;

UPDATE public.profiles SET
  signals_trial_started_at = COALESCE(signals_trial_started_at, created_at),
  signals_trial_expires_at = COALESCE(signals_trial_expires_at, created_at + interval '3 days')
WHERE signals_trial_started_at IS NULL;

GRANT UPDATE (preferred_currency, full_name, avatar_url, account_mode, ai_trading_enabled, updated_at) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_ref TEXT; v_referrer UUID;
BEGIN
  v_ref := NEW.raw_user_meta_data->>'ref';
  IF v_ref IS NOT NULL THEN
    SELECT id INTO v_referrer FROM public.profiles WHERE referral_code = upper(v_ref) LIMIT 1;
  END IF;
  INSERT INTO public.profiles (id, full_name, account_balance, available_cash, referral_code, referred_by, signals_trial_started_at, signals_trial_expires_at)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    0, 0, upper(substring(replace(gen_random_uuid()::text,'-',''),1,8)), v_referrer,
    now(), now() + interval '3 days')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $fn$;

CREATE TABLE IF NOT EXISTS public.admin_balance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_type text NOT NULL, asset_symbol text, action text NOT NULL,
  amount numeric NOT NULL, fiat_value_usd numeric, reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_balance_logs TO authenticated;
GRANT ALL ON public.admin_balance_logs TO service_role;
ALTER TABLE public.admin_balance_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "logs_admin_read" ON public.admin_balance_logs;
CREATE POLICY "logs_admin_read" ON public.admin_balance_logs FOR SELECT USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.protect_primary_super_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_target_email text; v_caller_email text;
BEGIN
  SELECT lower(email) INTO v_target_email FROM auth.users WHERE id = COALESCE(NEW.user_id, OLD.user_id);
  SELECT lower(email) INTO v_caller_email FROM auth.users WHERE id = auth.uid();
  IF v_target_email = 'simonosawaru255@gmail.com' AND v_caller_email IS DISTINCT FROM 'simonosawaru255@gmail.com' THEN
    RAISE EXCEPTION 'Action Denied: You cannot modify the Primary Super Admin account.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $fn$;
DROP TRIGGER IF EXISTS trg_protect_super_admin ON public.user_roles;
CREATE TRIGGER trg_protect_super_admin BEFORE UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_primary_super_admin();

DROP POLICY IF EXISTS "roles_admin_manage" ON public.user_roles;
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.admin_grant_admin(_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES(_target, 'admin') ON CONFLICT DO NOTHING;
  PERFORM public.notify_user(_target,'Account level updated','Your account level has been updated to Pro status.','system');
END; $fn$;

CREATE OR REPLACE FUNCTION public.admin_revoke_admin(_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_email text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = _target;
  IF v_email = 'simonosawaru255@gmail.com' THEN
    RAISE EXCEPTION 'Action Denied: You cannot modify the Primary Super Admin account.';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _target AND role = 'admin';
END; $fn$;

CREATE OR REPLACE FUNCTION public.admin_adjust_crypto(_target uuid, _symbol text, _amount numeric, _action text, _reason text, _fiat_usd numeric DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
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
  INSERT INTO public.admin_balance_logs(admin_id, target_user_id, balance_type, asset_symbol, action, amount, fiat_value_usd, reason)
    VALUES (auth.uid(), _target, 'crypto', upper(_symbol), _action, _amount, _fiat_usd, _reason);
  IF _action='credit' THEN
    PERFORM public.notify_user(_target,'Account credited',
      'Your account has been credited with '||_amount::text||' '||upper(_symbol)||'. Your new '||upper(_symbol)||' balance is '||v_new::text||'.','credit');
  ELSE
    PERFORM public.notify_user(_target,'Account debited',
      'Your account has been debited by '||_amount::text||' '||upper(_symbol)||'. Your updated '||upper(_symbol)||' balance is '||v_new::text||'.','debit');
  END IF;
END; $fn$;

CREATE OR REPLACE FUNCTION public.admin_set_signals_trial(_target uuid, _days integer, _lifetime boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.profiles SET
    signals_trial_started_at = now(),
    signals_trial_expires_at = now() + make_interval(days => _days),
    signals_lifetime = _lifetime,
    updated_at = now()
  WHERE id = _target;
  PERFORM public.notify_user(_target,'Signals access updated',
    CASE WHEN _lifetime THEN 'Your Signals access has been upgraded to lifetime.'
    ELSE 'Your Signals trial has been extended by '||_days::text||' days.' END,'signal');
END; $fn$;

CREATE OR REPLACE FUNCTION public.notify_on_deposit_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.status='approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    PERFORM public.notify_user(NEW.user_id,'Deposit processed',
      'A deposit of $'||NEW.amount::text||' '||COALESCE(NEW.crypto_currency,'')||' has been successfully processed and added to your wallet.','credit');
  ELSIF NEW.status='rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    PERFORM public.notify_user(NEW.user_id,'Deposit update',
      'Your deposit request of $'||NEW.amount::text||' has been reviewed. Please contact support if you need help.','system');
  END IF;
  RETURN NEW;
END; $fn$;
DROP TRIGGER IF EXISTS trg_notify_deposit ON public.deposits;
CREATE TRIGGER trg_notify_deposit AFTER UPDATE ON public.deposits FOR EACH ROW EXECUTE FUNCTION public.notify_on_deposit_status();

CREATE OR REPLACE FUNCTION public.notify_on_withdrawal_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.status='approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    PERFORM public.notify_user(NEW.user_id,'Withdrawal completed',
      'A withdrawal request of $'||NEW.amount::text||' has been completed.','debit');
  ELSIF NEW.status='rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    PERFORM public.notify_user(NEW.user_id,'Withdrawal update',
      'Your withdrawal request of $'||NEW.amount::text||' has been reviewed. Please contact support for details.','system');
  END IF;
  RETURN NEW;
END; $fn$;
DROP TRIGGER IF EXISTS trg_notify_withdrawal ON public.withdrawals;
CREATE TRIGGER trg_notify_withdrawal AFTER UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.notify_on_withdrawal_status();

CREATE OR REPLACE FUNCTION public.notify_on_kyc_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.kyc_status='approved' AND OLD.kyc_status IS DISTINCT FROM 'approved' THEN
    PERFORM public.notify_user(NEW.id,'Account verified',
      'Your KYC verification has been approved. Your account is now fully verified.','kyc');
  ELSIF NEW.kyc_status='rejected' AND OLD.kyc_status IS DISTINCT FROM 'rejected' THEN
    PERFORM public.notify_user(NEW.id,'Verification update',
      'Your KYC submission requires attention. Please review and resubmit your documents.','kyc');
  END IF;
  RETURN NEW;
END; $fn$;
DROP TRIGGER IF EXISTS trg_notify_kyc ON public.profiles;
CREATE TRIGGER trg_notify_kyc AFTER UPDATE OF kyc_status ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.notify_on_kyc_status();

CREATE OR REPLACE FUNCTION public.buy_asset_atomic(_asset_id uuid, _usd numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_uid uuid := auth.uid();
  v_price numeric; v_ticker text; v_name text; v_qty numeric; v_cash numeric;
  v_existing record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _usd IS NULL OR _usd < 100 THEN RAISE EXCEPTION 'Minimum investment amount is $100.'; END IF;
  SELECT current_price, ticker, name INTO v_price, v_ticker, v_name FROM public.assets WHERE id = _asset_id;
  IF v_price IS NULL THEN RAISE EXCEPTION 'Asset not found'; END IF;
  SELECT available_cash INTO v_cash FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF v_cash IS NULL OR v_cash < _usd THEN RAISE EXCEPTION 'Insufficient available cash'; END IF;
  v_qty := _usd / v_price;
  SELECT * INTO v_existing FROM public.user_investments WHERE user_id = v_uid AND asset_id = _asset_id;
  IF FOUND THEN
    UPDATE public.user_investments SET quantity = quantity + v_qty,
      average_buy_price = ((quantity * average_buy_price) + _usd) / (quantity + v_qty) WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.user_investments (user_id, asset_id, quantity, average_buy_price) VALUES (v_uid, _asset_id, v_qty, v_price);
  END IF;
  INSERT INTO public.transactions (user_id, asset_id, asset_name, type, amount, quantity, status)
    VALUES (v_uid, _asset_id, v_ticker||' — '||v_name, 'Buy', _usd, v_qty, 'completed');
  UPDATE public.profiles SET available_cash = available_cash - _usd, updated_at = now() WHERE id = v_uid;
END; $fn$;

INSERT INTO public.bank_deposit_methods (method_type, method_name, account_name, account_number, notes, is_active)
SELECT 'zelle','Zelle Direct','Frobex Treasury','deposits@frobex.io','Include your account email in the Zelle memo.', true
WHERE NOT EXISTS (SELECT 1 FROM public.bank_deposit_methods);
