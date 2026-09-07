-- 1. Reset starter balances to 0
ALTER TABLE public.profiles ALTER COLUMN account_balance SET DEFAULT 0;
ALTER TABLE public.profiles ALTER COLUMN available_cash SET DEFAULT 0;
UPDATE public.profiles SET account_balance = 0, available_cash = 0;

-- 2. Admin-controlled chart per user
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chart_intensity numeric NOT NULL DEFAULT 1.0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chart_seed integer NOT NULL DEFAULT 42;

-- 3. handle_new_user starts users at 0
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, account_balance, available_cash)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), 0, 0);
  RETURN NEW;
END;
$$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Deposits table
CREATE TABLE IF NOT EXISTS public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  crypto_currency text NOT NULL DEFAULT 'USDT',
  tx_hash text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deposits own insert" ON public.deposits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "deposits own select" ON public.deposits FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "deposits admin update" ON public.deposits FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- 5. Withdrawals table
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  wallet_address text NOT NULL,
  crypto_currency text NOT NULL DEFAULT 'USDT',
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wd own insert" ON public.withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wd own select" ON public.withdrawals FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "wd admin update" ON public.withdrawals FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- 6. App settings (deposit wallet address etc.)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "settings admin write" ON public.app_settings FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings(key, value) VALUES
  ('deposit_wallet_usdt', 'TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (TRC20 — update in admin)'),
  ('deposit_wallet_btc', 'bc1xxxxxxxxxxxxxxxxxxxxxxxxxxxx (update in admin)')
ON CONFLICT (key) DO NOTHING;

-- 7. Admin can view all profiles, holdings, transactions, complaints, roles, users
CREATE POLICY "profiles admin select" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles admin update" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "investments admin select" ON public.user_investments FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tx admin select" ON public.transactions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tx admin insert" ON public.transactions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);
CREATE POLICY "complaints admin update" ON public.complaints FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles admin manage" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. Seed admin role for the owner (auto-runs every time email signs up)
CREATE OR REPLACE FUNCTION public.ensure_owner_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'simonosawaru255@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_owner_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_owner_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.ensure_owner_admin();

-- If owner already exists, promote now
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE lower(email) = 'simonosawaru255@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;