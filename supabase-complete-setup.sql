-- ============================================================================
-- SOLEN TRADES / COMPLETE DATABASE SETUP SCRIPT
-- Consolidated Schema, RLS Policies, Seed Data, Triggers, Functions & Storage
-- Run this in your new Supabase Project -> SQL Editor to initialize the database.
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Custom Role Types
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'super_admin');
  END IF;
END $$;

-- ============================================================================
-- 3. CORE TABLES
-- ============================================================================

-- 3.1 User Roles Table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3.2 Profiles Table (With default $10,000 Demo Balance & 0 Live Balance)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  account_balance NUMERIC(20,2) NOT NULL DEFAULT 0.00,
  available_cash NUMERIC(20,2) NOT NULL DEFAULT 0.00,
  live_balance NUMERIC(20,2) NOT NULL DEFAULT 0.00,
  demo_balance NUMERIC(20,2) NOT NULL DEFAULT 10000.00,
  account_mode TEXT NOT NULL DEFAULT 'demo',
  role TEXT NOT NULL DEFAULT 'user',
  chart_mode TEXT NOT NULL DEFAULT 'profit',
  chart_intensity NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  chart_seed INT NOT NULL DEFAULT 1,
  crypto_balances JSONB DEFAULT '{}'::jsonb,
  preferred_currency TEXT DEFAULT 'USD',
  referral_code TEXT,
  referred_by TEXT,
  kyc_status TEXT NOT NULL DEFAULT 'unverified',
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  ai_trading_enabled BOOLEAN NOT NULL DEFAULT true,
  signals_trial_started_at TIMESTAMPTZ,
  signals_trial_expires_at TIMESTAMPTZ,
  signals_lifetime BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3.3 Assets Table
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  current_price NUMERIC(20,2) NOT NULL,
  daily_change_percent NUMERIC(8,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- 3.4 User Investments Table
CREATE TABLE IF NOT EXISTS public.user_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id),
  quantity NUMERIC(20,8) NOT NULL,
  average_buy_price NUMERIC(20,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_investments ENABLE ROW LEVEL SECURITY;

-- 3.5 Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id),
  asset_name TEXT,
  type TEXT NOT NULL,
  amount NUMERIC(20,2) NOT NULL,
  quantity NUMERIC(20,8),
  account_mode TEXT NOT NULL DEFAULT 'live',
  status TEXT NOT NULL DEFAULT 'completed',
  source_table TEXT,
  source_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 3.6 Live Positions Table (Trade Orders)
CREATE TABLE IF NOT EXISTS public.live_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  amount NUMERIC(20,2) NOT NULL,
  entry_price NUMERIC(20,4) NOT NULL,
  current_price NUMERIC(20,4) NOT NULL,
  pnl NUMERIC(20,2) NOT NULL DEFAULT 0,
  leverage NUMERIC(10,2) NOT NULL DEFAULT 1,
  liquidation_price NUMERIC(20,4),
  stop_loss NUMERIC(20,4),
  take_profit NUMERIC(20,4),
  status TEXT NOT NULL DEFAULT 'open',
  account_mode TEXT NOT NULL DEFAULT 'live',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.live_positions ENABLE ROW LEVEL SECURITY;

-- 3.7 Admin Payment Methods Table (Deposit Addresses, Cashtag, Bank Wire, etc.)
CREATE TABLE IF NOT EXISTS public.admin_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method_key TEXT NOT NULL UNIQUE,
  method_name TEXT NOT NULL,
  identifier_label TEXT NOT NULL,
  recipient_name TEXT NOT NULL DEFAULT '',
  identifier TEXT NOT NULL DEFAULT '',
  cash_app_link TEXT,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_payment_methods ENABLE ROW LEVEL SECURITY;

-- 3.8 Bank Deposit Methods
CREATE TABLE IF NOT EXISTS public.bank_deposit_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method_type TEXT NOT NULL DEFAULT 'wire',
  method_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT,
  routing_number TEXT,
  bank_name TEXT,
  bank_address TEXT,
  swift_code TEXT,
  notes TEXT,
  min_amount NUMERIC(20,2) NOT NULL DEFAULT 100,
  max_amount NUMERIC(20,2) NOT NULL DEFAULT 500000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_deposit_methods ENABLE ROW LEVEL SECURITY;

