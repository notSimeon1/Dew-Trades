
DROP POLICY IF EXISTS "settings public read" ON public.app_settings;
CREATE POLICY "settings authenticated read" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pos own update" ON public.live_positions;

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url, account_mode, ai_trading_enabled, updated_at)
  ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_kyc_pending()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.profiles SET kyc_status = 'pending', updated_at = now()
    WHERE id = auth.uid() AND kyc_status IN ('none','rejected');
END; $$;
REVOKE ALL ON FUNCTION public.submit_kyc_pending() FROM public;
GRANT EXECUTE ON FUNCTION public.submit_kyc_pending() TO authenticated;

CREATE OR REPLACE FUNCTION public.buy_asset_atomic(_asset_id uuid, _usd numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_price numeric; v_ticker text; v_name text; v_qty numeric; v_cash numeric;
  v_existing record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _usd IS NULL OR _usd <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  SELECT current_price, ticker, name INTO v_price, v_ticker, v_name
    FROM public.assets WHERE id = _asset_id;
  IF v_price IS NULL THEN RAISE EXCEPTION 'Asset not found'; END IF;
  SELECT available_cash INTO v_cash FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF v_cash IS NULL OR v_cash < _usd THEN RAISE EXCEPTION 'Insufficient available cash'; END IF;
  v_qty := _usd / v_price;
  SELECT * INTO v_existing FROM public.user_investments
    WHERE user_id = v_uid AND asset_id = _asset_id;
  IF FOUND THEN
    UPDATE public.user_investments
      SET quantity = quantity + v_qty,
          average_buy_price = ((quantity * average_buy_price) + _usd) / (quantity + v_qty)
      WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.user_investments (user_id, asset_id, quantity, average_buy_price)
      VALUES (v_uid, _asset_id, v_qty, v_price);
  END IF;
  INSERT INTO public.transactions (user_id, asset_id, asset_name, type, amount, quantity, status)
    VALUES (v_uid, _asset_id, v_ticker || ' — ' || v_name, 'Buy', _usd, v_qty, 'completed');
  UPDATE public.profiles SET available_cash = available_cash - _usd, updated_at = now()
    WHERE id = v_uid;
END; $$;
REVOKE ALL ON FUNCTION public.buy_asset_atomic(uuid, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.buy_asset_atomic(uuid, numeric) TO authenticated;

DROP POLICY IF EXISTS "kyc admin update" ON storage.objects;
DROP POLICY IF EXISTS "kyc admin delete" ON storage.objects;
CREATE POLICY "kyc admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "kyc admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

DROP POLICY IF EXISTS "roles deny non admin insert" ON public.user_roles;
DROP POLICY IF EXISTS "roles deny non admin update" ON public.user_roles;
DROP POLICY IF EXISTS "roles deny non admin delete" ON public.user_roles;
CREATE POLICY "roles deny non admin insert" ON public.user_roles
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "roles deny non admin update" ON public.user_roles
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "roles deny non admin delete" ON public.user_roles
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
