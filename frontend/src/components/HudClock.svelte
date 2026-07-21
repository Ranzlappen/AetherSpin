<script lang="ts">
  /**
   * Always-visible local clock — a standard responsible-gaming affordance
   * (players should never lose track of time in a session). Locale-formatted,
   * updates on the minute.
   */
  import { onMount } from 'svelte';
  import { localeTag } from '../core/i18n';
  import { t } from '../core/i18n';

  let now = new Date();

  onMount(() => {
    const tick = (): void => {
      now = new Date();
    };
    // Align updates to the minute boundary so the display is never stale.
    let interval: ReturnType<typeof setInterval> | undefined;
    const align = setTimeout(
      () => {
        tick();
        interval = setInterval(tick, 60_000);
      },
      60_000 - (Date.now() % 60_000)
    );
    return () => {
      clearTimeout(align);
      if (interval) clearInterval(interval);
    };
  });

  $: label = new Intl.DateTimeFormat($localeTag, { hour: '2-digit', minute: '2-digit' }).format(now);
</script>

<time class="clock" datetime={now.toISOString()} aria-label={$t('hud.clock')}>{label}</time>

<style>
  .clock {
    display: inline-flex;
    align-items: center;
    height: 40px;
    padding: 0 0.7rem;
    border-radius: 10px;
    border: 1px solid rgba(125, 249, 255, 0.22);
    background: rgba(12, 6, 34, 0.6);
    color: var(--text-dim);
    font-size: 0.85rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.06em;
  }
</style>
