import { useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { WhatsAppChat } from "@/components/WhatsAppChat";
import { getOrCreateUserSupportThread } from "@/lib/support-service";

const STORAGE_KEY = "dewtrades_chat_pos";
const BUTTON_SIZE = 56; // px
const PANEL_WIDTH = 380; // px
const PANEL_HEIGHT = 560; // px

export function LiveChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const posRef = useRef<{ left: number; top: number }>({ left: 0, top: 0 });

  // Refs for smooth drag tracking
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const isDragging = useRef(false);
  const isHolding = useRef(false);
  const [activeDrag, setActiveDrag] = useState(false);

  const startPointer = useRef<{ x: number; y: number } | null>(null);
  const startPos = useRef<{ left: number; top: number }>({ left: 0, top: 0 });
  const holdTimer = useRef<NodeJS.Timeout | null>(null);
  const rafId = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  // Initialize position from localStorage & listen for support chat open trigger
  useEffect(() => {
    const handleOpenSupport = () => setOpen(true);
    window.addEventListener("open-support-chat", handleOpenSupport);

    let initial = { left: 0, top: 0 };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.left === "number" && typeof parsed.top === "number") {
          initial = {
            left: Math.min(Math.max(8, parsed.left), window.innerWidth - BUTTON_SIZE - 8),
            top: Math.min(Math.max(8, parsed.top), window.innerHeight - BUTTON_SIZE - 8),
          };
        }
      }
    } catch (e) {
      /* ignore */
    }

    if (initial.left === 0 && initial.top === 0) {
      initial = {
        left: Math.max(8, window.innerWidth - BUTTON_SIZE - 20),
        top: Math.max(8, window.innerHeight - BUTTON_SIZE - 20),
      };
    }

    posRef.current = initial;
    setPos(initial);

    return () => {
      window.removeEventListener("open-support-chat", handleOpenSupport);
    };
  }, []);

  // Window resize protection
  useEffect(() => {
    const handleResize = () => {
      if (!posRef.current) return;
      const clampedLeft = Math.min(
        Math.max(8, posRef.current.left),
        window.innerWidth - BUTTON_SIZE - 8,
      );
      const clampedTop = Math.min(
        Math.max(8, posRef.current.top),
        window.innerHeight - BUTTON_SIZE - 8,
      );
      posRef.current = { left: clampedLeft, top: clampedTop };
      setPos({ left: clampedLeft, top: clampedTop });
      if (btnRef.current) {
        btnRef.current.style.left = `${clampedLeft}px`;
        btnRef.current.style.top = `${clampedTop}px`;
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Ensure support thread exists and listen for unread messages
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    let channel: any = null;

    (async () => {
      try {
        const name = user.user_metadata?.full_name || user.email?.split("@")[0];
        const thread = await getOrCreateUserSupportThread(user.id, name);
        if (!isMounted || !thread) return;
        setThreadId(thread.id);

        // Calculate unread count
        const { data: msgs } = await supabase
          .from("support_messages")
          .select("id, sender, is_read")
          .eq("thread_id", thread.id);

        if (isMounted) {
          const count = (msgs ?? []).filter((m: any) => m.sender !== "user" && !m.is_read).length;
          setUnread(count);
        }

        // Subscribe to incoming messages for live unread badge
        channel = supabase
          .channel(`widget-unread-${thread.id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "support_messages",
              filter: `thread_id=eq.${thread.id}`,
            },
            (payload: any) => {
              const newMsg = payload.new;
              if (newMsg.sender !== "user") {
                setUnread((prev) => prev + 1);
              }
            },
          )
          .subscribe();
      } catch (e: any) {
        console.error("[chat] failed to load thread", e);
        if (isMounted) toast.error(e.message || "Failed to connect to live support");
      }
    })();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  // Handle pointer down, move, up with 0.5s touch hold delay
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Only primary touch / left click
    if (e.button !== 0 && e.pointerType === "mouse") return;

    pointerIdRef.current = e.pointerId;
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore pointer capture error */
    }

    startPointer.current = { x: e.clientX, y: e.clientY };
    startPos.current = { ...posRef.current };
    isDragging.current = false;
    isHolding.current = false;

    // Start 0.5s touch hold timer
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      isHolding.current = true;
      isDragging.current = true;
      setActiveDrag(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(30);
        } catch {
          /* ignore vibration error */
        }
      }
    }, 500);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!startPointer.current) return;

    const dx = e.clientX - startPointer.current.x;
    const dy = e.clientY - startPointer.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // If moved > 8px, activate drag mode even before 0.5s
    if (dist > 8 && !isDragging.current) {
      isDragging.current = true;
      setActiveDrag(true);
    }

    if (isDragging.current) {
      if (holdTimer.current) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }

      const newLeft = Math.min(
        Math.max(8, startPos.current.left + dx),
        window.innerWidth - BUTTON_SIZE - 8,
      );
      const newTop = Math.min(
        Math.max(8, startPos.current.top + dy),
        window.innerHeight - BUTTON_SIZE - 8,
      );

      posRef.current = { left: newLeft, top: newTop };

      // High-performance direct DOM manipulation via requestAnimationFrame
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        if (btnRef.current) {
          btnRef.current.style.left = `${newLeft}px`;
          btnRef.current.style.top = `${newTop}px`;
        }
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }

    if (pointerIdRef.current !== null) {
      try {
        (e.target as HTMLElement).releasePointerCapture?.(pointerIdRef.current);
      } catch {
        /* ignore pointer release error */
      }
      pointerIdRef.current = null;
    }

    if (isDragging.current) {
      // Save final position to React state & localStorage
      const finalPos = { ...posRef.current };
      setPos(finalPos);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(finalPos));
      } catch {
        /* ignore storage error */
      }
    } else {
      // Quick tap (< 0.5s and no drag movement) -> open/close chat panel
      setOpen((o) => !o);
    }

    isDragging.current = false;
    isHolding.current = false;
    setActiveDrag(false);
    startPointer.current = null;
  };

  if (!user || pos === null) return null;

  const panelLeft = (() => {
    const centered = pos.left - (PANEL_WIDTH - BUTTON_SIZE) / 2;
    return Math.min(Math.max(8, centered), window.innerWidth - PANEL_WIDTH - 8);
  })();
  const panelTop = (() => {
    const above = pos.top - PANEL_HEIGHT - 12;
    if (above >= 8) return above;
    const below = pos.top + BUTTON_SIZE + 12;
    return Math.min(Math.max(8, below), window.innerHeight - PANEL_HEIGHT - 8);
  })();

  return (
    <>
      <button
        ref={btnRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`fixed z-50 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 hover:bg-amber-400 shadow-2xl transition-transform text-black touch-none select-none ${
          activeDrag
            ? "scale-110 ring-4 ring-amber-400/50 shadow-amber-500/50"
            : "hover:scale-105 active:scale-95 shadow-amber-500/30"
        }`}
        aria-label="Live support"
        style={{
          left: `${pos.left}px`,
          top: `${pos.top}px`,
          position: "fixed",
          touchAction: "none",
          WebkitUserSelect: "none",
        }}
      >
        <MessageCircle className="h-6 w-6 text-black pointer-events-none" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] pointer-events-none items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground animate-bounce">
            {unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && threadId && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="z-50 fixed flex flex-col overflow-hidden shadow-2xl rounded-2xl border border-[#222d34]"
            style={{ width: PANEL_WIDTH, height: PANEL_HEIGHT, left: panelLeft, top: panelTop }}
          >
            <div className="relative h-full w-full">
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 right-3 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-slate-300 hover:text-white transition-colors"
                title="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
              <WhatsAppChat
                threadId={threadId}
                userId={user.id}
                currentUserRole="user"
                recipientName="Dew Trades Support"
                recipientStatus="Online • Live Agent"
                height="h-full"
                compact
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
