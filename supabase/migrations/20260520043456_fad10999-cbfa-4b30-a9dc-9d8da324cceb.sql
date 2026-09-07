DROP POLICY IF EXISTS "complaints anyone insert" ON public.complaints;
CREATE POLICY "complaints safe insert"
ON public.complaints
FOR INSERT
WITH CHECK (
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR (auth.uid() IS NULL AND user_id IS NULL)
);