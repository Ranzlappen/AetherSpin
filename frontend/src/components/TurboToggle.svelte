<script lang="ts">
  /** Toggles turbo (quick-spin) mode: shorter reel stagger and win presentation. */
  import { turbo } from '../core/gameState';
  import { t } from '../core/i18n';

  function toggle(): void {
    turbo.update((on) => !on);
  }
</script>

<button
  class="turbo-toggle"
  class:on={$turbo}
  aria-label={$t('turbo.label')}
  aria-pressed={$turbo}
  title={$turbo ? $t('turbo.on') : $t('turbo.off')}
  on:click={toggle}
>
  ⚡
</button>

<style>
  .turbo-toggle {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid rgba(125, 249, 255, 0.35);
    background: rgba(12, 6, 34, 0.6);
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: grayscale(1);
    opacity: 0.75;
  }
  .turbo-toggle.on {
    filter: none;
    opacity: 1;
    border-color: var(--neon-gold);
    box-shadow: 0 0 10px rgba(255, 200, 60, 0.5);
  }
  .turbo-toggle:active {
    transform: scale(0.92);
  }
</style>
