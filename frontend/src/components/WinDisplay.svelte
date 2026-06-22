<script lang="ts">
  /** Animated count-up of the round win amount. */
  import { totalWin, currency } from '../core/gameState';
  import { formatCurrency } from '../config/gameConfig';
  import { onDestroy } from 'svelte';

  let displayed = 0;
  let raf = 0;
  let target = 0;

  function animateTo(value: number): void {
    target = value;
    cancelAnimationFrame(raf);
    if (value === 0) {
      displayed = 0;
      return;
    }
    const start = displayed;
    const startTime = performance.now();
    const duration = 700;
    const tick = (now: number): void => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      displayed = start + (target - start) * eased;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  $: animateTo($totalWin);

  onDestroy(() => cancelAnimationFrame(raf));
</script>

{#if $totalWin > 0}
  <div class="win panel" role="status">
    <span class="label">Win</span>
    <span class="value neon-text">{formatCurrency(displayed, $currency)}</span>
  </div>
{/if}

<style>
  .win {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.4rem 1.2rem;
    border-color: var(--neon-gold);
    animation: fadeIn 0.25s ease;
  }
  .label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--neon-gold);
  }
  .value {
    font-size: 1.5rem;
    font-weight: 900;
    color: var(--neon-gold);
  }
</style>