-- 3.9 Deposits Table
CREATE TABLE IF NOT EXISTS public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(20,2) NOT NULL,
  base_amount NUMERIC(20,2),
  gas_fee_amount NUMERIC(20,2) DEFAULT 0,
  total_payable NUMERIC(20,2),
  payment_method TEXT NOT NULL,
  payment_method_key TEXT,
  crypto_currency TEXT NOT NULL DEFAULT 'USDT',
  fiat_currency TEXT DEFAULT 'USD',
  tx_hash TEXT,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  bank_method_id UUID REFERENCES public.bank_deposit_methods(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

-- 3.10 Withdrawals Table
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(20,2) NOT NULL DEFAULT 0,
  crypto_currency TEXT NOT NULL DEFAULT 'USDT',
  wallet_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  tax_fee NUMERIC(20,2) DEFAULT 0,
  payout_amount NUMERIC(20,2) DEFAULT 0,
  fee_wallet_address TEXT,
  admin_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- 3.11 Trading Bots Definition Table
CREATE TABLE IF NOT EXISTS public.trading_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  capital_required NUMERIC(20,2) NOT NULL DEFAULT 300,
  min_roi NUMERIC(8,2) NOT NULL DEFAULT 2.0,
  max_roi NUMERIC(8,2) NOT NULL DEFAULT 5.0,
  win_rate NUMERIC(6,2) NOT NULL DEFAULT 90.0,
  duration_days INT NOT NULL DEFAULT 10,
  payout_interval TEXT NOT NULL DEFAULT 'daily',
  hourly_payout NUMERIC(10,2) NOT NULL DEFAULT 0,
  daily_payout NUMERIC(10,2) NOT NULL DEFAULT 0,
  perks JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trading_bots ENABLE ROW LEVEL SECURITY;

-- 3.12 User Active Bots Table
CREATE TABLE IF NOT EXISTS public.user_active_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES public.trading_bots(id),
  bot_name TEXT NOT NULL,
  invested_amount NUMERIC(20,2) NOT NULL,
  profit_accumulated NUMERIC(20,2) NOT NULL DEFAULT 0,
  daily_payout NUMERIC(20,2) NOT NULL DEFAULT 0,
  hourly_payout NUMERIC(20,2) NOT NULL DEFAULT 0,
  payout_interval TEXT NOT NULL DEFAULT 'daily',
  account_mode TEXT NOT NULL DEFAULT 'live',
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  last_payout_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_active_bots ENABLE ROW LEVEL SECURITY;

-- 3.13 Copy Trading Tiers Table
CREATE TABLE IF NOT EXISTS public.copy_trading_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key TEXT NOT NULL UNIQUE,
  tier_name TEXT NOT NULL,
  strategist_name TEXT NOT NULL,
  required_capital NUMERIC(20,2) NOT NULL DEFAULT 450,
  win_rate NUMERIC(6,2) NOT NULL DEFAULT 95.0,
  monthly_roi_min NUMERIC(6,2) NOT NULL DEFAULT 15,
  monthly_roi_max NUMERIC(6,2) NOT NULL DEFAULT 35,
  profit_share NUMERIC(6,2) NOT NULL DEFAULT 20,
  risk_rating TEXT NOT NULL DEFAULT 'Low',
  lock_in_days INT NOT NULL DEFAULT 30,
  perks JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.copy_trading_tiers ENABLE ROW LEVEL SECURITY;

-- 3.14 User Copy Allocations Table
CREATE TABLE IF NOT EXISTS public.user_copy_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES public.copy_trading_tiers(id),
  tier_key TEXT,
  allocated_amount NUMERIC(20,2) NOT NULL,
  total_profit NUMERIC(20,2) NOT NULL DEFAULT 0,
  strategist_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_copy_allocations ENABLE ROW LEVEL SECURITY;

-- 3.15 Platform Settings Table
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  key_name TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- 3.16 Buy Crypto Orders
CREATE TABLE IF NOT EXISTS public.buy_crypto_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_symbol TEXT NOT NULL,
  base_amount NUMERIC(20,2) NOT NULL,
  gas_fee_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
  total_payable NUMERIC(20,2) NOT NULL,
  crypto_amount NUMERIC(30,10) NOT NULL,
  payment_method_key TEXT NOT NULL,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 hours'),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.buy_crypto_orders ENABLE ROW LEVEL SECURITY;

-- 3.17 User Crypto Balances Table
CREATE TABLE IF NOT EXISTS public.user_crypto_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  balance NUMERIC(30,10) NOT NULL DEFAULT 0,
  locked_balance NUMERIC(30,10) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, symbol)
);
ALTER TABLE public.user_crypto_balances ENABLE ROW LEVEL SECURITY;

