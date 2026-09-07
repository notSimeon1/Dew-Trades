revoke all on function public.admin_decide_deposit_atomic(uuid, text) from public, anon, authenticated;
revoke all on function public.close_position_atomic(uuid, numeric) from public, anon, authenticated;
grant execute on function public.admin_decide_deposit_atomic(uuid, text) to service_role;
grant execute on function public.close_position_atomic(uuid, numeric) to service_role;