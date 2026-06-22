/**
 * Application entry point. Mounts the root Svelte component into `#app`.
 */
import './styles/global.css';
import App from './components/App.svelte';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Mount target "#app" not found in index.html.');
}

const app = new App({ target });

export default app;
