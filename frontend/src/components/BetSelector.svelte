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
  function max(): void {
    sound.play('buttonClick');
    betLevelIndex.set(betLevels.length - 1);
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
    <button class="max" aria-label={$t('bet.max')} on:click={max} disabled={atMax || $isSpinning}>
      {$t('bet.maxShort')}
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
  .max {
    height: 30px;
    padding: 0 0.55rem;
    border-radius: 15px;
    border: 1px solid rgba(125, 249, 255, 0.5);
    background: rgba(125, 249, 255, 0.08);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--neon-cyan);
  }
  .max:not(:disabled):active {
    transform: scale(0.94);
  }
  .value {
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--neon-gold);
    min-width: 84px;
    text-align: center;
  }

  /* Narrow phones: compact the stepper so the bet + buy row fits the width. */
  @media (max-width: 380px) {
    .bet {
      padding: 0.35rem 0.55rem;
    }
    .stepper {
      gap: 0.35rem;
    }
    .step {
      width: 28px;
      height: 28px;
    }
    .value {
      font-size: 0.95rem;
      min-width: 58px;
    }
  }

  /* The +/− stepper still reaches every level; below tablet width the Max
     shortcut costs more room than it's worth in the bottom dock. */
  @media (max-width: 519px) {
    .max {
      display: none;
    }
  }
</style>
