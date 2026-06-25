// Bundle-size budget guard. Fails CI if the largest built JS chunk's gzipped
// size exceeds the budget, so a heavy dependency or accidental import can't
// silently bloat the client. Run after `pnpm --filter @aetherspin/frontend build`.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = resolve(root, 'frontend/dist/assets');

// Gzipped budget (KB) for the single largest JS chunk. Current main entry is
// ~134 KB gz; this leaves headroom while catching meaningful regressions.
const BUDGET_GZIP_KB = 165;

let jsFiles;
try {
  jsFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
} catch {
  console.error(`No build output at ${assetsDir}. Run the frontend build first.`);
  process.exit(1);
}
if (jsFiles.length === 0) {
  console.error('No JS chunks found in the build output.');
  process.exit(1);
}

let worst = { file: '', kb: 0 };
for (const file of jsFiles.sort()) {
  const kb = gzipSync(readFileSync(resolve(assetsDir, file))).length / 1024;
  if (kb > worst.kb) worst = { file, kb };
  console.log(`  ${file}  ${kb.toFixed(1)} KB gz`);
}

console.log(
  `\nLargest chunk: ${worst.file} — ${worst.kb.toFixed(1)} KB gz (budget ${BUDGET_GZIP_KB} KB).`
);
if (worst.kb > BUDGET_GZIP_KB) {
  console.error(
    `::error::Bundle over budget: ${worst.file} is ${worst.kb.toFixed(1)} KB gz > ${BUDGET_GZIP_KB} KB.`
  );
  process.exit(1);
}
console.log('Within budget.');
