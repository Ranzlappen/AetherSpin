<script lang="ts">
  /** The main spin button. Disabled while spinning or when funds are short. */
  import { isSpinning, insufficientFunds, autoplay } from '../core/gameState';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ spin: void }>();

  $: disabled = $isSpinning || $insufficientFunds || $autoplay.active;

  function onClick(): void {
    if (disabled) return;
    dispatch('spin');
  }
</script>

<button class="spin-btn" class:spinning={$isSpinning} {disabled} aria-label="Spin" on:click={onClick}>
  <div class="ring"></div>
  <span class="glyph">{$isSpinning ? '' : 'SPIN'}</span>
  {#if $insufficientFunds && !$isSpinning}
    <span class="hint">Low balance</span>
  {/if}
</button>

<style>
  .spin-btn {
    position: relative;
    width: 96px;
    height: 96px;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 35%, rgba(255, 69, 224, 0.5), rgba(125, 249, 255, 0.12));
    border: 2px solid var(--neon-magenta);
    box-shadow:
      0 0 22px rgba(255, 69, 224, 0.5),
      inset 0 0 18px rgba(125, 249, 255, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .spin-btn:not(:disabled):active {
    transform: scale(0.95);
  }
  .ring {
    position: absolute;
    inset: 8px;
    border-radius: 50%;
    border: 3px solid transparent;
    border-top-color: var(--neon-cyan);
    border-right-color: var(--neon-cyan);
    opacity: 0;
  }
  .spinning .ring {
    opacity: 1;
    animation: spin 0.8s linear infinite;
  }
  .glyph {
    font-weight: 900;
    font-size: 1.25rem;
    letter-spacing: 0.1em;
    color: var(--text);
    text-shadow: 0 0 8px var(--neon-cyan);
  }
  .hint {
    position: absolute;
    bottom: -1.4rem;
    font-size: 0.6rem;
    color: var(--danger);
    white-space: nowrap;
  }
</style>
