
-- Roles enum & table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  account_balance NUMERIC(18,2) NOT NULL DEFAULT 10000.00,
  available_cash NUMERIC(18,2) NOT NULL DEFAULT 10000.00,
  chart_mode TEXT NOT NULL DEFAULT 'profit',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles select own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Assets (publicly viewable)
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  current_price NUMERIC(18,2) NOT NULL,
  daily_change_percent NUMERIC(8,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets readable by authenticated" ON public.assets FOR SELECT TO authenticated USING (true);

-- User investments
CREATE TABLE public.user_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  quantity NUMERIC(18,8) NOT NULL,
  average_buy_price NUMERIC(18,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "investments own select" ON public.user_investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "investments own insert" ON public.user_investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "investments own update" ON public.user_investments FOR UPDATE USING (auth.uid() = user_id);

-- Transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id),
  asset_name TEXT,
  type TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  quantity NUMERIC(18,8),
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx own select" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tx own insert" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Complaints
CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "complaints anyone insert" ON public.complaints FOR INSERT WITH CHECK (true);
CREATE POLICY "complaints own select" ON public.complaints FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Seed assets
INSERT INTO public.assets (ticker, name, asset_class, current_price, daily_change_percent) VALUES
('AAPL', 'Apple Inc.', 'Stock', 189.45, 1.23),
('MSFT', 'Microsoft Corp.', 'Stock', 415.20, 0.85),
('GOOGL', 'Alphabet Inc.', 'Stock', 175.30, -0.42),
('TSLA', 'Tesla Inc.', 'Stock', 242.10, 2.15),
('NVDA', 'NVIDIA Corp.', 'Stock', 875.60, 3.45),
('BTC', 'Bitcoin', 'Crypto', 68420.00, 1.85),
('ETH', 'Ethereum', 'Crypto', 3520.50, 2.30),
('SOL', 'Solana', 'Crypto', 168.75, 4.12),
('GOLD', 'Gold Futures', 'Commodity', 2385.40, 0.32),
('SPY', 'S&P 500 ETF', 'ETF', 558.90, 0.65);
