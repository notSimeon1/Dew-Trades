import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const saveSecurityQuestions = createServerFn({ method: "POST" })
  .validator(
    (data: {
      userId: string;
      question_1: string;
      answer_1: string;
      question_2: string;
      answer_2: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const { error } = await supabaseAdmin.from("user_security_answers" as any).upsert(
        {
          user_id: data.userId,
          question_1: data.question_1,
          answer_1: data.answer_1.trim().toLowerCase(),
          question_2: data.question_2,
          answer_2: data.answer_2.trim().toLowerCase(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: "Security questions saved successfully!" };
    } catch (err: any) {
      return { success: false, message: err?.message || "Failed to save security questions." };
    }
  });
