import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCurrency, AVAILABLE_CURRENCIES } from "@/lib/currency-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SetSecurityQuestionsModal } from "@/components/PasswordResetModal";
import {
  Camera,
  Upload,
  User,
  Sparkles,
  Shield,
  CheckCircle2,
  RefreshCw,
  Image as ImageIcon,
  Loader2,
  Copy,
  Check,
  SwitchCamera,
  Zap,
  Bot,
  Crown,
  Flame,
  Star,
  CheckCheck,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

// Curated generated avatar collections
const PRESET_AVATARS = [
  {
    id: "bot_1",
    name: "Cyber Quant",
    category: "bots",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=DewTradesTrader1",
  },
  {
    id: "bot_2",
    name: "Solana Whale",
    category: "bots",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=SolanaWhale",
  },
  {
    id: "bot_3",
    name: "Dragon Bull",
    category: "bots",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=DragonBull",
  },
  {
    id: "bot_4",
    name: "Matrix Bot",
    category: "bots",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=MatrixBot99",
  },

  {
    id: "hero_1",
    name: "Satoshi Hero",
    category: "heroes",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=SatoshiPro",
  },
  {
    id: "hero_2",
    name: "Crypto Queen",
    category: "heroes",
    url: "https://api.dicebear.com/7.x/lorelei/svg?seed=CryptoQueen",
  },
  {
    id: "hero_3",
    name: "Diamond Hands",
    category: "heroes",
    url: "https://api.dicebear.com/7.x/lorelei/svg?seed=DiamondBull",
  },
  {
    id: "hero_4",
    name: "Market Alpha",
    category: "heroes",
    url: "https://api.dicebear.com/7.x/personas/svg?seed=MarketAlpha",
  },

  {
    id: "adv_1",
    name: "Rocket Quant",
    category: "traders",
    url: "https://api.dicebear.com/7.x/adventurer/svg?seed=QuantRocket",
  },
  {
    id: "adv_2",
    name: "Executive VIP",
    category: "traders",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=ExecutiveOne",
  },
  {
    id: "adv_3",
    name: "Gold Trader",
    category: "traders",
    url: "https://api.dicebear.com/7.x/thumbs/svg?seed=GoldVIP",
  },
  {
    id: "adv_4",
    name: "Mystic Bull",
    category: "traders",
    url: "https://api.dicebear.com/7.x/personas/svg?seed=MysticQuant",
  },
];

function ProfilePage() {
  const { user } = useAuth();
  const { currency, setCurrency, currencyInfo } = useCurrency();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [copiedRef, setCopiedRef] = useState(false);
  const [updatingName, setUpdatingName] = useState(false);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);

  // Avatar states
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [customSeed, setCustomSeed] = useState("");

  // Camera modal states
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch Profile data
  const { data: profile, refetch } = useQuery({
    queryKey: ["user_profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (data?.full_name) setFullName(data.full_name);
      return data;
    },
    enabled: !!user,
  });

  // Start live camera stream
  const startCamera = async (facing: "user" | "environment" = "user") => {
    setCameraLoading(true);
    setCameraError(null);
    setCapturedImage(null);

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraLoading(false);
    } catch (err: any) {
      console.warn("Webcam access error:", err);
      setCameraLoading(false);
      setCameraError(
        "Camera access was denied or unavailable. You can also upload a photo directly.",
      );
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  useEffect(() => {
    if (cameraOpen) {
      startCamera(cameraFacing);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [cameraOpen, cameraFacing]);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setCapturedImage(dataUrl);
    }
  };

  // Helper to save avatar URL to Supabase profiles
  const saveAvatarUrl = async (url: string) => {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: url, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (error) throw error;

      toast.success("Profile photo updated successfully!");
      refetch();
      qc.invalidateQueries({ queryKey: ["user_profile"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      setSelectedAvatar(null);
      setCameraOpen(false);
      setCapturedImage(null);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save profile photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Upload file from device
  const handleFileUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 10 * 1024 * 1024) {
      return toast.error("File size must be under 10MB");
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;

      let urlToSave: string | null = null;

      // Try uploading to support_attachments bucket
      const { error: upErr } = await supabase.storage
        .from("support_attachments")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (!upErr) {
        const { data: signed } = await supabase.storage
          .from("support_attachments")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        if (signed?.signedUrl) {
          urlToSave = signed.signedUrl;
        } else {
          const { data: pub } = supabase.storage.from("support_attachments").getPublicUrl(path);
          urlToSave = pub?.publicUrl ?? null;
        }
      }

      // If storage blocked, convert to base64
      if (!urlToSave) {
        urlToSave = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      await saveAvatarUrl(urlToSave);
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
      setUploadingAvatar(false);
    }
  };

  // Convert base64 data URL to File and upload
  const handleSaveCapturedPhoto = async () => {
    if (!capturedImage) return;
    setUploadingAvatar(true);
    try {
      await saveAvatarUrl(capturedImage);
    } catch (e: any) {
      toast.error("Failed to save captured photo");
      setUploadingAvatar(false);
    }
  };

  // Save Full Name update
  const handleUpdateName = async () => {
    if (!user) return;
    if (!fullName.trim()) return toast.error("Name cannot be empty");
    setUpdatingName(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Name updated!");
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update name");
    } finally {
      setUpdatingName(false);
    }
  };

  const currentAvatar = profile?.avatar_url;
  const referralCode = profile?.referral_code ?? user?.id.substring(0, 8);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-4xl space-y-6 pb-12"
    >
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-6 shadow-elegant sm:p-8">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
          {/* Avatar frame */}
          <div className="group relative flex-shrink-0">
            <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-primary/30 bg-card shadow-glow sm:h-32 sm:w-32">
              {currentAvatar ? (
                <img src={currentAvatar} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-blue-600 text-4xl font-black text-white">
                  {(user?.email?.[0] ?? "U").toUpperCase()}
                </div>
              )}
            </div>

            <button
              onClick={() => setCameraOpen(true)}
              className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition-transform hover:scale-110 active:scale-95"
              title="Change Photo"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>

          {/* User info */}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                {profile?.full_name || user?.email?.split("@")[0] || "Trader Profile"}
              </h1>
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                <Crown className="mr-1 h-3 w-3" /> VIP Member
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground">{user?.email}</p>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 sm:justify-start text-xs">
              <span className="rounded-md bg-card px-2.5 py-1 border border-border text-muted-foreground">
                ID:{" "}
                <span className="font-mono text-foreground">{user?.id.substring(0, 10)}...</span>
              </span>
              <span className="rounded-md bg-card px-2.5 py-1 border border-border text-muted-foreground">
                KYC:{" "}
                <span
                  className={
                    profile?.kyc_status === "approved"
                      ? "font-bold text-success"
                      : "font-bold text-amber-400"
                  }
                >
                  {profile?.kyc_status?.toUpperCase() ?? "NOT VERIFIED"}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Avatar Customization & Profile Settings Tabs */}
      <Card className="p-6">
        <Tabs defaultValue="avatar" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="avatar" className="flex items-center gap-2">
              <Camera className="h-4 w-4" /> Profile Photo & Avatar
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <User className="h-4 w-4" /> Account Details
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: PROFILE PHOTO & AVATAR SELECTION */}
          <TabsContent value="avatar" className="space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold">Update Profile Photo</h3>
              <p className="text-xs text-muted-foreground">
                Upload a photo from your device, take a live snapshot with your camera, or choose
                from our exclusive generated avatars.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid gap-3 sm:grid-cols-3">
              {/* Camera Button */}
              <button
                onClick={() => setCameraOpen(true)}
                className="flex flex-col items-center justify-center rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-center transition-all hover:border-primary hover:bg-primary/10 group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary group-hover:scale-110 transition-transform">
                  <Camera className="h-5 w-5" />
                </div>
                <div className="mt-2 text-xs font-bold text-foreground">Take Live Photo</div>
                <div className="text-[10px] text-muted-foreground">Use device camera</div>
              </button>

              {/* Upload File Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface p-4 text-center transition-all hover:border-primary hover:bg-accent group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated text-foreground group-hover:scale-110 transition-transform">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <div className="mt-2 text-xs font-bold text-foreground">Upload Image</div>
                <div className="text-[10px] text-muted-foreground">PNG, JPG up to 10MB</div>
              </button>

              {/* Direct Mobile Camera Input */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface p-4 text-center transition-all hover:border-primary hover:bg-accent group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated text-foreground group-hover:scale-110 transition-transform">
                  <ImageIcon className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="mt-2 text-xs font-bold text-foreground">Mobile Camera Direct</div>
                <div className="text-[10px] text-muted-foreground">Instant photo capture</div>
              </button>

              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                }}
              />
            </div>

            {uploadingAvatar && (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 p-3 text-xs font-medium text-primary border border-primary/20">
                <Loader2 className="h-4 w-4 animate-spin" /> Saving new profile photo...
              </div>
            )}

            {/* GENERATED AVATARS SECTION */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400" /> Choose Generated Avatar
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Select a high-tech trader avatar for your profile
                  </p>
                </div>
              </div>

              {/* Avatar Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PRESET_AVATARS.map((av) => {
                  const isSelected = selectedAvatar === av.url || currentAvatar === av.url;
                  return (
                    <div
                      key={av.id}
                      onClick={() => setSelectedAvatar(av.url)}
                      className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border p-3 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-glow ring-2 ring-primary"
                          : "border-border bg-surface hover:border-primary/50 hover:bg-accent/40"
                      }`}
                    >
                      <div className="relative h-16 w-16 overflow-hidden rounded-full border border-border bg-card">
                        <img src={av.url} alt={av.name} className="h-full w-full object-cover" />
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-primary/30">
                            <CheckCircle2 className="h-6 w-6 text-primary-foreground drop-shadow-md" />
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-center text-xs font-semibold">{av.name}</div>
                    </div>
                  );
                })}
              </div>

              {/* CUSTOM AVATAR GENERATOR BY SEED */}
              <div className="rounded-xl border border-border bg-surface/60 p-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Bot className="h-3.5 w-3.5 text-primary" /> Generate Custom Seed Avatar
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter nickname, word or seed (e.g. Satoshi, CryptoKing)"
                    value={customSeed}
                    onChange={(e) => setCustomSeed(e.target.value)}
                    className="text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!customSeed.trim()) return toast.error("Enter a seed name");
                      const generatedUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(customSeed.trim())}`;
                      setSelectedAvatar(generatedUrl);
                    }}
                  >
                    Generate
                  </Button>
                </div>

                {customSeed.trim() && (
                  <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-card p-3">
                    <img
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(customSeed.trim())}`}
                      alt="Custom Avatar"
                      className="h-12 w-12 rounded-full border border-primary/30"
                    />
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="font-bold truncate">Custom Seed: {customSeed}</div>
                      <div className="text-muted-foreground">
                        Click apply to set as profile photo
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        saveAvatarUrl(
                          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(customSeed.trim())}`,
                        )
                      }
                      disabled={uploadingAvatar}
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </div>

              {selectedAvatar && selectedAvatar !== currentAvatar && (
                <div className="flex items-center justify-between rounded-xl bg-primary/10 border border-primary/30 p-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedAvatar}
                      alt="Selected"
                      className="h-10 w-10 rounded-full border border-primary"
                    />
                    <div>
                      <div className="text-xs font-bold text-foreground">New Avatar Selected</div>
                      <div className="text-[11px] text-muted-foreground">
                        Ready to set as your primary profile photo
                      </div>
                    </div>
                  </div>
                  <Button onClick={() => saveAvatarUrl(selectedAvatar)} disabled={uploadingAvatar}>
                    {uploadingAvatar ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Save Avatar
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: ACCOUNT DETAILS */}
          <TabsContent value="settings" className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Display Name / Full Name</Label>
                <div className="flex gap-2">
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Alex Rivera"
                  />
                  <Button onClick={handleUpdateName} disabled={updatingName}>
                    {updatingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </div>

              {/* Base Display Currency Section */}
              <div className="rounded-xl border border-border bg-surface/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <span>Base Display Currency</span>
                    </Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Select your preferred fiat currency to display all portfolio values, asset
                      prices, and trading totals.
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-primary/40 bg-primary/10 text-primary font-bold"
                  >
                    {currencyInfo.flag} {currencyInfo.code} ({currencyInfo.symbol})
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
                  {AVAILABLE_CURRENCIES.map((c) => {
                    const isSelected = c.code === currency;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          setCurrency(c.code);
                          toast.success(`Base display currency changed to ${c.code} (${c.symbol})`);
                        }}
                        className={`flex items-center justify-between rounded-lg border p-2.5 text-left transition-all text-xs ${
                          isSelected
                            ? "border-primary bg-primary/15 text-primary font-bold shadow-glow"
                            : "border-border bg-card hover:bg-accent hover:border-primary/40 text-foreground"
                        }`}
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm">{c.flag}</span>
                          <span className="truncate">{c.code}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-1 font-mono">
                          {c.symbol}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Email Address</Label>
                <Input
                  value={user?.email ?? ""}
                  disabled
                  className="bg-muted/50 cursor-not-allowed"
                />
                <p className="text-[10px] text-muted-foreground">
                  Email is linked to your authentication account.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Referral Code</Label>
                <div className="flex gap-2">
                  <Input value={referralCode} disabled className="bg-muted/50 font-mono text-xs" />
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(referralCode);
                      setCopiedRef(true);
                      toast.success("Referral code copied!");
                      setTimeout(() => setCopiedRef(false), 2000);
                    }}
                  >
                    {copiedRef ? (
                      <CheckCheck className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface/50 p-4 space-y-2">
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-primary" /> Identity Verification Status
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">KYC Verification</span>
                  <Badge variant={profile?.kyc_status === "approved" ? "default" : "secondary"}>
                    {profile?.kyc_status?.toUpperCase() ?? "NOT SUBMITTED"}
                  </Badge>
                </div>
                {profile?.kyc_status !== "approved" && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => navigate({ to: "/kyc" })}
                    className="p-0 text-primary text-xs h-auto"
                  >
                    Go to KYC Verification →
                  </Button>
                )}
              </div>

              {/* Security Questions Reset Setup */}
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                      <KeyRound className="h-4 w-4 text-primary" /> Security Questions for Password
                      Recovery
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Set up secret security questions saved to Supabase Cloud so you can easily
                      reset your password if forgotten.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-primary/40 text-primary hover:bg-primary/10"
                    onClick={() => setSecurityModalOpen(true)}
                  >
                    Configure Questions
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* CAMERA DIALOG */}
      <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" /> Device Camera Photo
            </DialogTitle>
            <DialogDescription className="text-xs">
              Take a snapshot with your device webcam or front/rear camera.
            </DialogDescription>
          </DialogHeader>

          <div className="relative flex flex-col items-center justify-center space-y-4">
            {capturedImage ? (
              <div className="relative h-64 w-64 overflow-hidden rounded-full border-4 border-primary shadow-glow">
                <img src={capturedImage} alt="Captured" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="relative h-64 w-64 overflow-hidden rounded-full border-4 border-primary/50 bg-black shadow-glow flex items-center justify-center">
                {cameraLoading ? (
                  <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    Starting camera...
                  </div>
                ) : cameraError ? (
                  <div className="p-4 text-center text-xs text-destructive">{cameraError}</div>
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            )}

            {!capturedImage && !cameraError && !cameraLoading && (
              <button
                type="button"
                onClick={() =>
                  setCameraFacing((prev) => (prev === "user" ? "environment" : "user"))
                }
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <SwitchCamera className="h-3.5 w-3.5" /> Switch Camera ({cameraFacing})
              </button>
            )}
          </div>

          <DialogFooter className="flex gap-2 sm:justify-between">
            {capturedImage ? (
              <>
                <Button variant="outline" onClick={() => setCapturedImage(null)} className="flex-1">
                  Retake Photo
                </Button>
                <Button
                  onClick={handleSaveCapturedPhoto}
                  disabled={uploadingAvatar}
                  className="flex-1"
                >
                  {uploadingAvatar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Use This Photo
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setCameraOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={capturePhoto} disabled={cameraLoading || !!cameraError}>
                  Capture Photo
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {user && (
        <SetSecurityQuestionsModal
          userId={user.id}
          open={securityModalOpen}
          onOpenChange={setSecurityModalOpen}
        />
      )}
    </motion.div>
  );
}
