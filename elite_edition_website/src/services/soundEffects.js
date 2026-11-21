/**
 * Elite Edition ERP — Subtle Haptic & Acoustic Sound Effects Engine
 *
 * Synthesizes Apple macOS / iOS style gentle acoustic micro-sounds
 * using the native browser Web Audio API:
 * - Zero external sound files or CDNs needed (0 KB network overhead)
 * - Zero latency (<1ms instant playback)
 * - Automatic mobile haptic vibration pulse (navigator.vibrate)
 * - User-controlled volume, Mute/Unmute, and Sound Profiles (Apple / Mechanical / Synth)
 */

const LS_SOUND_KEY = 'elite_erp_sound_enabled';
const LS_VOLUME_KEY = 'elite_erp_sound_volume';
const LS_PROFILE_KEY = 'elite_erp_sound_profile';

class SoundEffectsEngine {
  constructor() {
    this.audioCtx = null;
    this.enabled = this.readSetting(LS_SOUND_KEY, 'on') === 'on';
    const savedVol = parseFloat(this.readSetting(LS_VOLUME_KEY, '0.5'));
    this.volume = isNaN(savedVol) ? 0.5 : Math.max(0, Math.min(1, savedVol));
    this.profile = this.readSetting(LS_PROFILE_KEY, 'apple'); // 'apple' | 'mechanical' | 'synth'
    this.scanStep = 0;
    this.lastScanTime = 0;

    // Listen for cross-tab or cross-component sound settings changes
    if (typeof window !== 'undefined') {
      window.addEventListener('elite-sound-setting-change', (e) => {
        if (e.detail?.enabled !== undefined) this.enabled = !!e.detail.enabled;
        if (typeof e.detail?.volume === 'number') this.volume = e.detail.volume;
        if (typeof e.detail?.profile === 'string') this.profile = e.detail.profile;
      });
    }
  }

  readSetting(key, fallback) {
    try {
      if (typeof localStorage === 'undefined') return fallback;
      const val = localStorage.getItem(key);
      return val !== null ? val : fallback;
    } catch (_) {
      return fallback;
    }
  }

