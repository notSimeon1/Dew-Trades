import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Send,
  Paperclip,
  Mic,
  Check,
  CheckCheck,
  Loader as Loader2,
  Image as ImageIcon,
  MoreVertical,
  Phone,
  Video,
  Search,
  Bot,
  Smile,
  ShieldCheck,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { markSupportMessagesRead } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type SupportMsg = {
  id: string;
  thread_id: string;
  user_id: string;
  sender: "user" | "support" | "bot";
  body: string;
  attachment_url?: string | null;
  created_at: string;
  is_read: boolean;
};

type WhatsAppChatProps = {
  threadId: string;
  userId: string;
  currentUserRole: "user" | "support";
  recipientName?: string;
  recipientAvatar?: string;
  recipientStatus?: string;
  quickReplies?: string[];
  height?: string;
  compact?: boolean;
};

export function WhatsAppChat({
  threadId,
  userId,
  currentUserRole,
  recipientName = "Dew Trades Customer Support",
  recipientStatus = "online",
  quickReplies = [
    "Deposit Help",
    "Withdrawal Status",
    "KYC Verification",
    "Trade Issue",
    "Connect Agent",
  ],
  height = "h-[600px]",
  compact = false,
}: WhatsAppChatProps) {
  const markReadFn = useServerFn(markSupportMessagesRead);
  const [messages, setMessages] = useState<SupportMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [mediaPreview, setMediaPreview] = useState<{ file: File; url: string } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const recordingTimer = useRef<any>(null);

  // Mark unread messages from opposite party as read
  const markAsRead = useCallback(
    async (msgs: SupportMsg[]) => {
      const hasUnread = msgs.some(
        (m) =>
          (currentUserRole === "user" ? m.sender !== "user" : m.sender === "user") && !m.is_read,
      );

      if (hasUnread && threadId) {
        // Optimistically mark local messages as read
        setMessages((prev) =>
          prev.map((m) =>
            (currentUserRole === "user" ? m.sender !== "user" : m.sender === "user")
              ? { ...m, is_read: true }
              : m,
          ),
        );
        try {
          await markReadFn({
            data: {
              threadId,
              role: currentUserRole === "user" ? "user" : "admin",
            },
          });
        } catch {
          // Fallback client update
          await supabase
            .from("support_messages")
            .update({ is_read: true } as never)
            .eq("thread_id", threadId)
            .eq("is_read", false);
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("dewtrades:chat-read", {
              detail: { threadId, role: currentUserRole },
            }),
          );
        }
      }
    },
    [currentUserRole, threadId, markReadFn],
  );

  // Fetch messages and subscribe to realtime + poller
  const loadMessages = useCallback(async () => {
    if (!threadId) return;
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (data) {
      const msgs = data as SupportMsg[];
      setMessages(msgs);
      markAsRead(msgs);
    }
  }, [threadId, markAsRead]);

  useEffect(() => {
    loadMessages();

    // 1. Realtime subscription with unique channel name
    const channelName = `wa-chat-${threadId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            const m = payload.new as SupportMsg;
            const isOpposite =
              currentUserRole === "user" ? m.sender !== "user" : m.sender === "user";
            setMessages((prev) => {
              const filtered = prev.filter((x) => !x.id.startsWith("temp-") || x.body !== m.body);
              if (filtered.some((x) => x.id === m.id)) return filtered;
              return [...filtered, isOpposite ? { ...m, is_read: true } : m];
            });
            if (isOpposite) {
              markReadFn({
                data: {
                  threadId,
                  role: currentUserRole === "user" ? "user" : "admin",
                },
              }).catch(() => {});
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("dewtrades:chat-read", {
                    detail: { threadId, role: currentUserRole },
                  }),
                );
              }
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as SupportMsg;
            setMessages((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
          }
        },
      )
      .subscribe();

    // 2. Backup poller fallback (4s) with tab visibility check
    const poller = setInterval(() => {
      if (document.hidden) return;
      loadMessages();
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poller);
    };
  }, [threadId, currentUserRole, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Send message handler
  const send = async (bodyToSend?: string) => {
    const finalBody = bodyToSend ?? text.trim();
    if (!finalBody && !mediaPreview) return;
    if (!threadId || !userId) return;

    const senderType = currentUserRole === "user" ? "user" : "support";
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: SupportMsg = {
      id: tempId,
      thread_id: threadId,
      user_id: userId,
      sender: senderType,
      body: finalBody || (mediaPreview ? `📎 ${mediaPreview.file.name}` : ""),
      attachment_url: mediaPreview?.url ?? null,
      created_at: new Date().toISOString(),
      is_read: false,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setText("");

    setSending(true);
    let attachmentUrl: string | null = null;

    try {
      if (mediaPreview) {
        const file = mediaPreview.file;
        const path = `${userId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("support_attachments")
          .upload(path, file);
        if (upErr) console.warn("Attachment upload warn:", upErr);
        const { data: urlData } = await supabase.storage
          .from("support_attachments")
          .createSignedUrl(path, 60 * 60 * 24 * 7);
        attachmentUrl = urlData?.signedUrl ?? null;
      }

      const messagePayload = {
        thread_id: threadId,
        user_id: userId,
        sender: senderType,
        body: finalBody || (mediaPreview ? `📎 ${mediaPreview.file.name}` : ""),
        attachment_url: attachmentUrl,
        is_read: false,
      };

      const { error } = await supabase.from("support_messages").insert(messagePayload as never);
      if (error) throw error;

      // Update thread last_message_at
      await supabase
        .from("support_threads")
        .update({ last_message_at: new Date().toISOString() } as never)
        .eq("id", threadId);

      setMediaPreview(null);
      await loadMessages();
    } catch (e: any) {
      toast.error(e.message ?? "Could not send message");
    } finally {
      setSending(false);
    }
  };

  // Simulate Voice Note Recording
  const startRecording = () => {
    setIsRecording(true);
    setRecordingSeconds(0);
    recordingTimer.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
  };

  const stopAndSendRecording = () => {
    clearInterval(recordingTimer.current);
    setIsRecording(false);
    const secs = recordingSeconds || 1;
    send(`🎤 Voice note (${secs}s)`);
    setRecordingSeconds(0);
  };

  // File selection
  const handleFileSelect = (file: File) => {
    const url = URL.createObjectURL(file);
    setMediaPreview({ file, url });
  };

  // Date formatting helper
  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  // Filter messages by search query if active
  const displayedMessages = searchQuery.trim()
    ? messages.filter((m) => m.body?.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : messages;

  // Group messages by date
  const grouped = displayedMessages.reduce(
    (acc, msg) => {
      const dateLabel = formatDateLabel(msg.created_at);
      if (!acc[dateLabel]) acc[dateLabel] = [];
      acc[dateLabel].push(msg);
      return acc;
    },
    {} as Record<string, SupportMsg[]>,
  );

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border border-border bg-[#0b141a] text-slate-100 shadow-2xl ${height}`}
    >
      {/* Corporate Desk Header */}
      <div className="flex items-center justify-between border-b border-[#222d34] bg-[#161922] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 font-bold text-black shadow-sm">
            {currentUserRole === "user" ? "CS" : recipientName.slice(0, 2).toUpperCase()}
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-[#161922]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-sm text-slate-100">
              {recipientName}
              <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="flex items-center gap-1 text-[11px] text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              {isTyping ? "typing..." : recipientStatus}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <button
            type="button"
            onClick={() => {
              setShowSearch((prev) => !prev);
              if (showSearch) setSearchQuery("");
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              showSearch ? "bg-amber-500/20 text-amber-400" : "hover:text-slate-200"
            }`}
            title={showSearch ? "Close search" : "Search messages"}
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expandable Search Input Bar */}
      {showSearch && (
        <div className="border-b border-[#222d34] bg-[#161922] px-4 py-2 flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversation..."
            className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-slate-400 hover:text-slate-200"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="text-[10px] text-slate-400 font-mono">
            {displayedMessages.length} {displayedMessages.length === 1 ? "match" : "matches"}
          </span>
        </div>
      )}

      {/* WhatsApp Message Canvas */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{
          backgroundColor: "#0b141a",
          backgroundImage: `radial-gradient(circle at 50% 50%, rgba(18, 140, 126, 0.05) 0%, transparent 60%)`,
        }}
      >
        {Object.entries(grouped).map(([dateLabel, dateMsgs]) => (
          <div key={dateLabel} className="space-y-3">
            {/* Centered Date Badge */}
            <div className="flex justify-center my-2">
              <span className="rounded-lg bg-[#182229] px-3 py-1 text-[11px] font-medium text-slate-400 border border-[#222d34] shadow-sm">
                {dateLabel}
              </span>
            </div>

            {dateMsgs.map((m) => {
              const isMine = currentUserRole === "user" ? m.sender === "user" : m.sender !== "user";
              const timeStr = new Date(m.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`relative max-w-[80%] sm:max-w-[70%] rounded-xl px-3.5 py-2 text-sm shadow-md transition-all ${
                      isMine
                        ? "bg-[#005c4b] text-slate-100 rounded-tr-none"
                        : "bg-[#202c33] text-slate-100 rounded-tl-none border border-[#222d34]"
                    }`}
                  >
                    {!isMine && (
                      <div className="mb-0.5 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        {m.sender === "bot" ? (
                          <>
                            <Bot className="h-3 w-3" /> Assistant
                          </>
                        ) : currentUserRole === "user" ? (
                          "Dew Trades Support Agent"
                        ) : (
                          "Customer"
                        )}
                      </div>
                    )}

                    {/* Image Attachment Preview */}
                    {m.attachment_url && (
                      <div className="mb-2 overflow-hidden rounded-lg border border-black/20">
                        {m.attachment_url.match(/\.(jpeg|jpg|gif|png|webp)/i) ? (
                          <img
                            src={m.attachment_url}
                            alt="Attachment"
                            className="max-h-60 w-full object-cover"
                          />
                        ) : (
                          <a
                            href={m.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 rounded bg-black/20 p-2 text-xs text-emerald-300 underline"
                          >
                            <Paperclip className="h-4 w-4" /> View Attachment
                          </a>
                        )}
                      </div>
                    )}

                    {/* Message Body */}
                    <div className="whitespace-pre-wrap break-words leading-relaxed text-xs sm:text-sm">
                      {m.body}
                    </div>

                    {/* Time & Read Status Receipts */}
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-300/70">
                      <span>{timeStr}</span>
                      {isMine && (
                        <span>
                          {m.is_read ? (
                            <CheckCheck
                              className="h-3.5 w-3.5 text-sky-400 font-bold"
                              title="Read by recipient"
                            />
                          ) : (
                            <CheckCheck className="h-3.5 w-3.5 text-slate-400" title="Delivered" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Quick Replies */}
        {messages.length <= 2 && currentUserRole === "user" && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {quickReplies.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="rounded-full border border-amber-500/30 bg-[#111b21] px-3 py-1 text-xs text-amber-300 transition-colors hover:bg-amber-500 hover:text-black font-medium"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Media Attachment Pending Bar */}
      {mediaPreview && (
        <div className="flex items-center justify-between border-t border-[#222d34] bg-[#111b21] px-4 py-2 text-xs text-slate-300">
          <div className="flex items-center gap-2 truncate">
            <ImageIcon className="h-4 w-4 text-amber-400" />
            <span className="truncate">{mediaPreview.file.name}</span>
          </div>
          <button
            type="button"
            onClick={() => setMediaPreview(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Corporate Message Input Toolbar */}
      <div className="border-t border-[#222d34] bg-[#161922] p-2.5">
        {isRecording ? (
          <div className="flex items-center justify-between px-3 py-1.5 text-xs text-amber-400">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping" />
              <span>Recording Voice Note... {recordingSeconds}s</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500/40 text-amber-300"
              onClick={stopAndSendRecording}
            >
              Send Voice Note
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
                e.target.value = "";
              }}
            />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="p-2 text-slate-400 hover:text-amber-400 transition-colors"
              title="Attach File / Photo"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setIsTyping(e.target.value.length > 0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Type a message..."
              className="flex-1 rounded-lg bg-[#222631] px-3.5 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-400 outline-none focus:ring-1 focus:ring-amber-500/50"
            />

            {text.trim() || mediaPreview ? (
              <Button
                onClick={() => send()}
                disabled={sending}
                className="bg-amber-500 hover:bg-amber-400 text-black font-bold h-9 w-9 p-0 rounded-full shrink-0 shadow-sm"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-black" />
                ) : (
                  <Send className="h-4 w-4 text-black" />
                )}
              </Button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="p-2 text-slate-400 hover:text-amber-400 transition-colors"
                title="Record Voice Note"
              >
                <Mic className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
