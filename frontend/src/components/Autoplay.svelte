<script lang="ts">
  /** Autoplay control: choose a count to start, or stop an active run. */
  import { autoplay, isSpinning, insufficientFunds } from '../core/gameState';
  import { t } from '../core/i18n';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ start: { count: number }; stop: void }>();
  const counts = [10, 25, 50, 100];
  let open = false;

  function start(count: number): void {
    open = false;
    dispatch('start', { count });
  }
  function stop(): void {
    dispatch('stop');
  }
</script>

<div class="autoplay">
  {#if $autoplay.active}
    <button class="btn stop" aria-label={$t('autoplay.stop')} on:click={stop}>
      {$t('autoplay.stopShort')}
      <span class="count">{$autoplay.remaining === Infinity ? '∞' : $autoplay.remaining}</span>
    </button>
  {:else}
    <button
      class="btn"
      aria-label={$t('autoplay.label')}
      aria-expanded={open}
      disabled={$isSpinning || $insufficientFunds}
      on:click={() => (open = !open)}>{$t('autoplay.auto')} ▾</button
    >
    {#if open}
      <div class="menu panel">
        {#each counts as c (c)}
          <button class="menu-item" on:click={() => start(c)}>{c}</button>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .autoplay {
    position: relative;
  }
  .stop {
    border-color: var(--danger);
    background: linear-gradient(180deg, rgba(255, 84, 112, 0.28), rgba(255, 84, 112, 0.06));
  }
  .count {
    font-weight: 800;
    color: var(--neon-gold);
  }
  .menu {
    position: absolute;
    bottom: calc(100% + 0.4rem);
    left: 0;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.3rem;
    padding: 0.4rem;
    z-index: 20;
  }
  .menu-item {
    padding: 0.4rem 0.8rem;
    border-radius: 8px;
    border: 1px solid rgba(125, 249, 255, 0.35);
    background: rgba(125, 249, 255, 0.08);
    font-weight: 700;
  }
  .menu-item:hover {
    background: rgba(125, 249, 255, 0.18);
  }
</style>
