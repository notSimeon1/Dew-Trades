import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { saveSecurityQuestions } from "@/lib/security.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, CheckCircle2, Loader2, HelpCircle } from "lucide-react";

export const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "In what city were you born?",
  "What is your favorite book or movie?",
  "What was the make of your first car?",
];

interface PasswordResetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
}

export function PasswordResetModal({
  open,
  onOpenChange,
  defaultEmail = "",
}: PasswordResetModalProps) {
  const [step, setStep] = useState<"fetch" | "answer" | "reset">("fetch");
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);

  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [ans1, setAns1] = useState("");
  const [ans2, setAns2] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail);
      setStep("fetch");
      setAns1("");
      setAns2("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [open, defaultEmail]);

  const handleFetchQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }
    setLoading(true);
    try {
      // Call public RPC to get security questions for given email
      const { data, error } = await supabase.rpc("get_user_security_questions", {
        p_email: email.trim(),
      });

      if (error) {
        // Fallback or handle direct table query via server edge
        throw new Error(error.message);
      }

      if (!data || !data.success) {
        toast.error(data?.message || "No security questions found for this account.");
        return;
      }

      setQ1(data.question_1);
      setQ2(data.question_2);
      setStep("answer");
      toast.success("Security questions loaded.");
    } catch (err: any) {
      toast.error(err.message || "Failed to locate security questions");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ans1.trim() || !ans2.trim()) {
      toast.error("Please answer both security questions.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("verify_security_answers_and_reset_password", {
        p_email: email.trim(),
        p_ans1: ans1.trim(),
        p_ans2: ans2.trim(),
        p_new_password: newPassword,
      });

      if (error) throw error;

      if (!data || !data.success) {
        toast.error(data?.message || "Verification failed. Answers did not match.");
        return;
      }

      toast.success("Password reset successfully! You can now log in.");
      setStep("reset");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-card">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Reset Password</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Verify your identity using your security questions.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === "fetch" && (
          <form onSubmit={handleFetchQuestions} className="space-y-4 pt-2">
            <div>
              <Label htmlFor="reset-email">Account Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full bg-gradient-hero" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Find Security Questions"
              )}
            </Button>
          </form>
        )}

        {step === "answer" && (
          <form onSubmit={handleVerifyAndReset} className="space-y-4 pt-2">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <HelpCircle className="mr-1 inline-block h-3.5 w-3.5 text-primary" />
              Answer the security questions you set during account setup or in Security Settings.
            </div>

            <div>
              <Label className="text-xs font-semibold text-foreground">Question 1</Label>
              <p className="mb-1.5 text-xs text-muted-foreground">{q1}</p>
              <Input
                placeholder="Your answer..."
                value={ans1}
                onChange={(e) => setAns1(e.target.value)}
                required
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-foreground">Question 2</Label>
              <p className="mb-1.5 text-xs text-muted-foreground">{q2}</p>
              <Input
                placeholder="Your answer..."
                value={ans2}
                onChange={(e) => setAns2(e.target.value)}
                required
              />
            </div>

            <div className="border-t border-border pt-3">
              <Label htmlFor="new-pass">New Password</Label>
              <Input
                id="new-pass"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            <div>
              <Label htmlFor="confirm-pass">Confirm New Password</Label>
              <Input
                id="confirm-pass"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            <Button type="submit" className="w-full bg-gradient-hero" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Verify & Reset Password"
              )}
            </Button>
          </form>
        )}

        {step === "reset" && (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold">Password Changed!</h3>
            <p className="text-xs text-muted-foreground">
              Your password has been updated in the cloud. You can now log in using your new
              credentials.
            </p>
            <Button
              className="w-full"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface SetSecurityQuestionsModalProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetSecurityQuestionsModal({
  userId,
  open,
  onOpenChange,
}: SetSecurityQuestionsModalProps) {
  const [q1, setQ1] = useState(SECURITY_QUESTIONS[0]);
  const [a1, setA1] = useState("");
  const [q2, setQ2] = useState(SECURITY_QUESTIONS[1]);
  const [a2, setA2] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!a1.trim() || !a2.trim()) {
      toast.error("Please answer both questions.");
      return;
    }
    if (q1 === q2) {
      toast.error("Please select two different security questions.");
      return;
    }

    setSaving(true);
    try {
      // 1. Try resilient server function using service role
      const res = await saveSecurityQuestions({
        data: {
          userId,
          question_1: q1,
          answer_1: a1,
          question_2: q2,
          answer_2: a2,
        },
      });

      if (res && res.success) {
        toast.success("Security questions saved securely to Supabase cloud!");
        onOpenChange(false);
        return;
      }

      // 2. Fallback to client upsert
      const { error } = await supabase.from("user_security_answers" as any).upsert(
        {
          user_id: userId,
          question_1: q1,
          answer_1: a1.trim().toLowerCase(),
          question_2: q2,
          answer_2: a2.trim().toLowerCase(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      if (error) throw error;

      toast.success("Security questions saved securely to Supabase cloud!");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save security questions.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-card">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Security Questions</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Set easy-to-remember questions to recover your password if you ever get locked out.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div>
            <Label className="text-xs">Security Question 1</Label>
            <Select value={q1} onValueChange={setQ1}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select question" />
              </SelectTrigger>
              <SelectContent>
                {SECURITY_QUESTIONS.map((q) => (
                  <SelectItem key={q} value={q}>
                    {q}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="mt-2"
              placeholder="Answer to Question 1..."
              value={a1}
              onChange={(e) => setA1(e.target.value)}
              required
            />
          </div>

          <div>
            <Label className="text-xs">Security Question 2</Label>
            <Select value={q2} onValueChange={setQ2}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select question" />
              </SelectTrigger>
              <SelectContent>
                {SECURITY_QUESTIONS.map((q) => (
                  <SelectItem key={q} value={q}>
                    {q}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="mt-2"
              placeholder="Answer to Question 2..."
              value={a2}
              onChange={(e) => setA2(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full bg-gradient-hero" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Security Questions"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
