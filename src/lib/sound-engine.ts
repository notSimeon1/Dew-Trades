// Web Audio API Sound Synthesizer Engine for Dew Trades Trading Platform

class SoundFXEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const saved =
          localStorage.getItem("dewtrades_audio_enabled") ??
          localStorage.getItem("solentrades_audio_enabled");
        this.enabled = saved !== "false";
      } catch {
        this.enabled = true;
      }
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("dewtrades_audio_enabled", String(enabled));
      } catch {
        // Storage disabled or blocked
      }
    }
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  private initCtx() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  // Soft futuristic UI click
  public playClick() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch {
      /* ignore audio error */
    }
  }

  // Trade order execution sound (Buy/Sell)
  public playTrade(type: "buy" | "sell" = "buy") {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      if (type === "buy") {
        osc1.frequency.setValueAtTime(523.25, now); // C5
        osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.08); // E5
        osc2.frequency.setValueAtTime(659.25, now + 0.08);
        osc2.frequency.exponentialRampToValueAtTime(783.99, now + 0.16); // G5
      } else {
        osc1.frequency.setValueAtTime(783.99, now); // G5
        osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.08); // E5
        osc2.frequency.setValueAtTime(659.25, now + 0.08);
        osc2.frequency.exponentialRampToValueAtTime(523.25, now + 0.16); // C5
      }

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.1);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.2);
    } catch {
      /* ignore audio error */
    }
  }

  // Instant Swap swoosh chime
  public playSwap() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.12);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      /* ignore audio error */
    }
  }

  // Deposit Success Cash Chime
  public playDepositBonus() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.1, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.18);
      });
    } catch {
      /* ignore audio error */
    }
  }

  // Trigger tactile mobile vibration if supported
  public triggerHaptic(durationMs: number = 30) {
    if (typeof window !== "undefined" && "navigator" in window && navigator.vibrate) {
      try {
        navigator.vibrate(durationMs);
      } catch {
        /* ignore vibration error */
      }
    }
  }
}

export const soundFX = new SoundFXEngine();
