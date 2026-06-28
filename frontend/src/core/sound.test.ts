import { describe, it, expect, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { SOUND_SOURCES, SoundManager, type SoundName } from './sound';

const PUBLIC = resolve(dirname(fileURLToPath(import.meta.url)), '../../public');
const NAMES: SoundName[] = ['spin', 'reelStop', 'win', 'bigWin', 'scatter', 'freeSpinStart', 'buttonClick'];

describe('sound', () => {
  it('registers at least one source for every named sound', () => {
    for (const name of NAMES) {
      expect(SOUND_SOURCES[name].length, `${name} has no source`).toBeGreaterThan(0);
    }
  });

  // Missing-audio guard: every referenced bundle-relative clip must actually
  // ship under frontend/public/ — a dangling reference fails CI.
  it('every referenced bundle-relative audio file exists under public/', () => {
    const refs = Object.values(SOUND_SOURCES).flat();
    const missing = refs
      .filter((u) => !/^https?:\/\//.test(u)) // CDN urls can't be checked here
      .filter((u) => !existsSync(resolve(PUBLIC, u)));
    expect(missing, `missing audio under public/: ${missing.join(', ')}`).toEqual([]);
  });

  it('the SoundManager surface is throw-safe (load/play/mute/dispose)', () => {
    // Howler runs in no-audio mode under jsdom; the manager must stay silent and
    // never throw regardless. Suppress its expected load warnings.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const m = new SoundManager();
    expect(() => {
      m.load();
      m.load(); // idempotent
      m.play('spin');
      m.setMuted(true);
      expect(m.muted).toBe(true);
      m.play('win', 0.5); // muted → no-op
      m.setMuted(false);
      m.dispose();
    }).not.toThrow();
    vi.restoreAllMocks();
  });
});
