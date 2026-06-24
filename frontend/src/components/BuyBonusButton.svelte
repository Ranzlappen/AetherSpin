<script lang="ts">
  /** Buys the bonus (free-spins) mode for the configured cost multiplier. */
  import { buyBonusMode } from '../config/gameConfig';
  import { currentBet, balance, isSpinning, gameMode, currency } from '../core/gameState';
  import { formatCurrency } from '../config/gameConfig';
  import { t, localeTag } from '../core/i18n';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ buy: void }>();
  const costMultiplier = buyBonusMode?.cost ?? 100;

  let confirming = false;

  $: cost = $currentBet * costMultiplier;
  $: affordable = $balance >= cost;
  $: disabled = $isSpinning || !affordable || $gameMode === 'free';

  function request(): void {
    if (disabled) return;
    confirming = true;
  }
  function confirm(): void {
    confirming = false;
    dispatch('buy');
  }
</script>

{#if buyBonusMode}
  <button class="buy panel" {disabled} on:click={request}>
    <span class="title neon-text">{$t('buyBonus.label')}</span>
    <span class="price">{formatCurrency(cost, $currency, $localeTag)}</span>
  </button>

  {#if confirming}
    <div class="overlay" role="dialog" aria-modal="true">
      <div class="dialog panel">
        <h3>{$t('buyBonus.confirmTitle')}</h3>
        <p>
          {$t('buyBonus.confirmBody', {
            cost: formatCurrency(cost, $currency, $localeTag),
            multiplier: costMultiplier,
          })}
        </p>
        <div class="actions">
          <button class="btn" on:click={() => (confirming = false)}>{$t('common.cancel')}</button>
          <button class="btn btn-primary" on:click={confirm}>{$t('common.confirm')}</button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .buy {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.45rem 0.9rem;
    border-color: var(--neon-magenta);
    background: linear-gradient(180deg, rgba(255, 69, 224, 0.2), rgba(255, 69, 224, 0.05));
  }
  .title {
    font-weight: 800;
    font-size: 0.8rem;
    color: var(--neon-magenta);
  }
  .price {
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--neon-gold);
  }
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(2, 0, 10, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }
  .dialog {
    max-width: 340px;
    padding: 1.4rem;
    text-align: center;
    border-color: var(--neon-magenta);
  }
  .dialog h3 {
    margin: 0 0 0.6rem;
    color: var(--neon-magenta);
  }
  .actions {
    display: flex;
    gap: 0.8rem;
    justify-content: center;
    margin-top: 1rem;
  }
</style>
