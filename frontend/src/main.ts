/**
 * Application entry point. Mounts the root Svelte component into `#app`.
 */
import './styles/global.css';
import { mount } from 'svelte';
import Root from './components/Root.svelte';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Mount target "#app" not found in index.html.');
}

// Svelte 5 mount API. The legacy `new App({ target })` class API leaves the
// root reactive effects orphaned in a production build (`effect_orphan`), which
// crashes the bundle on load — `mount()` establishes the proper effect root.
// Root wraps App in an error boundary so a crash degrades to a recoverable
// fallback instead of a blank screen.
const app = mount(Root, { target });

export default app;
