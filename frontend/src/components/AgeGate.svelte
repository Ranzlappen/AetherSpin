<script lang="ts">
  /**
   * One-time age/legal acknowledgement, shown before play when a game opts in
   * via `responsibleGaming.requireAgeAck`. The player confirms they meet the
   * minimum age and accept the terms; the choice persists per game+version.
   * Modal + focus-trapped so play cannot start behind it. Informational only —
   * it never alters outcomes or balances. Off by default (operators usually
   * enforce KYC/age-gating upstream of the iframe).
   */
  import { t } from '../core/i18n';
  import { ageGateOpen, acknowledgeAge } from '../core/ageGate';
  import { ageRating, legalDisclaimer, helpUrl } from '../config/responsibleGaming';

  let accepted = false;

  function onAccept(): void {
    if (accepted) acknowledgeAge();
  }

  function focusOnMount(node: HTMLElement): void {
    node.focus();
  }
</script>

{#if $ageGateOpen}
  <div class="overlay" data-testid="age-gate">
    <div
      class="panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-title"
      aria-describedby="age-body"
    >
      <h2 id="age-title">{$t('ageGate.title')}</h2>
      <p id="age-body">{$t('ageGate.body', { age: ageRating || 18 })}</p>
      {#if legalDisclaimer}
        <p class="disclaimer">{legalDisclaimer}</p>
      {/if}
      <p class="disclaimer">{$t('rg.disclaimer')}</p>
      {#if helpUrl}
        <a class="help" href={helpUrl} target="_blank" rel="noopener noreferrer">{$t('rg.help')}</a>
      {/if}
      <label class="confirm">
        <input type="checkbox" bind:checked={accepted} use:focusOnMount />
        <span>{$t('ageGate.confirm', { age: ageRating || 18 })}</span>
      </label>
      <div class="actions">
        <button class="primary" disabled={!accepted} on:click={onAccept}>
          {$t('ageGate.enter')}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(4, 2, 16, 0.92);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 130;
    backdrop-filter: blur(4px);
  }
  .panel {
    max-width: min(92vw, 28rem);
    padding: 1.6rem 1.7rem;
    border-radius: 14px;
    border: 1px solid rgba(125, 249, 255, 0.35);
    background: rgba(12, 6, 34, 0.97);
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
  .disclaimer {
    margin-top: 0.6rem;
    font-size: 0.85rem;
    color: var(--text-dim);
  }
  .help {
    display: inline-block;
    margin-top: 0.5rem;
    color: var(--neon-magenta);
    text-decoration: underline;
  }
  .confirm {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    margin: 1.1rem 0 0;
    text-align: left;
    font-size: 0.95rem;
    cursor: pointer;
  }
  .confirm input {
    margin-top: 0.2rem;
  }
  .actions {
    display: flex;
    justify-content: center;
    margin-top: 1.3rem;
  }
  .actions button {
    padding: 0.6rem 1.4rem;
    border-radius: 10px;
    font-weight: 700;
  }
  .primary {
    background: var(--neon-magenta);
    color: #120016;
    border: none;
  }
  .primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
