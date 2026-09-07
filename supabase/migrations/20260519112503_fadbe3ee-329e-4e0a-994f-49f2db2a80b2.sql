
-- 1. Create triggers on auth.users (these were missing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_admin ON auth.users;
CREATE TRIGGER on_auth_user_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.ensure_owner_admin();

-- 2. Backfill profiles for any existing auth users missing one
INSERT INTO public.profiles (id, full_name, account_balance, available_cash)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
       0, 0
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 3. Backfill admin role for owner email
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
WHERE lower(email) = 'simonosawaru255@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Make sure admins can READ complaints (policy already exists but ensure)
DROP POLICY IF EXISTS "complaints admin select all" ON public.complaints;
CREATE POLICY "complaints admin select all" ON public.complaints
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 5. Allow admins to read all transactions and investments (in case missing)
DROP POLICY IF EXISTS "tx admin select all" ON public.transactions;
CREATE POLICY "tx admin select all" ON public.transactions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
