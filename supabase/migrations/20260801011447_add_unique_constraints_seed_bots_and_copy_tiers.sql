/*
# Add unique constraints on tier_key + seed 15 bots and 8 copy tiers

## Changes
1. Adds unique constraint on trading_bots.tier_key
2. Adds unique constraint on copy_trading_tiers.tier_key
3. Adds daily_payout and is_active columns to trading_bots
4. Upserts 15 trading bots ($300-$5,200, 10-day duration, ROI in name)
5. Upserts 8 copy trading tiers ($450-$6,000, named strategists, 94-99% win rate)
*/

ALTER TABLE trading_bots ADD COLUMN IF NOT EXISTS daily_payout numeric DEFAULT 0;
ALTER TABLE trading_bots ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'trading_bots_tier_key_key') THEN
    CREATE UNIQUE INDEX trading_bots_tier_key_key ON trading_bots (tier_key);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'copy_trading_tiers_tier_key_key') THEN
    CREATE UNIQUE INDEX copy_trading_tiers_tier_key_key ON copy_trading_tiers (tier_key);
  END IF;
END $$;

INSERT INTO trading_bots (tier_key, name, capital_required, min_roi, max_roi, win_rate, duration_days, payout_interval, hourly_payout, daily_payout, perks, status, sort_order, is_active)
VALUES
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
  win_rate = EXCLUDED.win_rate,
  duration_days = EXCLUDED.duration_days,
  payout_interval = EXCLUDED.payout_interval,
  hourly_payout = EXCLUDED.hourly_payout,
  daily_payout = EXCLUDED.daily_payout,
  perks = EXCLUDED.perks,
  status = EXCLUDED.status,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

INSERT INTO copy_trading_tiers (tier_key, tier_name, strategist_name, required_capital, win_rate, monthly_roi_min, monthly_roi_max, profit_share, risk_rating, lock_in_days, perks, sort_order, is_active)
VALUES
  ('basic',    'Basic',    'Alex Vance',         450,   94.0, 15, 25,  20, 'Low',    30, '["Entry-level copy trading","94% win rate","Low risk profile","30-day lock-in"]', 1, true),
  ('tier2',    'Tier 2',   'Elena Rostova',      850,   94.5, 18, 28,  20, 'Low',    30, '["Enhanced strategist access","94.5% win rate","Diversified portfolio","30-day lock-in"]', 2, true),
  ('tier3',    'Tier 3',   'Marcus Chen',        1050,  95.0, 20, 32,  20, 'Medium', 30, '["Proven track record","95% win rate","Multi-pair strategy","30-day lock-in"]', 3, true),
  ('tier4',    'Tier 4',   'Sophia Al-Mansoor',  2250,  96.0, 22, 38,  20, 'Medium', 30, '["Advanced risk management","96% win rate","Institutional-grade signals","30-day lock-in"]', 4, true),
  ('tier5',    'Tier 5',   'Viktor Dragan',      3150,  96.5, 25, 42,  20, 'Medium', 30, '["Elite strategist access","96.5% win rate","Quantitative models","30-day lock-in"]', 5, true),
  ('tier6',    'Tier 6',   'Sarah Jenkins',      4350,  97.0, 28, 48,  20, 'High',   30, '["Senior strategist tier","97% win rate","Custom position sizing","30-day lock-in"]', 6, true),
  ('tier7',    'Tier 7',   'Tariq Mansour',      4850,  98.0, 30, 52,  20, 'High',   30, '["Master strategist tier","98% win rate","Priority execution","30-day lock-in"]', 7, true),
  ('diamond',  'Diamond',  'Elena Vance',        6000,  99.0, 35, 60,  20, 'High',   30, '["Diamond-tier exclusive","99% win rate","VIP strategist access","30-day lock-in","White-glove support"]', 8, true)
ON CONFLICT (tier_key) DO UPDATE SET
  tier_name = EXCLUDED.tier_name,
  strategist_name = EXCLUDED.strategist_name,
  required_capital = EXCLUDED.required_capital,
  win_rate = EXCLUDED.win_rate,
  monthly_roi_min = EXCLUDED.monthly_roi_min,
  monthly_roi_max = EXCLUDED.monthly_roi_max,
  profit_share = EXCLUDED.profit_share,
  risk_rating = EXCLUDED.risk_rating,
  lock_in_days = EXCLUDED.lock_in_days,
  perks = EXCLUDED.perks,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
