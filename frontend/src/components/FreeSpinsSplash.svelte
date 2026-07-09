<script lang="ts">
  /**
   * Full-screen free-spins intro splash: the "FREE SPINS" card art with the
   * awarded spin count. Shown while playback holds on the feature transition;
   * tap/click/key dismisses early. Presentation-only.
   */
  import { onMount } from 'svelte';
  import { activeSplash, dismissSplash, initFreeSpinsSplash } from '../core/freespinsSplash';
  import { assetUrl } from '../config/assets';
  import { t } from '../core/i18n';

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
      <img class="card" src={assetUrl('fx/freespins-card.webp')} alt="" aria-hidden="true" />
      <span class="count">{$t('freeSpins.awarded', { count: $activeSplash.awarded })}</span>
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
    .card {
      animation: none;
    }
  }
</style>
