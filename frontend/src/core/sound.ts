/**
 * Howler-backed sound manager with a named registry. Audio files are optional:
 * if a source is missing or fails to decode the manager logs and continues, so
 * the game never crashes in environments without assets.
 *
 * The SFX wired below are **placeholder** synthesized clips
 * (`scripts/gen-placeholder-audio.mjs` → `public/audio/*.wav`); a designer's
 * final audio is a pure file replacement under `public/audio/`. URLs resolve
 * through {@link assetUrl} so the same registry works bundle-relative (dev/CI)
 * or from a CDN (`VITE_ASSET_BASE`). No Pixi or Svelte imports.
 */
import { Howl, Howler } from 'howler';
import { assetUrl } from '../config/assets';

/** Named sounds the game can request. */
export type SoundName = 'spin' | 'reelStop' | 'win' | 'bigWin' | 'scatter' | 'freeSpinStart' | 'buttonClick';

/**
 * Sources per sound (resolved via {@link assetUrl}). An empty array means "no
 * asset" — the manager silently no-ops that name. The
 * `every referenced audio file exists` guard in `sound.test.ts` fails CI on a
 * dangling reference.
 */
export const SOUND_SOURCES: Record<SoundName, string[]> = {
  spin: [assetUrl('audio/spin.wav')],
  reelStop: [assetUrl('audio/reelStop.wav')],
  win: [assetUrl('audio/win.wav')],
  bigWin: [assetUrl('audio/bigWin.wav')],
  scatter: [assetUrl('audio/scatter.wav')],
  freeSpinStart: [assetUrl('audio/freeSpinStart.wav')],
  buttonClick: [assetUrl('audio/buttonClick.wav')],
};

/** Named ambient music loops (one per game mode). */
export type MusicName = 'base' | 'freespins';

/**
 * Sources per music loop, resolved like {@link SOUND_SOURCES}. The shipped
 * files are seamless placeholder loops (`scripts/gen-placeholder-music.mjs`);
 * final composed loops (webm/mp3 per `docs/asset-spec.md` §3) are a pure file
 * replacement — prepend the compressed sources to each list.
 */
export const MUSIC_SOURCES: Record<MusicName, string[]> = {
  base: [assetUrl('audio/music/base-loop.wav')],
  freespins: [assetUrl('audio/music/freespins-loop.wav')],
};

/** Steady-state music volume (kept low under the SFX). */
const MUSIC_VOLUME = 0.35;
/** Cross-fade duration between mode loops (ms). */
const MUSIC_FADE_MS = 1200;

/** Manages loading, muting and playback of the named sound registry. */
export class SoundManager {
  private readonly howls = new Map<SoundName, Howl>();
  private readonly music = new Map<MusicName, Howl>();
  private activeMusic: MusicName | null = null;
  private isMuted = false;
  private loaded = false;

  /**
   * Lazily create {@link Howl} instances for every registered source. Sounds with
   * no source are skipped. Safe to call multiple times.
   */
  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    for (const name of Object.keys(SOUND_SOURCES) as SoundName[]) {
      const src = SOUND_SOURCES[name];
      if (!src || src.length === 0) continue;
      try {
        const howl = new Howl({
          src,
          preload: true,
          html5: false,
          onloaderror: (_id, err) => console.warn(`[sound] failed to load "${name}":`, err),
        });
        this.howls.set(name, howl);
      } catch (err) {
        console.warn(`[sound] could not create howl for "${name}":`, err);
      }
    }
    for (const name of Object.keys(MUSIC_SOURCES) as MusicName[]) {
      const src = MUSIC_SOURCES[name];
      if (!src || src.length === 0) continue;
      try {
        const howl = new Howl({
          src,
          preload: true,
          html5: false,
          loop: true,
          volume: 0,
          onloaderror: (_id, err) => console.warn(`[sound] failed to load music "${name}":`, err),
        });
        this.music.set(name, howl);
      } catch (err) {
        console.warn(`[sound] could not create howl for music "${name}":`, err);
      }
    }
  }

  /**
   * Cross-fade the ambient music to the named loop. Idempotent for the active
   * loop; no-ops (without throwing) when the asset never loaded. Playback obeys
   * the browser's autoplay policy — Howler starts the loop on the first user
   * gesture if invoked before interaction.
   */
  playMusic(name: MusicName, fadeMs = MUSIC_FADE_MS): void {
    if (this.activeMusic === name) return;
    const next = this.music.get(name);
    const prev = this.activeMusic ? this.music.get(this.activeMusic) : undefined;
    this.activeMusic = name;
    try {
      if (prev?.playing()) {
        prev.fade(prev.volume() as number, 0, fadeMs);
        prev.once('fade', () => {
          if (this.activeMusic !== null && this.music.get(this.activeMusic) !== prev) prev.stop();
        });
      }
      if (next) {
        if (!next.playing()) next.play();
        next.fade(next.volume() as number, MUSIC_VOLUME, fadeMs);
      }
    } catch (err) {
      console.warn(`[sound] playMusic("${name}") failed:`, err);
    }
  }

  /** Fade the ambient music out and stop it. */
  stopMusic(fadeMs = MUSIC_FADE_MS): void {
    const prev = this.activeMusic ? this.music.get(this.activeMusic) : undefined;
    this.activeMusic = null;
    if (!prev) return;
    try {
      if (prev.playing()) {
        prev.fade(prev.volume() as number, 0, fadeMs);
        prev.once('fade', () => prev.stop());
      }
    } catch (err) {
      console.warn('[sound] stopMusic failed:', err);
    }
  }

  /** The music loop currently targeted (null when stopped). */
  get currentMusic(): MusicName | null {
    return this.activeMusic;
  }

  /**
   * Play a named sound. No-ops (without throwing) when muted, unregistered, or
   * the asset never loaded.
   * @param name Sound to play.
   * @param volume Optional 0..1 volume override.
   */
  play(name: SoundName, volume = 1): void {
    if (this.isMuted) return;
    const howl = this.howls.get(name);
    if (!howl) return;
    try {
      const id = howl.play();
      howl.volume(Math.max(0, Math.min(1, volume)), id);
    } catch (err) {
      console.warn(`[sound] play("${name}") failed:`, err);
    }
  }

  /** Mute or unmute all sound globally. */
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    try {
      Howler.mute(muted);
    } catch {
      // Howler not available (e.g. SSR/test) — ignore.
    }
  }

  /** Current mute state. */
  get muted(): boolean {
    return this.isMuted;
  }

  /** Stop and unload every sound. */
  dispose(): void {
    for (const howl of [...this.howls.values(), ...this.music.values()]) {
      try {
        howl.unload();
      } catch {
        /* ignore */
      }
    }
    this.howls.clear();
    this.music.clear();
    this.activeMusic = null;
    this.loaded = false;
  }
}

/** Shared application-wide sound manager. */
export const sound = new SoundManager();
