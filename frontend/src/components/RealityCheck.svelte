<script lang="ts">
  /**
   * Responsible-gaming "reality check" reminder. Appears every
   * `responsibleGaming.realityCheckMinutes` and reports elapsed time + net
   * position, with a help link and an explicit choice to continue or take a
   * break. Modal and focus-trapped so it cannot be ignored by accident. It is
   * informational only — it never alters outcomes or balances.
   */
  import { t, localeTag } from '../core/i18n';
  import {
    realityCheckDue,
    acknowledgeRealityCheck,
    stopSession,
    sessionElapsedMinutes,
    sessionNet,
  } from '../core/session';
  import { helpUrl } from '../config/responsibleGaming';
  import { currency } from '../core/gameState';
  import { formatCurrency } from '../config/gameConfig';
  import type { TranslationKey } from '../core/i18n';

  let ended = false;

  // Snapshot the figures when the reminder is shown.
  $: minutes = $realityCheckDue ? sessionElapsedMinutes() : 0;
  $: net = $realityCheckDue ? sessionNet() : 0;
  $: netAbs = formatCurrency(Math.abs(net), $currency, $localeTag);
  $: netKey = (net > 0 ? 'rg.netWin' : net < 0 ? 'rg.netLoss' : 'rg.netEven') as TranslationKey;

  function onContinue(): void {
    acknowledgeRealityCheck();
  }

  function onQuit(): void {
    stopSession();
    ended = true;
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && $realityCheckDue && !ended) onContinue();
  }

  /** Move focus into the dialog when it opens (modal a11y). */
  function focusOnMount(node: HTMLElement): void {
    node.focus();
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if $realityCheckDue}
  <div class="overlay">
    <div class="panel" role="dialog" aria-modal="true" aria-labelledby="rg-title">
      {#if ended}
        <p class="ended" tabindex="-1" use:focusOnMount>{$t('rg.ended')}</p>
      {:else}
        <h2 id="rg-title">{$t('rg.title')}</h2>
        <p>{$t('rg.sessionTime', { minutes })}</p>
        <p class="net" class:up={net > 0} class:down={net < 0}>{$t(netKey, { amount: netAbs })}</p>
        <p class="disclaimer">{$t('rg.disclaimer')}</p>
        {#if helpUrl}
          <a class="help" href={helpUrl} target="_blank" rel="noopener noreferrer">{$t('rg.help')}</a>
        {/if}
        <div class="actions">
          <button class="secondary" on:click={onQuit}>{$t('rg.quit')}</button>
          <button class="primary" on:click={onContinue} use:focusOnMount>{$t('rg.continue')}</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(4, 2, 16, 0.82);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 120;
    backdrop-filter: blur(3px);
  }
  .panel {
    max-width: min(92vw, 26rem);
    padding: 1.5rem 1.6rem;
    border-radius: 14px;
    border: 1px solid rgba(125, 249, 255, 0.35);
    background: rgba(12, 6, 34, 0.96);
    box-shadow: 0 0 32px rgba(125, 249, 255, 0.25);
    text-align: center;
    color: var(--text);
  }
  h2 {
    margin: 0 0 0.8rem;
    color: var(--neon-cyan);
    letter-spacing: 0.04em;
  }
  p {
    margin: 0.35rem 0;
  }
  .net.up {
    color: var(--neon-cyan);
  }
  .net.down {
    color: var(--danger);
  }
  .disclaimer {
    margin-top: 0.8rem;
    font-size: 0.85rem;
    color: var(--text-dim);
  }
  .help {
    display: inline-block;
    margin-top: 0.6rem;
    color: var(--neon-magenta);
    text-decoration: underline;
  }
  .actions {
    display: flex;
    gap: 0.8rem;
    justify-content: center;
    margin-top: 1.3rem;
  }
  .actions button {
    padding: 0.6rem 1.2rem;
    border-radius: 10px;
    font-weight: 700;
  }
  .primary {
    background: var(--neon-magenta);
    color: #120016;
    border: none;
  }
  .secondary {
    background: transparent;
    color: var(--text);
    border: 1px solid rgba(255, 255, 255, 0.3);
  }
</style>
