
-- ============ PLATFORM SETTINGS (universal key-value) ============
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  key_name text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO authenticated, anon;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_read_all" ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "settings_admin_write" ON public.platform_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.platform_settings (category, key_name, value, description) VALUES
  ('fees','min_deposit_usd','100','Minimum deposit amount (USD)'),
  ('fees','gas_fee_percent','5','Global deposit/buy gas fee percentage'),
  ('fees','withdrawal_tax_percent','5','Withdrawal tax percentage'),
  ('fees','withdrawal_clearing_days','7','Withdrawal clearing/settlement days'),
  ('fees','referral_profit_share_percent','20','Referral profit-share royalty %'),
  ('fees','max_daily_withdrawal_usd','50000','Maximum daily withdrawal USD'),
  ('fees','max_leverage','100','Maximum leverage multiplier'),
  ('fees','payment_order_expiry_hours','2','Payment order expiration window'),
  ('marketing','hero_headline','"Trade The Future of Finance."','Auth-page hero headline'),
  ('marketing','hero_subheadline','"Join thousands of elite traders executing high-frequency trades with institutional-grade liquidity, deep market intelligence, and bank-level security."','Auth-page sub headline'),
  ('marketing','stat_volume','"$5.2B+"','Quarterly volume stat'),
  ('marketing','stat_uptime','"99.99%"','Uptime stat'),
  ('marketing','stat_execution','"< 2ms"','Execution speed stat'),
  ('marketing','stat_assets','"120+"','Supported assets stat'),
  ('marketing','ticker_announcement','"Welcome to Frobex — institutional-grade trading is live."','Dashboard ticker tape'),
  ('support','support_email','"support@frobex.com"','Support email'),
  ('support','telegram_handle','"@frobex"','Telegram handle'),
  ('signals','default_signal_credits','3','Default signal credits for new users'),
  ('signals','signals_trial_days','3','Free signals trial length in days');

-- ============ USER CRYPTO BALANCES (multi-asset isolated) ============
CREATE TABLE public.user_crypto_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_symbol text NOT NULL,
  balance numeric(30,10) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, asset_symbol)
);
GRANT SELECT ON public.user_crypto_balances TO authenticated;
GRANT ALL ON public.user_crypto_balances TO service_role;
ALTER TABLE public.user_crypto_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ucb_self_read" ON public.user_crypto_balances FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ucb_admin_write" ON public.user_crypto_balances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- seed for existing users
INSERT INTO public.user_crypto_balances (user_id, asset_symbol)
SELECT p.id, s.sym FROM public.profiles p
CROSS JOIN (VALUES ('BTC'),('ETH'),('BNB'),('SOL'),('USDT')) AS s(sym)
ON CONFLICT DO NOTHING;

