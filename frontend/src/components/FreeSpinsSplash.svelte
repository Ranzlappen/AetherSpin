<script lang="ts">
  /**
   * Full-screen free-spins splash: the "FREE SPINS" card art with the awarded
   * spin count on the feature intro, or the accumulated TOTAL WIN when the
   * feature ends. Shown while playback holds on the feature transition;
   * tap/click/key dismisses early. Presentation-only.
   */
  import { onMount } from 'svelte';
  import { activeSplash, dismissSplash, initFreeSpinsSplash } from '../core/freespinsSplash';
  import { assetUrl } from '../config/assets';
  import { currency } from '../core/gameState';
  import { formatCurrency } from '../config/gameConfig';
  import { t, localeTag } from '../core/i18n';

  onMount(() => initFreeSpinsSplash());

  function onKeydown(event: KeyboardEvent): void {
    if (!$activeSplash) return;
    event.preventDefault();
    dismissSplash();
  }
</script>

<svelte:window on:keydown={$activeSplash ? onKeydown : undefined} />

{#if $activeSplash}
  <div class="splash" role="alertdialog" aria-modal="false" aria-label={$t('hud.freeSpins')}>
    <button class="hit-area" on:click={dismissSplash} aria-label={$t('common.dismiss')}>
      {#if 'awarded' in $activeSplash}
        <img class="card" src={assetUrl('fx/freespins-card.webp')} alt="" aria-hidden="true" />
        <span class="count">{$t('freeSpins.awarded', { count: $activeSplash.awarded })}</span>
      {:else}
        <span class="summary-label">{$t('freeSpins.totalWin')}</span>
        <span class="summary-amount">
          {formatCurrency($activeSplash.totalWin, $currency, $localeTag)}
        </span>
      {/if}
    </button>
  </div>
{/if}

<style>
  .splash {
    position: absolute;
    inset: 0;
    z-index: 70;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(2, 0, 10, 0.72);
    animation: fadeIn 0.2s ease;
  }
  .hit-area {
    all: unset;
    cursor: pointer;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    width: 100%;
    height: 100%;
  }
  .card {
    width: min(88vmin, 720px);
    height: auto;
    animation: splashPop 0.35s cubic-bezier(0.2, 1.5, 0.4, 1);
  }
  .count {
    font-size: clamp(1.1rem, 4vw, 1.8rem);
    font-weight: 900;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--neon-gold);
    text-shadow: 0 0 16px rgba(255, 200, 60, 0.7);
  }
  .summary-label {
    font-size: clamp(1.2rem, 5vw, 2.2rem);
    font-weight: 900;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--neon-magenta);
    text-shadow: 0 0 20px rgba(255, 69, 224, 0.75);
    animation: splashPop 0.35s cubic-bezier(0.2, 1.5, 0.4, 1);
  }
  .summary-amount {
    font-size: clamp(2rem, 9vw, 4.4rem);
    font-weight: 900;
    color: var(--neon-gold);
    text-shadow:
      0 0 18px rgba(255, 209, 102, 0.85),
      0 0 46px rgba(255, 209, 102, 0.45);
    animation: splashPop 0.45s cubic-bezier(0.2, 1.5, 0.4, 1);
  }
  @keyframes splashPop {
    from {
      transform: scale(0.6);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .splash,
    .card,
    .summary-label,
    .summary-amount {
      animation: none;
    }
  }
</style>
