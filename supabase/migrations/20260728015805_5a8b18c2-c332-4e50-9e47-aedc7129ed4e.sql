
-- =========================================================
-- Admin: upsert payment method (Zelle/Cash App/Chase/etc.)
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_upsert_payment_method(
  _method_key text,
  _method_name text,
  _identifier_label text,
  _recipient_name text,
  _identifier text,
  _is_active boolean,
  _sort_order integer
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  INSERT INTO public.admin_payment_methods (method_key, method_name, identifier_label, recipient_name, identifier, is_active, sort_order, updated_at)
  VALUES (_method_key, _method_name, _identifier_label, _recipient_name, _identifier, COALESCE(_is_active, true), COALESCE(_sort_order, 0), now())
  ON CONFLICT (method_key) DO UPDATE
    SET method_name = EXCLUDED.method_name,
        identifier_label = EXCLUDED.identifier_label,
        recipient_name = EXCLUDED.recipient_name,
        identifier = EXCLUDED.identifier,
        is_active = EXCLUDED.is_active,
        sort_order = EXCLUDED.sort_order,
        updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Ensure method_key is unique so the upsert works.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_payment_methods_method_key_key'
  ) THEN
    ALTER TABLE public.admin_payment_methods ADD CONSTRAINT admin_payment_methods_method_key_key UNIQUE (method_key);
  END IF;
END $$;

-- =========================================================
-- Admin: update platform setting value
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_update_platform_setting(
  _key_name text,
  _value text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.platform_settings
    SET value = to_jsonb(_value),
        updated_at = now()
    WHERE key_name = _key_name;

  IF NOT FOUND THEN
    INSERT INTO public.platform_settings (category, key_name, value, updated_at)
    VALUES ('general', _key_name, to_jsonb(_value), now());
  END IF;
END;
$$;

-- =========================================================
-- Admin: publish announcement
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_post_announcement(
  _title text,
  _content text,
  _category text,
  _is_urgent boolean
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  INSERT INTO public.platform_announcements (title, content, category, is_urgent)
  VALUES (_title, COALESCE(_content, ''), COALESCE(_category, 'general'), COALESCE(_is_urgent, false))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- =========================================================
-- Admin: publish signal
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_post_signal(
  _asset_pair text,
  _direction text,
  _entry_low numeric,
  _entry_high numeric,
  _tp1 numeric,
  _tp2 numeric,
  _tp3 numeric,
  _sl numeric,
  _leverage text,
  _confidence numeric
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  INSERT INTO public.trading_signals (asset_pair, direction, entry_low, entry_high, tp_1, tp_2, tp_3, stop_loss, leverage, confidence, status)
  VALUES (_asset_pair, _direction, _entry_low, _entry_high, _tp1, _tp2, _tp3, _sl, COALESCE(_leverage, '10x'), COALESCE(_confidence, 80), 'active')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- =========================================================
-- Admin: create pre-market token
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_create_pre_market_token(
  _token_name text,
  _symbol text,
  _listing_price numeric,
  _pool_cap numeric,
  _min_allocation numeric,
  _tge_days integer,
  _perks text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid; v_perks jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  BEGIN
    v_perks := _perks::jsonb;
  EXCEPTION WHEN others THEN
    v_perks := '[]'::jsonb;
  END;

  INSERT INTO public.pre_market_tokens (token_name, symbol, listing_price, pool_cap, min_allocation, tge_date, perks, is_active, sort_order)
  VALUES (_token_name, _symbol, _listing_price, _pool_cap, _min_allocation, now() + make_interval(days => COALESCE(_tge_days, 14)), v_perks, true, 0)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Allow authenticated users to execute
GRANT EXECUTE ON FUNCTION public.admin_upsert_payment_method(text,text,text,text,text,boolean,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_platform_setting(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_post_announcement(text,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_post_signal(text,text,numeric,numeric,numeric,numeric,numeric,numeric,text,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_pre_market_token(text,text,numeric,numeric,numeric,integer,text) TO authenticated;

-- Make deposit-receipts bucket policies permissive enough for authenticated
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='deposit_receipts_owner_write') THEN
    CREATE POLICY "deposit_receipts_owner_write" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'deposit-receipts' AND (auth.uid())::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='deposit_receipts_owner_read') THEN
    CREATE POLICY "deposit_receipts_owner_read" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'deposit-receipts' AND ((auth.uid())::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
  END IF;
END $$;
