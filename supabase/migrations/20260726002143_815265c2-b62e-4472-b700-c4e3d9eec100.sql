
DROP POLICY IF EXISTS "user_own_support_upload" ON storage.objects;
CREATE POLICY "user_own_support_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('support-attachments','deposit-receipts') AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "user_own_support_read" ON storage.objects;
CREATE POLICY "user_own_support_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('support-attachments','deposit-receipts') AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));
DROP POLICY IF EXISTS "admin_support_manage" ON storage.objects;
CREATE POLICY "admin_support_manage" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id IN ('support-attachments','deposit-receipts') AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id IN ('support-attachments','deposit-receipts') AND public.has_role(auth.uid(),'admin'));
