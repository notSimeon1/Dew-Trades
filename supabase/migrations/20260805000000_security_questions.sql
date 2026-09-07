-- ============ SECURITY QUESTIONS & USER SECURITY ANSWERS ============

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.user_security_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_1 text NOT NULL,
  answer_1 text NOT NULL,
  question_2 text NOT NULL,
  answer_2 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_security_answers TO authenticated;
GRANT ALL ON public.user_security_answers TO service_role;

ALTER TABLE public.user_security_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usa_self_select" ON public.user_security_answers;
DROP POLICY IF EXISTS "usa_self_insert" ON public.user_security_answers;
DROP POLICY IF EXISTS "usa_self_update" ON public.user_security_answers;

CREATE POLICY "usa_self_select" ON public.user_security_answers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "usa_self_insert" ON public.user_security_answers
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "usa_self_update" ON public.user_security_answers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RPC to verify security questions and reset password safely
CREATE OR REPLACE FUNCTION public.verify_security_answers_and_reset_password(
  p_email text,
  p_ans1 text,
  p_ans2 text,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_stored_ans1 text;
  v_stored_ans2 text;
BEGIN
  -- Find user id by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No account found with this email.');
  END IF;

  -- Fetch security answers
  SELECT lower(trim(answer_1)), lower(trim(answer_2))
  INTO v_stored_ans1, v_stored_ans2
  FROM public.user_security_answers
  WHERE user_id = v_user_id;

  IF v_stored_ans1 IS NULL OR v_stored_ans2 IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No security questions set for this account. Contact support.');
  END IF;

  -- Validate answers (case-insensitive & trimmed)
  IF lower(trim(p_ans1)) <> v_stored_ans1 OR lower(trim(p_ans2)) <> v_stored_ans2 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Security question answers do not match.');
  END IF;

  -- Update auth.users password using Supabase crypt / extension or encrypted_password
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Password updated successfully! You can now sign in.');
END;
$$;

-- RPC to retrieve user security questions safely without exposing answers
CREATE OR REPLACE FUNCTION public.get_user_security_questions(
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_q1 text;
  v_q2 text;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No account found with this email.');
  END IF;

  SELECT question_1, question_2
  INTO v_q1, v_q2
  FROM public.user_security_answers
  WHERE user_id = v_user_id;

  IF v_q1 IS NULL OR v_q2 IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No security questions set for this account.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'question_1', v_q1,
    'question_2', v_q2
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_security_questions(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_security_answers_and_reset_password(text, text, text, text) TO anon, authenticated;

-- Force PostgREST to reload schema cache properly
SELECT pg_notify('pgrst', 'reload schema');

