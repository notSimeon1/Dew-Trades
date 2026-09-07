-- Comprehensive platform settings defaults
-- Uses ON CONFLICT DO NOTHING so existing admin-configured values are never overwritten.

INSERT INTO public.platform_settings (category, key_name, value, description) VALUES
  -- ── Financial limits ─────────────────────────────────────────────────────
  ('financial', 'min_deposit_usd',         '50',       'Minimum deposit amount (USD)'),
  ('financial', 'max_deposit_usd',         '500000',   'Maximum single deposit amount (USD)'),
  ('financial', 'min_withdrawal_usd',      '50',       'Minimum withdrawal amount (USD)'),
  ('financial', 'max_withdrawal_usd',      '100000',   'Maximum single withdrawal amount (USD)'),
  ('financial', 'demo_balance_default',    '50000',    'Starting demo account balance for new users (USD)'),

  -- ── Fees & rates ─────────────────────────────────────────────────────────
  ('fees', 'gas_fee_percent',              '3',        'Processing / gas fee applied on buy-bitcoin orders (%)'),
  ('fees', 'withdrawal_tax_percent',       '5',        'Tax deducted from approved withdrawals (%)'),
  ('fees', 'referral_profit_share_percent','20',       'Bonus credited to referrer when referred user deposits (%)'),
  ('fees', 'referral_min_deposit_usd',     '50',       'Minimum deposit amount required to trigger referral bonus (USD)'),
  ('fees', 'withdrawal_clearing_days',     '3',        'Settlement/clearing delay shown to user on withdrawal (days)'),
  ('fees', 'max_leverage',                 '100',      'Maximum trading leverage multiplier (x)'),

  -- ── Timing / intervals ───────────────────────────────────────────────────
  ('timing', 'payment_expiry_hours',       '2',        'How long a buy-bitcoin payment window stays open (hours)'),
  ('timing', 'deposit_processing_hours',   '1',        'Estimated deposit credit time shown to user (hours)'),
  ('timing', 'withdrawal_processing_hours','24',       'Estimated withdrawal processing time shown to user (hours)'),
  ('timing', 'kyc_review_hours',           '24',       'KYC review SLA shown to user (hours)'),

  -- ── Trading & AI ─────────────────────────────────────────────────────────
  ('trading', 'chart_drift_pct',           '0.35',     'Base chart drift intensity for simulated P&L candles'),
  ('trading', 'chart_volatility',          '0.004',    'Candle volatility scaling factor for simulated charts'),
  ('trading', 'ai_trade_cooldown_seconds', '25',       'Seconds AI bot waits between consecutive trades'),
  ('trading', 'ai_loss_cooldown_seconds',  '60',       'Seconds AI bot waits after a losing trade'),
  ('trading', 'min_ai_trade_usd',          '10',       'Minimum single AI trade size (USD)'),
  ('trading', 'max_ai_trade_usd',          '500',      'Maximum single AI trade size (USD)'),
  ('trading', 'default_signal_credits',    '3',        'Free signal credits granted to each new user on signup'),

  -- ── Branding / contact ───────────────────────────────────────────────────
  ('branding', 'hero_headline',            '"Trade Smarter, Earn Bigger"', 'Main hero section headline text'),
  ('branding', 'support_email',            '"support@frobex.io"',           'Public support contact email'),
  ('branding', 'platform_name',            '"Frobex"',                      'Platform display name')
ON CONFLICT (key_name) DO NOTHING;
