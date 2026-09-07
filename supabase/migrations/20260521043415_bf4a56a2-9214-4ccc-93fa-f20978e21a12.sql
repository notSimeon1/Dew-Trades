
-- Profile additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_mode TEXT NOT NULL DEFAULT 'demo' CHECK (account_mode IN ('demo','live')),
  ADD COLUMN IF NOT EXISTS demo_balance NUMERIC NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS live_balance NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'none' CHECK (kyc_status IN ('none','pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID;

-- Backfill referral codes
UPDATE public.profiles
SET referral_code = upper(substring(replace(gen_random_uuid()::text,'-',''),1,8))
WHERE referral_code IS NULL;

-- KYC submissions
CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  country TEXT,
  document_type TEXT NOT NULL,
  document_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kyc own select" ON public.kyc_submissions FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "kyc own insert" ON public.kyc_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kyc admin update" ON public.kyc_submissions FOR UPDATE USING (has_role(auth.uid(),'admin'));

-- Referral earnings
CREATE TABLE IF NOT EXISTS public.referral_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referred_user_id UUID NOT NULL,
  deposit_id UUID,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ref own select" ON public.referral_earnings FOR SELECT USING (auth.uid() = referrer_id OR has_role(auth.uid(),'admin'));

-- Live positions
CREATE TABLE IF NOT EXISTS public.live_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  asset TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy','sell')),
  quantity NUMERIC NOT NULL,
  leverage NUMERIC NOT NULL DEFAULT 1,
  margin NUMERIC NOT NULL,
  entry_price NUMERIC NOT NULL,
  close_price NUMERIC,
  pnl NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  account_mode TEXT NOT NULL DEFAULT 'demo',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);
ALTER TABLE public.live_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos own select" ON public.live_positions FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "pos own insert" ON public.live_positions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pos own update" ON public.live_positions FOR UPDATE USING (auth.uid() = user_id);

-- Market news (admin publishes)
CREATE TABLE IF NOT EXISTS public.market_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  source TEXT,
  impact TEXT NOT NULL DEFAULT 'medium' CHECK (impact IN ('low','medium','high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.market_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news public read" ON public.market_news FOR SELECT USING (true);
CREATE POLICY "news admin write" ON public.market_news FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- KYC documents bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents','kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "kyc upload own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "kyc read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR has_role(auth.uid(),'admin')));

-- Update handle_new_user to set referral_code + apply ?ref= referred_by from raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref TEXT;
  v_referrer UUID;
BEGIN
  v_ref := NEW.raw_user_meta_data->>'ref';
  IF v_ref IS NOT NULL THEN
    SELECT id INTO v_referrer FROM public.profiles WHERE referral_code = upper(v_ref) LIMIT 1;
  END IF;
  INSERT INTO public.profiles (id, full_name, account_balance, available_cash, referral_code, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    0, 0,
    upper(substring(replace(gen_random_uuid()::text,'-',''),1,8)),
    v_referrer
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
