/*
# Add admin grant/revoke RPCs and withdrawals table if missing

1. New Functions
- `admin_grant_admin(_target uuid)` — sets profiles.role = 'admin' for the given user. SECURITY DEFINER so the anon-key client can call it. Only callable by super_admin or admin users.
- `admin_revoke_admin(_target uuid)` — sets profiles.role = 'user' for the given user. Same security.
- Both functions check that the caller (auth.uid()) has role 'super_admin' or 'admin' in profiles.
- Both functions refuse to modify the primary super admin (simonosawaru255@gmail.com).

2. Security
- SECURITY DEFINER with search_path = 'public'.
- Caller must be an existing admin.
- Primary super admin is protected from revocation.
*/

CREATE OR REPLACE FUNCTION public.admin_grant_admin(_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_role text;
  target_email text;
BEGIN
  SELECT p.role INTO caller_role FROM public.profiles p WHERE p.id = auth.uid();
  IF caller_role IS NULL OR (caller_role <> 'super_admin' AND caller_role <> 'admin') THEN
    RAISE EXCEPTION 'Only admins can grant admin access';
  END IF;

  SELECT u.email INTO target_email FROM auth.users u WHERE u.id = _target;
  IF target_email = 'simonosawaru255@gmail.com' THEN
    RAISE EXCEPTION 'Cannot modify primary super admin';
  END IF;

  UPDATE public.profiles SET role = 'admin', updated_at = now() WHERE id = _target;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_revoke_admin(_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_role text;
  target_email text;
BEGIN
  SELECT p.role INTO caller_role FROM public.profiles p WHERE p.id = auth.uid();
  IF caller_role IS NULL OR (caller_role <> 'super_admin' AND caller_role <> 'admin') THEN
    RAISE EXCEPTION 'Only admins can revoke admin access';
  END IF;

  SELECT u.email INTO target_email FROM auth.users u WHERE u.id = _target;
  IF target_email = 'simonosawaru255@gmail.com' THEN
    RAISE EXCEPTION 'Cannot modify primary super admin';
  END IF;

  UPDATE public.profiles SET role = 'user', updated_at = now() WHERE id = _target;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_grant_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_admin(uuid) TO authenticated;
