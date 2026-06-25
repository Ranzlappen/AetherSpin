/**
 * QA replay viewer support. With `?replay=base` (or `?replay=bonus`) the client
 * deterministically serves the committed golden-book corpus
 * (shared/fixtures/books) one book per spin, so auditors, support, and streamers
 * can reproduce any reference outcome — including the free-spin feature — without
 * a backend. The corpus is loaded lazily (dynamic import), so it never ships in
 * the normal production bundle.
 */
import type { Book } from '../../../shared/src/types/events';
import { writable, type Writable } from 'svelte/store';

/** Replay-mode status for the HUD badge (null when not in replay mode). */
export interface ReplayStatus {
  mode: 'base' | 'bonus';
  /** 1-based index of the book most recently served. */
  index: number;
  total: number;
}

export const replayStatus: Writable<ReplayStatus | null> = writable(null);

// Lazy (non-eager) so each fixture is a separate on-demand chunk, not bundled.
const corpusLoaders = import.meta.glob('../../../shared/fixtures/books/*.jsonl', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

function parseJsonl(text: string): Book[] {
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Book);
}

/** Resolve the `?replay=` value to a corpus mode (defaults to base). */
export function parseReplayMode(raw: string | null): 'base' | 'bonus' | null {
  if (raw === null) return null;
  return raw === 'bonus' ? 'bonus' : 'base';
}

/** Load the committed corpus for a game + mode (empty array if absent). */
export async function loadReplayBooks(game: string, mode: 'base' | 'bonus'): Promise<Book[]> {
  const suffix = `${game}_${mode}.jsonl`;
  const key = Object.keys(corpusLoaders).find((p) => p.endsWith(suffix));
  if (!key) return [];
  return parseJsonl(await corpusLoaders[key]());
}

/**
 * Build a {@link MockRgsClient} book provider that cycles a fixed book list and
 * publishes progress to {@link replayStatus}.
 */
export function makeReplayProvider(books: Book[], mode: 'base' | 'bonus'): (b: boolean, id: number) => Book {
  let i = 0;
  replayStatus.set({ mode, index: 0, total: books.length });
  return (): Book => {
    const book = books[i % books.length];
    replayStatus.set({ mode, index: (i % books.length) + 1, total: books.length });
    i += 1;
    return book;
  };
}
