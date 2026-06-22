<script lang="ts">
  /** Shows the player's wallet balance, formatted via the currency derived store. */
  import { balanceLabel } from '../core/gameState';
</script>

<div class="balance panel">
  <span class="label">Balance</span>
  <span class="value neon-text">{$balanceLabel}</span>
</div>

<style>
  .balance {
    display: flex;
    flex-direction: column;
    padding: 0.4rem 0.9rem;
    min-width: 120px;
  }
  .label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--text-dim);
  }
  .value {
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--neon-cyan);
  }
</style>
