<script lang="ts">
  /**
   * Top-level error boundary. A render/runtime error anywhere in the game now
   * shows a recoverable fallback (and reports to telemetry) instead of a blank
   * white screen — the production failure mode an unbounded crash produces.
   */
  import App from './App.svelte';
  import { track } from '../core/telemetry';

  function report(error: unknown): void {
    track({
      type: 'error',
      where: 'root',
      message: error instanceof Error ? error.message : String(error),
    });
  }

  function reload(): void {
    if (typeof window !== 'undefined') window.location.reload();
  }
</script>

<svelte:boundary onerror={report}>
  <App />

  {#snippet failed(error)}
    <div class="boundary-fallback" role="alert">
      <h1>Something went wrong</h1>
      <p>The game hit an unexpected error and had to stop.</p>
      <p class="detail">{error instanceof Error ? error.message : String(error)}</p>
      <button on:click={reload}>Reload game</button>
    </div>
  {/snippet}
</svelte:boundary>

<style>
  .boundary-fallback {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 2rem;
    text-align: center;
    background: var(--bg, #05010f);
    color: var(--text, #eaf6ff);
  }
  .boundary-fallback h1 {
    color: var(--neon-magenta, #ff45e0);
    margin: 0;
  }
  .detail {
    font-size: 0.8rem;
    color: var(--text-dim, #9bb0d6);
    max-width: 90vw;
    word-break: break-word;
  }
  .boundary-fallback button {
    margin-top: 0.8rem;
    padding: 0.6rem 1.4rem;
    border-radius: 10px;
    border: 1px solid var(--neon-cyan, #7df9ff);
    background: transparent;
    color: var(--neon-cyan, #7df9ff);
    font-weight: 700;
    cursor: pointer;
  }
</style>
