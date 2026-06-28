#!/usr/bin/env node
/**
 * Synthesize **placeholder** sound effects as small WAV files.
 *
 * The audio pipeline (core/sound.ts, Howler-backed) was built but empty. This
 * fills it with short, soft-enveloped synthesized SFX so the demo has sound —
 * placeholders meant to be replaced by a designer's final audio. The
 * SoundManager is fault-tolerant and muteable, and SOUND_SOURCES keys are
 * stable, so the swap is a pure file replacement under `public/audio/`.
 *
 * Pure Node (no deps): writes 16-bit mono PCM WAVs. Re-run after edits:
 *     node scripts/gen-placeholder-audio.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SR = 44100;
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../frontend/public/audio');

const TAU = Math.PI * 2;

/** Amplitude envelope: short linear attack, then exponential decay. */
function envAt(t, dur, attack, decayTau) {
  const a = t < attack ? t / attack : 1;
  const d = Math.exp(-Math.max(0, t) / decayTau);
  // Gentle fade in the last 8 ms to avoid an end-of-buffer click.
  const tail = dur - t < 0.008 ? Math.max(0, (dur - t) / 0.008) : 1;
  return a * d * tail;
}

/** A pure-tone buffer (optionally frequency-swept f0→f1). */
function tone(f0, dur, { f1 = f0, attack = 0.008, decayTau = 0.18, vol = 0.5, harmonic = 0.0 } = {}) {
  const n = Math.floor(dur * SR);
  const buf = new Float64Array(n);
  let phase = 0;
  let phase2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f0 + (f1 - f0) * (t / dur);
    phase += (TAU * f) / SR;
    phase2 += (TAU * 2 * f) / SR;
    const s = Math.sin(phase) + harmonic * Math.sin(phase2);
    buf[i] = s * vol * envAt(t, dur, attack, decayTau);
  }
  return buf;
}

/** Mix several buffers (sum, length = longest). */
function mix(...bufs) {
  const n = Math.max(...bufs.map((b) => b.length));
  const out = new Float64Array(n);
  for (const b of bufs) for (let i = 0; i < b.length; i++) out[i] += b[i];
  return out;
}

/** Concatenate buffers end to end. */
function concat(...bufs) {
  const n = bufs.reduce((s, b) => s + b.length, 0);
  const out = new Float64Array(n);
  let o = 0;
  for (const b of bufs) {
    out.set(b, o);
    o += b.length;
  }
  return out;
}

/** Normalize to a target peak (keeps everything below clipping + harshness). */
function normalize(buf, peak = 0.6) {
  let max = 0;
  for (const s of buf) max = Math.max(max, Math.abs(s));
  if (max === 0) return buf;
  const g = peak / max;
  for (let i = 0; i < buf.length; i++) buf[i] *= g;
  return buf;
}

/** Encode a Float64 buffer ([-1,1]) as a 16-bit mono PCM WAV. */
function wav(buf) {
  const n = buf.length;
  const data = Buffer.alloc(44 + n * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + n * 2, 4);
  data.write('WAVE', 8);
  data.write('fmt ', 12);
  data.writeUInt32LE(16, 16); // fmt chunk size
  data.writeUInt16LE(1, 20); // PCM
  data.writeUInt16LE(1, 22); // mono
  data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 2, 28); // byte rate
  data.writeUInt16LE(2, 32); // block align
  data.writeUInt16LE(16, 34); // bits/sample
  data.write('data', 36);
  data.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, buf[i]));
    data.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return data;
}

// --- The SFX set (keys mirror core/sound.ts SoundName) -----------------------
const note = { C5: 523.25, E5: 659.25, G5: 783.99, B5: 987.77, C6: 1046.5, D6: 1174.66, E6: 1318.51 };

const SOUNDS = {
  // Crisp UI blip.
  buttonClick: () => normalize(tone(880, 0.06, { decayTau: 0.03, vol: 0.5, harmonic: 0.2 }), 0.5),
  // Low mechanical thunk as a reel lands.
  reelStop: () =>
    normalize(mix(tone(190, 0.13, { decayTau: 0.06, vol: 0.6 }), tone(95, 0.13, { decayTau: 0.07, vol: 0.3 })), 0.62),
  // Gentle rising whoosh on spin start.
  spin: () => normalize(tone(240, 0.42, { f1: 540, attack: 0.03, decayTau: 0.4, vol: 0.4, harmonic: 0.15 }), 0.5),
  // Bright two-note chime on a win.
  win: () =>
    normalize(
      mix(tone(note.E5, 0.5, { decayTau: 0.34, vol: 0.45 }), tone(note.B5, 0.5, { decayTau: 0.34, vol: 0.32 })),
      0.6,
    ),
  // Ascending arpeggio for a big win.
  bigWin: () =>
    normalize(
      concat(
        tone(note.C5, 0.14, { decayTau: 0.16, vol: 0.5 }),
        tone(note.E5, 0.14, { decayTau: 0.16, vol: 0.5 }),
        tone(note.G5, 0.14, { decayTau: 0.16, vol: 0.5 }),
        mix(tone(note.C6, 0.55, { decayTau: 0.4, vol: 0.5 }), tone(note.E6, 0.55, { decayTau: 0.4, vol: 0.3 })),
      ),
      0.62,
    ),
  // Sparkly shimmer when scatters land.
  scatter: () =>
    normalize(
      mix(
        tone(note.G5, 0.5, { decayTau: 0.35, vol: 0.3, harmonic: 0.25 }),
        tone(note.B5, 0.5, { decayTau: 0.32, vol: 0.28 }),
        tone(note.D6, 0.5, { decayTau: 0.3, vol: 0.24 }),
      ),
      0.58,
    ),
  // Hopeful rising fanfare entering free spins.
  freeSpinStart: () =>
    normalize(
      mix(
        tone(330, 0.7, { f1: 660, attack: 0.04, decayTau: 0.6, vol: 0.35 }),
        tone(note.E5, 0.7, { decayTau: 0.55, vol: 0.3 }),
        tone(note.G5, 0.7, { decayTau: 0.55, vol: 0.24 }),
      ),
      0.6,
    ),
};

mkdirSync(OUT, { recursive: true });
let n = 0;
for (const [name, make] of Object.entries(SOUNDS)) {
  writeFileSync(resolve(OUT, `${name}.wav`), wav(make()));
  n++;
}
console.log(`wrote ${n} placeholder SFX to frontend/public/audio/`);