-- 3.18 KYC Submissions Table
CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  document_type TEXT NOT NULL,
  document_front_url TEXT NOT NULL,
  document_back_url TEXT,
  selfie_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

-- 3.19 Support Threads Table
CREATE TABLE IF NOT EXISTS public.support_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT 'Customer Support',
  status TEXT NOT NULL DEFAULT 'open',
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;

-- 3.20 Support Messages Table
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender TEXT NOT NULL, -- 'user', 'admin', or 'bot'
  body TEXT NOT NULL,
  attachment_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- 3.21 P2P Messages Table
CREATE TABLE IF NOT EXISTS public.p2p_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.p2p_messages ENABLE ROW LEVEL SECURITY;

-- 3.22 Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3.23 Platform Announcements Table
CREATE TABLE IF NOT EXISTS public.platform_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  is_active BOOLEAN NOT NULL DEFAULT true,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;

-- 3.24 Trading Signals Table
CREATE TABLE IF NOT EXISTS public.trading_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_symbol TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'BUY',
  entry_price NUMERIC(20,4) NOT NULL,
  target_price_1 NUMERIC(20,4) NOT NULL,
  target_price_2 NUMERIC(20,4),
  stop_loss NUMERIC(20,4) NOT NULL,
  timeframe TEXT NOT NULL DEFAULT '1H',
  win_rate NUMERIC(6,2) DEFAULT 88.5,
  notes TEXT,
  is_free BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trading_signals ENABLE ROW LEVEL SECURITY;

-- 3.25 User Signal Credits & Unlocked Signals
CREATE TABLE IF NOT EXISTS public.user_signal_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  credits INT NOT NULL DEFAULT 3,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_signal_credits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_unlocked_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_id UUID NOT NULL REFERENCES public.trading_signals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, signal_id)
);
ALTER TABLE public.user_unlocked_signals ENABLE ROW LEVEL SECURITY;

-- 3.26 Pre-Market Tokens
CREATE TABLE IF NOT EXISTS public.pre_market_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  total_supply NUMERIC(30,2) NOT NULL,
  initial_price NUMERIC(20,4) NOT NULL,
  current_price NUMERIC(20,4) NOT NULL,
  target_listing_price NUMERIC(20,4) NOT NULL,
  launch_date TIMESTAMPTZ,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pre_market_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_pre_market_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_id UUID NOT NULL REFERENCES public.pre_market_tokens(id),
  amount_tokens NUMERIC(20,4) NOT NULL,
  total_cost_usd NUMERIC(20,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_pre_market_allocations ENABLE ROW LEVEL SECURITY;

-- 3.27 Market News & Complaints
CREATE TABLE IF NOT EXISTS public.market_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  image_url TEXT,
  category TEXT DEFAULT 'general',
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.market_news ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.complaints (
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

-- 3.28 Security Questions & Answers
CREATE TABLE IF NOT EXISTS public.user_security_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_1 TEXT NOT NULL,
  answer_1 TEXT NOT NULL,
  question_2 TEXT NOT NULL,
  answer_2 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.user_security_answers ENABLE ROW LEVEL SECURITY;

-- 3.29 Admin Balance Logs & Market Overrides
CREATE TABLE IF NOT EXISTS public.admin_balance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_type TEXT NOT NULL,
  action TEXT NOT NULL,
  amount NUMERIC(20,4) NOT NULL,
  fiat_value_usd NUMERIC(20,2),
  asset_symbol TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_balance_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_market_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  price_multiplier NUMERIC(8,4) NOT NULL DEFAULT 1.0000,
  trend TEXT NOT NULL DEFAULT 'neutral',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, symbol)
);
ALTER TABLE public.user_market_overrides ENABLE ROW LEVEL SECURITY;