-- extend handle_new_user to seed rows for future users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  INSERT INTO public.user_crypto_balances (user_id, asset_symbol)
  SELECT NEW.id, sym FROM (VALUES ('BTC'),('ETH'),('BNB'),('SOL'),('USDT')) AS s(sym)
  ON CONFLICT DO NOTHING;

  IF v_referrer IS NOT NULL THEN
    INSERT INTO public.referral_connections (sponsor_id, referee_id) VALUES (v_referrer, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.user_signal_credits (user_id, signals_remaining) VALUES (NEW.id, 3)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

-- ============ ADMIN PAYMENT METHODS ============
CREATE TABLE public.admin_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method_key text NOT NULL UNIQUE,
  method_name text NOT NULL,
  identifier_label text NOT NULL,
  recipient_name text NOT NULL DEFAULT '',
  identifier text NOT NULL DEFAULT '',
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_payment_methods TO authenticated;
GRANT ALL ON public.admin_payment_methods TO service_role;
ALTER TABLE public.admin_payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apm_read_active" ON public.admin_payment_methods FOR SELECT TO authenticated USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "apm_admin_write" ON public.admin_payment_methods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.admin_payment_methods (method_key, method_name, identifier_label, recipient_name, identifier, sort_order) VALUES
  ('cashapp','Cash App','$Cashtag','Frobex Payments','$FrobexPay',1),
  ('paypal','PayPal','PayPal Email','Frobex Payments','payments@frobex.com',2),
  ('zelle','Zelle','Zelle Email or Phone','Frobex Payments','zelle@frobex.com',3),
  ('chime','Chime','ChimeSign','Frobex Payments','$FrobexChime',4),
  ('applepay','Apple Pay','Apple Pay Phone/Email','Frobex Payments','+1 555 010 2030',5),
  ('venmo','Venmo','@Venmo Handle','Frobex Payments','@Frobex',6),
  ('bankwire','Bank Wire','Routing & Account','Frobex Trust LLC','Routing 021000021 · Account 000123456789',7);

-- ============ BUY CRYPTO / PAYMENT ORDERS ============
CREATE TABLE public.buy_crypto_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_symbol text NOT NULL,
  base_amount numeric(20,2) NOT NULL,
  gas_fee_amount numeric(20,2) NOT NULL DEFAULT 0,
  total_payable numeric(20,2) NOT NULL,
  crypto_amount numeric(30,10) NOT NULL,
  payment_method_key text NOT NULL,
  receipt_url text,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.buy_crypto_orders TO authenticated;
GRANT ALL ON public.buy_crypto_orders TO service_role;
ALTER TABLE public.buy_crypto_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bco_self" ON public.buy_crypto_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "bco_insert_self" ON public.buy_crypto_orders FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "bco_admin_update" ON public.buy_crypto_orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Extend deposits table with gas fee columns
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS base_amount numeric(20,2),
  ADD COLUMN IF NOT EXISTS gas_fee_amount numeric(20,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_payable numeric(20,2),
  ADD COLUMN IF NOT EXISTS payment_method_key text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- ============ TRADING BOTS ============
CREATE TABLE public.trading_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tier_key text NOT NULL UNIQUE,
  capital_required numeric(20,2) NOT NULL,
  duration_days int NOT NULL DEFAULT 10,
  min_roi numeric(6,2) NOT NULL,
  max_roi numeric(6,2) NOT NULL,
  win_rate numeric(6,2) NOT NULL DEFAULT 90,
  perks jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trading_bots TO authenticated, anon;
GRANT ALL ON public.trading_bots TO service_role;
ALTER TABLE public.trading_bots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bots_read" ON public.trading_bots FOR SELECT USING (true);
CREATE POLICY "bots_admin_write" ON public.trading_bots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.trading_bots (name, tier_key, capital_required, duration_days, min_roi, max_roi, win_rate, perks, sort_order) VALUES
  ('Alpha Core Algorithm','alpha_core',300,10,1.5,2.5,89.2,
    '["Standard Algorithmic Trend Following","Major Forex & Crypto Pairs","Daily Profit Accrual","Standard Risk Management Guardrails"]'::jsonb,1),
  ('Quantitative HFT Engine','quant_hft',1300,10,2.8,4.2,92.4,
    '["High-Frequency Trading (HFT) Execution","Automated Altcoin Arbitrage","Auto-Compounding Enabled","Priority Node Routing"]'::jsonb,2),
  ('Institutional Arbitrage Matrix','arbitrage_matrix',2400,10,4.5,6.0,94.1,
    '["Cross-Exchange Liquidity Sniping","Zero-Slippage Execution Protocol","1-on-1 VIP Account Manager","Deep Market Predictive Analytics"]'::jsonb,3),
  ('Neural Predictive Oracle','neural_oracle',3700,10,6.5,8.0,95.7,
    '["Machine Learning Pattern Recognition","Access to Pre-Market & Dark Pools","Instant Priority Withdrawals","Dedicated Server Node Allocation"]'::jsonb,4),
  ('Quantum Apex Shield','quantum_apex',5200,10,8.5,10.5,97.3,
    '["Quantum-Speed Trade Execution","Maximum Leverage Optimization","100% Capital Protection Insurance","Fully Autonomous Portfolio Dominance"]'::jsonb,5);

CREATE TABLE public.user_active_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_id uuid NOT NULL REFERENCES public.trading_bots(id) ON DELETE CASCADE,
  invested_amount numeric(20,2) NOT NULL,
  activation_date timestamptz NOT NULL DEFAULT now(),
  expiration_date timestamptz NOT NULL,
  current_profit numeric(20,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.user_active_bots TO authenticated;
GRANT ALL ON public.user_active_bots TO service_role;
ALTER TABLE public.user_active_bots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uab_self" ON public.user_active_bots FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "uab_insert_self" ON public.user_active_bots FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "uab_admin_update" ON public.user_active_bots FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ COPY TRADING ============
CREATE TABLE public.copy_trading_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key text NOT NULL UNIQUE,
  tier_name text NOT NULL,
  strategist_name text NOT NULL,
  required_capital numeric(20,2) NOT NULL,
  win_rate numeric(6,2) NOT NULL,
  monthly_roi_min numeric(6,2) NOT NULL,
  monthly_roi_max numeric(6,2) NOT NULL,
  perks jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.copy_trading_tiers TO authenticated, anon;
GRANT ALL ON public.copy_trading_tiers TO service_role;
ALTER TABLE public.copy_trading_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ctt_read" ON public.copy_trading_tiers FOR SELECT USING (true);
CREATE POLICY "ctt_admin_write" ON public.copy_trading_tiers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.copy_trading_tiers (tier_key, tier_name, strategist_name, required_capital, win_rate, monthly_roi_min, monthly_roi_max, perks, sort_order) VALUES
  ('veteran','The Veteran Trader','M. Ashford',500,88.4,18,25,
    '["Focused on Top 10 Crypto Majors (BTC, ETH, SOL)","Controlled Drawdown Protection (< 8%)","Automated Position Mirroring (1:1 Ratio)","Standard Risk Management Guardrails"]'::jsonb,1),
  ('pro','The Pro Trader','K. Nakamura',1200,92.1,32,45,
    '["Advanced Momentum & Trend Breakout Tactics","Cross-Asset Hedging (Crypto & Derivatives)","Dynamic Leverage Optimization (Up to 10x)","Priority Execution Routing & Zero Slip"]'::jsonb,2),
  ('elite','The Elite Syndicate Grandmaster','V. Sokolov',2000,96.8,60,85,
    '["Algorithmic Dark Pool & Arbitrage Mirroring","Institutional Whale Tracking & Liquidity Sniping","100% Automated Risk-Adjusted Compound Growth","VIP Direct Messaging Channel with Lead Strategist"]'::jsonb,3);

CREATE TABLE public.user_copy_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES public.copy_trading_tiers(id) ON DELETE CASCADE,
  allocated_amount numeric(20,2) NOT NULL,
  current_profit numeric(20,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.user_copy_allocations TO authenticated;
GRANT ALL ON public.user_copy_allocations TO service_role;
ALTER TABLE public.user_copy_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uca_self" ON public.user_copy_allocations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "uca_insert_self" ON public.user_copy_allocations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "uca_admin_update" ON public.user_copy_allocations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ PRE-MARKET ============
CREATE TABLE public.pre_market_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_name text NOT NULL,
  symbol text NOT NULL UNIQUE,
  listing_price numeric(20,6) NOT NULL,
  pool_cap numeric(20,2) NOT NULL,
  min_allocation numeric(20,2) NOT NULL DEFAULT 100,
  tge_date timestamptz NOT NULL,
  perks jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pre_market_tokens TO authenticated, anon;
GRANT ALL ON public.pre_market_tokens TO service_role;
ALTER TABLE public.pre_market_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pmt_read" ON public.pre_market_tokens FOR SELECT USING (true);
CREATE POLICY "pmt_admin_write" ON public.pre_market_tokens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.pre_market_tokens (token_name, symbol, listing_price, pool_cap, min_allocation, tge_date, perks, sort_order) VALUES
  ('HyperLiquid Layer 3','HL3',0.45,500000,250, now() + interval '14 days',
    '["High-throughput modular execution","Backed by top-tier Web3 VCs","20% initial unlock at TGE"]'::jsonb,1),
  ('Neural AI Network','NAI',1.20,1200000,500, now() + interval '21 days',
    '["Decentralized compute marketplace","Autonomous agent training layer","Fully audited smart contracts"]'::jsonb,2),
  ('Quantum DEX Protocol','QDX',3.50,2500000,1000, now() + interval '30 days',
    '["Cross-chain liquidity aggregator","Zero-gas routing protocol","Genesis staking multipliers"]'::jsonb,3);

CREATE TABLE public.user_pre_market_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_id uuid NOT NULL REFERENCES public.pre_market_tokens(id) ON DELETE CASCADE,
  usd_invested numeric(20,2) NOT NULL,
  tokens_allocated numeric(30,6) NOT NULL,
  status text NOT NULL DEFAULT 'escrowed',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.user_pre_market_allocations TO authenticated;
GRANT ALL ON public.user_pre_market_allocations TO service_role;
ALTER TABLE public.user_pre_market_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "upma_self" ON public.user_pre_market_allocations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "upma_insert_self" ON public.user_pre_market_allocations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============ PLATFORM ANNOUNCEMENTS ============
CREATE TABLE public.platform_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  content text NOT NULL,
  is_urgent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_announcements TO authenticated, anon;
GRANT ALL ON public.platform_announcements TO service_role;
ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa_read" ON public.platform_announcements FOR SELECT USING (true);
CREATE POLICY "pa_admin_write" ON public.platform_announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.platform_announcements (title, category, content, is_urgent) VALUES
  ('Welcome to Frobex','platform','Frobex institutional trading is now live. Deposit and start trading with dual-gateway fiat and crypto rails.',false),
  ('KYC Recommended','platform','Verify your identity to unlock higher withdrawal limits and priority routing.',false);

-- ============ TRADING SIGNALS ============
CREATE TABLE public.trading_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_pair text NOT NULL,
  direction text NOT NULL,
  entry_low numeric(20,4) NOT NULL,
  entry_high numeric(20,4) NOT NULL,
  tp_1 numeric(20,4),
  tp_2 numeric(20,4),
  tp_3 numeric(20,4),
  stop_loss numeric(20,4) NOT NULL,
  leverage text NOT NULL DEFAULT '10x',
  confidence numeric(5,2) NOT NULL DEFAULT 90,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trading_signals TO authenticated;
GRANT ALL ON public.trading_signals TO service_role;
ALTER TABLE public.trading_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ts_read" ON public.trading_signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "ts_admin_write" ON public.trading_signals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.trading_signals (asset_pair, direction, entry_low, entry_high, tp_1, tp_2, tp_3, stop_loss, leverage, confidence) VALUES
  ('BTC/USDT','long',64200,64500,66000,68500,72000,62800,'10x-20x',92),
  ('ETH/USDT','long',3220,3260,3400,3550,3800,3120,'5x-15x',89),
  ('SOL/USDT','short',185,188,178,170,160,196,'10x',87),
  ('BNB/USDT','long',612,618,640,670,710,595,'5x-10x',85);

CREATE TABLE public.user_signal_credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  signals_remaining int NOT NULL DEFAULT 3,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_signal_credits TO authenticated;
GRANT ALL ON public.user_signal_credits TO service_role;
ALTER TABLE public.user_signal_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usc_self" ON public.user_signal_credits FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "usc_admin_write" ON public.user_signal_credits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.user_signal_credits (user_id, signals_remaining)
SELECT id, 3 FROM public.profiles ON CONFLICT DO NOTHING;

CREATE TABLE public.user_unlocked_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_id uuid NOT NULL REFERENCES public.trading_signals(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, signal_id)
);
GRANT SELECT, INSERT ON public.user_unlocked_signals TO authenticated;
GRANT ALL ON public.user_unlocked_signals TO service_role;
ALTER TABLE public.user_unlocked_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uus_self" ON public.user_unlocked_signals FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "uus_insert_self" ON public.user_unlocked_signals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- unlock RPC
CREATE OR REPLACE FUNCTION public.unlock_signal(_signal_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_remaining int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.user_signal_credits (user_id, signals_remaining) VALUES (v_uid, 3) ON CONFLICT DO NOTHING;
  SELECT signals_remaining INTO v_remaining FROM public.user_signal_credits WHERE user_id = v_uid FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.user_unlocked_signals WHERE user_id=v_uid AND signal_id=_signal_id) THEN
    RETURN v_remaining;
  END IF;
  IF v_remaining <= 0 THEN RAISE EXCEPTION 'No signal credits remaining'; END IF;
  UPDATE public.user_signal_credits SET signals_remaining = signals_remaining - 1, updated_at = now() WHERE user_id = v_uid;
  INSERT INTO public.user_unlocked_signals (user_id, signal_id) VALUES (v_uid, _signal_id);
  RETURN v_remaining - 1;
END; $$;

-- ============ REFERRALS P2P ============
CREATE TABLE public.referral_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sponsor_id, referee_id)
);
GRANT SELECT ON public.referral_connections TO authenticated;
GRANT ALL ON public.referral_connections TO service_role;
ALTER TABLE public.referral_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rc_participants" ON public.referral_connections FOR SELECT TO authenticated
  USING (sponsor_id = auth.uid() OR referee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- backfill from existing profiles.referred_by
INSERT INTO public.referral_connections (sponsor_id, referee_id)
SELECT p.referred_by, p.id FROM public.profiles p WHERE p.referred_by IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE public.p2p_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.referral_connections(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_text text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.p2p_messages TO authenticated;
GRANT ALL ON public.p2p_messages TO service_role;
ALTER TABLE public.p2p_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "p2p_participants_read" ON public.p2p_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.referral_connections rc WHERE rc.id = p2p_messages.connection_id
    AND (rc.sponsor_id = auth.uid() OR rc.referee_id = auth.uid()))
  OR public.has_role(auth.uid(),'admin')
);
CREATE POLICY "p2p_participants_send" ON public.p2p_messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.referral_connections rc WHERE rc.id = connection_id
      AND (rc.sponsor_id = auth.uid() OR rc.referee_id = auth.uid())
  )
);
CREATE POLICY "p2p_mark_read" ON public.p2p_messages FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.referral_connections rc WHERE rc.id = p2p_messages.connection_id
    AND (rc.sponsor_id = auth.uid() OR rc.referee_id = auth.uid()))
);

-- ============ MARKET OVERRIDES ============
CREATE TABLE public.user_market_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_symbol text NOT NULL,
  feed_mode text NOT NULL DEFAULT 'live',
  custom_price numeric(20,6),
  custom_percentage numeric(10,4),
  trend_direction text NOT NULL DEFAULT 'sideways',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, asset_symbol)
);
GRANT SELECT ON public.user_market_overrides TO authenticated;
GRANT ALL ON public.user_market_overrides TO service_role;
ALTER TABLE public.user_market_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "umo_self_read" ON public.user_market_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "umo_admin_write" ON public.user_market_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ REALTIME PUBLICATION ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_crypto_balances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_payment_methods;
ALTER PUBLICATION supabase_realtime ADD TABLE public.buy_crypto_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trading_bots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_active_bots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.copy_trading_tiers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pre_market_tokens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trading_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_market_overrides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.p2p_messages;
