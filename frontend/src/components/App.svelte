<script lang="ts">
  /**
   * Root component. Mounts the Pixi stage, runs authentication on load, owns the
   * loading/error states, and orchestrates spins + autoplay by delegating to the
   * core {@link BookPlayer}. It talks to core via stores/bus only.
   */
  import { onMount, onDestroy } from 'svelte';
  import { Stage } from '../scenes/Stage';
  import { parseRgsParams, RgsClient, RgsError, type RgsTransport } from '../core/rgsClient';
  import { MockRgsClient } from '../core/mockRgs';
  import { BookPlayer } from '../core/bookPlayer';
  import {
    balance,
    currency,
    isSpinning,
    autoplay,
    insufficientFunds,
    gameMode,
    errorMessage,
    getCurrentBet,
    lastResult,
  } from '../core/gameState';
  import { sound } from '../core/sound';
  import { buyBonusMode, formatCurrency } from '../config/gameConfig';
  import { t, tn, setLocale, localeTag } from '../core/i18n';
  import { announce, announcement, prefersReducedMotion } from '../core/a11y';
  import { startSession, stopSession } from '../core/session';

  import LoadingScreen from './LoadingScreen.svelte';
  import BalanceDisplay from './BalanceDisplay.svelte';
  import BetSelector from './BetSelector.svelte';
  import SpinButton from './SpinButton.svelte';
  import WinDisplay from './WinDisplay.svelte';
  import Autoplay from './Autoplay.svelte';
  import PaytableModal from './PaytableModal.svelte';
  import BuyBonusButton from './BuyBonusButton.svelte';
  import FreeSpinsBanner from './FreeSpinsBanner.svelte';
  import SoundToggle from './SoundToggle.svelte';
  import RealityCheck from './RealityCheck.svelte';

  let canvasHost: HTMLDivElement;
  let stage: Stage | null = null;
  let transport: RgsTransport | null = null;
  let player: BookPlayer | null = null;
  let reducedMotionOff: (() => void) | null = null;

  let loading = true;
  let loadingMessage = tn('app.initializing');
  let usingMock = false;
  let paytableOpen = false;
  let fps = 0;
  let autoplayToken = 0;

  onMount(async () => {
    sound.load();
    sound.setMuted(false);

    const params = parseRgsParams();
    setLocale(params.lang); // RGS lang param → UI locale (falls back to English)
    usingMock = !params.rgsUrl || !params.sessionID;

    // Build the stage first so the canvas is visible behind the loader. A stuck
    // GPU/driver must never deadlock boot, so bound renderer init with a timeout:
    // on failure we surface an error but still bring up the (DOM) HUD.
    stage = new Stage();
    try {
      await Promise.race([
        stage.init({
          container: canvasHost,
          onFps: (v) => (fps = v),
          reducedMotion: get(prefersReducedMotion),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('renderer init timed out')), 12000)
        ),
      ]);
    } catch (err) {
      errorMessage.set(tn('app.rendererFailed', { message: (err as Error).message }));
    }
    // Follow OS reduce-motion changes mid-session.
    reducedMotionOff = prefersReducedMotion.subscribe((v) => stage?.setReducedMotion(v));

    transport = usingMock ? new MockRgsClient({ params, startingBalance: 1000 }) : new RgsClient({ params });
    player = new BookPlayer({ transport });

    if (params.currency) currency.set(params.currency);

    await authenticate();
  });

  onDestroy(() => {
    reducedMotionOff?.();
    stopSession();
    stage?.destroy();
    sound.dispose();
  });

  /** Authenticate the session and seed the wallet stores. */
  async function authenticate(): Promise<void> {
    if (!transport) return;
    loading = true;
    loadingMessage = usingMock ? tn('app.startingDemo') : tn('app.authenticating');
    try {
      const auth = await transport.authenticate();
      balance.set(auth.balance.amount);
      currency.set(auth.balance.currency);
      startSession(auth.balance.amount); // begin responsible-gaming session tracking
      loading = false;
      // Resume an unfinished round instead of starting a new one (RGS contract).
      if (player && auth.round && auth.round.book && auth.round.state !== 'resolved') {
        try {
          await player.resume(auth.round, getCurrentBet());
        } catch (err) {
          handleSpinError(err);
        }
      }
    } catch (err) {
      const message = err instanceof RgsError ? err.message : tn('error.connect');
      errorMessage.set(message);
      loading = false;
    }
  }

  /** Run a single round in the given mode. */
  async function spin(mode: string): Promise<void> {
    if (!player || get(isSpinning)) return;
    announce(tn('a11y.spinStart'));
    try {
      await player.play(getCurrentBet(), mode);
      announceOutcome();
    } catch (err) {
      handleSpinError(err);
    }
  }

  /** Mirror the round result into the ARIA live region for screen readers. */
  function announceOutcome(): void {
    const result = get(lastResult);
    if (!result) return;
    const amount = formatCurrency(result.win, get(currency), get(localeTag));
    if (result.wincap) announce(tn('a11y.wincap', { amount }));
    else if (result.triggeredFeature) announce(tn('a11y.featureTriggered', { amount }));
    else if (result.win > 0) announce(tn('a11y.win', { amount }));
    else announce(tn('a11y.noWin'));
  }

  /** Convert spin errors into UI toasts and stop autoplay. */
  function handleSpinError(err: unknown): void {
    stopAutoplay();
    const message =
      err instanceof RgsError ? err.message : ((err as Error)?.message ?? tn('error.spinFailed'));
    errorMessage.set(message);
  }

  function onSpin(): void {
    void spin('base');
  }

  /** Space/Enter triggers a spin when no interactive control owns the focus. */
  function onGlobalKeydown(event: KeyboardEvent): void {
    if (loading) return;
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A' || target?.isContentEditable)
      return;
    if (event.code === 'Space' || event.key === 'Enter') {
      event.preventDefault();
      onSpin();
    }
  }

  function onBuyBonus(): void {
    if (buyBonusMode) void spin(buyBonusMode.name);
  }

  /* ------------------------------- autoplay ------------------------------- */

  function startAutoplay(event: CustomEvent<{ count: number }>): void {
    autoplay.set({ active: true, remaining: event.detail.count, stopOnFeature: true });
    autoplayToken++;
    void runAutoplay(autoplayToken);
  }

  function stopAutoplay(): void {
    autoplayToken++;
    autoplay.set({ active: false, remaining: 0, stopOnFeature: true });
  }

  /** Drive sequential autoplay spins until the count is exhausted or stopped. */
  async function runAutoplay(token: number): Promise<void> {
    while (token === autoplayToken && get(autoplay).active && get(autoplay).remaining > 0) {
      if (get(insufficientFunds)) {
        errorMessage.set(tn('error.autoplayInsufficient'));
        break;
      }
      await spin('base');
      if (token !== autoplayToken) return;
      autoplay.update((a) => ({ ...a, remaining: a.remaining - 1 }));
      const result = get(lastResult);
      if (get(autoplay).stopOnFeature && result?.triggeredFeature) break;
      await delay(450);
    }
    if (token === autoplayToken) stopAutoplay();
  }

  function delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** Lightweight synchronous store read helper. */
  function get<T>(store: { subscribe: (cb: (v: T) => void) => () => void }): T {
    let value!: T;
    const unsub = store.subscribe((v) => (value = v));
    unsub();
    return value;
  }

  function dismissError(): void {
    errorMessage.set(null);
  }
