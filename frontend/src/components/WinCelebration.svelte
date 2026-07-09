<script lang="ts">
  /**
   * Full-screen tiered win celebration (BIG / MEGA / EPIC / MAX WIN). Pure DOM +
   * CSS (no Pixi, no assets required — the `data-tier` hook lets final art
   * restyle it later). Driven by the `activeCelebration` store; tap, click or
   * any key dismisses early. Presentation-only: dismissing never affects the
   * round outcome.
   */
  import { onMount } from 'svelte';
  import {
    activeCelebration,
    dismissCelebration,
    initCelebrations,
    CELEBRATION_DURATION_MS,
  } from '../core/celebration';
  import { currency } from '../core/gameState';
  import { formatCurrency } from '../config/gameConfig';
  import { assetUrl } from '../config/assets';
  import { t, localeTag } from '../core/i18n';
  import { prefersReducedMotion } from '../core/a11y';
  import type { WinTier } from '../core/eventBus';

  onMount(() => initCelebrations());

  const TITLE_KEYS = {
    big: 'win.big',
    mega: 'win.mega',
    epic: 'win.epic',
    wincap: 'win.wincap',
  } as const;

  function titleKey(tier: WinTier): (typeof TITLE_KEYS)[keyof typeof TITLE_KEYS] {
    return tier in TITLE_KEYS ? TITLE_KEYS[tier as keyof typeof TITLE_KEYS] : 'win.big';
  }

  /* Count the amount up over the first ~60% of the overlay's lifetime. */
  let displayed = 0;
  let raf = 0;
  $: startCountUp($activeCelebration?.amount ?? 0);

  function startCountUp(target: number): void {
    cancelAnimationFrame(raf);
    if (target <= 0) {
      displayed = 0;
      return;
    }
    if ($prefersReducedMotion) {
      displayed = target;
      return;
    }
    displayed = 0;
    const startTime = performance.now();
    const duration = CELEBRATION_DURATION_MS * 0.6;
    const tick = (now: number): void => {
      const p = Math.min(1, (now - startTime) / duration);
      displayed = target * (1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!$activeCelebration) return;
    event.preventDefault();
    dismissCelebration();
  }
</script>

<svelte:window on:keydown={$activeCelebration ? onKeydown : undefined} />

{#if $activeCelebration}
  <div
    class="celebration"
    data-tier={$activeCelebration.tier}
    role="alertdialog"
    aria-modal="false"
    aria-label={$t(titleKey($activeCelebration.tier))}
  >
    <button class="hit-area" on:click={dismissCelebration} aria-label={$t('common.dismiss')}>
      <img class="burst" src={assetUrl('fx/win-plate.webp')} alt="" aria-hidden="true" />
      <div class="plate">
        <span class="title">{$t(titleKey($activeCelebration.tier))}</span>
        <span class="amount">{formatCurrency(displayed, $currency, $localeTag)}</span>
        <span class="hint">{$t('win.tapToContinue')}</span>
      </div>
    </button>
  </div>
{/if}

<style>
  .celebration {
    position: absolute;
    inset: 0;
    z-index: 70;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(ellipse at center, rgba(12, 6, 34, 0.55), rgba(2, 0, 10, 0.85));
    animation: fadeIn 0.25s ease;
  }
  .hit-area {
    all: unset;
    cursor: pointer;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }
  .burst {
    position: absolute;
    width: min(78vmin, 640px);
    height: auto;
    pointer-events: none;
    animation: burstIn 0.45s cubic-bezier(0.2, 1.4, 0.4, 1);
  }
  .plate {
    position: relative;
  }
  @keyframes burstIn {
    from {
      transform: scale(0.4) rotate(-14deg);
      opacity: 0;
    }
    to {
      transform: scale(1) rotate(0deg);
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .burst {
      animation: none;
    }
  }
  .plate {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    padding: 2rem 3rem;
    border-radius: 24px;
    border: 2px solid var(--neon-gold);
    background: rgba(12, 6, 34, 0.75);
    box-shadow:
      0 0 40px rgba(255, 200, 60, 0.45),
      inset 0 0 30px rgba(255, 200, 60, 0.12);
    animation: celebrationPop 0.35s cubic-bezier(0.2, 1.6, 0.4, 1);
  }
  .title {
    font-size: clamp(1.6rem, 6vw, 3rem);
    font-weight: 900;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--neon-gold);
    text-shadow:
      0 0 18px rgba(255, 200, 60, 0.8),
      0 0 40px rgba(255, 200, 60, 0.4);
  }
  .amount {
    font-size: clamp(1.4rem, 5vw, 2.4rem);
    font-weight: 900;
    color: var(--text);
    text-shadow: 0 0 14px var(--neon-cyan);
  }
  .hint {
    font-size: 0.7rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  /* Tier accents — swap for final art via the data-tier hook. */
  .celebration[data-tier='mega'] .plate {
    border-color: var(--neon-magenta);
    box-shadow:
      0 0 46px rgba(255, 69, 224, 0.5),
      inset 0 0 30px rgba(255, 69, 224, 0.12);
  }
  .celebration[data-tier='mega'] .title {
    color: var(--neon-magenta);
    text-shadow:
      0 0 18px rgba(255, 69, 224, 0.8),
      0 0 40px rgba(255, 69, 224, 0.4);
  }
  .celebration[data-tier='epic'] .plate,
  .celebration[data-tier='wincap'] .plate {
    border-color: var(--neon-cyan);
    box-shadow:
      0 0 52px rgba(125, 249, 255, 0.55),
      inset 0 0 34px rgba(125, 249, 255, 0.14);
  }
  .celebration[data-tier='epic'] .title,
  .celebration[data-tier='wincap'] .title {
    color: var(--neon-cyan);
    text-shadow:
      0 0 18px rgba(125, 249, 255, 0.85),
      0 0 44px rgba(125, 249, 255, 0.45);
  }

  @keyframes celebrationPop {
    from {
      transform: scale(0.7);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .celebration,
    .plate {
      animation: none;
    }
  }
</style>
