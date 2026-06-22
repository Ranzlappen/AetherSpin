<script lang="ts">
  /** Full-screen loading / boot splash with a neon spinner. */
  export let message = 'Initializing NovaForged…';
</script>

<div class="loading">
  <div class="logo neon-text">NOVAFORGED</div>
  <div class="spinner"></div>
  <div class="message">{message}</div>
</div>

<style>
  .loading {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.4rem;
    background: radial-gradient(circle at 50% 40%, rgba(125, 43, 255, 0.25), transparent 60%), var(--bg);
    z-index: 100;
  }
  .logo {
    font-size: clamp(1.8rem, 6vw, 3.4rem);
    font-weight: 900;
    letter-spacing: 0.3em;
    color: var(--neon-cyan);
  }
  .spinner {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 4px solid rgba(125, 249, 255, 0.18);
    border-top-color: var(--neon-magenta);
    animation: spin 0.9s linear infinite;
  }
  .message {
    color: var(--text-dim);
    letter-spacing: 0.08em;
    font-size: 0.85rem;
  }
</style>
