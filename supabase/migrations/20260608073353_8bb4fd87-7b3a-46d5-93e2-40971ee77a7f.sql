
REVOKE EXECUTE ON FUNCTION public.admin_decide_withdrawal_atomic(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_decide_withdrawal_atomic(uuid, text, text) TO service_role;
