<script lang="ts">
  /** Bet-level stepper bound to the definition's bet levels. */
  import { betLevelIndex, currentBetLabel, increaseBet, decreaseBet, isSpinning } from '../core/gameState';
  import { betLevels } from '../config/gameConfig';
  import { sound } from '../core/sound';
  import { t } from '../core/i18n';

  $: atMin = $betLevelIndex <= 0;
  $: atMax = $betLevelIndex >= betLevels.length - 1;

  function dec(): void {
    sound.play('buttonClick');
    decreaseBet();
  }
  function inc(): void {
    sound.play('buttonClick');
    increaseBet();
  }
</script>

<div class="bet panel">
  <span class="label">{$t('hud.bet')}</span>
  <div class="stepper">
    <button class="step" aria-label={$t('bet.decrease')} on:click={dec} disabled={atMin || $isSpinning}>
      −
    </button>
    <span class="value neon-text">{$currentBetLabel}</span>
    <button class="step" aria-label={$t('bet.increase')} on:click={inc} disabled={atMax || $isSpinning}>
      +
    </button>
  </div>
</div>

<style>
  .bet {
    display: flex;
    flex-direction: column;
    padding: 0.4rem 0.9rem;
  }
  .label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--text-dim);
  }
  .stepper {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .step {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px solid rgba(125, 249, 255, 0.5);
    font-size: 1.2rem;
    font-weight: 800;
    line-height: 1;
    background: rgba(125, 249, 255, 0.08);
  }
  .step:not(:disabled):active {
    transform: scale(0.92);
  }
  .value {
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--neon-gold);
    min-width: 84px;
    text-align: center;
  }
</style>
