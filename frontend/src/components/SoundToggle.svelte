<script lang="ts">
  /** Toggles global mute via the sound manager and the `muted` store. */
  import { muted } from '../core/gameState';
  import { sound } from '../core/sound';
  import { t } from '../core/i18n';

  function toggle(): void {
    muted.update((m) => {
      const next = !m;
      sound.setMuted(next);
      return next;
    });
  }
</script>

<button class="sound-toggle" aria-label={$t('sound.toggle')} aria-pressed={$muted} on:click={toggle}>
  {$muted ? '🔇' : '🔊'}
</button>

<style>
  .sound-toggle {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid rgba(125, 249, 255, 0.35);
    background: rgba(12, 6, 34, 0.6);
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sound-toggle:active {
    transform: scale(0.92);
  }
</style>
