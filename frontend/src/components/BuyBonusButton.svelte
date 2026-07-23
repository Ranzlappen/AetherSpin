<script lang="ts">
  /** Buys the bonus (free-spins) mode for the configured cost multiplier. */
  import { buyBonusMode, gameDefinition } from '../config/gameConfig';
  import { assetUrl } from '../config/assets';
  import { currentBet, balance, isSpinning, gameMode, currency } from '../core/gameState';
  import { formatCurrency } from '../config/gameConfig';
  import { t, localeTag } from '../core/i18n';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ buy: void }>();
  const costMultiplier = buyBonusMode?.cost ?? 100;

  // Feature summary straight from the definition — never hard-coded numbers.
  const fsAwards = Object.values(gameDefinition.features.freeSpins.awards);
  const minSpins = Math.min(...fsAwards);
  const maxSpins = Math.max(...fsAwards);
  const ladderMax = gameDefinition.features.freeSpins.multiplierLadder.max;

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
        <img class="card" src={assetUrl('fx/freespins-card.webp')} alt="" aria-hidden="true" />
        <h3>{$t('buyBonus.confirmTitle')}</h3>
        <ul class="features">
          <li>{$t('buyBonus.featSpins', { min: minSpins, max: maxSpins })}</li>
          <li>{$t('buyBonus.featLadder', { max: ladderMax })}</li>
          <li>{$t('buyBonus.featWilds')}</li>
        </ul>
        <p class="cost-line">
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
    white-space: nowrap;
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
    max-width: 380px;
    width: min(380px, 92vw);
    padding: 1.4rem;
    text-align: center;
    border-color: var(--neon-magenta);
    box-shadow: 0 0 42px rgba(255, 69, 224, 0.28);
  }
  .card {
    width: min(240px, 60vw);
    height: auto;
    margin: -0.4rem auto 0.2rem;
    display: block;
    filter: drop-shadow(0 6px 22px rgba(255, 69, 224, 0.35));
  }
  .dialog h3 {
    margin: 0 0 0.6rem;
    font-size: 1.25rem;
    color: var(--neon-magenta);
    text-shadow: 0 0 12px rgba(255, 69, 224, 0.6);
  }
  .features {
    list-style: none;
    margin: 0 0 0.6rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.88rem;
    color: var(--text);
  }
  .features li::before {
    content: '◆ ';
    color: var(--neon-cyan);
  }
  .cost-line {
    margin: 0.2rem 0 0;
    color: var(--text-dim);
    font-size: 0.85rem;
  }
  .actions {
    display: flex;
    gap: 0.8rem;
    justify-content: center;
    margin-top: 1rem;
  }

  /* Narrow phones: trim the buy button so the bet + buy row fits the width. */
  @media (max-width: 380px) {
    .buy {
      padding: 0.4rem 0.6rem;
    }
    .title {
      font-size: 0.72rem;
    }
    .price {
      font-size: 0.85rem;
    }
  }
</style>
