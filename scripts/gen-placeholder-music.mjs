#!/usr/bin/env node
/**
 * Synthesize **placeholder** ambient music loops as seamless WAV files.
 *
 * Two loops, per `docs/asset-spec.md` §3 ("Ambient music"):
 *   - `music/base-loop.wav`      — deep, calm space pad for the base game.
 *   - `music/freespins-loop.wav` — brighter, lifted pad for the bonus.
 *
 * Seamlessness: every component frequency (voices, tremolo/pan LFOs) is
 * quantized to a whole number of cycles over the loop, so the last sample leads
 * exactly back into the first — no crossfade needed, no click at the loop point.
 *
 * Placeholders meant to be replaced by a composer's final loops (webm/mp3);
 * `MUSIC_SOURCES` keys in `core/sound.ts` are stable, so the swap is a pure
 * file replacement. Re-run after edits:
 *     node scripts/gen-placeholder-music.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/** 22.05 kHz keeps the files small; ambient pads carry no content above ~8 kHz. */
const SR = 22050;
/** Loop length (s). All modulation periods divide it exactly. */
const DUR = 24;
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../frontend/public/audio/music');

const TAU = Math.PI * 2;

/** Quantize a frequency to a whole number of cycles over the loop. */
function loopFreq(hz) {
  return Math.max(1, Math.round(hz * DUR)) / DUR;
}

/**
 * One pad voice: a detuned pair of sines (+ soft octave harmonic) with a slow
 * tremolo LFO and a slow stereo pan LFO. `lfoCycles`/`panCycles` are whole
 * cycles over the loop by construction.
 */
function voice(left, right, { freq, vol, lfoCycles, lfoDepth, panCycles, phase = 0, harmonic = 0.25 }) {
  const f = loopFreq(freq);
  const fDetune = loopFreq(freq * 1.003);
  const lfoW = (TAU * lfoCycles) / DUR;
  const panW = (TAU * panCycles) / DUR;
  const n = left.length;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const trem = 1 - lfoDepth * (0.5 + 0.5 * Math.sin(lfoW * t + phase));
    const s =
      (Math.sin(TAU * f * t + phase) +
        Math.sin(TAU * fDetune * t + phase * 1.7) +
        harmonic * Math.sin(TAU * 2 * f * t)) *
      vol *
      trem;
    const pan = 0.5 + 0.35 * Math.sin(panW * t + phase); // 0..1 → L..R
    left[i] += s * Math.cos((pan * Math.PI) / 2);
    right[i] += s * Math.sin((pan * Math.PI) / 2);
  }
}

/** Render a set of voices to a normalized stereo buffer pair. */
function render(voices, peak = 0.4) {
  const n = SR * DUR;
  const left = new Float64Array(n);
  const right = new Float64Array(n);
  for (const v of voices) voice(left, right, v);
  let max = 0;
  for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(left[i]), Math.abs(right[i]));
  const g = max > 0 ? peak / max : 1;
  return { left, right, gain: g };
}

/** Write a 16-bit stereo PCM WAV. */
function writeWav(name, { left, right, gain }) {
  const n = left.length;
  const dataSize = n * 2 * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(2, 22); // stereo
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2 * 2, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i] * gain)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i] * gain)) * 32767), 46 + i * 4);
  }
  writeFileSync(resolve(OUT, name), buf);
  console.log(`wrote ${name} (${(buf.length / 1024 / 1024).toFixed(2)} MB, ${DUR}s seamless loop)`);
}

mkdirSync(OUT, { recursive: true });

// Base game: deep D-minor-9 space pad — calm, dark, slowly breathing.
writeWav(
  'base-loop.wav',
  render([
    { freq: 36.71, vol: 0.5, lfoCycles: 2, lfoDepth: 0.35, panCycles: 0, phase: 0.0, harmonic: 0 }, // D1 sub
    { freq: 73.42, vol: 0.42, lfoCycles: 3, lfoDepth: 0.4, panCycles: 1, phase: 1.1 }, // D2
    { freq: 110.0, vol: 0.3, lfoCycles: 2, lfoDepth: 0.45, panCycles: 2, phase: 2.3 }, // A2
    { freq: 146.83, vol: 0.26, lfoCycles: 4, lfoDepth: 0.5, panCycles: 1, phase: 3.6 }, // D3
    { freq: 174.61, vol: 0.2, lfoCycles: 3, lfoDepth: 0.55, panCycles: 3, phase: 4.4 }, // F3
    { freq: 261.63, vol: 0.12, lfoCycles: 5, lfoDepth: 0.6, panCycles: 2, phase: 5.2 }, // C4
    { freq: 329.63, vol: 0.09, lfoCycles: 6, lfoDepth: 0.65, panCycles: 4, phase: 0.7 }, // E4 (9th)
  ])
);

// Free spins: the same world, lifted — D-major color, brighter voicing, a
// slightly faster shimmer so the bonus feels energized but not busy.
writeWav(
  'freespins-loop.wav',
  render([
    { freq: 73.42, vol: 0.45, lfoCycles: 3, lfoDepth: 0.35, panCycles: 0, phase: 0.0, harmonic: 0 }, // D2
    { freq: 146.83, vol: 0.34, lfoCycles: 4, lfoDepth: 0.4, panCycles: 1, phase: 0.9 }, // D3
    { freq: 220.0, vol: 0.28, lfoCycles: 5, lfoDepth: 0.45, panCycles: 2, phase: 1.8 }, // A3
    { freq: 293.66, vol: 0.2, lfoCycles: 6, lfoDepth: 0.5, panCycles: 3, phase: 2.7 }, // D4
    { freq: 369.99, vol: 0.16, lfoCycles: 7, lfoDepth: 0.55, panCycles: 2, phase: 3.5 }, // F#4
    { freq: 440.0, vol: 0.11, lfoCycles: 8, lfoDepth: 0.6, panCycles: 4, phase: 4.3 }, // A4
    { freq: 554.37, vol: 0.07, lfoCycles: 10, lfoDepth: 0.7, panCycles: 5, phase: 5.1 }, // C#5 sparkle
  ])
);
