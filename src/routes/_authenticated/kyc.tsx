import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck,
  Loader as Loader2,
  CloudUpload as UploadCloud,
  CircleCheck as CheckCircle2,
  Circle as XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/kyc")({
  component: KycPage,
});

function KycPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [country, setCountry] = useState("");
  const [docType, setDocType] = useState("passport");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["profile_kyc", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("kyc_status, full_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: submissions, refetch } = useQuery({
    queryKey: ["my_kyc", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("kyc_submissions")
        .select("*")
        .eq("user_id", user!.id)
        .order("submitted_at" as never, { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const submit = async () => {
    if (!fullName.trim()) return toast.error("Full name required");
    if (!file) return toast.error("Upload an ID document");
    if (file.size > 8 * 1024 * 1024) return toast.error("File must be under 8MB");
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `${user!.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("kyc-documents")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("kyc_submissions").insert({
        user_id: user!.id,
        full_name: fullName.trim(),
        date_of_birth: dob || null,
        country: country.trim() || null,
        document_type: docType,
        document_url: path,
      });
      if (error) throw error;
      const { error: rpcError } = await supabase.rpc("submit_kyc_pending" as never);
      if (rpcError) console.error("[kyc] submit_kyc_pending rpc failed:", rpcError.message);
      toast.success("KYC submitted — under review");
      setFile(null);
      setFullName("");
      setDob("");
      setCountry("");
      refetch();
      refetchProfile();
    } catch (err: any) {
      toast.error(err.message ?? "Submission failed");
    } finally {
      setBusy(false);
    }
  };

  const status = profile?.kyc_status ?? "none";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-3xl space-y-6"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-hero shadow-glow">
          <ShieldCheck className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Identity verification</h1>
          <p className="text-sm text-muted-foreground">
            Required before you can withdraw funds. Approved within 24h.
          </p>
        </div>
      </div>

      <Card className="p-4 flex items-center justify-between">
        <span className="text-sm">Current status</span>
        <StatusBadge status={status} />
      </Card>

      {status === "approved" ? (
        <Card className="p-6 bg-success/10 border-success/40">
          <p className="font-semibold text-success">Verified ✓ Withdrawals unlocked.</p>
        </Card>
      ) : (
        <Card className="p-6 space-y-4 bg-morph">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Legal full name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label>Date of birth</Label>
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                maxLength={60}
                placeholder="Nigeria"
              />
            </div>
            <div className="space-y-2">
              <Label>Document type</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passport">Passport</SelectItem>
                  <SelectItem value="national_id">National ID</SelectItem>
                  <SelectItem value="driver_license">Driver license</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Upload document (image or PDF, max 8MB)</Label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-surface px-4 py-6 hover:border-primary transition-colors">
              <UploadCloud className="h-5 w-5 text-primary" />
              <span className="text-sm">{file ? file.name : "Click to choose a file"}</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                hidden
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit for review
          </Button>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="mb-3 text-lg font-semibold">Submission history</h2>
        {!submissions?.length ? (
          <p className="text-sm text-muted-foreground">No submissions yet.</p>
        ) : (
          <div className="space-y-2">
            {submissions.map((s: any) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {s.full_name} · {s.document_type}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleString()}
                  </div>
                  {s.admin_note && (
                    <div className="mt-1 text-xs text-muted-foreground">Note: {s.admin_note}</div>
                  )}
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return (
      <Badge className="bg-success text-success-foreground">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Approved
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" /> Rejected
      </Badge>
    );
  if (status === "pending")
    return (
      <Badge variant="secondary">
        <Clock className="mr-1 h-3 w-3" /> Pending
      </Badge>
    );
  return <Badge variant="outline">Not submitted</Badge>;
}
