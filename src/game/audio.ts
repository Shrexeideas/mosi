import type { GamePhase, SimEvent } from './types';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private buzzOscA: OscillatorNode | null = null;
  private buzzOscB: OscillatorNode | null = null;
  private buzzFilter: BiquadFilterNode | null = null;
  private buzzGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private muted = false;
  private unlocked = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.72, this.ctx.currentTime, 0.04);
    }
    if (muted) {
      this.silenceLoops();
    }
  }

  public unlock(): void {
    if (this.unlocked || typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.72;
      this.masterGain.connect(this.ctx.destination);

      // Continuous mosquito buzz oscillators (muted at 0 until playing)
      this.buzzOscA = this.ctx.createOscillator();
      this.buzzOscB = this.ctx.createOscillator();
      this.buzzOscA.type = 'sawtooth';
      this.buzzOscB.type = 'triangle';
      this.buzzOscA.frequency.value = 380;
      this.buzzOscB.frequency.value = 387;

      this.buzzFilter = this.ctx.createBiquadFilter();
      this.buzzFilter.type = 'bandpass';
      this.buzzFilter.frequency.value = 620;
      this.buzzFilter.Q.value = 2.4;

      this.buzzGain = this.ctx.createGain();
      this.buzzGain.gain.value = 0;

      this.buzzOscA.connect(this.buzzFilter);
      this.buzzOscB.connect(this.buzzFilter);
      this.buzzFilter.connect(this.buzzGain);
      this.buzzGain.connect(this.masterGain);

      this.buzzOscA.start();
      this.buzzOscB.start();

      // Gentle ambient night room hum
      const ambOsc = this.ctx.createOscillator();
      ambOsc.type = 'sine';
      ambOsc.frequency.value = 68;
      const ambFilter = this.ctx.createBiquadFilter();
      ambFilter.type = 'lowpass';
      ambFilter.frequency.value = 140;
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0;
      ambOsc.connect(ambFilter);
      ambFilter.connect(this.ambientGain);
      this.ambientGain.connect(this.masterGain);
      ambOsc.start();

      this.unlocked = true;
    } catch {
      // Audio unavailable (e.g., restricted headless environment)
    }
  }

  public updateContinuous(
    phase: GamePhase,
    speed: number,
    isSipping: boolean,
    isDashing: boolean,
    breathPhase: number,
    isNinja = false,
    bloatLevel = 0
  ): void {
    if (
      !this.ctx ||
      !this.buzzGain ||
      !this.buzzOscA ||
      !this.buzzOscB ||
      !this.buzzFilter ||
      !this.ambientGain
    ) {
      return;
    }
    if (this.ctx.state === 'suspended' && phase === 'playing' && !this.muted) {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    if (this.muted || phase !== 'playing') {
      this.buzzGain.gain.setTargetAtTime(0, now, 0.05);
      this.ambientGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    // Subtle breathing swell in ambient night tone
    const breathMod = 0.014 + Math.max(0, Math.sin(breathPhase)) * 0.012;
    this.ambientGain.gain.setTargetAtTime(breathMod, now, 0.1);

    // Mosquito buzz pitch & volume react directly to motion, ninja stealth & chonky bloat
    const normalizedSpeed = Math.min(1, speed / 340);
    const bloatPitchDrop = bloatLevel * 65;
    const targetFreq = isSipping
      ? 265
      : isDashing
        ? 590
        : 345 - bloatPitchDrop + normalizedSpeed * 165;
    const ninjaVolFactor = isNinja ? 0.6 : 1;
    const targetVol =
      (isSipping
        ? 0.008
        : isDashing
          ? 0.052
          : 0.012 + normalizedSpeed * 0.032) * ninjaVolFactor;

    this.buzzOscA.frequency.setTargetAtTime(targetFreq, now, 0.04);
    this.buzzOscB.frequency.setTargetAtTime(targetFreq * 1.018, now, 0.04);
    this.buzzFilter.frequency.setTargetAtTime(targetFreq * 1.7, now, 0.05);
    this.buzzGain.gain.setTargetAtTime(targetVol, now, 0.04);
  }

  public silenceLoops(): void {
    if (!this.ctx || !this.buzzGain || !this.ambientGain) return;
    const now = this.ctx.currentTime;
    this.buzzGain.gain.setTargetAtTime(0, now, 0.03);
    this.ambientGain.gain.setTargetAtTime(0, now, 0.05);
  }

  public playUpgradeUnlock(): void {
    if (this.muted || !this.ctx) return;
    this.playNotes([523.25, 659.25, 987.77], 0.06, 0.11);
  }

  public handleEvents(events: SimEvent[], bellyFill: number): void {
    if (this.muted || !this.ctx) return;
    for (const ev of events) {
      switch (ev.type) {
        case 'dash':
          this.playSweep(480, 920, 0.11, 0.09, 'triangle');
          break;
        case 'land':
          this.playSweep(320, 210, 0.07, 0.07, 'sine');
          break;
        case 'sip_tick': {
          const base = 520 + bellyFill * 3.2;
          this.playSweep(base, base + 90, 0.055, 0.05, 'sine');
          break;
        }
        case 'food_sip':
          this.playSweep(410, 560, 0.06, 0.045, 'triangle');
          break;
        case 'long_distance':
          this.playNotes([587.33, 880], 0.07, 0.09);
          break;
        case 'stirring':
          this.playSweep(148, 112, 0.24, 0.08, 'triangle');
          break;
        case 'swat_windup':
          this.playSweep(290, 680, 0.48, 0.08, 'sine');
          break;
        case 'swat_strike':
          this.playNoiseBurst(0.14, 0.22);
          this.playSweep(210, 75, 0.14, 0.18, 'triangle');
          break;
        case 'near_miss':
          this.playNotes([523.25, 659.25, 783.99, 1046.5], 0.06, 0.11);
          break;
        case 'swatted':
          this.playNoiseBurst(0.22, 0.28);
          this.playSweep(640, 120, 0.42, 0.16, 'sawtooth');
          break;
        case 'alarm_tick': {
          const pitch = 980 + ev.urgency * 420;
          const vol = 0.025 + ev.urgency * 0.045;
          this.playSweep(pitch, pitch * 0.72, 0.035, vol, 'square');
          break;
        }
        case 'alarm_ring':
          this.playAlarmRing();
          break;
        case 'scratch_flick':
          this.playNoiseBurst(0.08, 0.1);
          this.playSweep(380, 220, 0.09, 0.07, 'triangle');
          break;
        case 'bloated':
          this.playSweep(280, 140, 0.22, 0.11, 'sine');
          break;
        case 'condition_triggered':
          this.playNotes([440, 554.37, 659.25], 0.055, 0.08);
          break;
        case 'sneeze_blast':
          this.playNoiseBurst(0.28, 0.26);
          this.playSweep(520, 140, 0.26, 0.14, 'sawtooth');
          break;
        case 'achievement':
          this.playNotes([659.25, 783.99, 1046.5], 0.07, 0.1);
          break;
        case 'victory':
        case 'escaped':
          this.playNotes([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.09, 0.12);
          break;
        case 'dawn':
          this.playNotes([659.25, 587.33, 493.88], 0.12, 0.1);
          break;
      }
    }
  }

  private playAlarmRing(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    // Rapid retro twin-bell clapper ring
    for (let i = 0; i < 10; i++) {
      const t = now + i * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(i % 2 === 0 ? 1280 : 1460, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.055);
    }
  }

  private playSweep(
    startFreq: number,
    endFreq: number,
    duration: number,
    volume: number,
    type: OscillatorType
  ): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private playNotes(freqs: number[], stepSec: number, volume: number): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * stepSec;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  private playNoiseBurst(duration: number, volume: number): void {
    if (!this.ctx || !this.masterGain) return;
    const sampleCount = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 950;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start();
  }
}
