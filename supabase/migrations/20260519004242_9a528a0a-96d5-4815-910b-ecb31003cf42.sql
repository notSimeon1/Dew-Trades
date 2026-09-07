-- Add triggers (missing) for new user profile + auto-admin
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_admin ON auth.users;
CREATE TRIGGER on_auth_user_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.ensure_owner_admin();

-- Grant admin to existing owner email if user already signed up
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE lower(email) = 'simonosawaru255@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Add USDT BEP20 default wallet, update legacy entries to the real address
INSERT INTO public.app_settings (key, value) VALUES
  ('deposit_wallet_usdt_bep20', '0x8B911165295C78935F53753e9D8DBC566104C514'),
  ('deposit_wallet_usdt_trc20', 'TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'),
  ('deposit_wallet_eth', '0x8B911165295C78935F53753e9D8DBC566104C514')
ON CONFLICT (key) DO NOTHING;

UPDATE public.app_settings SET value = '0x8B911165295C78935F53753e9D8DBC566104C514', updated_at = now()
WHERE key = 'deposit_wallet_usdt';