-- 3.30 Referral Tracking
CREATE TABLE IF NOT EXISTS public.referral_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(referee_id)
);
ALTER TABLE public.referral_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.referral_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deposit_id UUID REFERENCES public.deposits(id),
  amount NUMERIC(20,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'credited',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;

-- 3.31 App Settings Key-Value Store
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. HELPER FUNCTIONS & TRIGGERS
-- ============================================================================

-- 4.1 Check User Role Function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role::text
  );
$$;

-- 4.2 Auto Create Profile on Signup with $10,000 Demo Balance
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE
  v_ref_code TEXT;
  v_referred_by TEXT;
  v_sponsor_id UUID;
BEGIN
  -- Generate unique referral code (e.g. SOL-XXXXXX)
  v_ref_code := 'TRD-' || upper(substr(md5(random()::text), 1, 6));
  v_referred_by := NULLIF(trim(NEW.raw_user_meta_data->>'referred_by'), '');

  INSERT INTO public.profiles (
    id,
    full_name,
    account_balance,
    available_cash,
    live_balance,
    demo_balance,
    account_mode,
    role,
    referral_code,
    referred_by
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    0.00,
    0.00,
    0.00,
    10000.00, -- Default $10,000 Demo Balance
    'demo',
    'user',
    v_ref_code,
    v_referred_by
  )
  ON CONFLICT (id) DO NOTHING;

  -- Default 3 signal credits
  INSERT INTO public.user_signal_credits (user_id, credits)
  VALUES (NEW.id, 3)
  ON CONFLICT (user_id) DO NOTHING;

  -- Default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Link referral if referred_by code provided
  IF v_referred_by IS NOT NULL THEN
    SELECT id INTO v_sponsor_id FROM public.profiles WHERE referral_code = v_referred_by LIMIT 1;
    IF v_sponsor_id IS NOT NULL AND v_sponsor_id <> NEW.id THEN
      INSERT INTO public.referral_connections (sponsor_id, referee_id)
      VALUES (v_sponsor_id, NEW.id)
      ON CONFLICT (referee_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4.3 Support Thread Timestamp Trigger
CREATE OR REPLACE FUNCTION public.update_support_thread_last_message_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.support_threads
  SET last_message_at = NEW.created_at, updated_at = now()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_msg_update_thread ON public.support_messages;
CREATE TRIGGER trg_support_msg_update_thread
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_support_thread_last_message_at();

-- 4.4 Quick Helper to make any user an Admin / Super Admin
CREATE OR REPLACE FUNCTION public.make_user_admin(p_email TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
  IF v_id IS NULL THEN
    RETURN 'Error: User with email ' || p_email || ' not found in auth.users. They must sign up first.';
  END IF;

  UPDATE public.profiles SET role = 'super_admin' WHERE id = v_id;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN 'Success: ' || p_email || ' is now a Super Admin!';
END;
$$;

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Profiles
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- User Roles
DROP POLICY IF EXISTS "roles_select" ON public.user_roles;
CREATE POLICY "roles_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Assets
DROP POLICY IF EXISTS "assets_read_all" ON public.assets;
CREATE POLICY "assets_read_all" ON public.assets FOR SELECT TO authenticated, anon USING (true);

-- Deposits
DROP POLICY IF EXISTS "deposits_read" ON public.deposits;
CREATE POLICY "deposits_read" ON public.deposits
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "deposits_insert_own" ON public.deposits;
CREATE POLICY "deposits_insert_own" ON public.deposits
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Withdrawals
DROP POLICY IF EXISTS "withdrawals_read" ON public.withdrawals;
CREATE POLICY "withdrawals_read" ON public.withdrawals
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "withdrawals_insert_own" ON public.withdrawals;
CREATE POLICY "withdrawals_insert_own" ON public.withdrawals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Transactions
DROP POLICY IF EXISTS "tx_read" ON public.transactions;
CREATE POLICY "tx_read" ON public.transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "tx_insert_own" ON public.transactions;
CREATE POLICY "tx_insert_own" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Live Positions
DROP POLICY IF EXISTS "positions_read" ON public.live_positions;
CREATE POLICY "positions_read" ON public.live_positions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "positions_manage" ON public.live_positions;
CREATE POLICY "positions_manage" ON public.live_positions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Bots & Copy Trading
DROP POLICY IF EXISTS "bots_read" ON public.trading_bots;
CREATE POLICY "bots_read" ON public.trading_bots FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "active_bots_read" ON public.user_active_bots;
CREATE POLICY "active_bots_read" ON public.user_active_bots
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "copy_tiers_read" ON public.copy_trading_tiers;
CREATE POLICY "copy_tiers_read" ON public.copy_trading_tiers FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "copy_alloc_read" ON public.user_copy_allocations;
CREATE POLICY "copy_alloc_read" ON public.user_copy_allocations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Platform Settings & Payment Methods
DROP POLICY IF EXISTS "settings_read" ON public.platform_settings;
CREATE POLICY "settings_read" ON public.platform_settings FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "payment_methods_read" ON public.admin_payment_methods;
CREATE POLICY "payment_methods_read" ON public.admin_payment_methods FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "bank_methods_read" ON public.bank_deposit_methods;
CREATE POLICY "bank_methods_read" ON public.bank_deposit_methods FOR SELECT TO authenticated, anon USING (true);

-- Support
DROP POLICY IF EXISTS "support_threads_read" ON public.support_threads;
CREATE POLICY "support_threads_read" ON public.support_threads
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "support_threads_insert" ON public.support_threads;
CREATE POLICY "support_threads_insert" ON public.support_threads
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "support_messages_read" ON public.support_messages;
CREATE POLICY "support_messages_read" ON public.support_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "support_messages_insert" ON public.support_messages;
CREATE POLICY "support_messages_insert" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Grants
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role, postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon, postgres, service_role;

-- ============================================================================
-- 6. STORAGE BUCKETS SETUP
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('deposit-receipts', 'deposit-receipts', true),
  ('support_attachments', 'support_attachments', true),
  ('avatars', 'avatars', true),
  ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
DROP POLICY IF EXISTS "receipts_public_read" ON storage.objects;
CREATE POLICY "receipts_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id IN ('deposit-receipts', 'support_attachments', 'avatars'));

DROP POLICY IF EXISTS "receipts_auth_insert" ON storage.objects;
CREATE POLICY "receipts_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('deposit-receipts', 'support_attachments', 'avatars', 'kyc-documents'));

-- ============================================================================
-- 7. ESSENTIAL PLATFORM SEED DATA
-- ============================================================================

-- 7.1 Platform Settings
INSERT INTO public.platform_settings (category, key_name, value, description) VALUES
  ('financial', 'min_deposit_usd',          '50',       'Minimum deposit amount (USD)'),
  ('financial', 'max_deposit_usd',          '500000',   'Maximum single deposit amount (USD)'),
  ('financial', 'min_withdrawal_usd',       '50',       'Minimum withdrawal amount (USD)'),
  ('financial', 'max_withdrawal_usd',       '100000',   'Maximum single withdrawal amount (USD)'),
  ('financial', 'demo_balance_default',     '10000',    'Starting demo account balance for new users (USD)'),
  ('fees', 'gas_fee_percent',               '3',        'Processing / gas fee on crypto purchases (%)'),
  ('fees', 'withdrawal_tax_percent',        '5',        'Tax fee deducted from approved withdrawals (%)'),
  ('fees', 'withdrawal_processing_fee_usd', '0',        'Fixed processing fee deducted from withdrawal (USD)'),
  ('fees', 'referral_profit_share_percent', '20',       'Bonus credited to referrer on referred user deposits (%)'),
  ('fees', 'referral_min_deposit_usd',      '50',       'Minimum deposit amount to trigger referral bonus (USD)'),
  ('fees', 'withdrawal_clearing_days',      '3',        'Settlement/clearing delay shown to user (days)'),
  ('fees', 'max_leverage',                  '100',      'Maximum trading leverage multiplier (x)'),
  ('timing', 'payment_expiry_hours',        '2',        'Payment window expiration (hours)'),
  ('timing', 'deposit_processing_hours',    '1',        'Estimated deposit credit time (hours)'),
  ('timing', 'withdrawal_processing_hours', '24',       'Estimated withdrawal processing time (hours)'),
  ('timing', 'kyc_review_hours',            '24',       'KYC review SLA (hours)'),
  ('trading', 'chart_drift_pct',            '0.35',     'Base chart drift intensity for simulation'),
  ('trading', 'chart_volatility',           '0.004',    'Candle volatility scaling factor'),
  ('trading', 'ai_trade_cooldown_seconds',  '25',       'Seconds AI bot waits between trades'),
  ('trading', 'min_ai_trade_usd',           '10',       'Minimum single AI trade size (USD)'),
  ('trading', 'max_ai_trade_usd',           '500',      'Maximum single AI trade size (USD)'),
  ('trading', 'default_signal_credits',     '3',        'Free signal credits granted to each new user'),
  ('branding', 'platform_name',             '"Solen Trades"', 'Platform display name'),
  ('branding', 'hero_headline',             '"Trade Smarter, Earn Bigger"', 'Main hero headline'),
  ('branding', 'support_email',             '"support@solentrades.com"', 'Public support contact email')
ON CONFLICT (key_name) DO NOTHING;

-- 7.2 Core Assets (Crypto, Stocks, Commodities)
INSERT INTO public.assets (ticker, name, asset_class, current_price, daily_change_percent) VALUES
  ('BTC',   'Bitcoin',        'Crypto',    68420.00,  1.85),
  ('ETH',   'Ethereum',       'Crypto',    3520.50,   2.30),
  ('SOL',   'Solana',         'Crypto',    168.75,    4.12),
  ('XRP',   'XRP Ledger',     'Crypto',    0.5850,    1.45),
  ('BNB',   'BNB Chain',      'Crypto',    592.30,    0.95),
  ('DOGE',  'Dogecoin',       'Crypto',    0.1420,    3.80),
  ('AAPL',  'Apple Inc.',     'Stock',     189.45,    1.23),
  ('MSFT',  'Microsoft Corp.','Stock',     415.20,    0.85),
  ('GOOGL', 'Alphabet Inc.',  'Stock',     175.30,   -0.42),
  ('TSLA',  'Tesla Inc.',     'Stock',     242.10,    2.15),
  ('NVDA',  'NVIDIA Corp.',   'Stock',     875.60,    3.45),
  ('GOLD',  'Gold Futures',   'Commodity', 2385.40,   0.32),
  ('SPY',   'S&P 500 ETF',    'ETF',       558.90,    0.65)
ON CONFLICT (ticker) DO UPDATE SET current_price = EXCLUDED.current_price;

-- 7.3 Admin Payment Methods (Deposit Gateways)
INSERT INTO public.admin_payment_methods (method_key, method_name, identifier_label, recipient_name, identifier, sort_order) VALUES
  ('btc',      'Bitcoin (BTC)',       'BTC Wallet Address',  'Official Deposit', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 1),
  ('eth',      'Ethereum (ETH/ERC20)','ETH Wallet Address',  'Official Deposit', '0x8B911165295C78935F53753e9D8DBC566104C514', 2),
  ('usdt_trc20','USDT (TRC-20)',      'TRON Wallet Address', 'Official Deposit', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',         3),
  ('cashapp',  'Cash App',            '$Cashtag',            'Finance Desk',     '$SolenPay',                                 4),
  ('paypal',   'PayPal',              'PayPal Email',        'Billing Department','payments@solentrades.com',                 5),
  ('zelle',    'Zelle',               'Zelle Email or Phone','Finance Desk',     'zelle@solentrades.com',                     6),
  ('bankwire', 'Bank Wire Transfer',  'Account Details',     'Solen Trading LLC','Routing: 021000021 · Account: 000123456789', 7)
ON CONFLICT (method_key) DO NOTHING;

-- 7.4 Bank Deposit Method Wire Details
INSERT INTO public.bank_deposit_methods (method_type, method_name, account_name, account_number, routing_number, bank_name, bank_address, swift_code, notes, min_amount, max_amount, is_active, sort_order) VALUES
  ('wire', 'Federal Wire / ACH', 'Solen Trades International LLC', '9876543210', '021000021', 'JPMorgan Chase Bank, N.A.', '270 Park Ave, New York, NY 10017', 'CHASUS33', 'Include your account email in the wire transfer memo.', 500.00, 1000000.00, true, 1)
ON CONFLICT DO NOTHING;

-- 7.5 AI Trading Bots (15 Preconfigured Tiers)
INSERT INTO public.trading_bots (tier_key, name, capital_required, min_roi, max_roi, win_rate, duration_days, payout_interval, hourly_payout, daily_payout, perks, status, sort_order, is_active) VALUES
  ('starter',   'Alpha Bot v1 - 2.67% Daily ROI',     300,   2.67, 2.67,  85.0, 10, 'hourly', 8.00, 192.00,  '["$8/hour guaranteed payout","10-day duration","Entry-level AI trading","100% capital return in 7 days"]', 'active', 1, true),
  ('bronze',    'Alpha Bot v2 - 3.33% Daily ROI',      500,   3.33, 3.33,  87.0, 10, 'daily', 0, 16.67,   '["$16.67/day guaranteed payout","10-day duration","Bronze-tier AI","100% capital return in 7 days"]', 'active', 2, true),
  ('bronze2',   'Beta Bot v1 - 3.57% Daily ROI',       700,   3.57, 3.57,  88.0, 10, 'daily', 0, 25.00,   '["$25/day guaranteed payout","10-day duration","Enhanced signal engine","100% capital return in 7 days"]', 'active', 3, true),
  ('silver',    'Beta Bot v2 - 3.85% Daily ROI',       1000,  3.85, 3.85,  89.0, 10, 'daily', 0, 38.50,   '["$38.50/day guaranteed payout","10-day duration","Silver-tier strategy","100% capital return in 7 days"]', 'active', 4, true),
  ('silver2',   'Gamma Bot v1 - 4.00% Daily ROI',       1200,  4.00, 4.00,  90.0, 10, 'daily', 0, 48.00,   '["$48/day guaranteed payout","10-day duration","Multi-asset scanner","100% capital return in 7 days"]', 'active', 5, true),
  ('gold',      'Gamma Bot v2 - 4.17% Daily ROI',       1500,  4.17, 4.17,  91.0, 10, 'daily', 0, 62.50,   '["$62.50/day guaranteed payout","10-day duration","Gold-tier algorithms","100% capital return in 7 days"]', 'active', 6, true),
  ('gold2',     'Delta Bot v1 - 4.34% Daily ROI',       1800,  4.34, 4.34,  91.5, 10, 'daily', 0, 78.00,   '["$78/day guaranteed payout","10-day duration","Delta momentum engine","100% capital return in 7 days"]', 'active', 7, true),
  ('platinum',  'Delta Bot v2 - 4.50% Daily ROI',      2000,  4.50, 4.50,  92.0, 10, 'daily', 0, 90.00,   '["$90/day guaranteed payout","10-day duration","Platinum-tier AI","100% capital return in 7 days"]', 'active', 8, true),
  ('platinum2', 'Epsilon Bot v1 - 4.67% Daily ROI',    2300,  4.67, 4.67,  92.5, 10, 'daily', 0, 107.50,  '["$107.50/day guaranteed payout","10-day duration","Epsilon neural net","100% capital return in 7 days"]', 'active', 9, true),
  ('diamond',   'Epsilon Bot v2 - 4.84% Daily ROI',    2600,  4.84, 4.84,  93.0, 10, 'daily', 0, 126.00,  '["$126/day guaranteed payout","10-day duration","Diamond-tier precision","100% capital return in 7 days"]', 'active', 10, true),
  ('diamond2',  'Zeta Bot v1 - 5.00% Daily ROI',       3000,  5.00, 5.00,  93.5, 10, 'daily', 0, 150.00,  '["$150/day guaranteed payout","10-day duration","Zeta arbitrage engine","100% capital return in 7 days"]', 'active', 11, true),
  ('diamond3',  'Zeta Bot v2 - 5.17% Daily ROI',       3500,  5.17, 5.17,  94.0, 10, 'daily', 0, 181.00,  '["$181/day guaranteed payout","10-day duration","Advanced Zeta AI","100% capital return in 7 days"]', 'active', 12, true),
  ('elite',     'Eta Bot v1 - 5.34% Daily ROI',        4000,  5.34, 5.34,  94.5, 10, 'daily', 0, 213.50,  '["$213.50/day guaranteed payout","10-day duration","Elite-tier Eta engine","100% capital return in 7 days"]', 'active', 13, true),
  ('elite2',    'Eta Bot v2 - 5.50% Daily ROI',        4500,  5.50, 5.50,  95.0, 10, 'daily', 0, 247.50,  '["$247.50/day guaranteed payout","10-day duration","Premium Eta AI","100% capital return in 7 days"]', 'active', 14, true),
  ('apex',      'Omega Bot - 5.67% Daily ROI',         5200,  5.67, 5.67,  96.0, 10, 'daily', 0, 295.00,  '["$295/day guaranteed payout","10-day duration","Apex Omega AI","100% capital return in 7 days","Highest tier exclusive"]', 'active', 15, true)
ON CONFLICT (tier_key) DO UPDATE SET
  name = EXCLUDED.name,
  capital_required = EXCLUDED.capital_required,
  min_roi = EXCLUDED.min_roi,
  max_roi = EXCLUDED.max_roi,
  win_rate = EXCLUDED.win_rate;

-- 7.6 Copy Trading Tiers (8 Preconfigured Strategists)
INSERT INTO public.copy_trading_tiers (tier_key, tier_name, strategist_name, required_capital, win_rate, monthly_roi_min, monthly_roi_max, profit_share, risk_rating, lock_in_days, perks, sort_order, is_active) VALUES
  ('basic',    'Basic Tier',     'Alex Vance',         450,   94.0, 15, 25,  20, 'Low',    30, '["Entry-level copy trading","94% win rate","Low risk profile","30-day lock-in"]', 1, true),
  ('tier2',    'Tier 2 Growth',  'Elena Rostova',      850,   94.5, 18, 28,  20, 'Low',    30, '["Enhanced strategist access","94.5% win rate","Diversified portfolio","30-day lock-in"]', 2, true),
  ('tier3',    'Tier 3 Momentum','Marcus Chen',        1050,  95.0, 20, 32,  20, 'Medium', 30, '["Proven track record","95% win rate","Multi-pair strategy","30-day lock-in"]', 3, true),
  ('tier4',    'Tier 4 Pro',     'Sophia Al-Mansoor',  2250,  96.0, 22, 38,  20, 'Medium', 30, '["Advanced risk management","96% win rate","Institutional-grade signals","30-day lock-in"]', 4, true),
  ('tier5',    'Tier 5 Premier', 'Viktor Dragan',      3150,  96.5, 25, 42,  20, 'Medium', 30, '["Elite strategist access","96.5% win rate","Quantitative models","30-day lock-in"]', 5, true),
  ('tier6',    'Tier 6 Institutional','Sarah Jenkins', 4350,  97.0, 28, 48,  20, 'High',   30, '["Senior strategist tier","97% win rate","Custom position sizing","30-day lock-in"]', 6, true),
  ('tier7',    'Tier 7 Master',  'Tariq Mansour',      4850,  98.0, 30, 52,  20, 'High',   30, '["Master strategist tier","98% win rate","Priority execution","30-day lock-in"]', 7, true),
  ('diamond',  'Diamond VIP',    'Elena Vance',        6000,  99.0, 35, 60,  20, 'High',   30, '["Diamond-tier exclusive","99% win rate","VIP strategist access","30-day lock-in","White-glove support"]', 8, true)
ON CONFLICT (tier_key) DO UPDATE SET
  strategist_name = EXCLUDED.strategist_name,
  required_capital = EXCLUDED.required_capital,
  win_rate = EXCLUDED.win_rate;

-- 7.7 Pre-Market Seed Tokens
INSERT INTO public.pre_market_tokens (symbol, name, total_supply, initial_price, current_price, target_listing_price, launch_date, description, is_active) VALUES
  ('NEURA', 'NeuraChain AI', 100000000, 0.15, 0.42, 1.25, now() + interval '14 days', 'Next-generation decentralized AI compute layer.', true),
  ('QUANT', 'Quantum DEX',   50000000,  0.50, 1.10, 3.50, now() + interval '21 days', 'Zero-latency cross-chain decentralized liquidity protocol.', true)
ON CONFLICT (symbol) DO NOTHING;

-- ============================================================================
-- SETUP COMPLETE!
-- To assign your user as Admin after signing up:
-- Run: SELECT public.make_user_admin('your-email@example.com');
-- ============================================================================
