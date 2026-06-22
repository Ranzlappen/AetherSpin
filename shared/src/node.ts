/**
 * @aetherspin/shared/node — Node-only helpers (use filesystem APIs).
 *
 * Do NOT import this from browser/frontend code. For the browser, import the
 * game definition JSON directly. These are for Node tooling, tests, scripts and
 * the mock RGS running under Node.
 */
export { loadGameDefinition, listGameIds } from './loadDefinition.js';
