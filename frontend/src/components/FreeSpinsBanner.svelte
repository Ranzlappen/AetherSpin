<script lang="ts">
  /** Shows free-spins progress and the global multiplier ladder during the feature. */
  import { gameMode, freeSpins, currency } from '../core/gameState';
  import { ladderConfig, formatCurrency } from '../config/gameConfig';

  $: ladderSteps = Array.from(
    { length: ladderConfig.max },
    (_, i) => ladderConfig.start + i * ladderConfig.step
  );
</script>

{#if $gameMode === 'free'}
  <div class="banner panel" role="status">
    <div class="row">
      <span class="title neon-text">FREE SPINS</span>
      <span class="count">
        {$freeSpins.total - $freeSpins.remaining} / {$freeSpins.total}
      </span>
    </div>
    <div class="ladder">
      {#each ladderSteps as step (step)}
        <span class="rung" class:active={$freeSpins.globalMultiplier >= step}>
          x{step}
        </span>
      {/each}
    </div>
    <div class="accumulated">
      Won {formatCurrency($freeSpins.accumulated, $currency)}
    </div>
  </div>
{/if}

<style>
  .banner {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.6rem 1rem;
    border-color: var(--neon-magenta);
    animation: fadeIn 0.3s ease;
    min-width: 220px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .title {
    font-weight: 900;
    color: var(--neon-magenta);
    letter-spacing: 0.1em;
  }
  .count {
    font-weight: 800;
    color: var(--neon-cyan);
  }
  .ladder {
    display: flex;
    gap: 0.35rem;
  }
  .rung {
    flex: 1;
    text-align: center;
    padding: 0.2rem 0;
    border-radius: 8px;
    border: 1px solid rgba(125, 249, 255, 0.25);
    font-weight: 800;
    font-size: 0.85rem;
    color: var(--text-dim);
    transition: all 0.2s ease;
  }
  .rung.active {
    color: var(--neon-gold);
    border-color: var(--neon-gold);
    box-shadow: 0 0 10px rgba(255, 209, 102, 0.4);
  }
  .accumulated {
    font-size: 0.75rem;
    color: var(--text-dim);
    text-align: center;
  }
</style>