  getAudioContext() {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.audioCtx) {
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  isEnabled() {
    return this.enabled;
  }

  getVolume() {
    return this.volume;
  }

  getProfile() {
    return this.profile;
  }

  setEnabled(val) {
    this.enabled = !!val;
    try {
      localStorage.setItem(LS_SOUND_KEY, this.enabled ? 'on' : 'off');
      this.broadcast();
    } catch (_) {}
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, Number(vol) || 0));
    try {
      localStorage.setItem(LS_VOLUME_KEY, String(this.volume));
      this.broadcast();
    } catch (_) {}
  }

  setProfile(p) {
    this.profile = ['apple', 'mechanical', 'synth'].includes(p) ? p : 'apple';
    try {
      localStorage.setItem(LS_PROFILE_KEY, this.profile);
      this.broadcast();
    } catch (_) {}
  }

  broadcast() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('elite-sound-setting-change', {
          detail: { enabled: this.enabled, volume: this.volume, profile: this.profile }
        })
      );
    }
  }

  triggerHaptic(duration = 10) {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(duration);
      } catch (_) {}
    }
  }

  /**
   * 1. Success Chime (Velvety ascending chord)
   */
  playSuccess() {
    if (!this.enabled || this.volume <= 0) return;
    this.triggerHaptic(14);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.09 * this.volume, now);
      masterGain.connect(ctx.destination);

      if (this.profile === 'mechanical') {
        // Crisp dual click + affirmative tone
        this.playMechanicalClickInternal(ctx, now);
        this.playMechanicalClickInternal(ctx, now + 0.08);
        return;
      }

      if (this.profile === 'synth') {
        // Electronic warm synth fifth chord
        const notes = [440, 660, 880];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.04);
          gain.gain.setValueAtTime(0, now + i * 0.04);
          gain.gain.linearRampToValueAtTime(1, now + i * 0.04 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.32);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + i * 0.04);
          osc.stop(now + i * 0.04 + 0.35);
        });
        return;
      }

      // Default: Apple Minimalist C5 -> E5 -> G5
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.055);
        noteGain.gain.setValueAtTime(0, now + i * 0.055);
        noteGain.gain.linearRampToValueAtTime(1, now + i * 0.055 + 0.015);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.28);
        osc.connect(noteGain);
        noteGain.connect(masterGain);
        osc.start(now + i * 0.055);
        osc.stop(now + i * 0.055 + 0.3);
      });
    } catch (_) {}
  }

  /**
   * 2. Task Done Tone
   */
  playTaskDone() {
    if (!this.enabled || this.volume <= 0) return;
    this.triggerHaptic(18);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = this.profile === 'synth' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.09);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12 * this.volume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch (_) {}
  }

  /**
   * 3. Tactile Click
   */
  playClick() {
    if (!this.enabled || this.volume <= 0) return;
    this.triggerHaptic(8);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      if (this.profile === 'mechanical') {
        this.playMechanicalClickInternal(ctx, now);
        return;
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = this.profile === 'synth' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.022);

      gain.gain.setValueAtTime(0.06 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.024);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.025);
    } catch (_) {}
  }

  playMechanicalClickInternal(ctx, now) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(2200, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.018);
      gain.gain.setValueAtTime(0.08 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.022);
    } catch (_) {}
  }

  /**
   * 4. Operator Fast-Scanning Pop Audio Cue (Pop! Pop! Pop!)
   * Automatically pitches up with consecutive rapid entries
   */
  playScanPop(stepIndex) {
    if (!this.enabled || this.volume <= 0) return;
    this.triggerHaptic(10);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const nowMs = Date.now();
      if (nowMs - this.lastScanTime > 2500) {
        this.scanStep = 0;
      } else {
        this.scanStep = (this.scanStep + 1) % 8;
      }
      this.lastScanTime = nowMs;

      const baseStep = typeof stepIndex === 'number' ? stepIndex : this.scanStep;
      const freq = 680 + (baseStep % 10) * 85;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 1.3, now);
      osc.frequency.exponentialRampToValueAtTime(freq, now + 0.035);

      gain.gain.setValueAtTime(0.09 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.055);
    } catch (_) {}
  }

  /**
   * 5. Challan Dispatch / Print
   */
  playDispatch() {
    if (!this.enabled || this.volume <= 0) return;
    this.triggerHaptic(15);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(783.99, now);
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.08);

      gain.gain.setValueAtTime(0.09 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.24);
    } catch (_) {}
  }

  /**
   * 6. Warning
   */
  playWarning() {
    if (!this.enabled || this.volume <= 0) return;
    this.triggerHaptic([10, 30, 10]);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [349.23, 293.66];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        gain.gain.setValueAtTime(0.08 * this.volume, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.15);
      });
    } catch (_) {}
  }

  /**
   * 7. Cash / Payment Chime (Invoice Paid / Voucher Saved)
   */
  playPaymentSuccess() {
    if (!this.enabled || this.volume <= 0) return;
    this.triggerHaptic([10, 20, 15]);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [1046.5, 1318.51, 1567.98]; // C6, E6, G6 crisp bell
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const t = now + idx * 0.055;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.085 * this.volume, t);
        gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.24);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.26);
      });
    } catch (_) {}
  }

  /**
   * 8. Barcode / QR Scanner OK Beep
   */
  playScanSuccess() {
    if (!this.enabled || this.volume <= 0) return;
    this.triggerHaptic(12);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1320, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.055);
      gain.gain.setValueAtTime(0.11 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch (_) {}
  }

  /**
   * 9. Barcode / QR Scanner Error Double Low Buzz
   */
  playScanError() {
    if (!this.enabled || this.volume <= 0) return;
    this.triggerHaptic([20, 40, 20]);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [0, 0.11].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(210, now + offset);
        gain.gain.setValueAtTime(0.065 * this.volume, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.085);
      });
    } catch (_) {}
  }

  /**
   * 10. Chat Message Sent Bubble Pop
   */
  playChatSend() {
    if (!this.enabled || this.volume <= 0) return;
    this.triggerHaptic(8);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.042);
      gain.gain.setValueAtTime(0.085 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch (_) {}
  }

  /**
   * 11. Chat Incoming Gentle Water Drop Ping
   */
  playChatReceive() {
    if (!this.enabled || this.volume <= 0) return;
    this.triggerHaptic(10);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.075);
      gain.gain.setValueAtTime(0.08 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (_) {}
  }

  /**
   * 12. Subtle Glass Whoosh (Company Switch / Drawer / Spotlight)
   */
  playGlassWhoosh() {
    if (!this.enabled || this.volume <= 0) return;
    this.triggerHaptic(6);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const bufferSize = Math.floor(ctx.sampleRate * 0.11);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(2400, now + 0.1);
      filter.Q.value = 1.8;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.045 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
    } catch (_) {}
  }

  /**
   * 13. Delete Soft Low Thud & Undo Upward Chime
   */
  playDelete() {
    if (!this.enabled || this.volume <= 0) return;
    this.triggerHaptic(14);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(195, now);
      osc.frequency.exponentialRampToValueAtTime(82, now + 0.075);
      gain.gain.setValueAtTime(0.1 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.095);
    } catch (_) {}
  }

  playUndo() {
    if (!this.enabled || this.volume <= 0) return;
    this.triggerHaptic(10);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.09);
      gain.gain.setValueAtTime(0.075 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch (_) {}
  }

  /**
   * 14. Milestone 3-Note Ascending Glass Chord (Job Completed / Task Done)
   */
  playMilestone() {
    if (!this.enabled || this.volume <= 0) return;
    this.triggerHaptic([12, 24, 18]);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const chord = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
      chord.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const t = now + i * 0.06;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.08 * this.volume, t);
        gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.34);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.36);
      });
    } catch (_) {}
  }

  /**
   * 15. Print / Thermal Sticker Feed Click (PDF / A4 / Barcode Print)
   */
  playPrintJob() {
    if (!this.enabled || this.volume <= 0) return;
    this.triggerHaptic(10);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [0, 0.045].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(idx === 0 ? 1150 : 1520, now + offset);
        osc.frequency.exponentialRampToValueAtTime(620, now + offset + 0.032);
        gain.gain.setValueAtTime(0.075 * this.volume, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.038);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.04);
      });
    } catch (_) {}
  }

  /**
   * 16. Refresh Water Ripple (Pull-to-Refresh / Refresh Data)
   */
  playRefresh() {
    if (!this.enabled || this.volume <= 0) return;
    this.triggerHaptic(8);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [587.33, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const t = now + i * 0.042;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.06 * this.volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.15);
      });
    } catch (_) {}
  }

  /**
   * 17. Form Validation Error Soft Double-Tap
   */
  playValidationError() {
    if (!this.enabled || this.volume <= 0) return;
    this.triggerHaptic([14, 28, 14]);
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [0, 0.085].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now + offset);
        osc.frequency.exponentialRampToValueAtTime(145, now + offset + 0.065);
        gain.gain.setValueAtTime(0.095 * this.volume, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.075);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.08);
      });
    } catch (_) {}
  }

  /**
   * 18. Ultra-Soft Scroll / Arrow-Key Tick (Spotlight Cmd+K)
   */
  playScrollTick() {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1600, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.012);
      gain.gain.setValueAtTime(0.032 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.015);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.018);
    } catch (_) {}
  }

  /**
   * 19. Warm 2-Note Glass Welcome Chord (Login / Unlock)
   */
  playStartupChime() {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [440, 659.25].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const t = now + i * 0.09;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.065 * this.volume, t);
        gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.48);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    } catch (_) {}
  }
}

export const soundEffects = new SoundEffectsEngine();
export default soundEffects;
