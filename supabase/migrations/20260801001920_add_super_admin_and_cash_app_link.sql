/*
# Super admin auto-assignment + Cash App link + seed payment methods

1. Adds `role` column to `profiles` (text, default 'user')
2. Adds `cash_app_link` column to `admin_payment_methods` (text, nullable)
3. Adds `sort_order` column to `bank_deposit_methods` (integer, default 0)
4. Creates trigger to auto-assign super_admin role for simonosawaru255@gmail.com
5. Creates trigger to protect super_admin from demotion
6. Seeds admin_payment_methods with 7 payment methods including Cash App link
7. Seeds bank_deposit_methods with bank wire entry
*/

-- 1. Add role column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

-- 2. Add cash_app_link to admin_payment_methods
ALTER TABLE public.admin_payment_methods ADD COLUMN IF NOT EXISTS cash_app_link text;

-- 3. Add sort_order to bank_deposit_methods
ALTER TABLE public.bank_deposit_methods ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 4. Function to auto-assign super_admin role
CREATE OR REPLACE FUNCTION public.assign_super_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'simonosawaru255@gmail.com' THEN
    UPDATE public.profiles SET role = 'super_admin' WHERE id = NEW.id;
    IF NOT FOUND THEN
      INSERT INTO public.profiles (id, role) VALUES (NEW.id, 'super_admin');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_super_admin ON auth.users;
CREATE TRIGGER on_auth_user_super_admin
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_super_admin();

-- 5. Protect super admin from demotion
CREATE OR REPLACE FUNCTION public.protect_super_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_protected boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = OLD.id AND email = 'simonosawaru255@gmail.com') INTO _is_protected;
  IF _is_protected AND OLD.role = 'super_admin' THEN
    NEW.role = 'super_admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_super_admin_trigger ON public.profiles;
CREATE TRIGGER protect_super_admin_trigger
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin();

-- 6. Seed admin_payment_methods
INSERT INTO public.admin_payment_methods (method_key, method_name, identifier_label, identifier, recipient_name, is_active, sort_order, cash_app_link)
VALUES
  ('cash_app', 'Cash App', 'Cashtag', '$frobex', 'Frobex Treasury', true, 10, 'https://cash.app/$frobex'),
  ('paypal', 'PayPal', 'Email', 'deposits@frobex.io', 'Frobex Treasury', true, 20, NULL),
  ('zelle', 'Zelle', 'Email/Phone', 'deposits@frobex.io', 'Frobex Treasury', true, 30, NULL),
  ('chime', 'Chime', 'Account/Handle', 'deposits@frobex.io', 'Frobex Treasury', true, 40, NULL),
  ('apple_pay', 'Apple Pay', 'Apple Pay', 'deposits@frobex.io', 'Frobex Treasury', true, 50, NULL),
  ('venmo', 'Venmo', 'Handle', '@frobex', 'Frobex Treasury', true, 60, NULL),
  ('bank_wire', 'Bank Wire', 'Account number', '123456789', 'Frobex Treasury', true, 70, NULL)
ON CONFLICT DO NOTHING;

-- 7. Seed bank_deposit_methods
INSERT INTO public.bank_deposit_methods (method_name, method_type, account_name, account_number, routing_number, swift_code, bank_address, notes, min_amount, max_amount, is_active, sort_order)
VALUES
  ('Bank Wire', 'wire', 'Frobex Treasury LLC', '123456789', '021000021', 'FRBXUS33', '1 Wall Street, New York, NY 10005', 'Include your Frobex username in the memo line.', 100, 100000, true, 10)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