</script>

<svelte:window on:keydown={onGlobalKeydown} />

<div class="game-root">
  <div class="canvas-host" bind:this={canvasHost}></div>

  <!-- Polite live region: mirrors canvas-only outcomes to screen readers. -->
  <div class="sr-only" aria-live="polite" aria-atomic="true">{$announcement}</div>

  {#if !loading}
    <!-- Top HUD -->
    <header class="hud-top">
      <BalanceDisplay />
      <div class="top-center">
        <FreeSpinsBanner />
      </div>
      <div class="top-right">
        <SoundToggle />
        <button class="icon-btn" aria-label={$t('paytable.open')} on:click={() => (paytableOpen = true)}>
          i
        </button>
      </div>
    </header>

    <div class="win-zone">
      <WinDisplay />
    </div>

    <!-- Bottom control bar -->
    <footer class="hud-bottom">
      <div class="left-controls">
        <BetSelector />
        {#if $gameMode === 'base'}
          <BuyBonusButton on:buy={onBuyBonus} />
        {/if}
      </div>
      <div class="center-controls">
        <SpinButton on:spin={onSpin} />
      </div>
      <div class="right-controls">
        <Autoplay on:start={startAutoplay} on:stop={stopAutoplay} />
      </div>
    </footer>

    {#if usingMock}
      <div class="dev-badge" title={$t('hud.demoTitle')}>
        {$t('hud.demoBadge', { fps: fps.toFixed(0) })}
      </div>
    {/if}
  {/if}

  {#if loading}
    <LoadingScreen message={loadingMessage} />
  {/if}

  {#if $errorMessage}
    <div class="toast panel" role="alert">
      <span>{$errorMessage}</span>
      <button class="toast-close" on:click={dismissError} aria-label={$t('common.dismiss')}>✕</button>
    </div>
  {/if}

  <PaytableModal open={paytableOpen} on:close={() => (paytableOpen = false)} />
  <RealityCheck />
</div>

<style>
  .game-root {
    position: relative;
    width: 100%;
    height: 100%;
  }
  .canvas-host {
    position: absolute;
    inset: 0;
  }
  .canvas-host :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
  .hud-top {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: env(safe-area-inset-top, 0.6rem) 0.8rem 0.6rem;
    gap: 0.6rem;
    pointer-events: none;
  }
  .hud-top > * {
    pointer-events: auto;
  }
  .top-center {
    flex: 1;
    display: flex;
    justify-content: center;
  }
  .top-right {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .icon-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid rgba(125, 249, 255, 0.35);
    background: rgba(12, 6, 34, 0.6);
    font-weight: 800;
    font-style: italic;
    font-size: 1.1rem;
    color: var(--neon-cyan);
  }
  .win-zone {
    position: absolute;
    top: 18%;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }
  .hud-bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    padding: 0.8rem 1rem calc(env(safe-area-inset-bottom, 0.6rem) + 0.8rem);
  }
  .left-controls,
  .right-controls {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    flex: 1;
  }
  .right-controls {
    justify-content: flex-end;
  }
  .center-controls {
    flex: 0 0 auto;
  }
  .dev-badge {
    position: absolute;
    top: 50%;
    right: 0.6rem;
    transform: translateY(-50%) rotate(90deg);
    transform-origin: right center;
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    color: var(--text-dim);
    opacity: 0.6;
    pointer-events: none;
  }
  .toast {
    position: absolute;
    top: 4.5rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.7rem 1rem;
    border-color: var(--danger);
    color: var(--text);
    max-width: 90vw;
    z-index: 90;
    animation: fadeIn 0.2s ease;
  }
  .toast-close {
    color: var(--danger);
    font-weight: 800;
  }

  @media (orientation: portrait) {
    .hud-bottom {
      flex-wrap: wrap;
      justify-content: center;
    }
    .left-controls,
    .right-controls {
      flex: 1 1 40%;
    }
    .center-controls {
      order: -1;
      flex: 1 1 100%;
      display: flex;
      justify-content: center;
    }
  }
</style>
